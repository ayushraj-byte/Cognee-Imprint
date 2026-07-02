#!/usr/bin/env node

/**
 * Imprint Stop Hook — smart memory extraction.
 * Uses Groq (free LLM) when available, falls back to regex.
 * Runs after every assistant response via Stop hook in ~/.claude/settings.json
 *
 * API-only: every save goes through the hosted Imprint API, so the client
 * needs NO AWS credentials. The API handles embeddings, de-duplication, and
 * real-time contradiction detection server-side.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const API_BASE = process.env.IMPRINT_API_BASE || "https://cognee-imprint.vercel.app";
const USER_ID  = process.env.IMPRINT_USER_ID;
const GROQ_KEY = process.env.GROQ_API_KEY;

const LAST_ACTIVITY_FILE = join(tmpdir(), `imprint-last-activity-${USER_ID}.json`);
const AFK_THRESHOLD_MS   = 30 * 60 * 1000; // 30 minutes

// ── API helpers ───────────────────────────────────────────
async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

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
const GROQ_SYSTEM = `You are a memory extraction system. From a conversation between a User and Assistant, extract durable facts worth remembering long-term — facts ABOUT THE USER.

Classify each fact into the SINGLE most accurate topic. Do NOT default everything to "projects" — most facts are not project facts.
- personal: name, location, background, life facts
- preferences: coding style, tools/frameworks they like or dislike, how they like to work
- work: job, role, company, team, what they're learning, their tech stack
- projects: the STATE of a specific, named software project the user is building (progress, a decision, next step, blocker). ALWAYS name the project in the sentence, e.g. "Imprint: deployed the dashboard to Vercel."
- health: health conditions, fitness, diet, sleep — e.g. "User has diabetes."
- relationships: friends, family, teammates, collaborators
- general: anything that fits none of the above

Rules:
- Choose the topic that describes the FACT itself, not the activity. A coding session still produces preferences / personal / health facts — tag those correctly, NOT as "projects".
- Only use "projects" when the fact is about a concrete named project's state. A general preference like "prefers tabs over spaces" is "preferences".
- Each fact = one complete standalone sentence, understandable with no context.
- Be selective: skip trivial step-by-step chatter; keep what actually matters next session. Max 6 facts.
- Return a JSON array ONLY: [{"content":"...","topic":"preferences","keywords":["x"],"confidence":0.9}]
- Use exactly one of these topics: work | personal | preferences | projects | health | relationships | general`;

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

// ── Fetch user's memory rules via the API ─────────────────
async function fetchUserRules() {
  try {
    const data = await apiGet(`/api/rules?userId=${encodeURIComponent(USER_ID)}`);
    return Array.isArray(data.rules) ? data.rules : null;
  } catch {
    return null;
  }
}

// ── Save a fact via the hosted API ────────────────────────
// The API embeds, de-duplicates, and runs contradiction detection server-side.
async function saveFact({ content, topic }) {
  await apiPost("/api/memories", {
    userId: USER_ID,
    content,
    topic: topic || "general",
    pinned: false,
    source: "stop-hook",
  });
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
    if (!USER_ID) {
      process.stderr.write("[Imprint hook] IMPRINT_USER_ID not set — skipping save.\n");
      return;
    }
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

    // Only save reasonably confident facts (Groq scores 0-1; regex defaults to 0.75).
    facts = facts.filter(f => (f.confidence || 0) >= 0.65);

    if (!facts.length) return;

    // The hosted API de-duplicates and runs contradiction detection on each save.
    for (const fact of facts) {
      await saveFact(fact);
    }
  } catch (e) {
    process.stderr.write(`[Imprint hook] ${e.message}\n`);
  }
}

main();
