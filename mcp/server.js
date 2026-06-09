#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { z } from "zod";

const REGION  = process.env.AWS_REGION || "us-east-1";
const TABLE   = process.env.DYNAMODB_MEMORIES_TABLE || "imprint-memories";
const USER_ID = process.env.IMPRINT_USER_ID || "mcp-default-user";
const CACHE_TTL_MS = 60_000; // 60 seconds

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    // Keep connection alive — reduces TCP handshake on every call
    requestHandler: { requestTimeout: 3000, httpsAgent: { keepAlive: true } },
  })
);

// ── In-memory cache ───────────────────────────────────────
let cache = { items: null, ts: 0 };

function isCacheFresh() {
  return cache.items !== null && (Date.now() - cache.ts) < CACHE_TTL_MS;
}

function setCache(items) {
  cache = { items, ts: Date.now() };
}

function invalidateCache() {
  cache = { items: null, ts: 0 };
}

// ── DB helpers ────────────────────────────────────────────

async function fetchMemoriesFromDB(limit = 60) {
  const result = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": `USER#${USER_ID}`,
      ":prefix": "MEMORY#",          // only memory items, skip sessions/rules
    },
    ScanIndexForward: false,          // newest first
    Limit: limit,
  }));
  return (result.Items || []).map(clean);
}

async function fetchMemories(topic, limit = 60) {
  // Return from cache if fresh
  if (isCacheFresh()) {
    let items = cache.items;
    if (topic) items = items.filter(m => m.topic === topic);
    return items.slice(0, limit);
  }

  // Cache miss — fetch from DynamoDB
  const all = await fetchMemoriesFromDB(limit);
  setCache(all);

  if (topic) return all.filter(m => m.topic === topic);
  return all;
}

async function createMemory({ content, topic = "general", pinned = false }) {
  const now = new Date().toISOString();
  const memoryId = randomUUID();
  const item = {
    PK: `USER#${USER_ID}`,
    SK: `MEMORY#${now}#${memoryId}`,
    userId: USER_ID, memoryId, content, topic, pinned,
    createdAt: now, accessedAt: now,
    source: "claude-code", confidence: 1.0,
    keywords: content.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 6),
    contradicts: [],
    ...(!pinned ? { ttl: Math.floor(Date.now() / 1000) + 30 * 86400 } : {}),
  };
  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
  invalidateCache(); // bust cache so next get_memories is fresh
  return clean(item);
}

async function removeMemory(memoryId, createdAt) {
  await ddb.send(new DeleteCommand({
    TableName: TABLE,
    Key: { PK: `USER#${USER_ID}`, SK: `MEMORY#${createdAt}#${memoryId}` },
  }));
  invalidateCache();
}

async function pinMemory(memoryId, createdAt, pinned) {
  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `USER#${USER_ID}`, SK: `MEMORY#${createdAt}#${memoryId}` },
    UpdateExpression: "SET pinned = :p",
    ExpressionAttributeValues: { ":p": pinned },
  }));
  invalidateCache();
}

async function searchMemories(query) {
  const all = await fetchMemories(undefined, 100); // uses cache if warm
  const q = query.toLowerCase();
  return all.filter(m =>
    m.content.toLowerCase().includes(q) ||
    m.topic.toLowerCase().includes(q) ||
    (m.keywords || []).some(k => k.includes(q))
  );
}

function clean(item) {
  return {
    memoryId: item.memoryId,
    content: item.content,
    topic: item.topic,
    pinned: item.pinned,
    createdAt: item.createdAt,
    source: item.source,
    keywords: item.keywords || [],
  };
}

function format(memories) {
  if (!memories.length) return "No memories found.";
  const pinned = memories.filter(m => m.pinned);
  const rest   = memories.filter(m => !m.pinned);
  let out = "";
  if (pinned.length) {
    out += "📌 PINNED (always remember):\n";
    out += pinned.map(m => `  • [${m.topic}] ${m.content}`).join("\n") + "\n\n";
  }
  const byTopic = rest.reduce((a, m) => {
    (a[m.topic] = a[m.topic] || []).push(m);
    return a;
  }, {});
  for (const [t, ms] of Object.entries(byTopic)) {
    out += `${t.toUpperCase()}:\n`;
    out += ms.map(m => `  • ${m.content}`).join("\n") + "\n";
  }
  return out.trim();
}

// ── Pre-warm cache on startup ─────────────────────────────
// Fetch memories immediately so the first get_memories call is instant
fetchMemoriesFromDB(60).then(items => {
  setCache(items);
  console.error(`[Imprint MCP] Cache warmed — ${items.length} memories loaded`);
}).catch(e => {
  console.error(`[Imprint MCP] Cache warm failed: ${e.message}`);
});

// ── MCP Server ────────────────────────────────────────────

const server = new McpServer({ name: "imprint", version: "1.0.0" });

server.tool(
  "get_memories",
  "Retrieve stored memories about the user. Call at the start of every conversation.",
  {
    topic: z.enum(["work","personal","preferences","projects","health","relationships","general","all"]).optional(),
    limit: z.number().optional(),
  },
  async ({ topic, limit = 60 }) => {
    try {
      const memories = await fetchMemories(topic && topic !== "all" ? topic : undefined, limit);
      const pinCount = memories.filter(m => m.pinned).length;
      return {
        content: [{
          type: "text",
          text: `${memories.length} memories (${pinCount} pinned):\n\n${format(memories)}`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "save_memory",
  "Save a new fact about the user. Call whenever you learn something important.",
  {
    content: z.string().describe("The fact to remember."),
    topic: z.enum(["work","personal","preferences","projects","health","relationships","general"]),
    pinned: z.boolean().optional().describe("Pin to always inject into every session."),
  },
  async ({ content, topic, pinned = false }) => {
    try {
      const m = await createMemory({ content, topic, pinned });
      return { content: [{ type: "text", text: `✅ Saved: [${m.topic}] ${m.content}${pinned ? " 📌" : ""}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "search_memories",
  "Search memories by keyword. Use to find specific facts mid-conversation.",
  { query: z.string() },
  async ({ query }) => {
    try {
      const results = await searchMemories(query);
      if (!results.length) return { content: [{ type: "text", text: `No memories found for "${query}".` }] };
      return { content: [{ type: "text", text: `${results.length} results for "${query}":\n\n${format(results)}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "delete_memory",
  "Delete a memory. Use when the user asks you to forget something.",
  { memoryId: z.string(), createdAt: z.string() },
  async ({ memoryId, createdAt }) => {
    try {
      await removeMemory(memoryId, createdAt);
      return { content: [{ type: "text", text: "✅ Memory deleted." }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "pin_memory",
  "Pin or unpin a memory. Pinned memories are always injected into every session.",
  { memoryId: z.string(), createdAt: z.string(), pinned: z.boolean() },
  async ({ memoryId, createdAt, pinned }) => {
    try {
      await pinMemory(memoryId, createdAt, pinned);
      return { content: [{ type: "text", text: `✅ Memory ${pinned ? "📌 pinned" : "unpinned"}.` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[Imprint MCP] Running — table: ${TABLE} | user: ${USER_ID}`);
