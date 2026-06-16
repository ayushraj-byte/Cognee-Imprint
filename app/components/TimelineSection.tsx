"use client";

import { Pin, Trash2, Edit3, Check, X } from "lucide-react";
import { useState } from "react";

const TOPIC_META: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
  projects:      { color: "#7c3aed", bg: "#7c3aed18", label: "Projects",      emoji: "🚀" },
  work:          { color: "#0070f3", bg: "#0070f318", label: "Work",           emoji: "💼" },
  preferences:   { color: "#d97706", bg: "#d9770618", label: "Preferences",   emoji: "⭐" },
  personal:      { color: "#059669", bg: "#05966918", label: "Personal",      emoji: "👤" },
  health:        { color: "#e11d48", bg: "#e11d4818", label: "Health",        emoji: "❤️" },
  relationships: { color: "#8b5cf6", bg: "#8b5cf618", label: "Relationships", emoji: "🤝" },
  general:       { color: "#6b7280", bg: "#6b728018", label: "General",       emoji: "📌" },
};

function bucket(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7)  return "This week";
  if (diff < 30) return "This month";
  return "Older";
}

const BUCKET_ORDER = ["Today", "Yesterday", "This week", "This month", "Older"];

export default function TimelineSection({ memories, onDelete, onPin }: {
  memories: any[];
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText]   = useState("");

  const sorted = [...memories].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const grouped = BUCKET_ORDER.reduce((acc, b) => {
    const items = sorted.filter(m => bucket(new Date(m.createdAt)) === b);
    if (items.length) acc[b] = items;
    return acc;
  }, {} as Record<string, any[]>);

  if (!memories.length) return (
    <div style={{ animation: "fade-in 0.3s ease both" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,0.9)", marginBottom: 4 }}>Timeline</h1>
      <p style={{ color: "rgba(255,255,255,0.2)", marginTop: 60, textAlign: "center" }}>No memories yet — start chatting in any connected IDE.</p>
    </div>
  );

  return (
    <div style={{ animation: "fade-in 0.3s ease both", maxWidth: 680 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em", marginBottom: 4 }}>Timeline</h1>
        <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.3)" }}>When Imprint learned what it knows about you</p>
      </div>

      {Object.entries(grouped).map(([label, items]) => (
        <div key={label} style={{ marginBottom: 32, position: "relative" }}>
          {/* Bucket label */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.15)" }}>({items.length})</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.05)" }} />
          </div>

          {/* Timeline entries */}
          <div style={{ position: "relative" }}>
            {/* Vertical line */}
            <div style={{ position: "absolute", left: 5, top: 8, bottom: 8, width: 1, background: "rgba(255,255,255,0.06)" }} />

            {items.map((m, i) => {
              const meta = TOPIC_META[m.topic] || { color: "#6b7280", bg: "#6b728018", label: m.topic, emoji: "📌" };
              return (
                <div key={m.id} className="mem-row" style={{ display: "flex", gap: 16, marginBottom: 10, position: "relative" }}>
                  {/* Dot */}
                  <div style={{ width: 11, height: 11, borderRadius: "50%", background: m.pinned ? "#cf8f6d" : meta.color, border: `2px solid #111110`, flexShrink: 0, marginTop: 10, zIndex: 1 }} />

                  {/* Card */}
                  <div style={{ flex: 1, background: m.pinned ? "rgba(207,143,109,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${m.pinned ? "rgba(207,143,109,0.12)" : "rgba(255,255,255,0.05)"}`, borderRadius: 10, padding: "10px 14px", transition: "background 0.15s" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: meta.color, background: meta.bg, border: `1px solid ${meta.color}22`, borderRadius: 20, padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            {meta.emoji} {meta.label}
                          </span>
                          {m.pinned && <Pin size={10} style={{ color: "rgba(207,143,109,0.7)", fill: "rgba(207,143,109,0.4)" }} />}
                        </div>

                        {editingId === m.id ? (
                          <div>
                            <input value={editText} onChange={e => setEditText(e.target.value)}
                              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 10px", fontSize: 13, color: "rgba(255,255,255,0.85)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                              autoFocus onKeyDown={e => { if (e.key === "Escape") setEditingId(null); }} />
                            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                              <button onClick={() => setEditingId(null)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, background: "rgba(207,143,109,0.15)", border: "none", color: "#cf8f6d", fontSize: 11.5, cursor: "pointer" }}><Check size={10} />Done</button>
                              <button onClick={() => setEditingId(null)} style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 11.5, cursor: "pointer" }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.65)", margin: 0, lineHeight: 1.5 }}>{m.content}</p>
                        )}

                        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.18)" }}>
                            {new Date(m.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </span>
                          {((m as any)._raw?.source || m.source) && (
                            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)", borderRadius: 4, padding: "1px 6px" }}>
                              via {(m as any)._raw?.source || m.source}
                            </span>
                          )}
                        </div>
                      </div>

                      {editingId !== m.id && (
                        <div className="mem-actions" style={{ display: "flex", gap: 3, opacity: 0, transition: "opacity 0.15s", flexShrink: 0 }}>
                          <button onClick={() => onPin(m.id)} title={m.pinned ? "Unpin" : "Pin"}
                            style={{ width: 24, height: 24, borderRadius: 6, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: m.pinned ? "rgba(207,143,109,0.8)" : "rgba(255,255,255,0.25)" }}>
                            <Pin size={11} style={{ fill: m.pinned ? "rgba(207,143,109,0.5)" : "none" }} />
                          </button>
                          <button onClick={() => { setEditingId(m.id); setEditText(m.content); }} title="Edit"
                            style={{ width: 24, height: 24, borderRadius: 6, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.25)" }}>
                            <Edit3 size={11} />
                          </button>
                          <button onClick={() => onDelete(m.id)} title="Delete"
                            style={{ width: 24, height: 24, borderRadius: 6, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.25)" }}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "rgba(239,68,68,0.7)"}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.25)"}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
