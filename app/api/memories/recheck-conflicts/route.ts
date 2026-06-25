import { NextRequest, NextResponse } from "next/server";
import { getMemoryPool, invalidateMemoryPool } from "@/lib/pool";
import { updateMemory } from "@/lib/dynamodb";
import { checkContradiction } from "@/lib/contradiction";
import { requireOwnerOrAdminKey } from "@/lib/authz";

// Re-verify a batch of EXISTING conflict pairs with the (stricter) contradiction
// check, and unlink the ones that aren't genuine contradictions — i.e. prune the
// false positives left by an earlier, looser pass. The caller (driver) computes
// the pair list once and feeds it here in small batches.
//
// POST { userId, pairs: [{ aId, bId }] } → { checked, pruned }

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { userId, pairs, key } = await req.json();
  if (!userId || !Array.isArray(pairs)) {
    return NextResponse.json({ error: "userId and pairs[] required" }, { status: 400 });
  }
  const denied = await requireOwnerOrAdminKey(userId, key);
  if (denied) return denied;

  try {
    const all = await getMemoryPool(userId, 2000);
    const byId = new Map(all.map((m) => [m.memoryId, m]));
    let checked = 0, pruned = 0;

    for (const p of pairs) {
      const a = byId.get(p.aId), b = byId.get(p.bId);
      if (!a || !b) continue;
      checked++;
      const verdict = await checkContradiction(a.content, b.content);
      if (verdict.contradicts && verdict.confidence >= 0.7) continue; // genuine — keep it

      // False positive → unlink the pair on both sides.
      const aReasons = { ...(a.conflictReasons || {}) }; delete aReasons[b.memoryId];
      const bReasons = { ...(b.conflictReasons || {}) }; delete bReasons[a.memoryId];
      const aNext = (a.contradicts || []).filter((x) => x !== b.memoryId);
      const bNext = (b.contradicts || []).filter((x) => x !== a.memoryId);
      try {
        await updateMemory(userId, a.memoryId, a.createdAt, { contradicts: aNext, conflictReasons: aReasons });
        await updateMemory(userId, b.memoryId, b.createdAt, { contradicts: bNext, conflictReasons: bReasons });
        a.contradicts = aNext; a.conflictReasons = aReasons;
        b.contradicts = bNext; b.conflictReasons = bReasons;
        pruned++;
      } catch { /* best-effort */ }
    }

    invalidateMemoryPool(userId);
    return NextResponse.json({ checked, pruned });
  } catch (err) {
    console.error("POST /api/memories/recheck-conflicts error:", err);
    return NextResponse.json({ error: "Failed to re-check conflicts" }, { status: 500 });
  }
}
