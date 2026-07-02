#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Points at the hosted Cognee-Imprint API by default. Override with IMPRINT_API_BASE
// (e.g. http://localhost:3000) only to target a local `npm run dev` instance.
const API_BASE = process.env.IMPRINT_API_BASE || "https://cognee-imprint.vercel.app";
const API_KEY  = process.env.IMPRINT_API_KEY;   // secure path (revocable)
const CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;  // abort a request that hangs (e.g. Vercel cold start)
const MAX_ATTEMPTS = 3;             // total attempts before surfacing the error

// Resolved at startup — either from env directly or via API key lookup
let USER_ID = process.env.IMPRINT_USER_ID || null;

// ── In-memory cache ───────────────────────────────────────
let cache = { items: null, ts: 0 };
function isCacheFresh() { return cache.items !== null && (Date.now() - cache.ts) < CACHE_TTL_MS; }
function setCache(items) { cache = { items, ts: Date.now() }; }
function invalidateCache() { cache = { items: null, ts: 0 }; }

// ── API helpers ───────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// fetch with a hard timeout + bounded retry. Vercel functions cold-start, so the
// first request after an idle period can hang or return a 5xx; without this the
// IDE just sees a tool call that never returns. Retrying turns those transient
// failures into a successful call — but ONLY for idempotent methods.
//
// POST /api/memories is NOT safely retriable: the server-side dedup is a
// read-then-write check, so a POST that's retried after a slow (but successful)
// save races the original and writes a DUPLICATE row. So we never retry POST,
// and give it a longer timeout instead — a save that ingests into Cognee can
// legitimately take longer than a read, and we'd rather wait than double-write.
async function apiFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;

  const method = (options.method || "GET").toUpperCase();
  const retriable = method !== "POST";           // POST is not idempotent here
  const timeoutMs = method === "POST" ? 45_000 : REQUEST_TIMEOUT_MS;

  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
      if (res.ok) return await res.json();
      const body = await res.text().catch(() => "");
      // Retry server errors (incl. cold-start 502/503/504); fail fast on 4xx.
      // Never retry a POST — the request may have already saved server-side.
      if (retriable && res.status >= 500 && attempt < MAX_ATTEMPTS) {
        lastErr = new Error(`API error ${res.status}`);
        await sleep(300 * attempt);
        continue;
      }
      throw new Error(`API error ${res.status}: ${body}`);
    } catch (e) {
      const timedOut = e.name === "AbortError";
      const network  = timedOut || /fetch failed|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(`${e.message} ${e.code || ""}`);
      if (retriable && network && attempt < MAX_ATTEMPTS) {
        lastErr = timedOut ? new Error(`timed out after ${timeoutMs / 1000}s`) : e;
        await sleep(300 * attempt);
        continue;
      }
      if (timedOut) throw new Error(`Imprint API timed out after ${timeoutMs / 1000}s — the server may be waking up. Please try again.`);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr || new Error("Imprint API request failed after retries");
}

function requireUserId() {
  if (!USER_ID) throw new Error(
    "Imprint is not configured — set IMPRINT_USER_ID in your MCP server's env. " +
    "Copy the ready-made config from https://cognee-imprint.vercel.app/dashboard → Connect your IDE."
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
  return data; // { memory, contradictions }
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
    "  → Open https://cognee-imprint.vercel.app/dashboard → Connect your IDE\n" +
    "  → Set IMPRINT_USER_ID in this server's env\n" +
    "  → Restart your IDE."
  );
}

// ── MCP Server ────────────────────────────────────────────

const server = new McpServer({ name: "imprint", version: "1.2.0" });

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
      const { contradictions = [] } = await createMemory({ content, topic, pinned });
      let text = `✅ Saved: [${topic}] ${content}${pinned ? " 📌" : ""}`;
      if (contradictions.length) {
        text += `\n\n⚠️ This may contradict ${contradictions.length} existing memor${contradictions.length === 1 ? "y" : "ies"}:`;
        for (const c of contradictions) text += `\n  • "${c.existingMemoryContent}" — ${c.explanation}`;
        text += `\n\nBoth are now flagged in your Imprint dashboard. Tell me which is correct and I'll update it.`;
      }
      return { content: [{ type: "text", text }] };
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
          const r = await createMemory({ content: fact, topic: "general", pinned: false });
          if (r && r.memory) saved.push(fact);
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

// ── Learning tools: lessons · feedback · corrections · insights ─────────────

server.tool(
  "save_lesson",
  "Save a LESSON — a mistake and how it was fixed — so you never repeat it. Call this the moment you or the user hit a bug, error, or wrong approach and then resolve it. Future sessions recall the fix proactively.",
  {
    mistake: z.string().describe("What went wrong — the error, bug, or wrong approach."),
    fix: z.string().describe("How it was resolved — the correct approach to use next time."),
  },
  async ({ mistake, fix }) => {
    try {
      requireUserId();
      const content = `Lesson — avoid: ${mistake}. Do instead: ${fix}`;
      await apiFetch("/api/memories", {
        method: "POST",
        body: JSON.stringify({ userId: USER_ID, content, topic: "general", lesson: true, mistake, fix, source: process.env.IMPRINT_PLATFORM || "claude-code" }),
      });
      invalidateCache();
      return { content: [{ type: "text", text: `📘 Lesson saved:\n  • Avoid: ${mistake}\n  • Do:    ${fix}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "rate_memory",
  "Give feedback on a memory: 'up' if it's correct/useful, 'down' if it's wrong or outdated. Down-voted memories lose confidence and decay out; up-voted ones become trusted (auto-pinned). Use when the user confirms or disputes something you recalled.",
  { memoryId: z.string(), vote: z.enum(["up", "down"]) },
  async ({ memoryId, vote }) => {
    try {
      requireUserId();
      const r = await apiFetch("/api/memories", { method: "PATCH", body: JSON.stringify({ userId: USER_ID, memoryId, feedback: vote }) });
      invalidateCache();
      const conf = r?.feedback ? ` (confidence now ${Math.round(r.feedback.confidence * 100)}%)` : "";
      return { content: [{ type: "text", text: `${vote === "up" ? "👍" : "👎"} Feedback recorded${conf}.` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "correct_memory",
  "Correct a memory that's now wrong: saves the corrected fact and supersedes the old one (which fades out). Use when the user says things like 'actually it's X, not Y' or an old fact no longer holds.",
  {
    old_memory_id: z.string(),
    correction: z.string().describe("The correct, up-to-date fact — a full standalone sentence."),
    topic: z.enum(["work", "personal", "preferences", "projects", "health", "relationships", "general"]).optional(),
  },
  async ({ old_memory_id, correction, topic = "general" }) => {
    try {
      requireUserId();
      const saved = await createMemory({ content: correction, topic, pinned: false });
      const newId = saved?.memory?.memoryId;
      if (newId) await apiFetch("/api/memories", { method: "PATCH", body: JSON.stringify({ userId: USER_ID, memoryId: old_memory_id, supersededBy: newId }) });
      invalidateCache();
      return { content: [{ type: "text", text: `✏️ Corrected — new fact saved, old memory superseded.` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "get_insights",
  "Get recurring patterns across the user's memories — what they keep working on, repeated themes/mistakes, topic breakdown. Call when the user asks what you've noticed about them, or for a high-level summary.",
  {},
  async () => {
    try {
      requireUserId();
      const d = await apiFetch(`/api/insights?userId=${encodeURIComponent(USER_ID)}`);
      let text = `🧭 Insights — ${d.totalMemories} memories, ${d.lessons} lessons`;
      if (d.cogneeInsights) text += `\n\nCognee graph:\n${d.cogneeInsights}`;
      if (d.recurringThemes?.length) text += `\n\nRecurring:\n` + d.recurringThemes.map((t) => `  • ${t}`).join("\n");
      if (d.topicBreakdown?.length) text += `\n\nBy topic: ` + d.topicBreakdown.map((t) => `${t.topic}(${t.count})`).join(", ");
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
