import { Memory } from "./dynamodb";
import { scoreMemory } from "./rank";

// Approximate token count — 4 chars ≈ 1 token (GPT-family heuristic)
const CHARS_PER_TOKEN = 4;
const OVERHEAD_PER_MEMORY = 20; // formatting chars added per bullet

// Greedy knapsack: always include pinned memories first, then fill remaining
// budget with highest-ranked memories. Ensures the injected context never
// overflows the model's context window.
export function optimizeContext(memories: Memory[], tokenBudget = 2000): Memory[] {
  const charBudget = tokenBudget * CHARS_PER_TOKEN;
  const pinned = memories.filter(m => m.pinned);
  const rest = memories
    .filter(m => !m.pinned)
    .sort((a, b) => scoreMemory(b) - scoreMemory(a));

  const result: Memory[] = [];
  let used = 0;

  for (const m of pinned) {
    const cost = m.content.length + OVERHEAD_PER_MEMORY;
    if (used + cost <= charBudget) { result.push(m); used += cost; }
  }
  for (const m of rest) {
    const cost = m.content.length + OVERHEAD_PER_MEMORY;
    if (used + cost > charBudget) continue;
    result.push(m);
    used += cost;
  }

  return result;
}

export function estimateTokens(memories: Memory[]): number {
  return Math.ceil(
    memories.reduce((sum, m) => sum + m.content.length + OVERHEAD_PER_MEMORY, 0) / CHARS_PER_TOKEN
  );
}
