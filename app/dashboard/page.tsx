"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useUser, UserButton, SignOutButton } from "@clerk/nextjs";
import {
  Brain, Pin, Trash2, Edit3, Check, X, Plus, Download,
  Upload, Search, Clock, MessageSquare, Star,
  RefreshCw, FileText, Sparkles,
  LogOut, ExternalLink, SlidersHorizontal, Link2, BarChart2,
  Eye, AlertTriangle, Share2, Mic, GitBranch, LayoutGrid,
  Key, Send, Mail, Zap, Layers, Users, UserPlus, Copy
} from "lucide-react";
import MemoryRules from "../components/MemoryRules";
import AnalyticsSection from "../components/AnalyticsSection";
import TimelineSection from "../components/TimelineSection";
import ContextPreviewSection from "../components/ContextPreviewSection";
import ResolverSection from "../components/ResolverSection";
import MemoryGraphSection from "../components/MemoryGraphSection";

import { calculateHealth } from "../../lib/health";

/* ─── Types ─── */
interface Memory {
  id: string;
  content: string;
  topic: Topic;
  pinned: boolean;
  createdAt: Date;
  source: "chat" | "import" | "manual";
}
interface Session {
  id: string;
  title: string;
  date: Date;
  messageCount: number;
  memoriesExtracted: number;
  pinned: boolean;
}
type Topic = "work" | "personal" | "preferences" | "projects" | "health" | "relationships" | "general";
type ActiveSection = "overview" | "memories" | "sessions" | "import" | "rules" | "connect" | "analytics" | "timeline" | "preview" | "resolver" | "graph" | "chat" | "apikeys" | "digest" | "team";
interface ChatMsg { role: "user" | "assistant"; content: string; }

/* ─── Constants ─── */
const TOPIC_META: Record<Topic, { color: string; bg: string; label: string; emoji: string }> = {
  projects:      { color: "#7c3aed", bg: "rgba(124,58,237,0.1)",  label: "Projects",      emoji: "🚀" },
  work:          { color: "#0070f3", bg: "rgba(0,112,243,0.1)",   label: "Work",           emoji: "💼" },
  preferences:   { color: "#d97706", bg: "rgba(217,119,6,0.1)",   label: "Preferences",   emoji: "⭐" },
  personal:      { color: "#059669", bg: "rgba(5,150,105,0.1)",   label: "Personal",      emoji: "👤" },
  health:        { color: "#e11d48", bg: "rgba(225,29,72,0.1)",   label: "Health",        emoji: "❤️" },
  relationships: { color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",  label: "Relationships", emoji: "🤝" },
  general:       { color: "#6b7280", bg: "rgba(107,114,128,0.1)", label: "General",       emoji: "📌" },
};

const IDE_META: Record<string, { name: string; color: string; glyph: string }> = {
  "claude-code": { name: "Claude Code", color: "#CF8F6D", glyph: "⬡" },
  "cursor":      { name: "Cursor",      color: "#D2D2CE", glyph: "◈" },
  "codex":       { name: "Codex",       color: "#10A37F", glyph: "▲" },
  "antigravity": { name: "Antigravity", color: "#3186FF", glyph: "◑" },
  "extension":   { name: "Browser",     color: "#4285F4", glyph: "◎" },
  "chatgpt":     { name: "ChatGPT",     color: "#10A37F", glyph: "◆" },
  "gemini":      { name: "Gemini",      color: "#4285F4", glyph: "◇" },
  "manual":      { name: "Manual",      color: "#6B7280", glyph: "✎" },
  "import":      { name: "Import",      color: "#6B7280", glyph: "⬆" },
};

function normalizeIdeSource(src: string): string {
  if (!src || src === "chat") return "claude-code";
  if (["stop-hook", "session-summary"].includes(src)) return "claude-code";
  return src;
}

function getIdeMeta(src: string) {
  const n = normalizeIdeSource(src);
  return IDE_META[n] || { name: n || "Unknown", color: "#6B7280", glyph: "●" };
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const MOCK_MEMORIES: Memory[] = [
  { id:"m1", content:"Building Imprint — a persistent memory layer for Claude, for the H0 hackathon", topic:"projects", pinned:true, createdAt:new Date("2026-06-04"), source:"chat" },
  { id:"m2", content:"Stack: Next.js 16, DynamoDB, AWS Bedrock, Chrome Extension MV3, Vercel", topic:"work", pinned:true, createdAt:new Date("2026-06-04"), source:"chat" },
  { id:"m3", content:"H0 hackathon deadline is June 29, 2026 — $160K prize pool", topic:"projects", pinned:false, createdAt:new Date("2026-06-05"), source:"chat" },
  { id:"m4", content:"Prefers concise, direct responses with code examples over long explanations", topic:"preferences", pinned:true, createdAt:new Date("2026-06-03"), source:"import" },
  { id:"m5", content:"Based in India, using AWS AISPL account for cloud infrastructure", topic:"personal", pinned:false, createdAt:new Date("2026-06-03"), source:"chat" },
  { id:"m6", content:"Also working on Microsoft Agents League hackathon (Phi-4, deadline June 14)", topic:"projects", pinned:false, createdAt:new Date("2026-06-04"), source:"chat" },
  { id:"m7", content:"Learning Krish Naik ML course and Kunal Kushwaha Java course actively", topic:"work", pinned:false, createdAt:new Date("2026-06-05"), source:"chat" },
  { id:"m8", content:"Competes on Codeforces — solving 2 problems daily", topic:"preferences", pinned:false, createdAt:new Date("2026-06-05"), source:"chat" },
];

const MOCK_SESSIONS: Session[] = [
  { id:"s1", title:"AWS Aurora pgvector Sync", date:new Date("2026-06-06"), messageCount:14, memoriesExtracted:3, pinned:true },
  { id:"s2", title:"Claude Context Optimization", date:new Date("2026-06-05"), messageCount:8, memoriesExtracted:2, pinned:true },
  { id:"s3", title:"DynamoDB Pipeline Redesign", date:new Date("2026-06-04"), messageCount:22, memoriesExtracted:5, pinned:false },
  { id:"s4", title:"Memory Import Session", date:new Date("2026-06-03"), messageCount:6, memoriesExtracted:1, pinned:false },
  { id:"s5", title:"Hackathon Planning", date:new Date("2026-06-02"), messageCount:18, memoriesExtracted:4, pinned:false },
];

/* ─── Export helpers ─── */
function generateReadableExport(memories: Memory[], sessions: Session[]): string {
  const now = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
  const pinned = memories.filter(m => m.pinned);
  const byTopic = memories.reduce((acc, m) => {
    if (!acc[m.topic]) acc[m.topic] = [];
    acc[m.topic].push(m);
    return acc;
  }, {} as Record<string, Memory[]>);
  let out = `═══════════════════════════════════════════════════\n  IMPRINT — My Claude Memory Profile\n  Generated: ${now}\n═══════════════════════════════════════════════════\n\n`;
  out += `📌 ALWAYS REMEMBER (Pinned)\n───────────────────────────\n`;
  if (pinned.length === 0) out += `  No pinned memories yet.\n`;
  else pinned.forEach(m => { out += `  • ${m.content}\n`; });
  out += `\n`;
  Object.entries(byTopic).forEach(([topic, mems]) => {
    const meta = TOPIC_META[topic as Topic];
    out += `${meta.emoji} ${meta.label.toUpperCase()}\n───────────────────────────\n`;
    mems.forEach(m => { out += `  • ${m.content}${m.pinned ? "  ★" : ""}\n`; });
    out += `\n`;
  });
  const pinnedSessions = sessions.filter(s => s.pinned);
  if (pinnedSessions.length > 0) {
    out += `💬 IMPORTANT CONVERSATIONS\n───────────────────────────\n`;
    pinnedSessions.forEach(s => { out += `  • ${s.title} (${s.date.toLocaleDateString()} · ${s.messageCount} messages · ${s.memoriesExtracted} memories)\n`; });
    out += `\n`;
  }
  out += `═══════════════════════════════════════════════════\n  Total memories: ${memories.length} · Pinned: ${pinned.length}\n  Powered by Imprint + AWS DynamoDB\n═══════════════════════════════════════════════════\n`;
  return out;
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Overview / All IDEs panel ─── */
function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="dark-card" style={{ padding: "14px 20px", minWidth: 110 }}>
      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 5px" }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color, margin: 0, lineHeight: 1 }}>{value}</p>
    </div>
  );
}

function OverviewSection({ memories, sessions }: { memories: Memory[]; sessions: Session[] }) {
  const byIde: Record<string, Memory[]> = {};
  for (const m of memories) {
    const src = normalizeIdeSource((m as any)._raw?.source || m.source || "");
    if (!byIde[src]) byIde[src] = [];
    byIde[src].push(m);
  }
  const ideEntries = Object.entries(byIde).sort(([,a],[,b]) => b.length - a.length);
  const recentAll = [...memories]
    .sort((a,b) => new Date((b as any)._raw?.createdAt || b.createdAt).getTime() - new Date((a as any)._raw?.createdAt || a.createdAt).getTime())
    .slice(0, 10);

  return (
    <div style={{ animation: "dash-slide-in 0.35s ease both" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em", margin: "0 0 6px", fontFamily: "'Instrument Serif', serif" }}>
          All IDEs
        </h1>
        <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.35)" }}>
          {memories.length} memories across {ideEntries.length} source{ideEntries.length !== 1 ? "s" : ""} · {sessions.length} sessions tracked
        </p>
      </div>

      {/* Stat pills */}
      <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
        <StatPill label="Total memories" value={memories.length} color="#cf8f6d" />
        <StatPill label="Pinned" value={memories.filter(m => m.pinned).length} color="#7c3aed" />
        <StatPill label="Sources" value={ideEntries.length} color="#4eecd8" />
        <StatPill label="Sessions" value={sessions.length} color="#0070f3" />
      </div>

      {/* IDE cards */}
      {ideEntries.length > 0 ? (
        <>
          <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 14 }}>Connected sources</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14, marginBottom: 36 }}>
            {ideEntries.map(([ide, mems]) => {
              const meta = getIdeMeta(ide);
              const latest = [...mems].sort((a,b) => new Date((b as any)._raw?.createdAt || b.createdAt).getTime() - new Date((a as any)._raw?.createdAt || a.createdAt).getTime())[0];
              return (
                <div key={ide} className="dark-card" style={{ padding: "20px 22px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: -20, right: -10, fontSize: 80, opacity: 0.04, lineHeight: 1, color: meta.color, pointerEvents: "none" }}>{meta.glyph}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 24, lineHeight: 1, color: meta.color }}>{meta.glyph}</span>
                    <div>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,0.82)", margin: 0 }}>{meta.name}</p>
                      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", margin: 0 }}>via MCP</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 34, fontWeight: 700, color: meta.color, lineHeight: 1 }}>{mems.length}</span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>memories</span>
                  </div>
                  {latest && (
                    <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.28)", lineHeight: 1.5, margin: 0,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                      {latest.content}
                    </p>
                  )}
                  {latest && (
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", margin: "8px 0 0" }}>
                      Last: {timeAgo(new Date((latest as any)._raw?.createdAt || latest.createdAt))}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="dark-panel" style={{ padding: "48px 0", textAlign: "center", marginBottom: 32 }}>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 15, margin: "0 0 8px" }}>No memories yet</p>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, margin: 0 }}>Connect an IDE or install the extension to start building your memory graph.</p>
        </div>
      )}

      {/* Recent unified feed */}
      {recentAll.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>Recent across all sources</p>
          {recentAll.map(m => {
            const src = normalizeIdeSource((m as any)._raw?.source || m.source);
            const meta = getIdeMeta(src);
            const topicMeta = TOPIC_META[m.topic] || TOPIC_META.general;
            return (
              <div key={m.id} className="dark-card" style={{ padding: "13px 16px", marginBottom: 6, display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 18, lineHeight: 1, color: meta.color, marginTop: 1, flexShrink: 0 }}>{meta.glyph}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: meta.color }}>{meta.name}</span>
                    <span style={{ width: 2, height: 2, borderRadius: "50%", background: "rgba(255,255,255,0.2)", flexShrink: 0 }}/>
                    <span style={{ fontSize: 10, color: topicMeta.color, background: topicMeta.bg, borderRadius: 10, padding: "1px 7px" }}>
                      {topicMeta.emoji} {topicMeta.label}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.62)", lineHeight: 1.45, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.content}
                  </p>
                </div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", flexShrink: 0, marginTop: 2 }}>
                  {timeAgo(new Date((m as any)._raw?.createdAt || m.createdAt))}
                </span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN DASHBOARD
══════════════════════════════════════════════════ */
export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("userId") : null);
  const [loading, setLoading] = useState(true);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [newMemoryIds, setNewMemoryIds] = useState<Set<string>>(new Set());
  const lastCountRef = useRef(0);

  function mapApiMemory(m: any): Memory {
    return {
      id: m.memoryId,
      content: m.content,
      topic: (m.topic || "general") as Topic,
      pinned: !!m.pinned,
      createdAt: new Date(m.createdAt),
      source: (m.source === "import" ? "import" : m.source === "manual" ? "manual" : "chat"),
      _raw: m,
    } as any;
  }

  async function loadMemories() {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/memories?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      setMemories((data.memories || []).map(mapApiMemory));
    } catch (e) { console.error("Failed to load memories", e); }
    finally { setLoading(false); }
  }

  async function loadSessions() {
    if (!userId) return;
    try {
      const res = await fetch(`/api/sessions?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      setSessions((data.sessions || []).map((s: any) => ({ ...s, date: new Date(s.date) })));
    } catch (e) { console.error("Failed to load sessions", e); }
  }

  useEffect(() => { if (isLoaded && userId) { loadMemories(); loadSessions(); } }, [isLoaded, userId]);

  // Real-time polling — detects new memories every 3s and animates them in
  useEffect(() => {
    if (!userId) return;
    setIsLive(true);
    const poll = async () => {
      try {
        const res = await fetch(`/api/memories?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();
        const incoming: Memory[] = (data.memories || []).map(mapApiMemory);
        if (lastCountRef.current > 0 && incoming.length > lastCountRef.current) {
          setMemories(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const brandNew = incoming.filter(m => !existingIds.has(m.id));
            if (brandNew.length > 0) {
              setNewMemoryIds(new Set(brandNew.map(m => m.id)));
              setTimeout(() => setNewMemoryIds(new Set()), 3500);
              return incoming;
            }
            return prev;
          });
        }
        lastCountRef.current = incoming.length;
      } catch {}
    };
    const iv = setInterval(poll, 3000);
    return () => { clearInterval(iv); setIsLive(false); };
  }, [userId]);

  const [section, setSection] = useState<ActiveSection>("overview");
  const [search, setSearch] = useState("");
  const [filterTopic, setFilterTopic] = useState<Topic | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMemory, setNewMemory] = useState("");
  const [newTopic, setNewTopic] = useState<Topic>("general");
  const [privacyMode, setPrivacyMode] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareModal, setShareModal] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [nlInstruction, setNlInstruction] = useState("");
  const [nlUpdating, setNlUpdating] = useState(false);
  const [nlResult, setNlResult] = useState<string | null>(null);

  // Chat with memories
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const [chatStreamText, setChatStreamText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Consolidate
  const [consolidating, setConsolidating] = useState<Record<string, boolean>>({});
  const [consolidateResult, setConsolidateResult] = useState<Record<string, string>>({});

  // API keys
  const [apiKeyData, setApiKeyData] = useState<{ masked: string | null; hasKey: boolean } | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [newlyGenKey, setNewlyGenKey] = useState<string | null>(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  // Digest
  const [digestData, setDigestData] = useState<any>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestEmail, setDigestEmail] = useState("");
  const [digestStatus, setDigestStatus] = useState<string | null>(null);

  // Team / Org
  const [orgData, setOrgData] = useState<{ orgId: string; name: string; memberIds: string[]; adminUserId: string } | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgNameInput, setOrgNameInput] = useState("");
  const [orgJoinId, setOrgJoinId] = useState("");
  const [orgMemories, setOrgMemories] = useState<Memory[]>([]);
  const [orgMemoryInput, setOrgMemoryInput] = useState("");
  const [orgCopied, setOrgCopied] = useState(false);

  const pinnedCount = memories.filter(m => m.pinned).length;
  const health = calculateHealth(memories);
  const now = Date.now();
  const isStale = (m: Memory) => {
    const days = (now - new Date((m as any)._raw?.createdAt ?? m.createdAt).getTime()) / 86_400_000;
    return !m.pinned && days > 14 && ((m as any)._raw?.accessCount ?? 0) < 2;
  };
  const filtered = memories
    .filter(m => filterTopic === "all" || m.topic === filterTopic)
    .filter(m => !search || m.content.toLowerCase().includes(search.toLowerCase()));
  const byTopic = filtered.reduce((acc, m) => {
    if (!acc[m.topic]) acc[m.topic] = [];
    acc[m.topic].push(m);
    return acc;
  }, {} as Record<string, Memory[]>);

  function rawOf(m: Memory): any { return (m as any)._raw || {}; }

  async function togglePin(id: string) {
    const m = memories.find(x => x.id === id);
    if (!m || !userId) return;
    const nextPinned = !m.pinned;
    setMemories(p => p.map(x => x.id === id ? { ...x, pinned: nextPinned } : x));
    try {
      await fetch(`/api/memories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, createdAt: rawOf(m).createdAt, pinned: nextPinned }),
      });
    } catch { setMemories(p => p.map(x => x.id === id ? { ...x, pinned: !nextPinned } : x)); }
  }

  async function deleteMemory(id: string) {
    const m = memories.find(x => x.id === id);
    if (!m || !userId) return;
    setMemories(p => p.filter(x => x.id !== id));
    try {
      await fetch(`/api/memories?userId=${encodeURIComponent(userId)}&memoryId=${id}&createdAt=${encodeURIComponent(rawOf(m).createdAt)}`, { method: "DELETE" });
    } catch { loadMemories(); }
  }

  function startEdit(m: Memory) { setEditingId(m.id); setEditText(m.content); }

  async function saveEdit(id: string) {
    const m = memories.find(x => x.id === id);
    if (!m || !userId) return;
    setMemories(p => p.map(x => x.id === id ? { ...x, content: editText } : x));
    setEditingId(null);
    try {
      await fetch(`/api/memories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, createdAt: rawOf(m).createdAt, content: editText }),
      });
    } catch { loadMemories(); }
  }

  async function addMemory() {
    if (!newMemory.trim() || !userId) return;
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, content: newMemory.trim(), topic: newTopic, source: "manual" }),
      });
      const data = await res.json();
      if (data.memory) setMemories(p => [mapApiMemory(data.memory), ...p]);
    } catch { loadMemories(); }
    setNewMemory(""); setNewTopic("general"); setShowAddModal(false);
  }

  function toggleSessionPin(id: string) {
    setSessions(p => p.map(x => x.id === id ? { ...x, pinned: !x.pinned } : x));
  }

  function toggleSelect(id: string) {
    setSelectedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function deleteSelected() {
    for (const id of selectedIds) await deleteMemory(id);
    setSelectedIds(new Set());
  }

  async function pinSelected() {
    for (const id of selectedIds) await togglePin(id);
    setSelectedIds(new Set());
  }

  async function runNlUpdate() {
    if (!nlInstruction.trim() || !userId) return;
    setNlUpdating(true); setNlResult(null);
    try {
      const res = await fetch("/api/nl-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, instruction: nlInstruction.trim() }),
      });
      const data = await res.json();
      setNlResult(data.result ? `✓ ${data.result}` : data.error ? `✗ ${data.error}` : "✓ Done");
      if (!data.error) { loadMemories(); setNlInstruction(""); }
    } catch { setNlResult("✗ Failed"); }
    setNlUpdating(false);
  }

  async function sendChatMessage() {
    if (!chatInput.trim() || chatStreaming || !userId) return;
    const msg = chatInput.trim();
    setChatInput("");
    const newMsgs: ChatMsg[] = [...chatMessages, { role: "user", content: msg }];
    setChatMessages(newMsgs);
    setChatStreaming(true);
    setChatStreamText("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs, userId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setChatMessages(p => [...p, { role: "assistant", content: err.error || (res.status === 403 ? "No Anthropic API key stored. Add one in your profile settings." : "Request failed.") }]);
        setChatStreaming(false);
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break;
          try {
            const p = JSON.parse(raw);
            if (p.type === "content_block_delta" && p.delta?.type === "text_delta") {
              full += p.delta.text;
              setChatStreamText(full);
              chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }
          } catch {}
        }
      }
      setChatMessages(p => [...p, { role: "assistant", content: full || "…" }]);
      setChatStreamText("");
    } catch {
      setChatMessages(p => [...p, { role: "assistant", content: "Network error. Please try again." }]);
    }
    setChatStreaming(false);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function consolidateTopic(topic: string) {
    if (!userId) return;
    setConsolidating(p => ({ ...p, [topic]: true }));
    try {
      const res = await fetch("/api/memories/compress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, topic }),
      });
      const data = await res.json();
      const msg = data.memory ? "✓ Consolidated" : data.error || "✗ Need ≥3 unpinned";
      setConsolidateResult(p => ({ ...p, [topic]: msg }));
      if (data.memory) loadMemories();
    } catch {
      setConsolidateResult(p => ({ ...p, [topic]: "✗ Error" }));
    }
    setConsolidating(p => ({ ...p, [topic]: false }));
    setTimeout(() => setConsolidateResult(p => { const n = { ...p }; delete n[topic]; return n; }), 3500);
  }

  async function loadApiKey() {
    if (!userId) return;
    setApiKeyLoading(true);
    try {
      const res = await fetch(`/api/keys?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      setApiKeyData({ masked: data.key ?? null, hasKey: !!data.hasKey });
    } catch {}
    setApiKeyLoading(false);
  }

  async function generateApiKey() {
    if (!userId) return;
    setApiKeyLoading(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      setNewlyGenKey(data.key);
      setApiKeyData({ masked: null, hasKey: true });
    } catch {}
    setApiKeyLoading(false);
  }

  async function revokeApiKey() {
    if (!userId) return;
    setApiKeyLoading(true);
    try {
      await fetch("/api/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      setApiKeyData({ masked: null, hasKey: false });
      setNewlyGenKey(null);
    } catch {}
    setApiKeyLoading(false);
  }

  async function loadOrgData(orgId: string) {
    if (!userId) return;
    setOrgLoading(true);
    try {
      const res = await fetch(`/api/org?orgId=${encodeURIComponent(orgId)}&userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.org) {
        setOrgData(data.org);
        setOrgMemories((data.memories || []).map(mapApiMemory));
      }
    } catch {}
    setOrgLoading(false);
  }

  async function createOrg() {
    if (!userId || !orgNameInput.trim()) return;
    setOrgLoading(true);
    try {
      const res = await fetch("/api/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgNameInput.trim(), adminUserId: userId }),
      });
      const data = await res.json();
      if (data.org) { setOrgData(data.org); setOrgMemories([]); setOrgNameInput(""); }
    } catch {}
    setOrgLoading(false);
  }

  async function joinOrg() {
    if (!userId || !orgJoinId.trim()) return;
    setOrgLoading(true);
    try {
      await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: orgJoinId.trim(), userId }),
      });
      await loadOrgData(orgJoinId.trim());
      setOrgJoinId("");
    } catch {}
    setOrgLoading(false);
  }

  async function saveOrgMemory() {
    if (!orgData || !orgMemoryInput.trim() || !userId) return;
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: `org_${orgData.orgId}`, content: orgMemoryInput.trim(), topic: "general", source: "team" }),
      });
      const data = await res.json();
      if (data.memory) setOrgMemories(p => [mapApiMemory(data.memory), ...p]);
    } catch {}
    setOrgMemoryInput("");
  }

  async function runDigest() {
    if (!userId) return;
    setDigestLoading(true);
    setDigestStatus(null);
    try {
      const res = await fetch("/api/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email: digestEmail.trim() || undefined }),
      });
      const data = await res.json();
      setDigestData(data.digest);
      setDigestStatus(data.emailStatus === "sent" ? "✓ Email sent" : data.emailStatus === "no_resend_key" ? "Generated (add RESEND_API_KEY to send email)" : "Generated");
    } catch { setDigestStatus("✗ Failed"); }
    setDigestLoading(false);
  }

  async function openShare() {
    if (!userId) return;
    setShareModal(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.token) setShareUrl(`${window.location.origin}/share/${data.token}`);
    } catch {}
  }

  function copyShareUrl() {
    navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  async function runImport() {
    if (!importText.trim() || !userId) return;
    setImporting(true);
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, messages: [{ role: "user", content: importText }], source: "import" }),
      });
      const data = await res.json();
      if (data.memories) setMemories(p => [...data.memories.map(mapApiMemory), ...p]);
    } catch (e) { console.error(e); }
    setImporting(false); setImportDone(true);
    setTimeout(() => { setImportDone(false); setImportText(""); }, 2500);
  }

  /* ── Nav items ── */
  const NAV = [
    { id:"overview",  icon:<LayoutGrid size={15}/>,       label:"Overview",      badge: null },
    { id:"memories",  icon:<Brain size={15}/>,            label:"Memories",      badge: memories.length || null },
    { id:"chat",      icon:<MessageSquare size={15}/>,    label:"Chat",          badge: null },
    { id:"sessions",  icon:<Clock size={15}/>,            label:"Sessions",      badge: sessions.filter(s=>s.pinned).length || null },
    { id:"timeline",  icon:<Layers size={15}/>,           label:"Timeline",      badge: null },
    { id:"analytics", icon:<BarChart2 size={15}/>,        label:"Analytics",     badge: null },
    { id:"preview",   icon:<Eye size={15}/>,              label:"Context",       badge: null },
    { id:"resolver",  icon:<AlertTriangle size={15}/>,    label:"Conflicts",     badge: memories.filter(m=>(m as any)._raw?.contradicts?.length>0).length || null },
    { id:"graph",     icon:<Share2 size={15}/>,           label:"Memory graph",  badge: null },
    { id:"import",    icon:<Upload size={15}/>,           label:"Import",        badge: null },
    { id:"rules",     icon:<SlidersHorizontal size={15}/>,label:"Rules",         badge: null },
    { id:"connect",   icon:<Link2 size={15}/>,            label:"Connect",       badge: null },
    { id:"apikeys",   icon:<Key size={15}/>,              label:"API Keys",      badge: null },
    { id:"digest",    icon:<Mail size={15}/>,             label:"Digest",        badge: null },
    { id:"team",      icon:<Users size={15}/>,            label:"Team",          badge: null },
  ];

  // Load API key info when switching to that section
  useEffect(() => {
    if (section === "apikeys" && apiKeyData === null && userId) loadApiKey();
    if (section === "team" && orgData === null && userId) {
      // Check if user already belongs to an org by fetching user profile
      fetch(`/api/user?userId=${encodeURIComponent(userId)}`)
        .then(r => r.json())
        .then(data => { if (data.orgId) loadOrgData(data.orgId); })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "white", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes fade-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .mem-row:hover .mem-actions { opacity:1!important }
        .sess-row:hover .sess-actions { opacity:1!important }
        ::-webkit-scrollbar { width:4px } ::-webkit-scrollbar-track { background:transparent }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:4px }
        .nav-btn:hover { background:rgba(255,255,255,0.04)!important; color:rgba(255,255,255,0.75)!important; }
      `}</style>

      {/* Layout */}
      <div style={{ display: "flex", minHeight: "100vh" }}>

        {/* ── GLASS SIDEBAR ── */}
        <aside className="dark-sidebar" style={{ width: 220, flexShrink: 0, position: "sticky", top: 0, height: "100vh", display: "flex", flexDirection: "column" }}>
          {/* Logo */}
          <div style={{ padding: "20px 16px 16px" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,#cf8f6d,#c47a4a)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Brain size={13} style={{ color: "white" }}/>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", letterSpacing: "-0.01em" }}>Imprint</span>
            </Link>
          </div>

          {/* Nav */}
          <div style={{ padding: "0 10px 8px", flex: 1, overflowY: "auto" }}>
            {NAV.map(n => (
              <button key={n.id} onClick={() => setSection(n.id as ActiveSection)} className="nav-btn"
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 8px", borderRadius: 6, border: "none",
                  background: section === n.id ? "rgba(255,255,255,0.05)" : "transparent",
                  color: section === n.id ? "rgba(255,255,255,0.85)" : "#555",
                  fontSize: 13, fontWeight: section === n.id ? 500 : 400, cursor: "pointer", marginBottom: 2, textAlign: "left" as const,
                  transition: "background 0.15s, color 0.15s" }}>
                <span style={{ color: section === n.id ? "rgba(255,255,255,0.65)" : "#444" }}>{n.icon}</span>
                <span style={{ flex: 1 }}>{n.label}</span>
                {n.badge != null && n.badge > 0 && (
                  <span style={{ fontSize: 10, background: section === n.id ? "rgba(207,143,109,0.15)" : "#1c1c1c", color: section === n.id ? "rgba(207,143,109,0.9)" : "#444", borderRadius: 10, padding: "1px 7px" }}>{n.badge}</span>
                )}
              </button>
            ))}

            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "10px 4px 10px" }}/>

            {/* Privacy mode */}
            <button onClick={() => setPrivacyMode(p => !p)} className="nav-btn"
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 8px", borderRadius: 6, border: "none",
                background: privacyMode ? "rgba(239,68,68,0.08)" : "transparent",
                color: privacyMode ? "rgba(239,68,68,0.75)" : "#555",
                fontSize: 13, cursor: "pointer", textAlign: "left" as const, marginBottom: 2, transition: "all 0.15s" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: privacyMode ? "#ef4444" : "#444", flexShrink: 0 }}/>
              {privacyMode ? "Privacy ON" : "Privacy mode"}
            </button>

            {/* Share */}
            <button onClick={openShare} className="nav-btn"
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 8px", borderRadius: 6, border: "none",
                background: "transparent", color: "#555",
                fontSize: 13, cursor: "pointer", textAlign: "left" as const, marginBottom: 2, transition: "all 0.15s" }}>
              <Share2 size={14} style={{ color: "#444" }}/>
              Share profile
            </button>

            {/* Open Claude */}
            <button onClick={() => window.open("https://claude.ai", "_blank")} className="nav-btn"
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 8px", borderRadius: 6, border: "none",
                background: "transparent", color: "#555",
                fontSize: 13, cursor: "pointer", textAlign: "left" as const, transition: "all 0.15s" }}>
              <ExternalLink size={14} style={{ color: "#444" }}/>
              Open Claude
            </button>
          </div>

          {/* Stats footer */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "14px" }}>
            {memories.length > 0 && (
              <div style={{ marginBottom: 10, padding: "9px 11px", borderRadius: 8, background: "#141414", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Memory health</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: health.total >= 75 ? "#4eecd8" : health.total >= 50 ? "#fbbf24" : "#ef4444" }}>
                    {health.total}<span style={{ fontSize: 10, fontWeight: 400, marginLeft: 2, opacity: 0.5 }}>/100</span>
                  </span>
                </div>
                <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${health.total}%`, background: health.total >= 75 ? "#4eecd8" : health.total >= 50 ? "#fbbf24" : "#ef4444", borderRadius: 2, transition: "width 0.5s" }}/>
                </div>
                {health.staleCount > 0 && <p style={{ fontSize: 10, color: "rgba(251,191,36,0.6)", marginTop: 4 }}>⚠ {health.staleCount} stale</p>}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.22)" }}>Memories</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>{memories.length}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.22)" }}>Pinned</span>
              <span style={{ fontSize: 11, color: "rgba(207,143,109,0.7)", fontWeight: 600 }}>{pinnedCount}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.22)" }}>Sessions</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>{sessions.length}</span>
            </div>
            {user && (
              <div style={{ paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
                <UserButton appearance={{ elements: { avatarBox: { width: 28, height: 28 } } }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.firstName || user.emailAddresses[0]?.emailAddress?.split("@")[0]}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.emailAddresses[0]?.emailAddress}
                  </div>
                </div>
                <SignOutButton>
                  <button title="Sign out" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", padding: 4 }}>
                    <LogOut size={13}/>
                  </button>
                </SignOutButton>
              </div>
            )}
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main style={{ flex: 1, padding: "36px 48px", overflowY: "auto", maxHeight: "100vh", background: "#0a0a0a" }}>

          {/* ════ OVERVIEW ════ */}
          {section === "overview" && (
            <OverviewSection memories={memories} sessions={sessions} />
          )}

          {/* ════ MEMORIES ════ */}
          {section === "memories" && (
            <div style={{ animation: "fade-in 0.3s ease both" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h1 style={{ fontSize: 26, fontWeight: 600, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em", margin: 0, fontFamily: "'Instrument Serif', serif" }}>Memory Manager</h1>
                    {isLive && (
                      <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "rgba(78,236,216,0.8)", background: "rgba(78,236,216,0.08)", border: "1px solid rgba(78,236,216,0.2)", borderRadius: 20, padding: "3px 10px" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4eecd8", display: "inline-block", animation: "pulse-live 1.8s ease-in-out infinite" }}/>
                        Live
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", margin: "4px 0 0" }}>{memories.length} facts · {pinnedCount} pinned · always injected</p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => downloadText(generateReadableExport(memories, sessions), `imprint-memories-${new Date().toISOString().split("T")[0]}.txt`)} className="dark-btn"
                    style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, fontSize: 13 }}>
                    <Download size={13}/> Export
                  </button>
                  <button onClick={() => setShowAddModal(true)}
                    style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#cf8f6d,#c47a4a)", color: "white", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                    <Plus size={13}/> Add memory
                  </button>
                </div>
              </div>

              {/* NL update bar */}
              <div className="dark-panel" style={{ display: "flex", gap: 8, padding: "12px 14px", marginBottom: 16 }}>
                <Sparkles size={13} style={{ color: "rgba(207,143,109,0.6)", flexShrink: 0, marginTop: 10 }}/>
                <input value={nlInstruction} onChange={e => setNlInstruction(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && runNlUpdate()}
                  placeholder='e.g. "I switched jobs to Google" or "add TypeScript to my stack"'
                  className="dark-input"
                  style={{ flex: 1, padding: "8px 12px", fontSize: 13, fontFamily: "inherit" }}/>
                <button onClick={runNlUpdate} disabled={!nlInstruction.trim() || nlUpdating}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "none",
                    background: nlInstruction.trim() && !nlUpdating ? "rgba(207,143,109,0.15)" : "rgba(255,255,255,0.05)",
                    color: nlInstruction.trim() && !nlUpdating ? "rgba(207,143,109,0.9)" : "rgba(255,255,255,0.2)",
                    fontSize: 13, fontWeight: 500, cursor: nlInstruction.trim() && !nlUpdating ? "pointer" : "not-allowed",
                    whiteSpace: "nowrap" as const, display: "flex", alignItems: "center", gap: 6 }}>
                  {nlUpdating ? <><RefreshCw size={12} style={{ animation: "spin 0.8s linear infinite" }}/> Updating…</> : "✦ Update"}
                </button>
                {nlResult && <span style={{ display: "flex", alignItems: "center", fontSize: 12, color: nlResult.startsWith("✓") ? "rgba(78,236,216,0.8)" : "rgba(255,255,255,0.4)", whiteSpace: "nowrap" as const }}>{nlResult}</span>}
              </div>

              {/* Bulk action bar */}
              {selectedIds.size > 0 && (
                <div className="dark-panel" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 12, border: "1px solid rgba(207,143,109,0.2)" }}>
                  <span style={{ fontSize: 13, color: "rgba(207,143,109,0.8)", fontWeight: 500 }}>{selectedIds.size} selected</span>
                  <button onClick={pinSelected} style={{ padding: "5px 12px", borderRadius: 8, background: "rgba(207,143,109,0.12)", border: "1px solid rgba(207,143,109,0.25)", color: "rgba(207,143,109,0.85)", fontSize: 12, cursor: "pointer" }}>Pin all</button>
                  <button onClick={deleteSelected} style={{ padding: "5px 12px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "rgba(239,68,68,0.7)", fontSize: 12, cursor: "pointer" }}>Delete all</button>
                  <button onClick={() => setSelectedIds(new Set())} style={{ padding: "5px 12px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)", fontSize: 12, cursor: "pointer" }}>Clear</button>
                </div>
              )}

              {/* Search + filter */}
              <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" as const }}>
                <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
                  <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.25)", pointerEvents: "none" }}/>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search memories…" className="dark-input"
                    style={{ width: "100%", padding: "9px 14px 9px 36px", fontSize: 13.5, boxSizing: "border-box" as const }}/>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                  {(["all", ...Object.keys(TOPIC_META)] as const).map(t => (
                    <button key={t} onClick={() => setFilterTopic(t as any)}
                      style={{ padding: "7px 13px", borderRadius: 20,
                        border: `1px solid ${filterTopic===t ? (t==="all"?"rgba(255,255,255,0.3)":TOPIC_META[t as Topic].color+"55") : "rgba(255,255,255,0.08)"}`,
                        background: filterTopic===t ? (t==="all"?"rgba(255,255,255,0.08)":TOPIC_META[t as Topic].bg) : "transparent",
                        color: filterTopic===t ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)",
                        fontSize: 12, cursor: "pointer", fontWeight: filterTopic===t ? 500 : 400 }}>
                      {t === "all" ? "All" : TOPIC_META[t as Topic].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pinned */}
              {filterTopic === "all" && !search && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Pin size={13} style={{ color: "rgba(207,143,109,0.7)" }}/>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(207,143,109,0.7)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Pinned — always injected</span>
                  </div>
                  {memories.filter(m => m.pinned).length === 0
                    ? <p style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", paddingLeft: 21 }}>No pinned memories yet.</p>
                    : memories.filter(m => m.pinned).map(m => <MemoryRow key={m.id} m={m} editingId={editingId} editText={editText} setEditText={setEditText} onEdit={startEdit} onSave={saveEdit} onCancel={() => setEditingId(null)} onDelete={deleteMemory} onPin={togglePin} highlight stale={false} isNew={newMemoryIds.has(m.id)} selected={selectedIds.has(m.id)} onSelect={toggleSelect}/>)
                  }
                </div>
              )}

              {/* By topic */}
              {Object.entries(byTopic).map(([topic, mems]) => {
                const meta = TOPIC_META[topic as Topic];
                const unpinned = mems.filter(m => !m.pinned || filterTopic !== "all" || search);
                if (unpinned.length === 0 && filterTopic === "all" && !search) return null;
                const toShow = (filterTopic !== "all" || search) ? mems : unpinned;
                if (toShow.length === 0) return null;
                return (
                  <div key={topic} style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 14 }}>{meta.emoji}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>{meta.label}</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>({toShow.length})</span>
                      {memories.filter(m => m.topic === topic && !m.pinned).length >= 3 && (
                        <button onClick={() => consolidateTopic(topic)} disabled={!!consolidating[topic]}
                          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20,
                            background: "rgba(78,236,216,0.07)", border: "1px solid rgba(78,236,216,0.2)", color: "rgba(78,236,216,0.7)",
                            fontSize: 10.5, fontWeight: 600, cursor: consolidating[topic] ? "not-allowed" : "pointer" }}>
                          {consolidating[topic] ? <><RefreshCw size={9} style={{ animation: "spin 0.8s linear infinite" }}/> Consolidating…</> : <><Zap size={9}/> Consolidate</>}
                        </button>
                      )}
                      {consolidateResult[topic] && (
                        <span style={{ fontSize: 10.5, color: consolidateResult[topic].startsWith("✓") ? "rgba(78,236,216,0.7)" : "rgba(255,255,255,0.35)" }}>
                          {consolidateResult[topic]}
                        </span>
                      )}
                    </div>
                    {toShow.map(m => <MemoryRow key={m.id} m={m} editingId={editingId} editText={editText} setEditText={setEditText} onEdit={startEdit} onSave={saveEdit} onCancel={() => setEditingId(null)} onDelete={deleteMemory} onPin={togglePin} stale={isStale(m)} isNew={newMemoryIds.has(m.id)} selected={selectedIds.has(m.id)} onSelect={toggleSelect}/>)}
                  </div>
                );
              })}

              {memories.length === 0 && !loading && (
                <div style={{ textAlign: "center" as const, padding: "60px 0" }}>
                  <p style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>No memories yet</p>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", marginBottom: 20 }}>Connect an IDE or install the extension to start building your memory profile.</p>
                  <a href="/onboarding" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 10, background: "linear-gradient(135deg,#cf8f6d,#c47a4a)", color: "white", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>Get started →</a>
                </div>
              )}
              {memories.length > 0 && filtered.length === 0 && (
                <div style={{ textAlign: "center" as const, padding: "60px 0", color: "rgba(255,255,255,0.2)", fontSize: 14 }}>No memories match your search.</div>
              )}
            </div>
          )}

          {/* ════ SESSIONS ════ */}
          {section === "sessions" && (
            <div style={{ animation: "fade-in 0.3s ease both" }}>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 26, fontWeight: 600, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em", margin: "0 0 4px", fontFamily: "'Instrument Serif', serif" }}>Chat Sessions</h1>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", margin: 0 }}>Pin conversations to always include their context in future sessions</p>
              </div>
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Star size={13} style={{ color: "rgba(207,143,109,0.7)" }}/>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(207,143,109,0.7)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Pinned Sessions</span>
                </div>
                {sessions.filter(s => s.pinned).length === 0
                  ? <p style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", paddingLeft: 21 }}>No pinned sessions yet.</p>
                  : sessions.filter(s => s.pinned).map(s => <SessionRow key={s.id} s={s} onPin={toggleSessionPin} pinned/>)
                }
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 24 }}/>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Clock size={13} style={{ color: "rgba(255,255,255,0.3)" }}/>
                <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>All Sessions</span>
              </div>
              {sessions.map(s => <SessionRow key={s.id} s={s} onPin={toggleSessionPin} pinned={false}/>)}
            </div>
          )}

          {/* ════ IMPORT ════ */}
          {section === "import" && (
            <div style={{ animation: "fade-in 0.3s ease both", maxWidth: 640 }}>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 26, fontWeight: 600, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em", margin: "0 0 4px", fontFamily: "'Instrument Serif', serif" }}>Import Memories</h1>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", margin: 0 }}>Paste anything — a bio, notes, preferences, a resume. Imprint extracts the key facts.</p>
              </div>
              <div className="dark-panel" style={{ padding: 24, marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase" as const, display: "block", marginBottom: 10 }}>Paste your content</label>
                <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={8}
                  placeholder="e.g. My name is Yashasvi. I'm a developer based in India building Imprint..."
                  className="dark-input"
                  style={{ width: "100%", padding: "12px 14px", fontSize: 14, resize: "none" as const, lineHeight: 1.65, boxSizing: "border-box" as const, fontFamily: "inherit", display: "block" }}/>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, gap: 10 }}>
                  {importDone && <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "rgba(78,236,216,0.8)" }}><Check size={14}/> Memories extracted!</span>}
                  <button onClick={runImport} disabled={!importText.trim() || importing}
                    style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 22px", borderRadius: 10, border: "none",
                      background: !importText.trim() || importing ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,#cf8f6d,#c47a4a)",
                      color: !importText.trim() || importing ? "rgba(255,255,255,0.25)" : "white",
                      fontSize: 14, fontWeight: 500, cursor: !importText.trim() || importing ? "not-allowed" : "pointer" }}>
                    {importing ? <><RefreshCw size={13} style={{ animation: "spin 0.8s linear infinite" }}/> Extracting…</> : <><Sparkles size={13}/> Extract memories</>}
                  </button>
                </div>
              </div>
              <VoiceMemoryCard userId={userId || ""} onSaved={loadMemories} />
              <div className="dark-panel" style={{ padding: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(207,143,109,0.1)", border: "1px solid rgba(207,143,109,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FileText size={17} style={{ color: "rgba(207,143,109,0.7)" }}/>
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)", margin: 0 }}>Export your memory profile</p>
                    <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.3)", margin: "2px 0 0" }}>Downloads as a clean, human-readable text file</p>
                  </div>
                </div>
                <div className="dark-card" style={{ padding: "14px 16px", marginBottom: 14, fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.8 }}>
                  <span style={{ color: "rgba(255,255,255,0.2)" }}>═══════════════════════════════</span><br/>
                  <span style={{ color: "rgba(207,143,109,0.8)" }}>  IMPRINT — My Claude Memory Profile</span><br/>
                  <span style={{ color: "rgba(255,255,255,0.2)" }}>═══════════════════════════════</span><br/><br/>
                  <span style={{ color: "rgba(255,255,255,0.55)" }}>📌 ALWAYS REMEMBER (Pinned)</span><br/>
                  {memories.filter(m=>m.pinned).slice(0,2).map((m,i) => <span key={i}>  • {m.content.slice(0,50)}{m.content.length>50?"…":""}<br/></span>)}<br/>
                  <span style={{ color: "rgba(255,255,255,0.55)" }}>🚀 PROJECTS</span><br/>
                  {memories.filter(m=>m.topic==="projects").slice(0,1).map((m,i) => <span key={i}>  • {m.content.slice(0,50)}{m.content.length>50?"…":""}<br/></span>)}
                  <span style={{ color: "rgba(255,255,255,0.18)" }}>  ...</span>
                </div>
                <button onClick={() => downloadText(generateReadableExport(memories, sessions), `imprint-memories-${new Date().toISOString().split("T")[0]}.txt`)} className="dark-btn"
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 22px", borderRadius: 10, fontSize: 14, fontWeight: 500, width: "100%", justifyContent: "center" as const }}>
                  <Download size={14}/> Download memory profile (.txt)
                </button>
              </div>
            </div>
          )}

          {/* ════ RULES ════ */}
          {section === "rules" && userId && (
            <div style={{ animation: "fade-in 0.3s ease both", maxWidth: 680 }}>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 26, fontWeight: 600, color: "rgba(255,255,255,0.9)", margin: "0 0 6px", fontFamily: "'Instrument Serif', serif" }}>Memory Rules</h1>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, margin: 0 }}>Choose what Imprint saves automatically from your conversations.</p>
              </div>
              <MemoryRules userId={userId}/>
            </div>
          )}

          {/* ════ CONNECT ════ */}
          {section === "connect" && <ConnectSection userId={userId || ""}/>}

          {/* ════ ANALYTICS ════ */}
          {section === "analytics" && <AnalyticsSection memories={memories} sessions={sessions}/>}

          {/* ════ TIMELINE ════ */}
          {section === "timeline" && <TimelineSection memories={memories} onDelete={deleteMemory} onPin={togglePin}/>}

          {/* ════ PREVIEW ════ */}
          {section === "preview" && <ContextPreviewSection memories={memories}/>}

          {/* ════ RESOLVER ════ */}
          {section === "resolver" && <ResolverSection memories={memories} userId={userId || ""} onDelete={deleteMemory} onRefresh={loadMemories}/>}

          {/* ════ GRAPH ════ */}
          {section === "graph" && <MemoryGraphSection memories={memories}/>}

          {/* ════ CHAT ════ */}
          {section === "chat" && (
            <div style={{ animation: "fade-in 0.3s ease both", display: "flex", flexDirection: "column" as const, height: "calc(100vh - 72px)", maxWidth: 760 }}>
              <div style={{ marginBottom: 16 }}>
                <h1 style={{ fontSize: 26, fontWeight: 600, color: "rgba(255,255,255,0.9)", margin: "0 0 4px", fontFamily: "'Instrument Serif', serif" }}>Chat with Memories</h1>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", margin: 0 }}>Claude answers using your {memories.length} saved memories as context</p>
              </div>
              <div className="dark-panel scrollbar-thin" style={{ flex: 1, overflowY: "auto", padding: "20px 24px", marginBottom: 12, display: "flex", flexDirection: "column" as const }}>
                {chatMessages.length === 0 && !chatStreaming && (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", gap: 10, opacity: 0.4 }}>
                    <MessageSquare size={36} style={{ color: "rgba(255,255,255,0.3)" }}/>
                    <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", margin: 0 }}>Ask anything — Claude knows your context</p>
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" as const, justifyContent: "center" }}>
                      {["What am I currently building?", "What are my preferences?", "Summarize my active projects"].map(q => (
                        <button key={q} onClick={() => { setChatInput(q); }}
                          style={{ padding: "6px 14px", borderRadius: 20, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)", fontSize: 12, cursor: "pointer" }}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{ marginBottom: 20, display: "flex", flexDirection: "column" as const, alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: msg.role === "user" ? "rgba(207,143,109,0.6)" : "rgba(78,236,216,0.6)", marginBottom: 5, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
                      {msg.role === "user" ? "You" : "Claude"}
                    </div>
                    <div style={{ maxWidth: "85%", padding: "11px 15px", borderRadius: 12, fontSize: 14, lineHeight: 1.65, color: "rgba(255,255,255,0.8)",
                      background: msg.role === "user" ? "rgba(207,143,109,0.1)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${msg.role === "user" ? "rgba(207,143,109,0.2)" : "rgba(255,255,255,0.07)"}`,
                      whiteSpace: "pre-wrap" as const }}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatStreaming && (
                  <div style={{ marginBottom: 20, display: "flex", flexDirection: "column" as const, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(78,236,216,0.6)", marginBottom: 5, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Claude</div>
                    <div style={{ maxWidth: "85%", padding: "11px 15px", borderRadius: 12, fontSize: 14, lineHeight: 1.65, color: "rgba(255,255,255,0.8)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", whiteSpace: "pre-wrap" as const }}>
                      {chatStreamText || <span style={{ opacity: 0.4 }}>…</span>}
                      <span style={{ display: "inline-block", width: 2, height: "1em", background: "rgba(78,236,216,0.8)", marginLeft: 2, verticalAlign: "text-bottom", animation: "pulse-live 0.9s ease-in-out infinite" }}/>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef}/>
              </div>
              <div className="dark-panel" style={{ display: "flex", gap: 10, padding: "12px 14px" }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                  placeholder="Ask about your projects, preferences, or anything Claude should know…"
                  className="dark-input"
                  style={{ flex: 1, padding: "10px 14px", fontSize: 14, fontFamily: "inherit" }}
                  disabled={chatStreaming}/>
                <button onClick={sendChatMessage} disabled={!chatInput.trim() || chatStreaming}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 42, height: 42, borderRadius: 10, border: "none",
                    background: chatInput.trim() && !chatStreaming ? "linear-gradient(135deg,#cf8f6d,#c47a4a)" : "rgba(255,255,255,0.06)",
                    color: chatInput.trim() && !chatStreaming ? "white" : "rgba(255,255,255,0.2)",
                    cursor: chatInput.trim() && !chatStreaming ? "pointer" : "not-allowed" }}>
                  <Send size={15}/>
                </button>
              </div>
            </div>
          )}

          {/* ════ API KEYS ════ */}
          {section === "apikeys" && (
            <div style={{ animation: "fade-in 0.3s ease both", maxWidth: 680 }}>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 26, fontWeight: 600, color: "rgba(255,255,255,0.9)", margin: "0 0 4px", fontFamily: "'Instrument Serif', serif" }}>API Keys</h1>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", margin: 0 }}>Access your memories programmatically from any app</p>
              </div>

              {/* Key display */}
              <div className="dark-panel" style={{ padding: "20px 24px", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(207,143,109,0.1)", border: "1px solid rgba(207,143,109,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Key size={18} style={{ color: "rgba(207,143,109,0.8)" }}/>
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)", margin: 0 }}>Imprint API Key</p>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: "2px 0 0" }}>Generated keys never expire — revoke to invalidate</p>
                  </div>
                </div>
                {newlyGenKey ? (
                  <div className="dark-card" style={{ padding: "12px 16px", marginBottom: 12, border: "1px solid rgba(78,236,216,0.3)", background: "rgba(78,236,216,0.05)" }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(78,236,216,0.8)", margin: "0 0 6px" }}>✓ New key generated — copy it now, it won't show again</p>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <code style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.75)", background: "#0d0d0d", padding: "7px 10px", borderRadius: 6, wordBreak: "break-all" as const }}>{newlyGenKey}</code>
                      <button onClick={() => { navigator.clipboard.writeText(newlyGenKey); setApiKeyCopied(true); setTimeout(() => setApiKeyCopied(false), 2000); }}
                        className="dark-btn" style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, flexShrink: 0, color: apiKeyCopied ? "#4eecd8" : undefined }}>
                        {apiKeyCopied ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                ) : apiKeyData?.hasKey ? (
                  <div className="dark-card" style={{ padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
                    <code style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>{apiKeyData.masked || "imp_live_••••••••••••••••••••"}</code>
                    <span style={{ fontSize: 11, color: "rgba(78,236,216,0.6)", background: "rgba(78,236,216,0.07)", borderRadius: 10, padding: "2px 8px" }}>Active</span>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>No key generated yet.</p>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={generateApiKey} disabled={apiKeyLoading}
                    style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, border: "none",
                      background: apiKeyLoading ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg,#cf8f6d,#c47a4a)",
                      color: apiKeyLoading ? "rgba(255,255,255,0.25)" : "white", fontSize: 13, fontWeight: 500, cursor: apiKeyLoading ? "not-allowed" : "pointer" }}>
                    {apiKeyLoading ? <><RefreshCw size={12} style={{ animation: "spin 0.8s linear infinite" }}/> Working…</> : <><Key size={13}/> {apiKeyData?.hasKey ? "Regenerate key" : "Generate key"}</>}
                  </button>
                  {apiKeyData?.hasKey && (
                    <button onClick={revokeApiKey} disabled={apiKeyLoading} className="dark-btn"
                      style={{ padding: "9px 16px", borderRadius: 10, fontSize: 13, color: "rgba(239,68,68,0.6)", borderColor: "rgba(239,68,68,0.15)" }}>
                      Revoke
                    </button>
                  )}
                </div>
              </div>

              {/* Usage */}
              <div className="dark-panel" style={{ padding: "20px 24px", marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.1em", margin: "0 0 14px" }}>Usage</p>
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                  {[
                    { label: "List memories", method: "GET", path: "/api/v1/memories?limit=50" },
                    { label: "Filter by topic", method: "GET", path: "/api/v1/memories?topic=projects" },
                    { label: "Create memory", method: "POST", path: "/api/v1/memories  {content, topic}" },
                  ].map(ex => (
                    <div key={ex.label} className="dark-card" style={{ padding: "10px 14px" }}>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 5 }}>{ex.label}</div>
                      <code style={{ fontSize: 12, color: "rgba(207,143,109,0.8)", display: "flex", gap: 8 }}>
                        <span style={{ color: ex.method === "GET" ? "rgba(78,236,216,0.7)" : "rgba(139,92,246,0.7)" }}>{ex.method}</span>
                        <span>{ex.path}</span>
                      </code>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 6, fontFamily: "monospace" }}>
                        Authorization: Bearer {"<your_key>"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="dark-panel" style={{ padding: "14px 20px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", margin: 0, lineHeight: 1.6 }}>
                  Base URL: <code style={{ color: "rgba(255,255,255,0.45)" }}>https://imprint-ebon.vercel.app</code> — CORS enabled, JSON responses.
                  Rate limit: 100 req/min per key.
                </p>
              </div>
            </div>
          )}

          {/* ════ TEAM ════ */}
          {section === "team" && (
            <div style={{ animation: "fade-in 0.3s ease both", maxWidth: 720 }}>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 26, fontWeight: 600, color: "rgba(255,255,255,0.9)", margin: "0 0 4px", fontFamily: "'Instrument Serif', serif" }}>Team Memory</h1>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", margin: 0 }}>Share memories across your whole team — injected into every member's IDE sessions</p>
              </div>

              {orgLoading && !orgData ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
                  <RefreshCw size={14} style={{ animation: "spin 0.8s linear infinite" }}/> Loading…
                </div>
              ) : !orgData ? (
                /* No org yet — create or join */
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="dark-panel" style={{ padding: "22px 24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(207,143,109,0.1)", border: "1px solid rgba(207,143,109,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Users size={17} style={{ color: "rgba(207,143,109,0.8)" }}/>
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)", margin: 0 }}>Create a team</p>
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: "2px 0 0" }}>You'll be the admin</p>
                      </div>
                    </div>
                    <input value={orgNameInput} onChange={e => setOrgNameInput(e.target.value)} placeholder="Team name (e.g. Acme Dev)"
                      className="dark-input" style={{ width: "100%", padding: "9px 12px", fontSize: 13, boxSizing: "border-box" as const, marginBottom: 10, fontFamily: "inherit" }}/>
                    <button onClick={createOrg} disabled={!orgNameInput.trim() || orgLoading}
                      style={{ width: "100%", padding: "9px", borderRadius: 10, border: "none",
                        background: orgNameInput.trim() ? "linear-gradient(135deg,#cf8f6d,#c47a4a)" : "rgba(255,255,255,0.05)",
                        color: orgNameInput.trim() ? "white" : "rgba(255,255,255,0.2)", fontSize: 13, fontWeight: 500, cursor: orgNameInput.trim() ? "pointer" : "not-allowed" }}>
                      {orgLoading ? "Creating…" : "Create team"}
                    </button>
                  </div>
                  <div className="dark-panel" style={{ padding: "22px 24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(78,236,216,0.08)", border: "1px solid rgba(78,236,216,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <UserPlus size={17} style={{ color: "rgba(78,236,216,0.8)" }}/>
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)", margin: 0 }}>Join a team</p>
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: "2px 0 0" }}>Enter the team ID</p>
                      </div>
                    </div>
                    <input value={orgJoinId} onChange={e => setOrgJoinId(e.target.value)} placeholder="Team ID (UUID)"
                      className="dark-input" style={{ width: "100%", padding: "9px 12px", fontSize: 13, boxSizing: "border-box" as const, marginBottom: 10, fontFamily: "monospace" }}/>
                    <button onClick={joinOrg} disabled={!orgJoinId.trim() || orgLoading}
                      style={{ width: "100%", padding: "9px", borderRadius: 10,
                        border: `1px solid ${orgJoinId.trim() ? "rgba(78,236,216,0.25)" : "rgba(255,255,255,0.06)"}`,
                        background: orgJoinId.trim() ? "rgba(78,236,216,0.12)" : "rgba(255,255,255,0.05)",
                        color: orgJoinId.trim() ? "rgba(78,236,216,0.9)" : "rgba(255,255,255,0.2)",
                        fontSize: 13, fontWeight: 500, cursor: orgJoinId.trim() ? "pointer" : "not-allowed" }}>
                      {orgLoading ? "Joining…" : "Join team"}
                    </button>
                  </div>
                </div>
              ) : (
                /* Has org */
                <div>
                  {/* Org header */}
                  <div className="dark-panel" style={{ padding: "18px 22px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(207,143,109,0.12)", border: "1px solid rgba(207,143,109,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Users size={20} style={{ color: "rgba(207,143,109,0.8)" }}/>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.88)", margin: "0 0 3px" }}>{orgData.name}</p>
                      <code style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>{orgData.orgId}</code>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(orgData.orgId); setOrgCopied(true); setTimeout(() => setOrgCopied(false), 2000); }}
                      className="dark-btn" style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 12, color: orgCopied ? "#4eecd8" : undefined }}>
                      <Copy size={11}/>{orgCopied ? "Copied!" : "Copy ID"}
                    </button>
                  </div>

                  {/* Members */}
                  <div className="dark-panel" style={{ padding: "16px 20px", marginBottom: 20 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.1em", margin: "0 0 12px" }}>
                      Members ({orgData.memberIds.length})
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
                      {orgData.memberIds.map(mid => (
                        <div key={mid} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20,
                          background: mid === orgData.adminUserId ? "rgba(207,143,109,0.1)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${mid === orgData.adminUserId ? "rgba(207,143,109,0.25)" : "rgba(255,255,255,0.07)"}` }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: mid === orgData.adminUserId ? "rgba(207,143,109,0.8)" : "rgba(255,255,255,0.25)" }}/>
                          <span style={{ fontSize: 12, color: mid === userId ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>
                            {mid.slice(0, 12)}…{mid === userId ? " (you)" : ""}{mid === orgData.adminUserId ? " 👑" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 10, marginBottom: 0 }}>
                      Share your Team ID with teammates — they paste it under "Join a team"
                    </p>
                  </div>

                  {/* Shared memories */}
                  <div className="dark-panel" style={{ padding: "16px 20px" }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.1em", margin: "0 0 12px" }}>
                      Shared memories ({orgMemories.length}) — injected into all members' sessions
                    </p>
                    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                      <input value={orgMemoryInput} onChange={e => setOrgMemoryInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && saveOrgMemory()}
                        placeholder="Add a shared team memory…"
                        className="dark-input" style={{ flex: 1, padding: "9px 12px", fontSize: 13, fontFamily: "inherit" }}/>
                      <button onClick={saveOrgMemory} disabled={!orgMemoryInput.trim()}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "none",
                          background: orgMemoryInput.trim() ? "linear-gradient(135deg,#cf8f6d,#c47a4a)" : "rgba(255,255,255,0.05)",
                          color: orgMemoryInput.trim() ? "white" : "rgba(255,255,255,0.2)", fontSize: 13, fontWeight: 500, cursor: orgMemoryInput.trim() ? "pointer" : "not-allowed", whiteSpace: "nowrap" as const }}>
                        <Plus size={13}/> Add
                      </button>
                    </div>
                    {orgMemories.length === 0 ? (
                      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", margin: 0 }}>No shared memories yet. Add the first one above.</p>
                    ) : (
                      orgMemories.slice(0, 20).map(m => (
                        <div key={m.id} className="dark-card" style={{ padding: "10px 14px", marginBottom: 6, display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <Users size={12} style={{ color: "rgba(207,143,109,0.5)", marginTop: 2, flexShrink: 0 }}/>
                          <span style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{m.content}</span>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>{timeAgo(m.createdAt)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ DIGEST ════ */}
          {section === "digest" && (
            <div style={{ animation: "fade-in 0.3s ease both", maxWidth: 680 }}>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 26, fontWeight: 600, color: "rgba(255,255,255,0.9)", margin: "0 0 4px", fontFamily: "'Instrument Serif', serif" }}>Weekly Digest</h1>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", margin: 0 }}>Generate a snapshot of your memory health and recent activity</p>
              </div>

              <div className="dark-panel" style={{ padding: "20px 24px", marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.1em", margin: "0 0 12px" }}>Email digest (optional)</p>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <input value={digestEmail} onChange={e => setDigestEmail(e.target.value)} placeholder="your@email.com"
                    type="email" className="dark-input" style={{ flex: 1, padding: "9px 14px", fontSize: 14, fontFamily: "inherit" }}/>
                  <button onClick={runDigest} disabled={digestLoading}
                    style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, border: "none",
                      background: digestLoading ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg,#cf8f6d,#c47a4a)",
                      color: digestLoading ? "rgba(255,255,255,0.25)" : "white", fontSize: 13, fontWeight: 500, cursor: digestLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                    {digestLoading ? <><RefreshCw size={12} style={{ animation: "spin 0.8s linear infinite" }}/> Generating…</> : <><Zap size={13}/> Generate</>}
                  </button>
                </div>
                {digestStatus && <p style={{ fontSize: 12, color: digestStatus.startsWith("✓") ? "rgba(78,236,216,0.7)" : "rgba(255,255,255,0.4)", marginTop: -8, marginBottom: 0 }}>{digestStatus}</p>}
              </div>

              {digestData && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
                    {[
                      { label: "Total", value: digestData.total, color: "#cf8f6d" },
                      { label: "New this week", value: digestData.newThisWeek, color: "#4eecd8" },
                      { label: "Pinned", value: digestData.pinned, color: "#7c3aed" },
                      { label: "Stale (30d+)", value: digestData.staleCount, color: "#fbbf24" },
                    ].map(s => (
                      <div key={s.label} className="dark-card" style={{ padding: "14px 16px", textAlign: "center" as const }}>
                        <p style={{ fontSize: 28, fontWeight: 700, color: s.color, margin: "0 0 4px", lineHeight: 1 }}>{s.value}</p>
                        <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.3)", margin: 0 }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                  {digestData.topics?.length > 0 && (
                    <div className="dark-panel" style={{ padding: "16px 20px", marginBottom: 16 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.1em", margin: "0 0 12px" }}>Topics</p>
                      <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                        {digestData.topics.map((t: { topic: string; count: number; sample: string[] }) => (
                          <div key={t.topic} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", minWidth: 90 }}>{t.topic}</span>
                            <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${Math.min((t.count / digestData.total) * 100, 100)}%`, background: "rgba(207,143,109,0.5)", borderRadius: 2 }}/>
                            </div>
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", minWidth: 24, textAlign: "right" as const }}>{t.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {digestData.recentHighlights?.length > 0 && (
                    <div className="dark-panel" style={{ padding: "16px 20px", marginBottom: 16 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.1em", margin: "0 0 12px" }}>New this week</p>
                      {digestData.recentHighlights.map((m: { content: string; topic: string }, i: number) => (
                        <div key={i} style={{ display: "flex", gap: 10, paddingBottom: 8, marginBottom: 8, borderBottom: i < digestData.recentHighlights.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                          <span style={{ fontSize: 12, color: "rgba(207,143,109,0.5)", minWidth: 70 }}>{m.topic}</span>
                          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.45 }}>{m.content}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {digestData.staleMemories?.length > 0 && (
                    <div className="dark-panel" style={{ padding: "16px 20px" }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(251,191,36,0.6)", textTransform: "uppercase" as const, letterSpacing: "0.1em", margin: "0 0 12px" }}>⚠ Stale — consider pruning</p>
                      {digestData.staleMemories.map((m: { id: string; content: string; topic: string }) => (
                        <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, paddingBottom: 8, marginBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", minWidth: 70 }}>{m.topic}</span>
                          <span style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.45 }}>{m.content}</span>
                          <button onClick={() => deleteMemory(m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(239,68,68,0.4)", flexShrink: 0, padding: 4 }}>
                            <Trash2 size={12}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </main>
      </div>

      {/* ── Share modal ── */}
      {shareModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="dark-panel" style={{ width: "100%", maxWidth: 480, padding: 28, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 600, color: "rgba(255,255,255,0.9)", margin: 0 }}>Share your memory profile</h3>
              <button onClick={() => setShareModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 4 }}><X size={16}/></button>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 16, lineHeight: 1.6 }}>
              Anyone with this link can view your <strong style={{ color: "rgba(207,143,109,0.8)" }}>pinned memories</strong>.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input readOnly value={shareUrl || "Generating…"} className="dark-input"
                style={{ flex: 1, padding: "9px 12px", fontSize: 12.5, fontFamily: "monospace" }}/>
              <button onClick={copyShareUrl} disabled={!shareUrl} className="dark-btn"
                style={{ padding: "9px 18px", borderRadius: 10, fontSize: 13, whiteSpace: "nowrap" as const,
                  color: shareCopied ? "#cf8f6d" : undefined, borderColor: shareCopied ? "rgba(207,143,109,0.3)" : undefined }}>
                {shareCopied ? "✓ Copied!" : "Copy link"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", marginTop: 10 }}>Only pinned memories are visible. No account required to view.</p>
          </div>
        </div>
      )}

      {/* ── Add Memory Modal ── */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="dark-panel" style={{ width: "100%", maxWidth: 440, padding: 28, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ fontSize: 17, fontWeight: 600, color: "rgba(255,255,255,0.9)", margin: 0 }}>Add memory manually</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 4 }}><X size={16}/></button>
            </div>
            <textarea value={newMemory} onChange={e => setNewMemory(e.target.value)} rows={3}
              placeholder="e.g. I prefer dark mode in all tools"
              className="dark-input"
              style={{ width: "100%", padding: "11px 13px", fontSize: 14, resize: "none" as const, fontFamily: "inherit", boxSizing: "border-box" as const, marginBottom: 12, display: "block" }}/>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 16 }}>
              {(Object.keys(TOPIC_META) as Topic[]).map(t => (
                <button key={t} onClick={() => setNewTopic(t)}
                  style={{ padding: "5px 12px", borderRadius: 20,
                    border: `1px solid ${newTopic===t ? TOPIC_META[t].color+"66" : "rgba(255,255,255,0.08)"}`,
                    background: newTopic===t ? TOPIC_META[t].bg : "transparent",
                    color: newTopic===t ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)",
                    fontSize: 12, cursor: "pointer", fontWeight: newTopic===t ? 500 : 400 }}>
                  {TOPIC_META[t].emoji} {TOPIC_META[t].label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowAddModal(false)} className="dark-btn"
                style={{ flex: 1, padding: "10px", borderRadius: 10, fontSize: 14 }}>Cancel</button>
              <button onClick={addMemory} disabled={!newMemory.trim()}
                style={{ flex: 2, padding: "10px", borderRadius: 10, border: "none",
                  background: newMemory.trim() ? "linear-gradient(135deg,#cf8f6d,#c47a4a)" : "rgba(255,255,255,0.05)",
                  color: newMemory.trim() ? "white" : "rgba(255,255,255,0.25)",
                  fontSize: 14, fontWeight: 500, cursor: newMemory.trim() ? "pointer" : "not-allowed" }}>
                Save memory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Voice Memory Card ── */
function VoiceMemoryCard({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ transcript: string; count: number } | null>(null);
  const [err, setErr] = useState("");
  const mediaRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);

  async function startRecording() {
    setErr(""); setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setProcessing(true);
        try {
          const fd = new FormData();
          fd.append("audio", blob, "recording.webm");
          fd.append("userId", userId);
          const res = await fetch("/api/voice", { method: "POST", body: fd });
          const data = await res.json();
          if (data.error) setErr(data.error);
          else { setResult({ transcript: data.transcript, count: data.count }); onSaved(); }
        } catch (e: any) { setErr(e.message); }
        setProcessing(false);
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
    } catch { setErr("Microphone access denied."); }
  }

  function stopRecording() { mediaRef.current?.stop(); setRecording(false); }

  return (
    <div className="dark-panel" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: recording ? "rgba(239,68,68,0.12)" : "rgba(139,92,246,0.1)", border: `1px solid ${recording ? "rgba(239,68,68,0.25)" : "rgba(139,92,246,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Mic size={17} style={{ color: recording ? "#ef4444" : "#8b5cf6" }}/>
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)", margin: 0 }}>Voice memory</p>
          <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.3)", margin: "2px 0 0" }}>Record a voice note — Imprint transcribes and extracts facts automatically</p>
        </div>
      </div>
      {result && (
        <div className="dark-card" style={{ padding: "12px 14px", marginBottom: 12, border: "1px solid rgba(78,236,216,0.2)" }}>
          <p style={{ fontSize: 12, color: "rgba(78,236,216,0.8)", margin: "0 0 6px", fontWeight: 600 }}>✓ Saved {result.count} memories</p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>"{result.transcript.slice(0,120)}{result.transcript.length>120?"…":""}"</p>
        </div>
      )}
      {err && <p style={{ fontSize: 12, color: "rgba(239,68,68,0.7)", marginBottom: 12 }}>{err}</p>}
      <button onClick={recording ? stopRecording : startRecording} disabled={processing}
        style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 10, border: "none",
          background: recording ? "rgba(239,68,68,0.15)" : "rgba(139,92,246,0.12)",
          color: recording ? "#ef4444" : "#a78bfa", fontSize: 13.5, fontWeight: 500, cursor: processing ? "not-allowed" : "pointer" }}>
        {processing ? <><RefreshCw size={13} style={{ animation: "spin 0.8s linear infinite" }}/> Transcribing…</> : recording ? <>● Stop recording</> : <><Mic size={13}/> Start recording</>}
      </button>
    </div>
  );
}

/* ── GitHub Sync Card ── */
function GitHubSyncCard({ userId }: { userId: string }) {
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ count: number } | null>(null);
  const [err, setErr] = useState("");

  async function sync() {
    if (!token.trim()) { setErr("GitHub token required."); return; }
    setLoading(true); setErr(""); setResult(null);
    try {
      const res = await fetch("/api/github", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, githubToken: token, repo: repo.trim() || undefined }) });
      const data = await res.json();
      if (data.error) setErr(data.error);
      else setResult({ count: data.count });
    } catch (e: any) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <div className="dark-card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <GitBranch size={16} style={{ color: "rgba(255,255,255,0.45)" }}/>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,0.7)", margin: 0 }}>GitHub context sync</p>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "2px 7px" }}>optional</span>
      </div>
      <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.3)", marginBottom: 14, lineHeight: 1.6 }}>
        Pull your open PRs, assigned issues, and GitHub profile into Imprint as memories.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        <input value={token} onChange={e => setToken(e.target.value)} type="password" placeholder="GitHub personal access token (repo, read:user)" className="dark-input" style={{ padding: "8px 12px", fontSize: 13, fontFamily: "monospace" }}/>
        <input value={repo} onChange={e => setRepo(e.target.value)} placeholder="owner/repo — optional" className="dark-input" style={{ padding: "8px 12px", fontSize: 13 }}/>
      </div>
      {result && <p style={{ fontSize: 12, color: "rgba(78,236,216,0.8)", marginBottom: 10 }}>✓ Synced {result.count} memories from GitHub</p>}
      {err && <p style={{ fontSize: 12, color: "rgba(239,68,68,0.7)", marginBottom: 10 }}>{err}</p>}
      <button onClick={sync} disabled={loading || !token.trim()} className="dark-btn"
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 9, fontSize: 13, fontWeight: 500,
          opacity: loading || !token.trim() ? 0.4 : 1, cursor: loading || !token.trim() ? "not-allowed" : "pointer" }}>
        {loading ? <><RefreshCw size={12} style={{ animation: "spin 0.8s linear infinite" }}/> Syncing…</> : <><GitBranch size={12}/> Sync GitHub context</>}
      </button>
    </div>
  );
}

/* ── Connect Section ── */
const PLATFORMS = [
  { id: "claude-code", label: "Claude Code", tag: "MCP · CLI",    accent: "#cf8f6d", icon: "⬡", configPath: "~/.claude/settings.json",    verifyCmd: "claude mcp list" },
  { id: "cursor",      label: "Cursor",      tag: "MCP · Editor", accent: "#4eecd8", icon: "◈", configPath: "~/.cursor/mcp.json",          verifyCmd: "Restart Cursor → open a chat" },
  { id: "codex",       label: "Codex",       tag: "MCP · CLI",    accent: "#10a37f", icon: "▲", configPath: "~/.codex/config.json",        verifyCmd: "codex → ask about yourself" },
  { id: "antigravity", label: "Antigravity", tag: "MCP · Editor", accent: "#3186FF", icon: "◑", configPath: "Preferences → AI Tools → MCP",verifyCmd: "Start a session → memories inject" },
  { id: "custom",      label: "Other IDE",   tag: "MCP · Any",    accent: "#6b7280", icon: "+", configPath: "See your IDE's MCP docs",      verifyCmd: "Ask your AI: 'what do you know about me?'" },
];

function mcpConfig(platform: string, userId: string) {
  return JSON.stringify({ mcpServers: { imprint: { command: "node", args: ["/path/to/imprint/mcp/server.js"], env: { IMPRINT_USER_ID: userId || "your-user-id", IMPRINT_PLATFORM: platform } } } }, null, 2);
}

function ConnectSection({ userId }: { userId: string }) {
  const [activePlatform, setActivePlatform] = useState("claude-code");
  const [copied, setCopied] = useState<string | null>(null);
  const [customIde, setCustomIde] = useState("");
  const platform = PLATFORMS.find(p => p.id === activePlatform)!;

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const effectivePlatform = activePlatform === "custom" && customIde ? customIde.toLowerCase().replace(/\s+/g, "-") : activePlatform;
  const config = mcpConfig(effectivePlatform, userId);

  return (
    <div style={{ animation: "fade-in 0.3s ease both", maxWidth: 760 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 600, color: "rgba(255,255,255,0.9)", margin: "0 0 6px", fontFamily: "'Instrument Serif', serif" }}>Connect your IDE</h1>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, margin: 0 }}>One MCP server. Works in Claude Code, Cursor, Codex, Antigravity, and any MCP-compatible tool.</p>
      </div>

      {/* User ID */}
      <div className="dark-panel" style={{ padding: "14px 18px", marginBottom: 28, display: "flex", alignItems: "center", gap: 14, border: "1px solid rgba(207,143,109,0.18)" }}>
        <Brain size={16} style={{ color: "rgba(207,143,109,0.7)", flexShrink: 0 }}/>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 10, color: "rgba(207,143,109,0.5)", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Your Imprint User ID</p>
          <code style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", wordBreak: "break-all" }}>{userId || "Sign in to see your user ID"}</code>
        </div>
        {userId && (
          <button onClick={() => copy(userId, "uid")} className="dark-btn"
            style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, flexShrink: 0 }}>
            {copied === "uid" ? "✓ Copied" : "Copy ID"}
          </button>
        )}
      </div>

      {/* Platform tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {PLATFORMS.map(p => (
          <button key={p.id} onClick={() => setActivePlatform(p.id)}
            style={{ padding: "7px 16px", borderRadius: 100,
              border: `1px solid ${activePlatform === p.id ? p.accent + "55" : "rgba(255,255,255,0.08)"}`,
              background: activePlatform === p.id ? `${p.accent}12` : "transparent",
              color: activePlatform === p.id ? p.accent : "rgba(255,255,255,0.35)",
              fontSize: 13, fontWeight: activePlatform === p.id ? 600 : 400, cursor: "pointer", transition: "all 0.2s" }}>
            {p.icon} {p.label}
            <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.05em" }}>{p.tag}</span>
          </button>
        ))}
      </div>

      {activePlatform === "custom" && (
        <div style={{ marginBottom: 20 }}>
          <input value={customIde} onChange={e => setCustomIde(e.target.value)} placeholder="Enter your IDE name (e.g. Zed, VS Code, JetBrains)" className="dark-input"
            style={{ width: "100%", padding: "10px 14px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}/>
          {customIde && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>IMPRINT_PLATFORM → <code style={{ color: "rgba(255,255,255,0.45)" }}>"{effectivePlatform}"</code></p>}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="dark-panel" style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${platform.accent}18`, border: `1px solid ${platform.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: platform.accent }}>1</div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>Clone & install MCP server</span>
          </div>
          <pre style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", background: "#0d0d0d", borderRadius: 8, padding: "10px 12px", margin: 0, fontFamily: "monospace", whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
            {`git clone https://github.com/YashasviThakur/imprint.git\ncd imprint/mcp && npm install`}
          </pre>
          <button onClick={() => copy("git clone https://github.com/YashasviThakur/imprint.git && cd imprint/mcp && npm install", "install")} className="dark-btn"
            style={{ marginTop: 10, padding: "5px 12px", borderRadius: 7, fontSize: 11.5, color: copied === "install" ? platform.accent : undefined }}>
            {copied === "install" ? "✓ Copied" : "Copy command"}
          </button>
        </div>

        <div className="dark-panel" style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${platform.accent}18`, border: `1px solid ${platform.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: platform.accent }}>2</div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>Add to <code style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{platform.configPath}</code></span>
          </div>
          <pre style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", background: "#0d0d0d", borderRadius: 8, padding: "10px 12px", margin: 0, fontFamily: "monospace", whiteSpace: "pre-wrap", lineHeight: 1.65, maxHeight: 160, overflow: "auto" }}>
            {config}
          </pre>
          <button onClick={() => copy(config, "config")} className="dark-btn"
            style={{ marginTop: 10, padding: "5px 12px", borderRadius: 7, fontSize: 11.5, color: copied === "config" ? platform.accent : undefined }}>
            {copied === "config" ? "✓ Copied" : "Copy config"}
          </button>
        </div>
      </div>

      <div className="dark-panel" style={{ padding: "16px 18px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${platform.accent}18`, border: `1px solid ${platform.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: platform.accent }}>3</div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>Verify connection</span>
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>
          {platform.verifyCmd} — then ask your AI: <em style={{ color: "rgba(255,255,255,0.55)" }}>"What do you know about me?"</em>
        </p>
      </div>

      <GitHubSyncCard userId={userId}/>

      <div className="dark-panel" style={{ padding: "16px 18px", marginTop: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 12px" }}>Available MCP tools once connected</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["get_memories", "save_memory", "search_memories", "delete_memory", "pin_memory", "summarize_session"].map(tool => (
            <span key={tool} style={{ fontSize: 12, fontFamily: "monospace", padding: "4px 10px", borderRadius: 6, background: `${platform.accent}10`, border: `1px solid ${platform.accent}25`, color: platform.accent }}>{tool}</span>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", margin: "12px 0 0" }}>
          Memories saved from any connected IDE are shared across all your tools — one memory graph, every environment.
        </p>
      </div>
    </div>
  );
}

/* ── Memory Row ── */
function MemoryRow({ m, editingId, editText, setEditText, onEdit, onSave, onCancel, onDelete, onPin, highlight, stale, isNew, selected, onSelect }:{
  m:Memory; editingId:string|null; editText:string; setEditText:(v:string)=>void;
  onEdit:(m:Memory)=>void; onSave:(id:string)=>void; onCancel:()=>void;
  onDelete:(id:string)=>void; onPin:(id:string)=>void; highlight?:boolean;
  stale?:boolean; isNew?:boolean; selected?:boolean; onSelect?:(id:string)=>void;
}) {
  const meta = TOPIC_META[m.topic];
  return (
    <div className="mem-row" style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 14px", borderRadius: 10,
      background: isNew ? "rgba(78,236,216,0.06)" : selected ? "rgba(207,143,109,0.07)" : highlight ? "rgba(207,143,109,0.04)" : "#141414",
      border: `1px solid ${isNew ? "rgba(78,236,216,0.3)" : selected ? "rgba(207,143,109,0.25)" : highlight ? "rgba(207,143,109,0.12)" : stale ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.06)"}`,
      marginBottom: 6, transition: "all 0.4s ease",
      animation: isNew ? "memory-glow 3.5s ease forwards" : "none",
      boxShadow: isNew ? "0 0 20px rgba(78,236,216,0.15)" : "none" }}>
      {onSelect && <input type="checkbox" checked={!!selected} onChange={() => onSelect(m.id)} style={{ marginTop: 3, cursor: "pointer", accentColor: "#cf8f6d", flexShrink: 0 }}/>}
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 3, flexShrink: 0, marginTop: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: meta.color, background: meta.bg, border: `1px solid ${meta.color}22`, borderRadius: 20, padding: "2px 8px", textTransform: "uppercase" as const, letterSpacing: "0.04em", whiteSpace: "nowrap" as const }}>
          {meta.emoji} {meta.label}
        </span>
        {stale && <span style={{ fontSize: 9, color: "rgba(251,191,36,0.7)", background: "rgba(251,191,36,0.08)", borderRadius: 10, padding: "1px 6px", textAlign: "center" as const }}>stale</span>}
      </div>
      {editingId === m.id ? (
        <div style={{ flex: 1 }}>
          <input value={editText} onChange={e => setEditText(e.target.value)} className="dark-input"
            style={{ width: "100%", padding: "7px 10px", fontSize: 13.5, boxSizing: "border-box" as const, fontFamily: "inherit" }}
            autoFocus onKeyDown={e => { if(e.key==="Enter")onSave(m.id); if(e.key==="Escape")onCancel(); }}/>
          <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
            <button onClick={() => onSave(m.id)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, background: "linear-gradient(135deg,#cf8f6d,#c47a4a)", border: "none", color: "white", fontSize: 12.5, cursor: "pointer" }}><Check size={11}/>Save</button>
            <button onClick={onCancel} className="dark-btn" style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12.5 }}>Cancel</button>
          </div>
        </div>
      ) : (
        <span style={{ flex: 1, fontSize: 13.5, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{m.content}</span>
      )}
      {editingId !== m.id && (
        <div className="mem-actions" style={{ display: "flex", gap: 4, opacity: 0, transition: "opacity 0.15s", flexShrink: 0 }}>
          <button onClick={() => onPin(m.id)} title={m.pinned?"Unpin":"Pin"}
            style={{ width: 26, height: 26, borderRadius: 6, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: m.pinned ? "rgba(207,143,109,0.8)" : "rgba(255,255,255,0.25)" }}>
            <Pin size={12} style={{ fill: m.pinned ? "rgba(207,143,109,0.5)" : "none" }}/>
          </button>
          <button onClick={() => onEdit(m)} title="Edit"
            style={{ width: 26, height: 26, borderRadius: 6, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.25)" }}>
            <Edit3 size={12}/>
          </button>
          <button onClick={() => onDelete(m.id)} title="Delete"
            style={{ width: 26, height: 26, borderRadius: 6, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.25)" }}
            onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.color="rgba(239,68,68,0.7)"}
            onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.color="rgba(255,255,255,0.25)"}>
            <Trash2 size={12}/>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Session Row ── */
function SessionRow({ s, onPin, pinned }:{s:Session; onPin:(id:string)=>void; pinned:boolean}) {
  return (
    <div className="sess-row" style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderRadius: 10,
      background: s.pinned ? "rgba(207,143,109,0.05)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${s.pinned ? "rgba(207,143,109,0.15)" : "rgba(255,255,255,0.06)"}`,
      backdropFilter: "blur(4px)", marginBottom: 6 }}>
      <MessageSquare size={15} style={{ color: s.pinned ? "rgba(207,143,109,0.6)" : "rgba(255,255,255,0.2)", flexShrink: 0 }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", margin: 0, fontWeight: s.pinned ? 500 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{s.title}</p>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", margin: "2px 0 0" }}>
          {s.date.toLocaleDateString()} · {s.messageCount} messages · {s.memoriesExtracted} memories extracted
        </p>
      </div>
      <div className="sess-actions" style={{ display: "flex", gap: 6, opacity: 0, transition: "opacity 0.15s" }}>
        <button onClick={() => onPin(s.id)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8,
            background: s.pinned ? "rgba(207,143,109,0.1)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${s.pinned ? "rgba(207,143,109,0.2)" : "rgba(255,255,255,0.08)"}`,
            color: s.pinned ? "rgba(207,143,109,0.8)" : "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
          <Star size={11} style={{ fill: s.pinned ? "rgba(207,143,109,0.5)" : "none" }}/>
          {s.pinned ? "Unpin" : "Pin"}
        </button>
      </div>
    </div>
  );
}
