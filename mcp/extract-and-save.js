#!/usr/bin/env node

/**
 * Imprint Stop Hook — smart memory extraction.
 * Uses Groq (free LLM) when available, falls back to regex.
 * Runs after every Claude response via Stop hook in ~/.claude/settings.json
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const REGION  = process.env.AWS_REGION || "us-east-1";
const TABLE   = process.env.DYNAMODB_MEMORIES_TABLE || "imprint-memories";
const USER_ID = process.env.IMPRINT_USER_ID || "yashasvi-thakur-imprint";
const GROQ_KEY = process.env.GROQ_API_KEY;

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

// ── Groq extraction ───────────────────────────────────────
const GROQ_SYSTEM = `You are a memory extraction system. Given a conversation, extract factual statements about the USER only.

Rules:
- Extract both EXPLICIT facts ("my name is X") and IMPLICIT facts ("my app keeps crashing" → user has an app)
- Only facts about: work, projects, preferences, personal life, health, relationships, goals, tech stack
- Each fact must be a complete standalone sentence
- Max 6 facts
- Return JSON array ONLY: [{"content":"...","topic":"projects","keywords":["x"],"confidence":0.9}]
- Topics: work|personal|preferences|projects|health|relationships|general`;

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
  { re: /my goal is (?:to\s+)?(.+?)(?:\.|,|$)/gi,                                        topic: "general", tpl: m => `User's goal: ${m[1].trim()}` },
];

function extractWithRegex(text) {
  const userLines = text.split("\n")
    .filter(l => /^(User|Human|you):/i.test(l))
    .join(" ");

  const facts = [];
  const seen = new Set();

  for (const { re, topic, tpl } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(userLines)) !== null) {
      const content = tpl(m);
      const key = content.toLowerCase().slice(0, 40);
      if (content.length < 12 || seen.has(key)) continue;
      seen.add(key);
      facts.push({ content, topic, keywords: content.toLowerCase().split(/\s+/).slice(0, 5), confidence: 0.75 });
    }
  }
  return facts;
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

// ── Main ──────────────────────────────────────────────────
async function main() {
  try {
    const raw = await readStdin();
    if (!raw.trim()) return;

    let payload;
    try { payload = JSON.parse(raw); } catch { return; }

    const transcript = payload?.transcript || payload?.conversation || payload?.messages || "";
    const text = typeof transcript === "string" ? transcript : JSON.stringify(transcript);
    if (!text || text.length < 30) return;

    const recent = text.slice(-4000);

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
