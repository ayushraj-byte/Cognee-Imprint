#!/usr/bin/env node

/**
 * Imprint Stop Hook — runs after every Claude response.
 * Reads the conversation transcript, extracts memorable facts,
 * saves them to DynamoDB via the Imprint MCP tools.
 *
 * Called by the Stop hook in ~/.claude/settings.json
 * Receives the hook payload on stdin as JSON.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const REGION   = process.env.AWS_REGION || "us-east-1";
const TABLE    = process.env.DYNAMODB_MEMORIES_TABLE || "imprint-memories";
const USER_ID  = process.env.IMPRINT_USER_ID || "yashasvi-thakur-imprint";
const API_KEY  = process.env.ANTHROPIC_API_KEY;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
}));

// ── Read stdin (hook payload) ─────────────────────────────
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

// ── Extract memorable facts via Anthropic API ─────────────
async function extractFacts(transcript) {
  if (!API_KEY) return [];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: `You extract memorable personal facts from conversations.
Return ONLY a JSON array of objects like:
[{"content": "fact about the user", "topic": "work|personal|preferences|projects|health|relationships|general", "pinned": false}]
Only extract concrete, lasting facts about the USER (not the assistant).
Skip temporary task details. Return [] if nothing worth saving.`,
      messages: [{ role: "user", content: `Extract memorable facts from this conversation:\n\n${transcript}\n\nReturn ONLY valid JSON array, no explanation.` }],
    }),
  });

  if (!response.ok) return [];
  const data = await response.json();
  const text = data.content?.[0]?.text?.trim() || "[]";
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return [];
  }
}

// ── Load existing memories to avoid duplicates ────────────
async function loadExisting() {
  const result = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": `USER#${USER_ID}` },
    ScanIndexForward: false,
    Limit: 100,
  }));
  return (result.Items || []).map(i => i.content?.toLowerCase() || "");
}

// ── Save a single fact ────────────────────────────────────
async function saveFact({ content, topic = "general", pinned = false }) {
  const now = new Date().toISOString();
  const memoryId = randomUUID();
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `USER#${USER_ID}`,
      SK: `MEMORY#${now}#${memoryId}`,
      userId: USER_ID, memoryId, content, topic, pinned,
      createdAt: now, accessedAt: now,
      source: "stop-hook", confidence: 0.9,
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

    // Extract transcript from hook payload
    // Claude Code Stop hook sends: { session_id, transcript, ... }
    const transcript = payload?.transcript || payload?.conversation || "";
    if (!transcript || transcript.length < 100) return;

    // Only process the last ~2000 chars (recent exchange)
    const recent = transcript.slice(-2000);

    const facts = await extractFacts(recent);
    if (!facts.length) return;

    const existing = await loadExisting();

    let saved = 0;
    for (const fact of facts) {
      if (!fact.content) continue;
      // Skip if very similar to existing memory
      const lower = fact.content.toLowerCase();
      const isDupe = existing.some(e => e.includes(lower.slice(0, 30)));
      if (isDupe) continue;
      await saveFact(fact);
      saved++;
    }

    if (saved > 0) {
      // Signal to Claude Code that hook ran successfully
      process.stdout.write(JSON.stringify({ success: true, saved }));
    }
  } catch (e) {
    // Fail silently — never block Claude
    process.stderr.write(`[Imprint hook error] ${e.message}\n`);
  }
}

main();
