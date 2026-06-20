#!/usr/bin/env node

/**
 * Imprint Stop Hook — smart memory extraction.
 * Uses Groq (free LLM) when available, falls back to regex.
 * Runs after every Claude response via Stop hook in ~/.claude/settings.json
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const DAILY_LIMIT  = 100; // max memories saved per day
const WEEKLY_LIMIT = 500; // max memories saved per 7-day rolling window
import { randomUUID } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const REGION   = process.env.AWS_REGION || "us-east-1";
const TABLE    = process.env.DYNAMODB_MEMORIES_TABLE || "imprint-memories";
const USER_ID  = process.env.IMPRINT_USER_ID || "yashasvi-thakur-imprint";
const GROQ_KEY = process.env.GROQ_API_KEY;

const LAST_ACTIVITY_FILE = join(tmpdir(), `imprint-last-activity-${USER_ID}.json`);
const AFK_THRESHOLD_MS   = 30 * 60 * 1000; // 30 minutes

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
}));

// ── Read stdin ────────────────────────────────────────────
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

// ── Parse raw transcript (JSONL or plain text) → clean dialogue ──
function parseTranscript(raw) {
  const lines = raw.trim().split("\n");
  const messages = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      // Claude Code JSONL format: {type:"user"|"assistant", message:{role,content}}
      const role = obj.type || obj.role || (obj.message?.role);
      const contentRaw = obj.message?.content ?? obj.content;

      if (!role || !["user","assistant","human"].includes(String(role).toLowerCase())) continue;

      let text = "";
      if (Array.isArray(contentRaw)) {
        // Content blocks — grab only text blocks, skip tool_use / tool_result
        text = contentRaw
          .filter(c => c.type === "text" && c.text)
          .map(c => c.text)
          .join(" ");
      } else if (typeof contentRaw === "string") {
        text = contentRaw;
      }

      text = text.trim();
      if (text.length < 5) continue;

      const label = String(role).toLowerCase().startsWith("a") ? "Assistant" : "User";
      messages.push(`${label}: ${text}`);
    } catch {
      // Not JSON — keep as plain text line if it looks like dialogue
      if (/^(user|assistant|human|claude)\s*:/i.test(line)) {
        messages.push(line.trim());
      }
    }
  }

  // Return last ~6000 chars of clean dialogue
  return messages.join("\n\n").slice(-6000);
}

// ── Groq extraction ───────────────────────────────────────
const GROQ_SYSTEM = `You are a memory extraction system. Given a conversation between a User and Assistant, extract facts worth remembering long-term.

Rules:
- Extract from BOTH user messages AND assistant messages
- PRIORITIZE progress/state facts over identity facts
- From assistant messages: extract what was built, fixed, deployed, decided, what's next
- From user messages: extract facts about the user's life, projects, preferences, goals
- Each fact must be a complete standalone sentence someone can understand with no context
- Max 8 facts total
- Return JSON array ONLY: [{"content":"...","topic":"projects","keywords":["x"],"confidence":0.9}]
- Topics: work|personal|preferences|projects|health|relationships|general

PRIORITIZE these types (in order):
1. "Completed: [specific thing done this session]"
2. "[Project] current state: [where it stands now]"
3. "Next up: [what needs to happen next]"
4. "Decided: [technical or product decision made]"
5. "Blocked on: [what is blocking progress]"
6. User identity facts (name, location, stack, preferences)`;

async function extractWithGroq(text) {
  if (!GROQ_KEY || GROQ_KEY === "gsk_YOUR_GROQ_KEY_HERE") return null;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: GROQ_SYSTEM },
        { role: "user", content: `Extract memories:\n\n${text.slice(0, 5000)}` },
      ],
      temperature: 0.1,
      max_tokens: 800,
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "";

  // Parse JSON from response (model might wrap it in markdown)
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return null;

  try {
    const arr = JSON.parse(jsonMatch[0]);
    return arr
      .filter(m => m.content && m.topic && m.content.length > 10)
      .map(m => ({
        content: String(m.content).trim(),
        topic: m.topic || "general",
        keywords: Array.isArray(m.keywords) ? m.keywords : m.content.toLowerCase().split(/\s+/).slice(0, 5),
        confidence: Number(m.confidence) || 0.85,
      }));
  } catch {
    return null;
  }
}

// ── Regex fallback ────────────────────────────────────────
const PATTERNS = [
  { re: /(?:my name is|i(?:'m| am) called)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi, topic: "personal",     tpl: m => `User's name is ${m[1]}` },
  { re: /(?:i(?:'m| am) (?:from|in|based in)|i live in)\s+([A-Za-z\s,]+?)(?:\.|,|$)/gi, topic: "personal", tpl: m => `User is from/in ${m[1].trim()}` },
  { re: /i(?:'m| am)(?: a| an)?\s+([\w\s]+?)\s+(?:at|for|in)\s+([\w\s]+?)(?:\.|,|$)/gi, topic: "work",    tpl: m => `User is a ${m[1].trim()} at ${m[2].trim()}` },
  { re: /(?:our|my) (?:team|company|startup)\s+(?:is called|is|called)\s+(.+?)(?:\.|,|$)/gi, topic: "work", tpl: m => `User's company: ${m[1].trim()}` },
  { re: /i (?:prefer|love|like|always use)\s+(.+?)(?:\.|,|$)/gi,                         topic: "preferences", tpl: m => `User prefers ${m[1].trim()}` },
  { re: /i (?:don'?t like|hate|avoid|dislike|never use)\s+(.+?)(?:\.|,|$)/gi,            topic: "preferences", tpl: m => `User dislikes ${m[1].trim()}` },
  { re: /i(?:'m| am) (?:building|working on|developing|creating|making)\s+(.+?)(?:\.|,|$)/gi, topic: "projects", tpl: m => `User is building ${m[1].trim()}` },
  { re: /(?:entering|participating in|submitting to)\s+(.+?hackathon.+?)(?:\.|,|$)/gi,   topic: "projects", tpl: m => `User is in ${m[1].trim()}` },
  { re: /(?:my|our) (?:app|project|product|tool)\s+(?:is called|is named|is)\s+(.+?)(?:\.|,|$)/gi, topic: "projects", tpl: m => `User's project: ${m[1].trim()}` },
  { re: /deadline (?:is|on|:)\s+(.+?)(?:\.|,|$)/gi,                                      topic: "projects", tpl: m => `Deadline: ${m[1].trim()}` },
  { re: /(?:using|our stack|tech stack(?:\s+is)?|built with|we use)\s+(.+?)(?:\.|,|$)/gi, topic: "work",   tpl: m => `Stack: ${m[1].trim()}` },
  { re: /i use\s+(React|Vue|Angular|Next\.?js|Node|Python|Java|Go|Rust|TypeScript|JavaScript|Flutter|Swift|Kotlin|Svelte|Django|FastAPI|Postgres|MongoDB|Redis|Docker)(?:\s|,|\.)/gi, topic: "preferences", tpl: m => `User uses ${m[1]}` },
  { re: /i(?:'m| am) (?:learning|studying|taking)\s+(.+?)(?:\.|,|$)/gi,                  topic: "work",    tpl: m => `User is learning ${m[1].trim()}` },
  { re: /my goal is (?:to\s+)?(.+?)(?:\.|,|$)/gi,                                        topic: "general",  tpl: m => `User's goal: ${m[1].trim()}` },
  // Progress & state patterns
  { re: /(?:next|next up|next step)[:\s]+(?:is\s+)?(?:to\s+)?(.{10,80})(?:\.|,|$)/gi,   topic: "projects", tpl: m => `Next up: ${m[1].trim()}` },
  { re: /(?:completed?|finished?|done with|just (?:built|added|fixed|shipped))\s+(.{8,80})(?:\.|,|$)/gi, topic: "projects", tpl: m => `Completed: ${m[1].trim()}` },
  { re: /(?:blocked?|stuck) on\s+(.{8,80})(?:\.|,|$)/gi,                                 topic: "projects", tpl: m => `Blocked on: ${m[1].trim()}` },
  { re: /(?:decided?|chose|going with|switching to)\s+(.{8,80})(?:instead|over|because|$)/gi, topic: "projects", tpl: m => `Decision: ${m[1].trim()}` },
  { re: /(?:todo|still need to|need to|have to|must)\s+(.{8,80})(?:\.|,|$)/gi,           topic: "projects", tpl: m => `TODO: ${m[1].trim()}` },
];

// Patterns that apply to ASSISTANT messages (progress extraction)
const ASSISTANT_PATTERNS = [
  { re: /✅\s*(?:saved|fixed|built|added|pushed|deployed|done)[:\s]+(.{8,100})(?:\.|$)/gi,  topic: "projects", tpl: m => `Completed: ${m[1].trim()}` },
  { re: /(?:i(?:'ve)?|we(?:'ve)?)\s+(?:fixed|built|added|pushed|deployed|updated|created|completed)\s+(.{8,100})(?:\.|,|$)/gi, topic: "projects", tpl: m => `Completed: ${m[1].trim()}` },
  { re: /(?:pushed?|committed?|deployed?)\s+(?:to|on)\s+(?:github|vercel|main|production)[^\n]*/gi, topic: "projects", tpl: m => `Deployed: ${m[0].trim().slice(0, 80)}` },
  { re: /next\s+(?:step|up|thing)[:\s]+(?:is\s+)?(.{10,100})(?:\.|,|$)/gi,                 topic: "projects", tpl: m => `Next up: ${m[1].trim()}` },
  { re: /(?:error|issue|problem|bug)\s+(?:was|is)\s+(.{8,80})(?:\.|,|$)/gi,                 topic: "projects", tpl: m => `Issue found: ${m[1].trim()}` },
  { re: /blocked?\s+(?:because|by|on)\s+(.{8,80})(?:\.|,|$)/gi,                             topic: "projects", tpl: m => `Blocked on: ${m[1].trim()}` },
];

function extractWithRegex(text) {
  const lines = text.split("\n");

  // Extract from user lines (facts about the user)
  const userText = lines.filter(l => /^(User|Human|you):/i.test(l)).join(" ");

  // Extract from assistant lines (progress, completions, next steps)
  const assistantText = lines.filter(l => /^(Assistant|Claude|A):/i.test(l)).join(" ");

  const facts = [];
  const seen = new Set();

  const addFact = (content, topic, confidence = 0.75) => {
    const key = content.toLowerCase().slice(0, 40);
    if (content.length < 12 || seen.has(key)) return;
    seen.add(key);
    facts.push({ content, topic, keywords: content.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 6), confidence });
  };

  // User patterns
  for (const { re, topic, tpl } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(userText)) !== null) addFact(tpl(m), topic);
  }

  // Assistant patterns (progress/state)
  for (const { re, topic, tpl } of ASSISTANT_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(assistantText)) !== null) addFact(tpl(m), topic, 0.8);
  }

  return facts;
}

// ── Check daily/weekly usage limits ──────────────────────
async function checkUsageLimits() {
  try {
    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [dayRes, weekRes] = await Promise.all([
      ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND SK BETWEEN :start AND :end",
        ExpressionAttributeValues: {
          ":pk":    `USER#${USER_ID}`,
          ":start": `MEMORY#${startOfDay.toISOString()}`,
          ":end":   `MEMORY#${now.toISOString()}`,
        },
        Select: "COUNT",
      })),
      ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND SK BETWEEN :start AND :end",
        ExpressionAttributeValues: {
          ":pk":    `USER#${USER_ID}`,
          ":start": `MEMORY#${sevenDaysAgo.toISOString()}`,
          ":end":   `MEMORY#${now.toISOString()}`,
        },
        Select: "COUNT",
      })),
    ]);

    const dailyCount  = dayRes.Count  || 0;
    const weeklyCount = weekRes.Count || 0;
    const dailyPct    = dailyCount  / DAILY_LIMIT;
    const weeklyPct   = weeklyCount / WEEKLY_LIMIT;

    return {
      dailyCount,  weeklyCount,
      dailyPct,    weeklyPct,
      nearDailyLimit:  dailyPct  >= 0.90,
      nearWeeklyLimit: weeklyPct >= 0.97,
      isNearLimit: dailyPct >= 0.90 || weeklyPct >= 0.97,
    };
  } catch {
    return { isNearLimit: false, nearDailyLimit: false, nearWeeklyLimit: false, dailyPct: 0, weeklyPct: 0 };
  }
}

// ── Fetch user's memory rules from DynamoDB ───────────────
async function fetchUserRules() {
  try {
    const result = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: `USER#${USER_ID}`, SK: "MEMORY_RULES" },
    }));
    return result.Item?.rules || null;
  } catch {
    return null;
  }
}

// ── Load existing to dedup ────────────────────────────────
async function loadExisting() {
  const result = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": `USER#${USER_ID}`, ":prefix": "MEMORY#" },
    ScanIndexForward: false,
    Limit: 100,
  }));
  return (result.Items || []).map(i => i.content?.toLowerCase().slice(0, 40) || "");
}

// ── Save a fact ───────────────────────────────────────────
async function saveFact({ content, topic, keywords, confidence }) {
  const now = new Date().toISOString();
  const memoryId = randomUUID();
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `USER#${USER_ID}`,
      SK: `MEMORY#${now}#${memoryId}`,
      userId: USER_ID, memoryId, content, topic,
      keywords: keywords || content.toLowerCase().split(/\s+/).slice(0, 5),
      confidence: confidence || 0.8,
      pinned: false,
      createdAt: now, accessedAt: now,
      source: "stop-hook",
      contradicts: [],
    },
  }));
}

// ── AFK session summary ───────────────────────────────────
function readLastActivity() {
  try {
    if (!existsSync(LAST_ACTIVITY_FILE)) return null;
    return JSON.parse(readFileSync(LAST_ACTIVITY_FILE, "utf8"));
  } catch { return null; }
}

function writeLastActivity(text) {
  try {
    writeFileSync(LAST_ACTIVITY_FILE, JSON.stringify({ ts: Date.now(), preview: text.slice(-300) }), "utf8");
  } catch {}
}

async function generateSessionSummary(text) {
  if (!GROQ_KEY || GROQ_KEY === "gsk_YOUR_GROQ_KEY_HERE") return null;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "Summarize this Claude session in 1-2 sentences. Focus on what was accomplished and what is next. Be concise." },
        { role: "user", content: text.slice(-3000) },
      ],
      temperature: 0.2,
      max_tokens: 150,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  try {
    const raw = await readStdin();
    if (!raw.trim()) return;

    let payload;
    try { payload = JSON.parse(raw); } catch { return; }

    // Claude Code passes transcript as a FILE PATH, not inline
    // Try transcript_path first, then fall back to inline fields
    let text = "";
    if (payload?.transcript_path) {
      try {
        text = readFileSync(payload.transcript_path, "utf8");
      } catch (e) {
        process.stderr.write(`[Imprint hook] Could not read transcript_path: ${e.message}\n`);
      }
    }
    // Fallback: inline transcript (older format or direct calls)
    if (!text) {
      const inline = payload?.transcript || payload?.conversation || payload?.messages || "";
      text = typeof inline === "string" ? inline : JSON.stringify(inline);
    }
    if (!text || text.length < 30) return;

    const now = Date.now();
    const lastActivity = readLastActivity();
    const isAfkReturn = lastActivity && (now - lastActivity.ts) >= AFK_THRESHOLD_MS;

    // Save session summary if user was AFK for 30+ minutes
    if (isAfkReturn) {
      const minutesAway = Math.round((now - lastActivity.ts) / 60000);
      const summary = await generateSessionSummary(text);
      if (summary) {
        await saveFact({
          content: `Session summary (after ${minutesAway}min break): ${summary}`,
          topic: "projects",
          keywords: ["session", "summary", "afk"],
          confidence: 0.9,
        });
      }
    }

    writeLastActivity(text);

    // Parse JSONL transcript → clean "User: ... \n\n Assistant: ..." dialogue
    const recent = parseTranscript(text);
    if (recent.length < 30) return;

    // Get user's Memory Rules to filter topics
    const userRules = await fetchUserRules();
    const enabledTopics = userRules
      ? new Set(userRules.filter(r => r.enabled).map(r => r.topic))
      : null; // null = all enabled

    // Try Groq first, fall back to regex
    let facts = await extractWithGroq(recent);
    if (!facts || facts.length === 0) {
      facts = extractWithRegex(recent);
    }

    // Filter by enabled topics
    if (enabledTopics) {
      facts = facts.filter(f => enabledTopics.has(f.topic));
    }

    // Check daily/weekly usage limits — save aggressively when close
    const usage = await checkUsageLimits();
    const minConfidence = usage.isNearLimit ? 0 : 0.65; // bypass filter near limits

    if (usage.isNearLimit) {
      const reason = usage.nearWeeklyLimit
        ? `weekly limit at ${Math.round(usage.weeklyPct * 100)}%`
        : `daily limit at ${Math.round(usage.dailyPct * 100)}%`;
      await saveFact({
        content: `[Imprint checkpoint] Saving all facts — ${reason}. ${new Date().toLocaleDateString()}.`,
        topic: "projects",
        keywords: ["checkpoint", "limit", "imprint"],
        confidence: 1,
      });
    }

    // Only save reasonably confident facts (Groq scores 0-1; regex defaults to 0.75)
    // Near limits: minConfidence=0 so everything is saved regardless
    facts = facts.filter(f => (f.confidence || 0) >= minConfidence);

    if (!facts.length) return;

    const existing = await loadExisting();
    for (const fact of facts) {
      const key = fact.content.toLowerCase().slice(0, 40);
      if (existing.includes(key)) continue;
      await saveFact(fact);
    }
  } catch (e) {
    process.stderr.write(`[Imprint hook] ${e.message}\n`);
  }
}

main();
