#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = "https://imprint-ebon.vercel.app";
const USER_ID  = process.env.IMPRINT_USER_ID || "mcp-default-user";
const CACHE_TTL_MS = 60_000;

// ── In-memory cache ───────────────────────────────────────
let cache = { items: null, ts: 0 };

function isCacheFresh() {
  return cache.items !== null && (Date.now() - cache.ts) < CACHE_TTL_MS;
}
function setCache(items) { cache = { items, ts: Date.now() }; }
function invalidateCache() { cache = { items: null, ts: 0 }; }

// ── API helpers ───────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchMemories(topic, limit = 60) {
  if (isCacheFresh()) {
    let items = cache.items;
    if (topic) items = items.filter(m => m.topic === topic);
    return items.slice(0, limit);
  }
  const data = await apiFetch(`/api/memories?userId=${encodeURIComponent(USER_ID)}&limit=${limit}`);
  const all = data.memories || [];
  setCache(all);
  if (topic) return all.filter(m => m.topic === topic);
  return all;
}

// Semantic search: passes query to the API which embeds it and returns ranked results.
// Falls back to the ranked full list if the API doesn't support it.
async function fetchSemanticMemories(query, limit = 20) {
  const data = await apiFetch(
    `/api/memories?userId=${encodeURIComponent(USER_ID)}&semantic=${encodeURIComponent(query)}&limit=${limit}`
  );
  return data.memories || [];
}

async function createMemory({ content, topic = "general", pinned = false }) {
  const data = await apiFetch("/api/memories", {
    method: "POST",
    body: JSON.stringify({ userId: USER_ID, content, topic, pinned, source: process.env.IMPRINT_PLATFORM || "claude-code" }),
  });
  invalidateCache();
  return data.memory;
}

async function removeMemory(memoryId, createdAt) {
  await apiFetch(`/api/memories?userId=${encodeURIComponent(USER_ID)}&memoryId=${memoryId}&createdAt=${encodeURIComponent(createdAt)}`, {
    method: "DELETE",
  });
  invalidateCache();
}

async function togglePin(memoryId, createdAt, pinned) {
  await apiFetch("/api/memories", {
    method: "PATCH",
    body: JSON.stringify({ userId: USER_ID, memoryId, createdAt, pinned }),
  });
  invalidateCache();
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

// ── Pre-warm cache ────────────────────────────────────────
fetchMemories(undefined, 60).then(items => {
  console.error(`[Imprint MCP] Ready — ${items.length} memories loaded for user: ${USER_ID}`);
}).catch(e => {
  console.error(`[Imprint MCP] Cache warm failed: ${e.message}`);
});

// ── MCP Server ────────────────────────────────────────────

const server = new McpServer({ name: "imprint", version: "1.0.0" });

server.tool(
  "get_memories",
  "Retrieve stored memories about the user. Call at the start of every conversation. Optionally pass `query` to get the most relevant memories for the current task instead of everything.",
  {
    topic: z.enum(["work","personal","preferences","projects","health","relationships","general","all"]).optional(),
    limit: z.number().optional(),
    query: z.string().optional().describe("Current task or question — returns semantically relevant memories ranked by relevance. Omit to get all memories."),
  },
  async ({ topic, limit = 60, query }) => {
    try {
      let memories;
      if (query) {
        // Smart injection: only return memories relevant to the current task
        memories = await fetchSemanticMemories(query, Math.min(limit, 20));
      } else {
        memories = await fetchMemories(topic && topic !== "all" ? topic : undefined, limit);
      }
      const pinCount = memories.filter(m => m.pinned).length;
      const header = query
        ? `${memories.length} relevant memories for "${query}" (${pinCount} pinned):\n\n`
        : `${memories.length} memories (${pinCount} pinned):\n\n`;
      return {
        content: [{
          type: "text",
          text: header + format(memories),
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
      await createMemory({ content, topic, pinned });
      return { content: [{ type: "text", text: `✅ Saved: [${topic}] ${content}${pinned ? " 📌" : ""}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "search_memories",
  "Search memories using natural language — semantically ranked by relevance to your query.",
  { query: z.string().describe("Natural language query — e.g. 'what frameworks does the user prefer?'") },
  async ({ query }) => {
    try {
      const results = await fetchSemanticMemories(query, 10);
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
      await togglePin(memoryId, createdAt, pinned);
      return { content: [{ type: "text", text: `✅ Memory ${pinned ? "📌 pinned" : "unpinned"}.` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
