import { NextRequest, NextResponse } from "next/server";
import { getMemories, updateMemory } from "@/lib/dynamodb";
import { checkContradiction } from "@/lib/contradiction";
import { cosineSimilarity } from "@/lib/embeddings";
import { requireOwnerOrAdminKey } from "@/lib/authz";

// One-off / re-runnable backfill of contradiction links across a user's EXISTING
// memories. Real-time detection only runs on new saves, so history saved before
// the fix never got conflict links. This walks the store in resumable chunks and
// LLM-checks each memory against its most-similar OLDER memories (index i < j, so
// every unordered pair is checked exactly once across the whole run), then merges
// the resulting links into both sides. Idempotent: re-running unions, never wipes.
//
// POST { userId, cursor=0, batchSize=8, dryRun=false, key? }
//   → { total, cursor, nextCursor, processed, done, foundCount, found[], writes }

export const maxDuration = 60; // allow longer processing per chunk (Vercel)

const K = 5;          // most-similar candidates checked per memory
const FLOOR = 0.6;    // cosine floor below which we don't ask the LLM
const SAME = 0.95;    // at/above this it's the same fact reworded, not a conflict
const CONF = 0.7;     // confidence threshold for a confirmed contradiction
const CONCURRENCY = 2; // low, to avoid Groq rate-limit bursts (and their slow retries)
// Backfill is thousands of binary judgements — use the fast, high-rate-limit model
// rather than 70b. Live single-save detection still uses the stronger default.
const BACKFILL_MODEL = "llama-3.1-8b-instant";

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
  return out;
}

export async function POST(req: NextRequest) {
  const { userId, cursor = 0, batchSize = 8, dryRun = false, key } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  // Expensive endpoint: only the signed-in owner or a caller with ADMIN_KEY.
  const denied = await requireOwnerOrAdminKey(userId, key);
  if (denied) return denied;
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });

  // Fetch the whole store once (newest-first, stable). getMemories paginates up
  // to ~1500 rows; backfill covers the most recent 1500 if the store is larger.
  const all = await getMemories(userId, undefined, 5000);
  const total = all.length;
  const end = Math.min(cursor + batchSize, total);

  type Hit = { aId: string; bId: string; aCreatedAt: string; bCreatedAt: string; sim: number; reason: string };
  const hits: Hit[] = [];

  for (let i = cursor; i < end; i++) {
    const m = all[i];
    if (!m.embedding?.length) continue;
    // Candidates: OLDER memories (index > i) most similar to m, within the window.
    const cands = all
      .slice(i + 1)
      .map((e) => ({ e, sim: e.embedding?.length ? cosineSimilarity(m.embedding!, e.embedding) : -1 }))
      .filter((x) => x.sim >= FLOOR && x.sim < SAME)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, K);
    const results = await mapLimit(cands, CONCURRENCY, async ({ e, sim }) => {
      const c = await checkContradiction(m.content, e.content, groqKey, BACKFILL_MODEL);
      return c.contradicts && c.confidence >= CONF ? { e, sim, reason: c.reason } : null;
    });
    for (const r of results) {
      if (r) hits.push({ aId: m.memoryId, bId: r.e.memoryId, aCreatedAt: m.createdAt, bCreatedAt: r.e.createdAt, sim: r.sim, reason: r.reason });
    }
  }

  let writes = 0;
  if (!dryRun && hits.length) {
    const byId = new Map(all.map((m) => [m.memoryId, m]));
    // Accumulate per-memory updates, seeding from existing links so we union.
    const acc = new Map<string, { ids: Set<string>; reasons: Record<string, string>; createdAt: string }>();
    const ensure = (id: string, createdAt: string, existing: { contradicts?: string[]; conflictReasons?: Record<string, string> }) => {
      if (!acc.has(id)) acc.set(id, { ids: new Set(existing.contradicts || []), reasons: { ...(existing.conflictReasons || {}) }, createdAt });
      return acc.get(id)!;
    };
    for (const h of hits) {
      const a = byId.get(h.aId), b = byId.get(h.bId);
      if (!a || !b) continue;
      const ra = ensure(h.aId, h.aCreatedAt, a); ra.ids.add(h.bId); ra.reasons[h.bId] = h.reason;
      const rb = ensure(h.bId, h.bCreatedAt, b); rb.ids.add(h.aId); rb.reasons[h.aId] = h.reason;
    }
    await mapLimit([...acc.entries()], CONCURRENCY, async ([id, v]) => {
      try { await updateMemory(userId, id, v.createdAt, { contradicts: [...v.ids], conflictReasons: v.reasons }); writes++; } catch {}
    });
  }

  const nextCursor = end;
  return NextResponse.json({
    total,
    cursor,
    nextCursor,
    processed: end - cursor,
    done: nextCursor >= total,
    foundCount: hits.length,
    found: hits.map((h) => ({ a: h.aId, b: h.bId, sim: Number(h.sim.toFixed(3)), reason: h.reason })),
    writes,
  });
}
