import { Memory } from "./dynamodb";

// Decay constant: half-life ≈ 14 days (e^(-0.05 * 14) ≈ 0.5)
const LAMBDA = 0.05;

// Pinned memories always float to the top with score 2.0.
// Unpinned: confidence × recency_decay × (1 + access_boost)
// - recency_decay = e^(-λ × daysOld)  → newer memories score higher
// - access_boost  = min(accessCount / 10, 0.5)  → frequently-used memories get up to +50%
export function scoreMemory(memory: Memory): number {
  if (memory.pinned) return 2.0;

  const daysOld =
    (Date.now() - new Date(memory.createdAt).getTime()) / 86_400_000;
  const recencyDecay = Math.exp(-LAMBDA * daysOld);
  const accessBoost = Math.min((memory.accessCount ?? 0) / 10, 0.5);

  return memory.confidence * recencyDecay * (1 + accessBoost);
}

export function rankMemories(memories: Memory[]): Memory[] {
  return [...memories].sort((a, b) => scoreMemory(b) - scoreMemory(a));
}
