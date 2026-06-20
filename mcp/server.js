#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = "https://imprint-ebon.vercel.app";
const API_KEY  = process.env.IMPRINT_API_KEY;   // secure path (revocable)
const CACHE_TTL_MS = 60_000;

// Resolved at startup — either from env directly or via API key lookup
let USER_ID = process.env.IMPRINT_USER_ID || null;

// ── In-memory cache ───────────────────────────────────────
let cache = { items: null, ts: 0 };
function isCacheFresh() { return cache.items !== null && (Date.now() - cache.ts) < CACHE_TTL_MS; }
function setCache(items) { cache = { items, ts: Date.now() }; }
function invalidateCache() { cache = { items: null, ts: 0 }; }

// ── API helpers ───────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

function requireUserId() {
  if (!USER_ID) throw new Error(
    "Not authenticated. Set IMPRINT_API_KEY in your MCP config. " +
    "Get your key from https://imprint-ebon.vercel.app → Dashboard → Connect MCP."
  );
}

async function fetchMemories(topic, limit = 60) {
  requireUserId();
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

async function fetchSemanticMemories(query, limit = 20) {
  requireUserId();
  const data = await apiFetch(
    `/api/memories?userId=${encodeURIComponent(USER_ID)}&semantic=${encodeURIComponent(query)}&limit=${limit}`
  );
  return data.memories || [];
}

async function createMemory({ content, topic = "general", pinned = false }) {
  requireUserId();
  const data = await apiFetch("/api/memories", {
    method: "POST",
    body: JSON.stringify({ userId: USER_ID, content, topic, pinned, source: process.env.IMPRINT_PLATFORM || "claude-code" }),
  });
  invalidateCache();
  return data.memory;
}

async function removeMemory(memoryId, createdAt) {
  requireUserId();
  await apiFetch(`/api/memories?userId=${encodeURIComponent(USER_ID)}&memoryId=${memoryId}&createdAt=${encodeURIComponent(createdAt)}`, {
    method: "DELETE",
  });
  invalidateCache();
}

async function togglePin(memoryId, createdAt, pinned) {
  requireUserId();
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
  const byTopic = rest.reduce((a, m) => { (a[m.topic] = a[m.topic] || []).push(m); return a; }, {});
  for (const [t, ms] of Object.entries(byTopic)) {
    out += `${t.toUpperCase()}:\n`;
    out += ms.map(m => `  • ${m.content}`).join("\n") + "\n";
  }
  return out.trim();
}

// ── Startup: establish identity ───────────────────────────
if (USER_ID) {
  // Simple path: IMPRINT_USER_ID set directly (copied from dashboard)
  fetchMemories(undefined, 60)
    .then(items => console.error(`[Imprint MCP] ✓ Ready — ${items.length} memories loaded`))
    .catch(e  => console.error(`[Imprint MCP] Cache warm failed: ${e.message}`));
} else if (API_KEY) {
  // Secure path: resolve userId from API key
  try {
    const data = await apiFetch("/api/v1/memories?limit=60");
    USER_ID = data.userId;
    setCache(data.memories || []);
    console.error(`[Imprint MCP] ✓ Ready — ${data.count} memories loaded`);
  } catch (e) {
    console.error(`[Imprint MCP] ✗ Auth failed: ${e.message}`);
  }
} else {
  console.error(
    "[Imprint MCP] ⚠️  Not configured.\n" +
    "  → Open https://imprint-ebon.vercel.app/dashboard\n" +
    "  → Scroll to \"Add to Claude\" → click Copy\n" +
    "  → Paste the config block into your Claude settings and restart."
  );
}

// ── MCP Server ────────────────────────────────────────────

const server = new McpServer({ name: "imprint", version: "1.1.0" });

server.tool(
  "get_memories",
  "Retrieve stored memories about the user. Call at the start of every conversation. ALWAYS pass `query` = the user's first message so semantic search returns relevant memories, not just recent ones. Pass `optimize=true` to fit a token budget.",
  {
    topic: z.enum(["work","personal","preferences","projects","health","relationships","general","all"]).optional(),
    limit: z.number().optional(),
    query: z.string().optional().describe("REQUIRED for relevance: pass the user's first message or current task. Runs semantic search — returns memories ranked by relevance, not recency. Without this, only the 60 most recent memories are returned regardless of topic."),
    optimize: z.boolean().optional().describe("Trim memories to fit a token budget (default 2000 tokens). Pinned memories are always included first."),
    budget: z.number().optional().describe("Token budget when optimize=true. Default: 2000."),
  },
  async ({ topic, limit = 60, query, optimize = false, budget = 2000 }) => {
    try {
      let memories;
      if (query) {
        memories = await fetchSemanticMemories(query, Math.min(limit, 20));
      } else if (optimize) {
        const data = await apiFetch(`/api/memories?userId=${encodeURIComponent(USER_ID)}&optimize=true&budget=${budget}`);
        memories = data.memories || [];
      } else {
        memories = await fetchMemories(topic && topic !== "all" ? topic : undefined, limit);
      }
      const pinCount = memories.filter(m => m.pinned).length;
      const header = query
        ? `${memories.length} relevant memories for "${query}" (${pinCount} pinned):\n\n`
        : optimize
        ? `${memories.length} memories within ~${budget}-token budget (${pinCount} pinned):\n\n`
        : `${memories.length} memories (${pinCount} pinned):\n\n`;
      return { content: [{ type: "text", text: header + format(memories) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "save_memory",
  "Save a durable fact about the user. Call PROACTIVELY — the moment you learn anything worth recalling in a future session: their name, role, tech stack, projects, goals, deadlines, preferences, or decisions. Don't wait until the end of the conversation; save as soon as the fact appears. Saves are de-duplicated server-side (exact and paraphrase), so re-saving something already known is safe and cheap.",
  {
    content: z.string().describe("The fact to remember — a single, self-contained sentence (e.g. 'The user is building Imprint, a persistent memory layer')."),
    topic: z.enum(["work","personal","preferences","projects","health","relationships","general"]),
    pinned: z.boolean().optional().describe("Pin to inject into EVERY future session regardless of relevance. Use for always-true essentials: name, main project, key preferences. Pinned memories never expire."),
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
  "Search memories by natural language, semantically ranked by relevance. ALWAYS call this BEFORE answering any personal question about the user (health, job, preferences, past decisions, what they're working on) — never answer such questions from assumptions. Also call it when the conversation shifts to a topic the session-start memories didn't cover.",
  { query: z.string().describe("Natural language query — pass the user's question verbatim, e.g. 'what frameworks does the user prefer?' or 'what is the user building?'") },
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

server.tool(
  "summarize_session",
  "Save what was learned this conversation as memories. Call at the end of any session where you learned important facts about the user.",
  {
    key_facts: z.array(z.string()).describe("Specific facts to save as individual memories — one sentence each, max 8."),
    summary: z.string().optional().describe("Optional free-text summary — extracted and saved if no key_facts provided."),
  },
  async ({ key_facts, summary }) => {
    try {
      const saved = [];
      for (const fact of key_facts.slice(0, 8)) {
        try {
          const m = await createMemory({ content: fact, topic: "general", pinned: false });
          if (m) saved.push(fact);
        } catch {}
      }
      if (!key_facts.length && summary) {
        try {
          const data = await apiFetch("/api/memories", {
            method: "POST",
            body: JSON.stringify({ userId: USER_ID, messages: [{ role: "user", content: summary }], source: "session-summary" }),
          });
          const count = (data.memories || []).length;
          if (count) saved.push(`[extracted ${count} memories from summary]`);
        } catch {}
      }
      invalidateCache();
      return {
        content: [{
          type: "text",
          text: saved.length
            ? `✅ Session saved: ${saved.length} memor${saved.length === 1 ? "y" : "ies"} stored.\n${saved.map(f => `  • ${f}`).join("\n")}`
            : "No new memories were saved (either no facts provided or all were duplicates).",
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
