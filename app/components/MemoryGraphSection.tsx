"use client";

import { useState, useEffect, useRef } from "react";

const TOPIC_COLORS: Record<string, string> = {
  projects:      "#7c3aed",
  work:          "#0070f3",
  preferences:   "#d97706",
  personal:      "#059669",
  health:        "#e11d48",
  relationships: "#8b5cf6",
  general:       "#6b7280",
};

const W = 760, H = 520;
const REPULSION = 4000;
const SPRING_K  = 0.04;
const SPRING_LEN = 140;
const DAMPING   = 0.80;
const GRAVITY   = 0.018;
const MAX_NODES = 60;

interface GNode { id: string; content: string; topic: string; pinned: boolean; confidence: number; x: number; y: number; vx: number; vy: number; }
interface GEdge { source: string; target: string; }

function step(nodes: GNode[], edges: GEdge[]) {
  const cx = W / 2, cy = H / 2;
  for (const n of nodes) { n.vx += (cx - n.x) * GRAVITY; n.vy += (cy - n.y) * GRAVITY; }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = REPULSION / (d * d);
      nodes[i].vx -= (dx / d) * f; nodes[i].vy -= (dy / d) * f;
      nodes[j].vx += (dx / d) * f; nodes[j].vy += (dy / d) * f;
    }
  }
  for (const e of edges) {
    const s = nodes.find(n => n.id === e.source), t = nodes.find(n => n.id === e.target);
    if (!s || !t) continue;
    const dx = t.x - s.x, dy = t.y - s.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = (d - SPRING_LEN) * SPRING_K;
    s.vx += (dx / d) * f; s.vy += (dy / d) * f;
    t.vx -= (dx / d) * f; t.vy -= (dy / d) * f;
  }
  for (const n of nodes) {
    n.vx *= DAMPING; n.vy *= DAMPING;
    n.x = Math.max(36, Math.min(W - 36, n.x + n.vx));
    n.y = Math.max(36, Math.min(H - 36, n.y + n.vy));
  }
}

export default function MemoryGraphSection({ memories }: { memories: any[] }) {
  const nodesRef = useRef<GNode[]>([]);
  const edgesRef = useRef<GEdge[]>([]);
  const rafRef   = useRef<number>(0);
  const [, setTick] = useState(0);
  const [hovered,  setHovered]  = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const slice = memories.slice(0, MAX_NODES);
    nodesRef.current = slice.map((m, i) => {
      const angle = (i / Math.max(slice.length, 1)) * 2 * Math.PI;
      const r = 160 + Math.random() * 80;
      return {
        id: m.id, content: m.content, topic: m.topic,
        pinned: !!m.pinned,
        confidence: m._raw?.confidence ?? 0.8,
        x: W / 2 + Math.cos(angle) * r,
        y: H / 2 + Math.sin(angle) * r,
        vx: 0, vy: 0,
      };
    });
    edgesRef.current = [];
    for (const m of slice) {
      for (const otherId of (m._raw?.contradicts ?? [])) {
        edgesRef.current.push({ source: m.id, target: otherId });
      }
    }

    let frame = 0;
    function loop() {
      step(nodesRef.current, edgesRef.current);
      frame++;
      if (frame % 2 === 0) setTick(t => t + 1);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [memories]);

  const nodes = nodesRef.current;
  const edges = edgesRef.current;
  const sel   = selected ? memories.find(m => m.id === selected) : null;

  return (
    <div style={{ animation: "fade-in 0.3s ease both" }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em", marginBottom: 4 }}>Memory Graph</h1>
        <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.3)" }}>
          Force-directed view of your memory store — clusters by topic, red dashed edges show contradictions
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 14 }}>
        {/* Canvas */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
            <defs>
              <radialGradient id="bg" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="rgba(78,236,216,0.03)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
            </defs>
            <rect width={W} height={H} fill="url(#bg)" />

            {/* Contradiction edges */}
            {edges.map((e, i) => {
              const s = nodes.find(n => n.id === e.source);
              const t = nodes.find(n => n.id === e.target);
              if (!s || !t) return null;
              return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="rgba(239,68,68,0.55)" strokeWidth={1.5} strokeDasharray="5 3" />;
            })}

            {/* Nodes */}
            {nodes.map(n => {
              const color = TOPIC_COLORS[n.topic] || "#6b7280";
              const r = n.pinned ? 13 : 7 + n.confidence * 7;
              const isH = hovered === n.id, isS = selected === n.id;
              return (
                <g key={n.id} style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelected(isS ? null : n.id)}
                >
                  {(isH || isS) && <circle cx={n.x} cy={n.y} r={r + 7} fill={color} opacity={0.18} />}
                  <circle cx={n.x} cy={n.y} r={r}
                    fill={color} opacity={isH || isS ? 1 : 0.72}
                    stroke={isS ? "white" : n.pinned ? "rgba(255,255,255,0.5)" : "none"}
                    strokeWidth={isS || n.pinned ? 2 : 0}
                  />
                  {n.pinned && (
                    <text x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="white" style={{ pointerEvents: "none", userSelect: "none" }}>★</text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Side panel */}
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
          {/* Legend */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "13px 15px" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.25)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 10 }}>Topics</p>
            {Object.entries(TOPIC_COLORS).map(([t, c]) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: c, flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)", textTransform: "capitalize" as const }}>{t}</span>
              </div>
            ))}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "9px 0" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <div style={{ width: 22, borderTop: "1.5px dashed rgba(239,68,68,0.5)" }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Contradiction</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: "rgba(255,255,255,0.35)", border: "2px solid rgba(255,255,255,0.55)", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Pinned ★</span>
            </div>
          </div>

          {/* Selected memory */}
          {sel ? (
            <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${TOPIC_COLORS[sel.topic] || "#6b7280"}33`, borderRadius: 12, padding: "13px 15px", flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: TOPIC_COLORS[sel.topic] || "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 8 }}>{sel.topic}</p>
              <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.72)", lineHeight: 1.55, margin: 0 }}>{sel.content}</p>
              <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.18)", marginTop: 10 }}>{new Date(sel.createdAt).toLocaleDateString()}</p>
            </div>
          ) : (
            <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12, padding: "13px 15px", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.18)", textAlign: "center" as const }}>Click a node<br/>to inspect it</p>
            </div>
          )}

          {/* Counts */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "12px 15px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Nodes</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>{nodes.length}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Conflict edges</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: edges.length > 0 ? "rgba(239,68,68,0.7)" : "rgba(5,150,105,0.7)" }}>{edges.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
