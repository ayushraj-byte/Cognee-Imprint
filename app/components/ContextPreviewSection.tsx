"use client";

import { useState } from "react";
import { Copy, Eye, Check } from "lucide-react";

const TOPIC_META: Record<string, { color: string; label: string; emoji: string }> = {
  projects:      { color: "#7c3aed", label: "Projects",      emoji: "🚀" },
  work:          { color: "#0070f3", label: "Work",           emoji: "💼" },
  preferences:   { color: "#d97706", label: "Preferences",   emoji: "⭐" },
  personal:      { color: "#059669", label: "Personal",      emoji: "👤" },
  health:        { color: "#e11d48", label: "Health",        emoji: "❤️" },
  relationships: { color: "#8b5cf6", label: "Relationships", emoji: "🤝" },
  general:       { color: "#6b7280", label: "General",       emoji: "📌" },
};

function buildPreview(memories: any[]): string {
  const pinned = memories.filter(m => m.pinned);
  const rest   = memories.filter(m => !m.pinned);

  let ctx = "You are a helpful AI assistant with persistent memory about this user.\n\n";
  ctx += "=== What you know about this user (from past conversations) ===\n";

  if (pinned.length) {
    ctx += "\n[ALWAYS REMEMBER]\n";
    ctx += pinned.map(m => `• ${m.content}`).join("\n");
  }

  const byTopic = rest.reduce((acc: Record<string, string[]>, m) => {
    (acc[m.topic] = acc[m.topic] || []).push(m.content);
    return acc;
  }, {});

  for (const [topic, items] of Object.entries(byTopic)) {
    ctx += `\n[${topic.toUpperCase()}]\n`;
    ctx += items.map(i => `• ${i}`).join("\n");
  }

  ctx += "\n\nUse this knowledge naturally — don't explicitly say 'I remember that you...', just know it.";
  return ctx;
}

export default function ContextPreviewSection({ memories }: { memories: any[] }) {
  const [copied, setCopied] = useState(false);
  const [limit, setLimit] = useState(20);

  const sorted = [...memories]
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  const preview = buildPreview(sorted);
  const tokens  = Math.round(preview.length / 4);
  const pinnedCount = sorted.filter(m => m.pinned).length;

  function copy() {
    navigator.clipboard.writeText(preview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ animation: "fade-in 0.3s ease both", maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em", marginBottom: 4 }}>Context preview</h1>
        <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.3)" }}>Exactly what your AI will know at the start of the next session</p>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "8px 14px" }}>
          <Eye size={13} style={{ color: "rgba(255,255,255,0.3)" }} />
          <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)" }}>Showing top</span>
          <select value={limit} onChange={e => setLimit(Number(e.target.value))}
            style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.75)", fontSize: 12.5, outline: "none", cursor: "pointer" }}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={40}>40</option>
            <option value={999}>all</option>
          </select>
          <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)" }}>memories</span>
        </div>

        <div style={{ display: "flex", gap: 10, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
          <span>~{tokens.toLocaleString()} tokens</span>
          <span>·</span>
          <span>{pinnedCount} pinned</span>
          <span>·</span>
          <span>{sorted.length} injected</span>
        </div>

        <button onClick={copy}
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: `1px solid ${copied ? "rgba(207,143,109,0.35)" : "rgba(255,255,255,0.08)"}`, background: copied ? "rgba(207,143,109,0.1)" : "rgba(255,255,255,0.03)", color: copied ? "#cf8f6d" : "rgba(255,255,255,0.55)", fontSize: 12.5, cursor: "pointer", transition: "all 0.2s" }}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied!" : "Copy context"}
        </button>
      </div>

      {/* Injected memory list */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>What will be injected</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.map((m, i) => {
            const meta = TOPIC_META[m.topic] || { color: "#6b7280", label: m.topic, emoji: "📌" };
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px", background: m.pinned ? "rgba(207,143,109,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${m.pinned ? "rgba(207,143,109,0.1)" : "rgba(255,255,255,0.04)"}`, borderRadius: 8 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", minWidth: 20, paddingTop: 1, fontFamily: "monospace" }}>#{i + 1}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: meta.color, background: `${meta.color}15`, borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap", flexShrink: 0 }}>{meta.emoji}</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", flex: 1, lineHeight: 1.45 }}>{m.content}</span>
                {m.pinned && <span style={{ fontSize: 9, color: "rgba(207,143,109,0.6)", background: "rgba(207,143,109,0.08)", borderRadius: 4, padding: "2px 5px", flexShrink: 0 }}>PINNED</span>}
              </div>
            );
          })}
        </div>
        {memories.length > limit && (
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", marginTop: 10, textAlign: "center" }}>
            +{memories.length - limit} more memories not shown — increase limit above
          </p>
        )}
      </div>

      {/* Raw system prompt preview */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Raw system prompt</p>
        <pre style={{ fontSize: 11.5, color: "rgba(255,255,255,0.3)", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 16px", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace", lineHeight: 1.7, maxHeight: 320, overflow: "auto", margin: 0 }}>
          {preview}
        </pre>
      </div>
    </div>
  );
}
