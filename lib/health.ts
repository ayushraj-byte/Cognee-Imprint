const ALL_TOPICS = ["work", "personal", "preferences", "projects", "health", "relationships", "general"];

export interface HealthBreakdown {
  freshness: number;    // 0-25
  confidence: number;   // 0-25
  consistency: number;  // 0-25
  coverage: number;     // 0-25
}

export interface HealthScore {
  total: number;
  grade: "A" | "B" | "C" | "D" | "F";
  breakdown: HealthBreakdown;
  staleCount: number;
}

export function calculateHealth(memories: any[]): HealthScore {
  if (!memories.length) {
    return { total: 0, grade: "F", breakdown: { freshness: 0, confidence: 0, consistency: 0, coverage: 0 }, staleCount: 0 };
  }

  const now = Date.now();

  // Freshness: avg e^(-0.05 * daysOld), scaled 0-25
  const avgFresh = memories.reduce((sum, m) => {
    const created = m._raw?.createdAt ?? m.createdAt;
    const days = (now - new Date(created).getTime()) / 86_400_000;
    return sum + Math.exp(-0.05 * days);
  }, 0) / memories.length;
  const freshness = Math.round(avgFresh * 25);

  // Confidence: avg confidence * 25
  const avgConf = memories.reduce((sum, m) => sum + (m._raw?.confidence ?? 0.7), 0) / memories.length;
  const confidence = Math.round(avgConf * 25);

  // Consistency: (1 - contradiction_rate) * 25
  const contradicted = memories.filter(m => (m._raw?.contradicts?.length ?? 0) > 0).length;
  const consistency = Math.round((1 - contradicted / memories.length) * 25);

  // Coverage: unique topics / 7 * 25
  const topics = new Set(memories.map(m => m.topic));
  const coverage = Math.round((topics.size / ALL_TOPICS.length) * 25);

  const total = Math.min(100, freshness + confidence + consistency + coverage);
  const grade = total >= 90 ? "A" : total >= 75 ? "B" : total >= 60 ? "C" : total >= 45 ? "D" : "F";

  // Stale: unpinned, older than 14 days, accessed < 2 times
  const staleCount = memories.filter(m => {
    if (m.pinned) return false;
    const created = m._raw?.createdAt ?? m.createdAt;
    const days = (now - new Date(created).getTime()) / 86_400_000;
    return days > 14 && (m._raw?.accessCount ?? 0) < 2;
  }).length;

  return { total, grade, breakdown: { freshness, confidence, consistency, coverage }, staleCount };
}
