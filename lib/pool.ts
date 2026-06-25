import { getMemories } from "./dynamodb";
import type { Memory } from "./dynamodb";

// Per-instance, short-TTL cache of a user's memory pool (embeddings included).
// Both contradiction detection (on every save) and ask-your-memory fetch the
// whole pool to rank by embedding similarity — this avoids re-querying ~1000
// rows from DynamoDB on every call within a burst (e.g. a stop-hook firing
// repeatedly, or several questions in a row).
//
// TTL is short and the pool is invalidated on write (see invalidateMemoryPool),
// so the writer always sees fresh data; only unrelated concurrent reads within
// the window see slightly stale data, which is fine for best-effort ranking.
//
// NOTE: this is the no-cost interim. The real fix for very large stores is a
// managed vector index (e.g. Upstash Vector's free tier) so we never load the
// whole pool — deferred deliberately to avoid adding a paid external service.
const TTL_MS = 15 * 1000;
const cache = new Map<string, { mems: Memory[]; ts: number }>();

export async function getMemoryPool(userId: string, limit = 1000): Promise<Memory[]> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.mems.slice(0, limit);
  const mems = await getMemories(userId, undefined, Math.max(limit, 1000));
  cache.set(userId, { mems, ts: Date.now() });
  return mems.slice(0, limit);
}

export function invalidateMemoryPool(userId: string) {
  cache.delete(userId);
}
