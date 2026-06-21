"use client";

import { useState, useEffect } from "react";

interface MemoryRule {
  ruleId: string;
  label: string;
  topic: string;
  enabled: boolean;
  keywords?: string[];
  pattern?: string;
  createdAt: string;
}

const TOPIC_COLORS: Record<string, string> = {
  projects: "#4eecd8",
  preferences: "#7c3aed",
  work: "#f97316",
  personal: "#3b82f6",
  health: "#10b981",
  relationships: "#ec4899",
  general: "#6b7280",
};

export default function MemoryRules({ userId }: { userId: string }) {
  const [rules, setRules] = useState<MemoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newRule, setNewRule] = useState({ label: "", topic: "general", keywords: "", pattern: "" });

  useEffect(() => {
    fetch(`/api/rules?userId=${userId}`)
      .then(r => r.json())
      .then(d => { setRules(d.rules || []); setLoading(false); });
  }, [userId]);

  async function toggle(rule: MemoryRule) {
    setSaving(rule.ruleId);
    setRules(prev => prev.map(r => r.ruleId === rule.ruleId ? { ...r, enabled: !r.enabled } : r));
    await fetch("/api/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ruleId: rule.ruleId, enabled: !rule.enabled }),
    });
    setSaving(null);
  }

  async function deleteRule(ruleId: string) {
    setRules(prev => prev.filter(r => r.ruleId !== ruleId));
    await fetch(`/api/rules?userId=${userId}&ruleId=${ruleId}`, { method: "DELETE" });
  }

  async function addRule() {
    if (!newRule.label.trim()) return;
    const body = {
      userId,
      label: newRule.label,
      topic: newRule.topic,
      keywords: newRule.keywords ? newRule.keywords.split(",").map(k => k.trim()).filter(Boolean) : [],
      ...(newRule.pattern ? { pattern: newRule.pattern } : {}),
    };
    const res = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setRules(prev => [...prev, data.rule]);
    setShowAdd(false);
    setNewRule({ label: "", topic: "general", keywords: "", pattern: "" });
  }

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    transition: "opacity 0.2s",
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    color: "#fff",
    padding: "8px 12px",
    fontSize: 14,
    width: "100%",
    outline: "none",
  };

  if (loading) return <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Loading rules…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <h3 style={{ color: "#fff", fontSize: 18, margin: 0, fontFamily: "'Instrument Serif', serif" }}>Memory Rules</h3>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, margin: "4px 0 0" }}>
            Control what your AI assistant remembers automatically from your conversations.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          style={{ background: "#4eecd811", border: "1px solid #4eecd833", color: "#4eecd8", borderRadius: 10, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}
        >
          + Add rule
        </button>
      </div>

      {/* Add rule form */}
      {showAdd && (
        <div style={{ ...cardStyle, flexDirection: "column", alignItems: "stretch", gap: 12, borderColor: "rgba(78,236,216,0.15)" }}>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: 0 }}>New custom rule</p>
          <input style={inputStyle} placeholder="Rule name  e.g. Client names" value={newRule.label} onChange={e => setNewRule(p => ({ ...p, label: e.target.value }))} />
          <select
            style={{ ...inputStyle, width: "auto" }}
            value={newRule.topic}
            onChange={e => setNewRule(p => ({ ...p, topic: e.target.value }))}
          >
            {["projects", "preferences", "work", "personal", "health", "relationships", "general"].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input style={inputStyle} placeholder="Keywords (comma separated)  e.g. client, meeting, deal" value={newRule.keywords} onChange={e => setNewRule(p => ({ ...p, keywords: e.target.value }))} />
          <input style={inputStyle} placeholder="Custom regex pattern (optional)" value={newRule.pattern} onChange={e => setNewRule(p => ({ ...p, pattern: e.target.value }))} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addRule} style={{ background: "#4eecd8", color: "#000", border: "none", borderRadius: 10, padding: "8px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Save</button>
            <button onClick={() => setShowAdd(false)} style={{ background: "transparent", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {rules.map(rule => {
        const color = TOPIC_COLORS[rule.topic] || "#6b7280";
        return (
          <div key={rule.ruleId} style={{ ...cardStyle, opacity: rule.enabled ? 1 : 0.45 }}>
            {/* Toggle */}
            <div
              onClick={() => toggle(rule)}
              style={{
                width: 40, height: 22, borderRadius: 11, cursor: "pointer", flexShrink: 0,
                background: rule.enabled ? color : "rgba(255,255,255,0.1)",
                position: "relative", transition: "background 0.2s",
              }}
            >
              <div style={{
                position: "absolute", top: 3, left: rule.enabled ? 21 : 3,
                width: 16, height: 16, borderRadius: "50%", background: "#fff",
                transition: "left 0.2s",
              }} />
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#fff", fontSize: 14, fontWeight: 500 }}>{rule.label}</span>
                <span style={{ fontSize: 11, color, background: `${color}15`, border: `1px solid ${color}30`, borderRadius: 6, padding: "1px 7px" }}>{rule.topic}</span>
                {saving === rule.ruleId && <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>saving…</span>}
              </div>
              {rule.keywords && rule.keywords.length > 0 && (
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, margin: "3px 0 0" }}>
                  Keywords: {rule.keywords.join(", ")}
                </p>
              )}
            </div>

            {/* Delete (only custom rules) */}
            {!rule.ruleId.startsWith("default-") && (
              <button
                onClick={() => deleteRule(rule.ruleId)}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 16, padding: 4 }}
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
