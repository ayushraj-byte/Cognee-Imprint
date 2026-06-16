"use client";

import { useState } from "react";
import { AlertTriangle, Check, Trash2, GitMerge, Zap, RefreshCw } from "lucide-react";

const TOPIC_META: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
  projects:      { color: "#7c3aed", bg: "#7c3aed18", label: "Projects",      emoji: "🚀" },
  work:          { color: "#0070f3", bg: "#0070f318", label: "Work",           emoji: "💼" },
  preferences:   { color: "#d97706", bg: "#d9770618", label: "Preferences",   emoji: "⭐" },
  personal:      { color: "#059669", bg: "#05966918", label: "Personal",      emoji: "👤" },
  health:        { color: "#e11d48", bg: "#e11d4818", label: "Health",        emoji: "❤️" },
  relationships: { color: "#8b5cf6", bg: "#8b5cf618", label: "Relationships", emoji: "🤝" },
  general:       { color: "#6b7280", bg: "#6b728018", label: "General",       emoji: "📌" },
};

function findConflictPairs(memories: any[]): { a: any; b: any; reason: string; aiDetected: boolean }[] {
  const pairs: { a: any; b: any; reason: string; aiDetected: boolean }[] = [];
  const seen = new Set<string>();

  // 1 — server-flagged contradicts[] from semantic AI detection
  for (const m of memories) {
    const contradicts: string[] = (m as any)._raw?.contradicts || [];
    for (const otherId of contradicts) {
      const key = [m.id, otherId].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const other = memories.find(x => x.id === otherId);
      if (other) {
        pairs.push({
          a: m, b: other,
          reason: "Detected by semantic AI (Groq llama-3.3-70b pairwise comparison)",
          aiDetected: true,
        });
      }
    }
  }

  // 2 — client heuristic: same topic + negation words + word overlap
  const NEGATIONS = /\b(not|never|don't|doesn't|no longer|stopped|changed|switched|moved|left|quit|avoid|hate|dislike)\b/i;
  const sameTopic = memories.reduce((acc: Record<string, any[]>, m) => {
    (acc[m.topic] = acc[m.topic] || []).push(m);
    return acc;
  }, {});

  for (const group of Object.values(sameTopic)) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j];
        const key = [a.id, b.id].sort().join("|");
        if (seen.has(key)) continue;
        const hasNeg = NEGATIONS.test(a.content) || NEGATIONS.test(b.content);
        if (!hasNeg) continue;
        const aWords = new Set(a.content.toLowerCase().match(/\b\w{4,}\b/g) || []);
        const bWords = (b.content.toLowerCase().match(/\b\w{4,}\b/g) || []);
        const overlap = bWords.filter((w: string) => aWords.has(w)).length;
        if (overlap >= 2) {
          seen.add(key);
          pairs.push({ a, b, reason: "Potential conflict — similar topic with opposing statement", aiDetected: false });
        }
      }
    }
  }

  return pairs.slice(0, 10);
}

function CompressSection({
  memories,
  userId,
  onRefresh,
}: {
  memories: any[];
  userId: string;
  onRefresh: () => void;
}) {
  const [compressing, setCompressing] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, number>>({});

  // Topics with ≥ 3 unpinned memories are compressible
  const topicCounts = memories.reduce((acc: Record<string, number>, m) => {
    if (!m.pinned) acc[m.topic] = (acc[m.topic] || 0) + 1;
    return acc;
  }, {});
  const compressible = Object.entries(topicCounts).filter(([, count]) => count >= 3);

  if (compressible.length === 0) return null;

  async function compress(topic: string) {
    setCompressing(topic);
    try {
      const res = await fetch("/api/memories/compress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, topic }),
      });
      const data = await res.json();
      if (data.deletedCount) {
        setDone(prev => ({ ...prev, [topic]: data.deletedCount }));
        onRefresh();
      }
    } catch {}
    setCompressing(null);
  }

  return (
    <div style={{ marginTop: 36 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Zap size={14} style={{ color: "rgba(78,236,216,0.7)" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(78,236,216,0.6)", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
          Memory compression
        </span>
      </div>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 14, lineHeight: 1.6 }}>
        Compress multiple related memories into a single dense fact using Groq AI. Pinned memories are never touched.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {compressible.map(([topic, count]) => {
          const meta = TOPIC_META[topic] || { color: "#6b7280", bg: "#6b728018", label: topic, emoji: "📌" };
          const isDone = !!done[topic];
          const isCompressing = compressing === topic;
          return (
            <div key={topic} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10, padding: "11px 16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: meta.color, background: meta.bg, borderRadius: 4, padding: "2px 8px", textTransform: "uppercase" as const }}>
                  {meta.emoji} {meta.label}
                </span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                  {isDone ? `${done[topic]} → 1 memory` : `${count} memories`}
                </span>
              </div>
              {isDone ? (
                <span style={{ fontSize: 12, color: "rgba(78,236,216,0.7)" }}>✓ Compressed</span>
              ) : (
                <button
                  onClick={() => compress(topic)}
                  disabled={isCompressing || !!compressing}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "5px 14px", borderRadius: 8,
                    border: `1px solid ${meta.color}33`,
                    background: `${meta.color}0d`,
                    color: isCompressing ? "rgba(255,255,255,0.3)" : meta.color,
                    fontSize: 12, cursor: isCompressing ? "not-allowed" : "pointer", fontWeight: 500,
                  }}
                >
                  {isCompressing
                    ? <><RefreshCw size={11} style={{ animation: "spin 0.8s linear infinite" }} /> Compressing…</>
                    : <><Zap size={11} /> Compress</>
                  }
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ResolverSection({ memories, userId, onDelete, onRefresh }: {
  memories: any[];
  userId?: string;
  onDelete: (id: string) => void;
  onRefresh?: () => void;
}) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const pairs = findConflictPairs(memories).filter(p => !resolved.has([p.a.id, p.b.id].sort().join("|")));

  function resolve(a: any, b: any) {
    setResolved(prev => new Set([...prev, [a.id, b.id].sort().join("|")]));
  }
  function keepA(a: any, b: any) { onDelete(b.id); resolve(a, b); }
  function keepB(a: any, b: any) { onDelete(a.id); resolve(a, b); }
  function deleteBoth(a: any, b: any) { onDelete(a.id); onDelete(b.id); resolve(a, b); }

  return (
    <div style={{ animation: "fade-in 0.3s ease both", maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em", marginBottom: 4 }}>
          Contradiction resolver
        </h1>
        <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.3)" }}>
          Memories that may conflict — resolve them to keep your context clean
        </p>
      </div>

      {pairs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0 24px" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(5,150,105,0.12)", border: "1px solid rgba(5,150,105,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Check size={22} style={{ color: "#059669" }} />
          </div>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>No contradictions found</p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.2)" }}>Imprint flags conflicts automatically using Groq semantic analysis.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={14} style={{ color: "#ef4444", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "rgba(252,165,165,0.85)" }}>
              {pairs.length} potential conflict{pairs.length > 1 ? "s" : ""} detected. Review each pair and choose which memory to keep.
            </span>
          </div>

          {pairs.map(({ a, b, reason, aiDetected }, i) => {
            const metaA = TOPIC_META[a.topic] || { color: "#6b7280", bg: "#6b728018", label: a.topic, emoji: "📌" };
            const metaB = TOPIC_META[b.topic] || { color: "#6b7280", bg: "#6b728018", label: b.topic, emoji: "📌" };
            return (
              <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8 }}>
                  {aiDetected
                    ? <Zap size={11} style={{ color: "rgba(251,191,36,0.7)", flexShrink: 0 }} />
                    : <AlertTriangle size={11} style={{ color: "rgba(239,68,68,0.5)", flexShrink: 0 }} />
                  }
                  <span style={{ fontSize: 11, color: aiDetected ? "rgba(251,191,36,0.6)" : "rgba(255,255,255,0.25)" }}>
                    {reason}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                  <div style={{ padding: "14px 16px", borderRight: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: metaA.color, background: metaA.bg, borderRadius: 4, padding: "2px 7px", textTransform: "uppercase" as const }}>{metaA.emoji} {metaA.label}</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{new Date(a.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, margin: "0 0 14px" }}>{a.content}</p>
                    <button onClick={() => keepA(a, b)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(5,150,105,0.3)", background: "rgba(5,150,105,0.08)", color: "#059669", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
                      <Check size={11} /> Keep this
                    </button>
                  </div>

                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: metaB.color, background: metaB.bg, borderRadius: 4, padding: "2px 7px", textTransform: "uppercase" as const }}>{metaB.emoji} {metaB.label}</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{new Date(b.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, margin: "0 0 14px" }}>{b.content}</p>
                    <button onClick={() => keepB(a, b)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(5,150,105,0.3)", background: "rgba(5,150,105,0.08)", color: "#059669", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
                      <Check size={11} /> Keep this
                    </button>
                  </div>
                </div>

                <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 8 }}>
                  <button onClick={() => resolve(a, b)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.35)", fontSize: 11.5, cursor: "pointer" }}>
                    <GitMerge size={10} /> Keep both
                  </button>
                  <button onClick={() => deleteBoth(a, b)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(239,68,68,0.15)", background: "rgba(239,68,68,0.05)", color: "rgba(239,68,68,0.55)", fontSize: 11.5, cursor: "pointer" }}>
                    <Trash2 size={10} /> Delete both
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Memory compression */}
      {userId && onRefresh && (
        <CompressSection memories={memories} userId={userId} onRefresh={onRefresh} />
      )}
    </div>
  );
}
