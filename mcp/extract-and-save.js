#!/usr/bin/env node

/**
 * Imprint Stop Hook — zero-cost memory extraction.
 * No API calls. Uses rule-based pattern matching to extract facts.
 * Runs after every Claude response via Stop hook in ~/.claude/settings.json
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const REGION  = process.env.AWS_REGION || "us-east-1";
const TABLE   = process.env.DYNAMODB_MEMORIES_TABLE || "imprint-memories";
const USER_ID = process.env.IMPRINT_USER_ID || "yashasvi-thakur-imprint";

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

// ── Rule-based extraction (free, no API) ──────────────────
const PATTERNS = [
  // Name
  { re: /(?:my name is|i(?:'m| am) called)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi, topic: "personal", tpl: m => `User's name is ${m[1]}` },
  // Location
  { re: /(?:i(?:'m| am) (?:from|in|based in)|i live in)\s+([A-Za-z\s,]+?)(?:\.|,|$)/gi, topic: "personal", tpl: m => `User is from/in ${m[1].trim()}` },
  // Job / role
  { re: /i(?:'m| am)(?: a| an)?\s+([\w\s]+?)\s+(?:at|for|in)\s+([\w\s]+?)(?:\.|,|$)/gi, topic: "work", tpl: m => `User is a ${m[1].trim()} at ${m[2].trim()}` },
  // Preference
  { re: /i (?:prefer|love|like|use|always use)\s+(.+?)(?:\.|,|$)/gi, topic: "preferences", tpl: m => `User prefers ${m[1].trim()}` },
  // Dislike
  { re: /i (?:don't like|hate|avoid|dislike)\s+(.+?)(?:\.|,|$)/gi, topic: "preferences", tpl: m => `User dislikes ${m[1].trim()}` },
  // Building / project
  { re: /i(?:'m| am) (?:building|working on|developing|creating)\s+(.+?)(?:\.|,|$)/gi, topic: "projects", tpl: m => `User is building ${m[1].trim()}` },
  // Hackathon
  { re: /(?:entering|participating in|submitting to)\s+(.+?hackathon.+?)(?:\.|,|$)/gi, topic: "projects", tpl: m => `User is participating in ${m[1].trim()}` },
  // Deadline
  { re: /deadline (?:is|on)\s+(.+?)(?:\.|,|$)/gi, topic: "projects", tpl: m => `Deadline: ${m[1].trim()}` },
  // Stack / tech
  { re: /(?:using|our stack is|tech stack(?:\s+is)?)\s+(.+?)(?:\.|,|$)/gi, topic: "work", tpl: m => `User's stack: ${m[1].trim()}` },
  // Language / framework mention with "I use"
  { re: /i use\s+(React|Vue|Angular|Next\.?js|Node|Python|Java|Go|Rust|TypeScript|JavaScript|Flutter|Swift|Kotlin)(?:\s|,|\.)/gi, topic: "preferences", tpl: m => `User uses ${m[1]}` },
];

function extractFacts(text) {
  // Only look at user messages (lines starting with "User:" or "Human:")
  const userLines = text
    .split("\n")
    .filter(l => /^(User|Human|you|yashasvi):/i.test(l))
    .join(" ");

  if (!userLines) return [];

  const facts = [];
  const seen = new Set();

  for (const { re, topic, tpl } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(userLines)) !== null) {
      const content = tpl(m);
      // Skip very short or duplicate facts
      if (content.length < 15 || seen.has(content.toLowerCase().slice(0, 40))) continue;
      seen.add(content.toLowerCase().slice(0, 40));
      facts.push({ content, topic, pinned: false });
    }
  }

  return facts;
}

// ── Load existing to dedup ────────────────────────────────
async function loadExisting() {
  const result = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": `USER#${USER_ID}` },
    ScanIndexForward: false,
    Limit: 100,
  }));
  return (result.Items || []).map(i => i.content?.toLowerCase().slice(0, 40) || "");
}

// ── Save a fact ───────────────────────────────────────────
async function saveFact({ content, topic, pinned }) {
  const now = new Date().toISOString();
  const memoryId = randomUUID();
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `USER#${USER_ID}`,
      SK: `MEMORY#${now}#${memoryId}`,
      userId: USER_ID, memoryId, content, topic, pinned,
      createdAt: now, accessedAt: now,
      source: "stop-hook", confidence: 0.85,
      keywords: content.toLowerCase().split(/\s+/).slice(0, 5),
      contradicts: [],
      ...(!pinned ? { ttl: Math.floor(Date.now() / 1000) + 30 * 86400 } : {}),
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

    const transcript = payload?.transcript || payload?.conversation || "";
    if (!transcript || transcript.length < 50) return;

    const recent = transcript.slice(-3000);
    const facts = extractFacts(recent);
    if (!facts.length) return;

    const existing = await loadExisting();
    let saved = 0;

    for (const fact of facts) {
      const key = fact.content.toLowerCase().slice(0, 40);
      if (existing.includes(key)) continue;
      await saveFact(fact);
      saved++;
    }
  } catch (e) {
    process.stderr.write(`[Imprint hook] ${e.message}\n`);
  }
}

main();
