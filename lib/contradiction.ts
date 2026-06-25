import { cosineSimilarity } from "./embeddings";
import { llmComplete } from "./llm";

const SYSTEM = `You decide whether two facts about the same person are a genuine CONTRADICTION — two statements that CANNOT both be true at the same time.

Return JSON only: { "contradicts": boolean, "reason": string, "confidence": number }

THE TEST: Could both statements be true simultaneously? If yes → contradicts: false.

CONTRADICTIONS (true) — one statement makes the other impossible:
- "uses React" vs "switched to Vue and no longer uses React" → true
- "is a full-time student" vs "works full-time as an engineer" → true
- "prefers dark mode" vs "prefers light mode" → true
- "the deadline is June 29" vs "the deadline is July 5" → true

NOT contradictions (false) — both can be true together; do NOT flag these:
- "working with a Claude plugin" vs "having issues with Claude Code" → false (you can use something AND have problems with it)
- "building project X" vs "fixed a bug in project X" → false (working on it includes hitting problems)
- "uses TypeScript" vs "is learning Rust" → false (can do both)
- "building project A" vs "also building project B" → false (additions, not conflicts)
- one fact adds detail to the other, or describes a problem/task/activity → false
- the same fact worded differently → false

Be STRICT. A problem, an update, an addition, a task, or extra detail is NOT a contradiction. Only flag a true logical conflict where one fact directly negates the other. When unsure, answer false.

"reason" must be one short human-readable sentence, e.g. "You said you use React, but this says you switched to Vue."`;

export async function checkContradiction(
  newContent: string,
  existingContent: string,
  _groqKey?: string,   // kept for call-site compatibility; provider keys come from env now
  _model?: string
): Promise<{ contradicts: boolean; reason: string; confidence: number }> {
  // Routed through the provider-fallback helper (Groq → Cerebras → Gemini), which
  // retries per-provider and falls over on rate limits — so a 429 no longer
  // silently drops a real contradiction (important for the backfill's many checks).
  try {
    const out = await llmComplete(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Fact A (new): "${newContent}"\nFact B (stored): "${existingContent}"` },
      ],
      { temperature: 0, maxTokens: 120, json: true }
    );
    if (!out) return { contradicts: false, reason: "", confidence: 0 };
    const parsed = JSON.parse(out);
    return {
      contradicts: !!parsed.contradicts,
      reason: String(parsed.reason ?? ""),
      confidence: Number(parsed.confidence) || 0.8,
    };
  } catch {
    return { contradicts: false, reason: "", confidence: 0 };
  }
}

// ── Semantic candidate selection ──────────────────────────────────────────
// The whole point: pick the existing memories actually WORTH checking against a
// new fact. The old version sliced the 5 most-recent same-topic rows, so in a
// large store the fact you contradict (usually older, possibly a different
// topic) was never compared. Now we rank by embedding similarity instead.

export interface NewMemInput {
  content: string;
  topic: string;
  embedding?: number[];
  clientId?: string;   // lets the caller map a hit back to the right new memory
  excludeId?: string;  // skip this existing id (don't compare a memory to itself)
}

export interface ExistingMemInput {
  memoryId: string;
  content: string;
  topic: string;
  embedding?: number[];
  createdAt?: string;
}

export interface ContradictionHit {
  newMemoryContent: string;
  newMemoryClientId?: string;
  existingMemoryId: string;
  existingMemoryContent: string;
  explanation: string;
  confidence: number;
}

const TOP_K = 5;               // most-similar candidates checked per new memory
const SIM_FLOOR = 0.6;         // below this cosine, don't bother asking the LLM
const SAME_FACT = 0.95;        // at/above this it's the same fact reworded, not a conflict
const LEGACY_RECENT = 3;       // also check N recent rows that predate embeddings
const MAX_CHECKS_DEFAULT = 24; // global LLM-call budget per request

// Pick the existing memories most worth an LLM contradiction check against `n`.
function selectCandidates(n: NewMemInput, existing: ExistingMemInput[]): ExistingMemInput[] {
  const pool = existing.filter((e) => e.memoryId !== n.excludeId);

  if (n.embedding && n.embedding.length) {
    const scored = pool.map((e) => ({
      e,
      sim: e.embedding && e.embedding.length ? cosineSimilarity(n.embedding!, e.embedding) : -1,
    }));
    // Most-similar facts (but not near-identical re-wordings, which aren't conflicts).
    const ranked = scored
      .filter((x) => x.sim >= SIM_FLOOR && x.sim < SAME_FACT)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, TOP_K)
      .map((x) => x.e);
    // Rows saved before embeddings existed score -1 and are invisible to cosine
    // ranking — keep a few of the most recent so legacy facts can still conflict.
    const legacy = scored.filter((x) => x.sim === -1).slice(0, LEGACY_RECENT).map((x) => x.e);
    return [...ranked, ...legacy];
  }

  // New memory has no embedding (Jina down) → degrade to the old recency heuristic.
  return pool.filter((e) => e.topic === n.topic).slice(0, TOP_K);
}

// Compares each new memory against its most semantically similar existing memories
// (across ALL topics) in parallel, bounded by a global call budget.
// Returns only confirmed contradictions with confidence ≥ 0.7.
export async function detectSemanticContradictions(
  newMems: NewMemInput[],
  existing: ExistingMemInput[],
  groqKey: string,
  opts: { maxChecks?: number } = {}
): Promise<ContradictionHit[]> {
  const results: ContradictionHit[] = [];
  let budget = opts.maxChecks ?? MAX_CHECKS_DEFAULT;

  await Promise.all(
    newMems.map(async (n) => {
      const candidates = selectCandidates(n, existing);
      // Reserve budget synchronously (JS is single-threaded) so the parallel
      // new-memory tasks never collectively blow past the global cap.
      const toCheck: ExistingMemInput[] = [];
      for (const e of candidates) {
        if (budget <= 0) break;
        budget--;
        toCheck.push(e);
      }

      await Promise.all(
        toCheck.map(async (e) => {
          const check = await checkContradiction(n.content, e.content, groqKey);
          if (check.contradicts && check.confidence >= 0.7) {
            results.push({
              newMemoryContent: n.content,
              newMemoryClientId: n.clientId,
              existingMemoryId: e.memoryId,
              existingMemoryContent: e.content,
              explanation: check.reason,
              confidence: check.confidence,
            });
          }
        })
      );
    })
  );

  return results;
}
