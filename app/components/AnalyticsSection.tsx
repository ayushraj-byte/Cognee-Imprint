"use client";

import { useState } from "react";
import { Download } from "lucide-react";

const TOPIC_META: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
  projects:      { color: "#7c3aed", bg: "#7c3aed18", label: "Projects",      emoji: "🚀" },
  work:          { color: "#0070f3", bg: "#0070f318", label: "Work",           emoji: "💼" },
  preferences:   { color: "#d97706", bg: "#d9770618", label: "Preferences",   emoji: "⭐" },
  personal:      { color: "#059669", bg: "#05966918", label: "Personal",      emoji: "👤" },
  health:        { color: "#e11d48", bg: "#e11d4818", label: "Health",        emoji: "❤️" },
  relationships: { color: "#8b5cf6", bg: "#8b5cf618", label: "Relationships", emoji: "🤝" },
  general:       { color: "#6b7280", bg: "#6b728018", label: "General",       emoji: "📌" },
};

function StatCard({ label, value, accent, sub }: { label: string; value: number | string; accent: string; sub?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "16px 18px" }}>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 600, color: accent, margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

export default function AnalyticsSection({ memories, sessions }: {
  memories: any[];
  sessions: any[];
}) {
  const [exportCopied, setExportCopied] = useState(false);

  const topicCounts = Object.entries(
    memories.reduce((acc: Record<string, number>, m) => {
      acc[m.topic] = (acc[m.topic] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const maxTopicCount = Math.max(...topicCounts.map(([, c]) => c as number), 1);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      count: memories.filter(m => {
        const md = new Date(m.createdAt);
        return md.toDateString() === d.toDateString();
      }).length,
    };
  });

  const maxDayCount = Math.max(...last7.map(d => d.count), 1);

  const sources = memories.reduce((acc: Record<string, number>, m) => {
    const src = (m as any)._raw?.source || m.source || "chat";
    const label = src === "claude-code" ? "Claude Code" : src === "cursor" ? "Cursor" : src === "codex" ? "Codex" : src === "antigravity" ? "Antigravity" : src === "import" ? "Import" : src === "manual" ? "Manual" : "Other";
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const pinnedCount = memories.filter(m => m.pinned).length;
  const topicsUsed = new Set(memories.map(m => m.topic)).size;
  const totalMsgs = sessions.reduce((s: number, ss: any) => s + ss.messageCount, 0);

  function exportMarkdown() {
    const lines: string[] = [
      "# My Imprint Memory Profile",
      `*Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}*`,
      "",
      "## Stats",
      `- **Total memories:** ${memories.length}`,
      `- **Pinned:** ${pinnedCount}`,
      `- **Topics covered:** ${topicsUsed}`,
      `- **Sessions:** ${sessions.length}`,
      "",
    ];

    const byTopic = memories.reduce((acc: Record<string, any[]>, m) => {
      if (!acc[m.topic]) acc[m.topic] = [];
      acc[m.topic].push(m);
      return acc;
    }, {});

    for (const [topic, mems] of Object.entries(byTopic)) {
      const meta = TOPIC_META[topic] || { label: topic, emoji: "📌" };
      lines.push(`## ${meta.emoji} ${meta.label}`);
      for (const m of mems as any[]) {
        lines.push(`- ${m.pinned ? "📌 " : ""}${m.content}`);
      }
      lines.push("");
    }

    lines.push("---");
    lines.push("*Powered by [Imprint](https://imprint-ebon.vercel.app)*");

    const md = lines.join("\n");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `imprint-memories-${new Date().toISOString().split("T")[0]}.md`; a.click();
    URL.revokeObjectURL(url);
  }

  function copyObsidian() {
    const lines: string[] = ["---", "tags: [imprint, memory]", `date: ${new Date().toISOString().split("T")[0]}`, "---", "", "# Imprint Memory Graph", ""];
    const byTopic = memories.reduce((acc: Record<string, any[]>, m) => { if (!acc[m.topic]) acc[m.topic] = []; acc[m.topic].push(m); return acc; }, {});
    for (const [topic, mems] of Object.entries(byTopic)) {
      const meta = TOPIC_META[topic] || { label: topic, emoji: "📌" };
      lines.push(`## ${meta.emoji} ${meta.label}`);
      for (const m of mems as any[]) lines.push(`- [ ] ${m.content}${m.pinned ? " #pinned" : ""}`);
      lines.push("");
    }
    navigator.clipboard.writeText(lines.join("\n"));
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 2000);
  }

  return (
    <div style={{ animation: "fade-in 0.3s ease both", maxWidth: 780 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em", marginBottom: 4 }}>Analytics</h1>
          <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.3)" }}>Your memory profile at a glance</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={copyObsidian}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: exportCopied ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.03)", color: exportCopied ? "#a78bfa" : "rgba(255,255,255,0.45)", fontSize: 12.5, cursor: "pointer" }}>
            {exportCopied ? "✓ Copied!" : "Copy for Obsidian"}
          </button>
          <button onClick={exportMarkdown}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.45)", fontSize: 12.5, cursor: "pointer" }}>
            <Download size={12} /> Export .md
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        <StatCard label="Total memories" value={memories.length} accent="#4eecd8" />
        <StatCard label="Pinned" value={pinnedCount} accent="#cf8f6d" sub="always injected" />
        <StatCard label="Sessions" value={sessions.length} accent="#7c3aed" sub={`${totalMsgs} messages`} />
        <StatCard label="Topics" value={topicsUsed} accent="#10a37f" sub="active" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Topic distribution */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "18px 20px" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 16px" }}>Topic distribution</p>
          {topicCounts.length === 0 ? (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.2)" }}>No memories yet.</p>
          ) : topicCounts.map(([topic, count]) => {
            const meta = TOPIC_META[topic] || { color: "#6b7280", label: topic, emoji: "📌" };
            const pct = Math.round(((count as number) / maxTopicCount) * 100);
            return (
              <div key={topic} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{meta.emoji} {meta.label}</span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{count as number}</span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: meta.color, borderRadius: 3, transition: "width 0.6s ease" }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* 7-day growth */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "18px 20px" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 16px" }}>Memory growth — last 7 days</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
            {last7.map((day, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%" }}>
                <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
                  <div style={{
                    width: "100%", borderRadius: "3px 3px 0 0",
                    background: day.count > 0 ? "#4eecd8" : "rgba(255,255,255,0.06)",
                    height: day.count > 0 ? `${Math.max(8, (day.count / maxDayCount) * 100)}%` : "4px",
                    transition: "height 0.4s ease",
                    opacity: i === 6 ? 1 : 0.6 + (i / 6) * 0.4,
                  }} />
                </div>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{day.label}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 10 }}>
            +{last7.reduce((s, d) => s + d.count, 0)} memories this week
          </p>
        </div>
      </div>

      {/* Source breakdown */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "18px 20px" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 14px" }}>Sources — where memories came from</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {Object.entries(sources).length === 0 ? (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.2)" }}>No data yet.</p>
          ) : Object.entries(sources).sort((a, b) => b[1] - a[1]).map(([src, cnt]) => {
            const colors: Record<string, string> = { "Claude Code": "#cf8f6d", "Cursor": "#4eecd8", "Codex": "#10a37f", "Antigravity": "#a855f7", "Other": "#d97706", "Import": "#6b7280", "Manual": "#8b5cf6" };
            const c = colors[src] || "#6b7280";
            const pct = Math.round(((cnt as number) / memories.length) * 100);
            return (
              <div key={src} style={{ background: `${c}12`, border: `1px solid ${c}30`, borderRadius: 10, padding: "10px 14px", minWidth: 100 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{cnt as number}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{src}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 1 }}>{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
