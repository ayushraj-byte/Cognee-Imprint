// ─────────────────────────────────────────────────────────────────────────────
// lib/memory-store.ts — the memory store, powered by Cognee Cloud.
//
// Replaces the DynamoDB + Jina + Groq retrieval stack. Each durable fact is:
//   1. persisted locally (lib/local-store) so the dashboard can list/edit/pin it,
//   2. ingested into the user's Cognee dataset (add → cognify) so Cognee builds a
//      knowledge graph and powers semantic / graph retrieval.
//
// Public surface matches the old lib/dynamodb.ts memory functions exactly, so
// every existing API route keeps working without changes.
// ─────────────────────────────────────────────────────────────────────────────

import { v4 as uuidv4 } from "uuid";
import type { Memory, Topic } from "./memory-types";
import {
  lsListMemories,
  lsPutMemory,
  lsUpdateMemory,
  lsDeleteMemory,
  lsMutateMemory,
} from "./local-store";
import {
  cogneeEnabled,
  datasetForUser,
  cogneeRemember,
  cogneeRecall,
  cogneeImprove,
  cogneeForgetItem,
  cogneeGetDatasetByName,
  DEFAULT_SEARCH_TYPE,
  type CogneeSearchResult,
} from "./cognee";

const MEMORY_TTL_DAYS = 30;

// Normalize a raw stored row into a full Memory (defaults for optional fields).
function normalize(m: Record<string, unknown>): Memory {
  return {
    userId: m.userId as string,
    memoryId: m.memoryId as string,
    content: m.content as string,
    topic: (m.topic as Topic) || "general",
    keywords: (m.keywords as string[]) || [],
    createdAt: m.createdAt as string,
    accessedAt: (m.accessedAt as string) || (m.createdAt as string),
    ttl: m.ttl as number | undefined,
    pinned: !!m.pinned,
    contradicts: (m.contradicts as string[]) || [],
    conflictReasons: (m.conflictReasons as Record<string, string>) || {},
    confidence: (m.confidence as number) ?? 1.0,
    accessCount: (m.accessCount as number) ?? 0,
    embedding: m.embedding as number[] | undefined,
    source: m.source as string | undefined,
    tags: (m.tags as string[]) || [],
    cogneeDataId: m.cogneeDataId as string | undefined,
  };
}

// Best-effort extraction of the created data-item id from a Cognee /add response.
function extractDataId(res: unknown): string | undefined {
  const r = res as Record<string, unknown> | null | undefined;
  if (!r || typeof r !== "object") return undefined;
  const candidates: unknown[] = [
    r.id,
    r.dataId,
    (r.data as Record<string, unknown> | undefined)?.id,
    Array.isArray(r.data) ? (r.data[0] as Record<string, unknown>)?.id : undefined,
    Array.isArray(r.datasets)
      ? ((r.datasets[0] as Record<string, unknown>)?.data as Record<string, unknown>[] | undefined)?.[0]?.id
      : undefined,
  ];
  const hit = candidates.find((c) => typeof c === "string" && c.length > 0);
  return hit as string | undefined;
}

// Pull human-readable text out of a Cognee search result (shape varies by type).
function extractText(r: CogneeSearchResult): string {
  const sr = r.search_result ?? (r as Record<string, unknown>).text ?? (r as Record<string, unknown>).content;
  if (typeof sr === "string") return sr;
  if (sr && typeof sr === "object") {
    const o = sr as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    if (typeof o.content === "string") return o.content;
  }
  return typeof r === "string" ? (r as unknown as string) : "";
}

function keywordRank(all: Memory[], query: string, limit: number): Memory[] {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const scored = all
    .map((m) => {
      const hay = (m.content + " " + (m.keywords || []).join(" ")).toLowerCase();
      const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
      return { m, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.m);
}

// ── Core memory functions (drop-in replacements for the DynamoDB versions) ──

export async function saveMemory(
  memory: Omit<Memory, "memoryId" | "createdAt" | "accessedAt" | "ttl">
): Promise<Memory> {
  const now = new Date().toISOString();
  const memoryId = uuidv4();
  const ttl = memory.pinned
    ? undefined
    : Math.floor(Date.now() / 1000) + MEMORY_TTL_DAYS * 86400;

  const item: Memory = { ...memory, memoryId, createdAt: now, accessedAt: now, ttl };

  // remember() into Cognee Cloud — this is what powers graph + semantic retrieval.
  if (cogneeEnabled()) {
    try {
      const ds = datasetForUser(memory.userId);
      const nodeSet = [
        `topic:${memory.topic}`,
        memory.pinned ? "pinned:true" : "pinned:false",
        ...(memory.source ? [`source:${memory.source}`] : []),
      ];
      const rememberRes = await cogneeRemember(ds, memory.content, nodeSet);
      const dataId = extractDataId(rememberRes);
      if (dataId) item.cogneeDataId = dataId;
      // improve() the graph asynchronously (enrich/re-weight) so the save stays fast.
      cogneeImprove(ds).catch((e) =>
        console.error("[cognee] improve failed:", (e as Error).message)
      );
    } catch (e) {
      // Cognee is the retrieval brain, but a transient remember() failure must not
      // lose the memory — it's still persisted locally below.
      console.error("[cognee] remember failed:", (e as Error).message);
    }
  }

  await lsPutMemory(memory.userId, item as unknown as Record<string, unknown>);
  return item;
}

export async function getMemories(
  userId: string,
  topic?: Topic,
  limit = 50
): Promise<Memory[]> {
  const raw = await lsListMemories(userId);
  const nowSec = Math.floor(Date.now() / 1000);
  let list = raw
    .map(normalize)
    // Drop expired non-pinned memories (mirrors DynamoDB's 30-day TTL).
    .filter((m) => m.pinned || !m.ttl || m.ttl > nowSec);
  if (topic) list = list.filter((m) => m.topic === topic);
  // Newest first (ISO timestamps sort lexicographically).
  list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return list.slice(0, limit);
}

export async function searchMemories(
  userId: string,
  query: string,
  limit = 10
): Promise<Memory[]> {
  const all = await getMemories(userId, undefined, 2000);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return all
    .filter((m) =>
      words.some(
        (w) =>
          m.content.toLowerCase().includes(w) ||
          (m.keywords || []).some((k) => k.toLowerCase().includes(w))
      )
    )
    .slice(0, limit);
}

export async function updateMemory(
  userId: string,
  memoryId: string,
  _createdAt: string,
  updates: Partial<
    Pick<Memory, "content" | "pinned" | "topic" | "contradicts" | "conflictReasons" | "tags">
  >
): Promise<void> {
  const patch: Record<string, unknown> = { ...updates, accessedAt: new Date().toISOString() };
  if (updates.pinned !== undefined) {
    // Pinned = permanent (no TTL). Unpinned = fresh 30-day TTL.
    patch.ttl = updates.pinned
      ? undefined
      : Math.floor(Date.now() / 1000) + MEMORY_TTL_DAYS * 86400;
  }
  await lsUpdateMemory(userId, memoryId, patch);
}

export async function deleteMemory(
  userId: string,
  memoryId: string,
  _createdAt: string
): Promise<void> {
  // Best-effort: remove the ingested document from the Cognee knowledge graph.
  if (cogneeEnabled()) {
    try {
      const rows = await lsListMemories(userId);
      const row = rows.find((x) => x.memoryId === memoryId) as
        | { cogneeDataId?: string }
        | undefined;
      if (row?.cogneeDataId) {
        const ds = await cogneeGetDatasetByName(datasetForUser(userId));
        if (ds) await cogneeForgetItem(ds.id, row.cogneeDataId);
      }
    } catch (e) {
      console.error("[cognee] delete failed:", (e as Error).message);
    }
  }
  await lsDeleteMemory(userId, memoryId);
}

export async function incrementAccessCount(
  userId: string,
  memoryId: string,
  _createdAt: string
): Promise<void> {
  // Atomic read-modify-write inside the store's write lock — no lost updates.
  await lsMutateMemory(userId, memoryId, (row) => {
    row.accessCount = ((row.accessCount as number) || 0) + 1;
    row.accessedAt = new Date().toISOString();
  });
}

// ── Cognee-powered retrieval ────────────────────────────────────────────────

/**
 * Semantic retrieval powered by Cognee Cloud. Asks Cognee for the most relevant
 * source chunks, then maps them back to local memory rows so callers still get
 * full Memory objects (for the dashboard / MCP). Falls back to keyword ranking
 * when Cognee is unavailable or returns nothing matchable.
 */
export async function cogneeSemanticSearch(
  userId: string,
  query: string,
  limit = 20
): Promise<Memory[]> {
  const all = await getMemories(userId, undefined, 2000);
  if (!all.length) return [];
  if (!cogneeEnabled()) return keywordRank(all, query, limit);

  try {
    const ds = datasetForUser(userId);
    const results = await cogneeRecall(query, {
      searchType: "CHUNKS",
      datasets: [ds],
      topK: Math.max(limit, 10),
    });
    const texts = results.map(extractText).filter((t) => t && t.trim().length > 0);
    if (!texts.length) return keywordRank(all, query, limit);

    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const matched: Memory[] = [];
    const seen = new Set<string>();
    for (const t of texts) {
      const tn = norm(t);
      const hit = all.find((m) => {
        if (seen.has(m.memoryId)) return false;
        const cn = norm(m.content);
        const probe = cn.slice(0, 60);
        return probe.length > 0 && (tn.includes(probe) || cn.includes(tn.slice(0, 60)));
      });
      if (hit) {
        matched.push(hit);
        seen.add(hit.memoryId);
      }
    }
    const ranked = matched.length ? matched : keywordRank(all, query, limit);
    return ranked.slice(0, limit);
  } catch (e) {
    console.error("[cognee] search failed:", (e as Error).message);
    return keywordRank(all, query, limit);
  }
}

/**
 * Ask the Cognee knowledge graph a natural-language question and get a
 * synthesized answer (GRAPH_COMPLETION / RAG_COMPLETION). Returns null when
 * Cognee is unavailable so callers can fall back to their own logic.
 */
export async function cogneeGraphAnswer(
  userId: string,
  query: string
): Promise<string | null> {
  if (!cogneeEnabled()) return null;
  try {
    const ds = datasetForUser(userId);
    const results = await cogneeRecall(query, {
      searchType: DEFAULT_SEARCH_TYPE,
      datasets: [ds],
      topK: 10,
    });
    const answer = results.map(extractText).filter(Boolean).join("\n").trim();
    return answer || null;
  } catch (e) {
    console.error("[cognee] graph answer failed:", (e as Error).message);
    return null;
  }
}
