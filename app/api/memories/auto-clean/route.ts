import { NextRequest, NextResponse } from "next/server";
import { getMemoryPool, invalidateMemoryPool } from "@/lib/pool";
import { updateMemory, deleteMemory } from "@/lib/dynamodb";
import type { Memory } from "@/lib/dynamodb";
import { cosineSimilarity } from "@/lib/embeddings";
import { llmComplete } from "@/lib/llm";
import { requireOwner } from "@/lib/authz";

// Automatic, conservative store cleanup (triggered in the background on dashboard
// load). Safety rails: never deletes a PINNED memory; duplicates use a higher
// similarity bar than the manual resolver; conflicts auto-resolve ONLY when the
// model is confident the newer fact supersedes the older (an updated value of the
// same attribute) — genuine either/or conflicts are left for manual review.
//
// POST { userId } → { duplicatesRemoved, conflictsResolved, conflictsRemaining }

export const maxDuration = 60;

const DUP_SIM = 0.93;            // higher than the manual resolver (0.90)
const MAX_CONFLICT_CHECKS = 20;  // bound LLM cost per run

function pickBest(cluster: Memory[]): Memory {
  // Keep: pinned first, then the most detailed (longest), then the newest.
  return [...cluster].sort((a, b) =>
    (Number(!!b.pinned) - Number(!!a.pinned)) ||
    ((b.content?.length || 0) - (a.content?.length || 0)) ||
    (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  )[0];
}

export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const denied = await requireOwner(userId);
  if (denied) return denied;

  try {
    const all = await getMemoryPool(userId, 2000);
    const byId = new Map(all.map((m) => [m.memoryId, m]));
    const toDelete = new Set<string>();
    const mark = (m: Memory | undefined) => { if (m && !m.pinned) toDelete.add(m.memoryId); }; // never delete pinned

    // ── 1) Duplicates: keep the best of each near-identical cluster ──
    const withEmb = all.filter((m) => m.embedding && m.embedding.length);
    const usedDup = new Set<string>();
    for (let i = 0; i < withEmb.length; i++) {
      const a = withEmb[i];
      if (usedDup.has(a.memoryId)) continue;
      const cluster = [a];
      usedDup.add(a.memoryId);
      for (let j = i + 1; j < withEmb.length; j++) {
        const b = withEmb[j];
        if (usedDup.has(b.memoryId)) continue;
        if (cosineSimilarity(a.embedding!, b.embedding!) >= DUP_SIM) { cluster.push(b); usedDup.add(b.memoryId); }
      }
      if (cluster.length > 1) {
        const best = pickBest(cluster);
        for (const m of cluster) if (m.memoryId !== best.memoryId) mark(m);
      }
    }
    const duplicatesRemoved = toDelete.size;

    // ── 2) Conflicts: auto-resolve only a clear "supersede" (newer updated value) ──
    const haveLLM = !!(process.env.GROQ_API_KEY || process.env.CEREBRAS_API_KEY || process.env.GEMINI_API_KEY);
    const seen = new Set<string>();
    const pairs: [Memory, Memory][] = [];
    for (const m of all) {
      for (const pid of (m.contradicts || [])) {
        const other = byId.get(pid);
        if (!other) continue;
        const key = [m.memoryId, pid].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push([m, other]);
      }
    }
    let conflictsResolved = 0, checks = 0;
    if (haveLLM) {
      for (const [a, b] of pairs) {
        if (checks >= MAX_CONFLICT_CHECKS) break;
        if (toDelete.has(a.memoryId) || toDelete.has(b.memoryId)) continue;
        const ta = new Date(a.createdAt).getTime(), tb = new Date(b.createdAt).getTime();
        if (ta === tb) continue; // identical timestamps → can't tell which is newer; leave for manual
        const older = ta < tb ? a : b;
        const newer = older === a ? b : a;
        checks++;
        const out = await llmComplete(
          [
            { role: "system", content:
              "Two facts about the same person conflict. Decide if the NEWER fact is a later update of the SAME mutable attribute or status, so the newer should replace the older. " +
              "supersede=true for a clear forward update: a moved deadline, a switched tool, a changed city, OR a status/state progression such as a bug going broken→fixed/resolved or a task going pending→done. " +
              "supersede=false for preferences or opinions, for a regression or re-opening (e.g. fixed→broken again), and whenever you cannot clearly tell which fact is the later state. When in doubt, false. " +
              "Return JSON {\"supersede\": boolean, \"reason\": string}." },
            { role: "user", content: `Older fact: "${older.content}"\nNewer fact: "${newer.content}"` },
          ],
          { temperature: 0, maxTokens: 80, json: true }
        );
        if (!out) continue;
        let verdict: { supersede?: boolean } = {};
        try { verdict = JSON.parse(out); } catch { continue; }
        if (verdict.supersede) {
          // Newer wins. If the older (stale) memory is pinned, carry the pin
          // forward to the surviving newer fact so the user's "always remember"
          // intent isn't lost, then drop the older. Force the delete past mark()'s
          // pinned guard since the pin has been preserved on the newer memory.
          try {
            if (older.pinned && !newer.pinned) {
              await updateMemory(userId, newer.memoryId, newer.createdAt, { pinned: true });
              newer.pinned = true;
            }
            toDelete.add(older.memoryId);
            conflictsResolved++;
          } catch { /* pin-carry failed → leave the pair intact for manual review */ }
        }
      }
    }

    // ── Apply: delete marked memories, then strip dangling refs on survivors ──
    await Promise.all([...toDelete].map((id) => {
      const m = byId.get(id);
      return m ? deleteMemory(userId, id, m.createdAt).catch(() => {}) : Promise.resolve();
    }));
    await Promise.all(all
      .filter((m) => !toDelete.has(m.memoryId) && (m.contradicts || []).some((x) => toDelete.has(x)))
      .map((m) => {
        const nextC = (m.contradicts || []).filter((x) => !toDelete.has(x));
        const nextR = { ...(m.conflictReasons || {}) };
        for (const x of Object.keys(nextR)) if (toDelete.has(x)) delete nextR[x];
        return updateMemory(userId, m.memoryId, m.createdAt, { contradicts: nextC, conflictReasons: nextR }).catch(() => {});
      }));

    invalidateMemoryPool(userId);
    return NextResponse.json({ duplicatesRemoved, conflictsResolved, conflictsRemaining: pairs.length - conflictsResolved });
  } catch (err) {
    console.error("POST /api/memories/auto-clean error:", err);
    return NextResponse.json({ error: "Failed to auto-clean" }, { status: 500 });
  }
}
