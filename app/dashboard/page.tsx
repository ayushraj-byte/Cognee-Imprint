"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useUser, UserButton, SignOutButton } from "@clerk/nextjs";
import {
  Brain, Pin, Trash2, Edit3, Check, X, Plus, Download,
  Upload, Search, Filter, Clock, MessageSquare, Star,
  ChevronRight, RefreshCw, ArrowLeft, FileText, Sparkles,
  BookOpen, Settings, LogOut, MoreHorizontal, Copy,
  ExternalLink, SlidersHorizontal, Link2, BarChart2,
  Eye, AlertTriangle, Share2, Mic, GitBranch
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
type ActiveSection = "memories" | "sessions" | "import" | "rules" | "connect" | "analytics" | "timeline" | "preview" | "resolver" | "graph";

/* ─── Constants ─── */
const TOPIC_META: Record<Topic, { color: string; bg: string; label: string; emoji: string }> = {
  projects:      { color: "#7c3aed", bg: "#7c3aed18", label: "Projects",      emoji: "🚀" },
  work:          { color: "#0070f3", bg: "#0070f318", label: "Work",           emoji: "💼" },
  preferences:   { color: "#d97706", bg: "#d9770618", label: "Preferences",   emoji: "⭐" },
  personal:      { color: "#059669", bg: "#05966918", label: "Personal",      emoji: "👤" },
  health:        { color: "#e11d48", bg: "#e11d4818", label: "Health",        emoji: "❤️" },
  relationships: { color: "#8b5cf6", bg: "#8b5cf618", label: "Relationships", emoji: "🤝" },
  general:       { color: "#6b7280", bg: "#6b728018", label: "General",       emoji: "📌" },
};

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

  let out = "";
  out += `═══════════════════════════════════════════════════\n`;
  out += `  IMPRINT — My Claude Memory Profile\n`;
  out += `  Generated: ${now}\n`;
  out += `═══════════════════════════════════════════════════\n\n`;

  out += `📌 ALWAYS REMEMBER (Pinned)\n`;
  out += `───────────────────────────\n`;
  if (pinned.length === 0) {
    out += `  No pinned memories yet.\n`;
  } else {
    pinned.forEach(m => {
      out += `  • ${m.content}\n`;
    });
  }
  out += `\n`;

  Object.entries(byTopic).forEach(([topic, mems]) => {
    const meta = TOPIC_META[topic as Topic];
    out += `${meta.emoji} ${meta.label.toUpperCase()}\n`;
    out += `───────────────────────────\n`;
    mems.forEach(m => {
      out += `  • ${m.content}${m.pinned ? "  ★" : ""}\n`;
    });
    out += `\n`;
  });

  const pinnedSessions = sessions.filter(s => s.pinned);
  if (pinnedSessions.length > 0) {
    out += `💬 IMPORTANT CONVERSATIONS\n`;
    out += `───────────────────────────\n`;
    pinnedSessions.forEach(s => {
      out += `  • ${s.title} (${s.date.toLocaleDateString()} · ${s.messageCount} messages · ${s.memoriesExtracted} memories)\n`;
    });
    out += `\n`;
  }

  out += `═══════════════════════════════════════════════════\n`;
  out += `  Total memories: ${memories.length} · Pinned: ${pinned.length}\n`;
  out += `  Powered by Imprint + AWS DynamoDB\n`;
  out += `═══════════════════════════════════════════════════\n`;

  return out;
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════════════
   MAIN DASHBOARD
══════════════════════════════════════════════════ */
export default function Dashboard() {
  const { user, isLoaded } = useUser();
  // userId = Clerk user id (stable, server-verified). Falls back to URL param for extension links.
  const userId = user?.id ?? (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("userId") : null);
  const [loading, setLoading] = useState(true);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  // Map raw API memory -> dashboard Memory shape
  function mapApiMemory(m: any): Memory {
    return {
      id: m.memoryId,
      content: m.content,
      topic: (m.topic || "general") as Topic,
      pinned: !!m.pinned,
      createdAt: new Date(m.createdAt),
      source: (m.source === "import" ? "import" : m.source === "manual" ? "manual" : "chat"),
      // keep raw createdAt string for PATCH/DELETE which key on it
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
    } catch (e) {
      console.error("Failed to load memories", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadSessions() {
    if (!userId) return;
    try {
      const res = await fetch(`/api/sessions?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      setSessions((data.sessions || []).map((s: any) => ({
        ...s,
        date: new Date(s.date),
      })));
    } catch (e) {
      console.error("Failed to load sessions", e);
    }
  }

  useEffect(() => { if (isLoaded && userId) { loadMemories(); loadSessions(); } }, [isLoaded, userId]);
  const [section, setSection] = useState<ActiveSection>("memories");
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
    } catch (e) { console.error(e); }
  }
  async function deleteMemory(id: string) {
    const m = memories.find(x => x.id === id);
    if (!m || !userId) return;
    setMemories(p => p.filter(x => x.id !== id));
    try {
      await fetch(`/api/memories/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, createdAt: rawOf(m).createdAt }),
      });
    } catch (e) { console.error(e); }
  }
  function startEdit(m: Memory) { setEditingId(m.id); setEditText(m.content); }
  async function saveEdit(id: string) {
    const m = memories.find(x => x.id === id);
    setMemories(p => p.map(x => x.id === id ? { ...x, content: editText } : x));
    setEditingId(null);
    if (!m || !userId) return;
    try {
      await fetch(`/api/memories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, createdAt: rawOf(m).createdAt, content: editText }),
      });
    } catch (e) { console.error(e); }
  }
  async function addMemory() {
    if (!newMemory.trim() || !userId) return;
    const content = newMemory.trim();
    setNewMemory(""); setShowAddModal(false);
    try {
      const res = await fetch(`/api/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, memories: [{ content, topic: newTopic }] }),
      });
      const data = await res.json();
      if (data.memories) setMemories(p => [...data.memories.map(mapApiMemory), ...p]);
      else loadMemories();
    } catch (e) { console.error(e); loadMemories(); }
  }
  function toggleSessionPin(id: string) {
    setSessions(p => p.map(s => s.id === id ? { ...s, pinned: !s.pinned } : s));
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
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
      const res = await fetch("/api/memories/natural-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, instruction: nlInstruction }),
      });
      const data = await res.json();
      setNlResult(data.count ? `✓ Updated ${data.count} memor${data.count === 1 ? "y" : "ies"}` : "No memories needed updating.");
      if (data.count) loadMemories();
    } catch { setNlResult("Update failed."); }
    setNlUpdating(false);
    setTimeout(() => { setNlResult(null); setNlInstruction(""); }, 3000);
  }

  async function openShare() {
    if (!userId) return;
    try {
      const res = await fetch(`/api/share?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      setShareUrl(data.shareUrl || "");
    } catch { setShareUrl(""); }
    setShareModal(true);
  }

  function copyShareUrl() {
    navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }
  async function runImport() {
    if (!importText.trim() || importing || !userId) return;
    setImporting(true);
    try {
      const res = await fetch(`/api/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, text: importText }),
      });
      const data = await res.json();
      if (data.memories) setMemories(p => [...data.memories.map(mapApiMemory), ...p]);
    } catch (e) { console.error(e); }
    setImporting(false); setImportDone(true);
    setTimeout(() => { setImportDone(false); setImportText(""); }, 2500);
  }

  const S = {
    page: { minHeight:"100vh", background:"#111110", color:"white", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif", display:"flex" },
    sidebar: { width:220, flexShrink:0, background:"#1a1918", borderRight:"1px solid rgba(255,255,255,0.06)", display:"flex", flexDirection:"column" as const, height:"100vh", position:"sticky" as const, top:0 },
    main: { flex:1, padding:"36px 48px", overflowY:"auto" as const, maxHeight:"100vh" },
  };

  return (
    <div style={S.page}>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes fade-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .mem-row:hover .mem-actions { opacity:1!important }
        .sess-row:hover .sess-actions { opacity:1!important }
        ::-webkit-scrollbar { width:4px } ::-webkit-scrollbar-track { background:transparent }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:4px }
      `}</style>

      {/* ── SIDEBAR ── */}
      <aside style={S.sidebar}>
        <div style={{ padding:"18px 14px 10px", display:"flex", alignItems:"center", gap:9 }}>
          <Link href="/" style={{ display:"flex", alignItems:"center", gap:8, textDecoration:"none" }}>
            <div style={{ width:28, height:28, borderRadius:8, background:"linear-gradient(135deg,#cf8f6d,#c47a4a)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Brain size={14} style={{ color:"white" }}/>
            </div>
            <span style={{ fontSize:15, fontWeight:600, color:"rgba(255,255,255,0.85)" }}>Imprint</span>
          </Link>
        </div>

        <div style={{ padding:"0 8px 8px", flex:1 }}>
          {[
            { id:"memories",  icon:<Brain size={15}/>,         label:"Memories",   badge: memories.length },
            { id:"sessions",  icon:<MessageSquare size={15}/>, label:"Sessions",   badge: sessions.filter(s=>s.pinned).length || null },
            { id:"timeline",  icon:<Clock size={15}/>,         label:"Timeline" },
            { id:"analytics", icon:<BarChart2 size={15}/>,     label:"Analytics" },
            { id:"preview",   icon:<Eye size={15}/>,           label:"Context preview" },
            { id:"resolver",  icon:<AlertTriangle size={15}/>, label:"Conflicts",  badge: memories.filter(m => (m as any)._raw?.contradicts?.length > 0).length || null },
            { id:"graph",     icon:<Share2 size={15}/>,        label:"Memory graph" },
            { id:"import",    icon:<Upload size={15}/>,        label:"Import" },
            { id:"rules",     icon:<SlidersHorizontal size={15}/>, label:"Memory Rules" },
            { id:"connect",   icon:<Link2 size={15}/>,         label:"Connect" },
          ].map(n => (
            <button key={n.id} onClick={() => setSection(n.id as ActiveSection)}
              style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:8, border:"none",
                background: section === n.id ? "rgba(255,255,255,0.08)" : "transparent",
                color: section === n.id ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.38)",
                fontSize:13.5, fontWeight: section === n.id ? 500 : 400, cursor:"pointer", marginBottom:2, textAlign:"left" as const }}
              onMouseEnter={e => { if(section!==n.id)(e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { if(section!==n.id)(e.currentTarget as HTMLButtonElement).style.background="transparent"; }}>
              <span style={{ opacity: section === n.id ? 1 : 0.45 }}>{n.icon}</span>
              <span style={{ flex:1 }}>{n.label}</span>
              {n.badge != null && n.badge > 0 && (
                <span style={{ fontSize:10, background:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.4)", borderRadius:10, padding:"1px 7px" }}>{n.badge}</span>
              )}
            </button>
          ))}

          <div style={{ height:1, background:"rgba(255,255,255,0.06)", margin:"8px 4px 8px" }}/>

          {/* Privacy mode */}
          <button onClick={() => setPrivacyMode(p => !p)}
            style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:8, border:"none",
              background: privacyMode ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.03)",
              color: privacyMode ? "rgba(239,68,68,0.75)" : "rgba(255,255,255,0.35)", fontSize:13, cursor:"pointer", textAlign:"left" as const, marginBottom:4 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background: privacyMode ? "#ef4444" : "rgba(255,255,255,0.2)", flexShrink:0 }}/>
            {privacyMode ? "Privacy mode ON" : "Privacy mode"}
          </button>

          {/* Share */}
          <button onClick={openShare}
            style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:8, border:"none",
              background:"rgba(124,58,237,0.07)", color:"rgba(167,139,250,0.65)", fontSize:13, cursor:"pointer", textAlign:"left" as const, marginBottom:4 }}>
            <Share2 size={14} style={{ opacity:0.6 }}/>
            Share profile
          </button>

          <button onClick={() => window.open("https://claude.ai", "_blank")}
            style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:8, border:"none",
              background:"rgba(207,143,109,0.08)", color:"rgba(207,143,109,0.75)", fontSize:13.5, cursor:"pointer", textAlign:"left" as const }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background="rgba(207,143,109,0.14)"}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background="rgba(207,143,109,0.08)"}>
            <ExternalLink size={14} style={{ opacity:0.6 }}/>
            Open Claude
          </button>
        </div>

        {/* Stats */}
        <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", padding:"14px" }}>
          {/* Health score */}
          {memories.length > 0 && (
            <div style={{ marginBottom:10, padding:"8px 10px", borderRadius:8, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <span style={{ fontSize:10, color:"rgba(255,255,255,0.3)", textTransform:"uppercase" as const, letterSpacing:"0.07em" }}>Memory health</span>
                <span style={{ fontSize:13, fontWeight:700, color: health.total >= 75 ? "rgba(78,236,216,0.8)" : health.total >= 50 ? "rgba(251,191,36,0.8)" : "rgba(239,68,68,0.7)" }}>
                  {health.total}<span style={{ fontSize:10, fontWeight:400, marginLeft:2 }}>/100</span>
                </span>
              </div>
              <div style={{ height:3, borderRadius:2, background:"rgba(255,255,255,0.06)", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${health.total}%`, background: health.total >= 75 ? "#4eecd8" : health.total >= 50 ? "#fbbf24" : "#ef4444", borderRadius:2, transition:"width 0.5s" }} />
              </div>
              {health.staleCount > 0 && (
                <p style={{ fontSize:10, color:"rgba(251,191,36,0.6)", marginTop:5 }}>⚠ {health.staleCount} stale memor{health.staleCount === 1 ? "y" : "ies"}</p>
              )}
            </div>
          )}
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.25)" }}>Memories</span>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.55)", fontWeight:600 }}>{memories.length}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.25)" }}>Pinned</span>
            <span style={{ fontSize:11, color:"rgba(207,143,109,0.7)", fontWeight:600 }}>{pinnedCount}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.25)" }}>Sessions</span>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.55)", fontWeight:600 }}>{sessions.length}</span>
          </div>

          {/* User row */}
          {user && (
            <div style={{ marginTop:14, paddingTop:12, borderTop:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:10 }}>
              <UserButton appearance={{
                elements: { avatarBox: { width:28, height:28 } },
              }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.65)", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {user.firstName || user.emailAddresses[0]?.emailAddress?.split("@")[0]}
                </div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {user.emailAddresses[0]?.emailAddress}
                </div>
              </div>
              <SignOutButton>
                <button title="Sign out" style={{ background:"none", border:"none", color:"rgba(255,255,255,0.2)", cursor:"pointer", padding:4 }}>
                  <LogOut size={13}/>
                </button>
              </SignOutButton>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={S.main}>

        {/* ════ MEMORIES SECTION ════ */}
        {section === "memories" && (
          <div style={{ animation:"fade-in 0.3s ease both" }}>
            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
              <div>
                <h1 style={{ fontSize:24, fontWeight:700, color:"rgba(255,255,255,0.9)", letterSpacing:"-0.02em", marginBottom:4 }}>Memory Manager</h1>
                <p style={{ fontSize:13.5, color:"rgba(255,255,255,0.3)" }}>{memories.length} facts stored · {pinnedCount} pinned · always injected into Claude</p>
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => downloadText(generateReadableExport(memories, sessions), `imprint-memories-${new Date().toISOString().split("T")[0]}.txt`)}
                  style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 16px", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.04)", color:"rgba(255,255,255,0.55)", fontSize:13, cursor:"pointer" }}
                  onMouseEnter={e=>{(e.currentTarget).style.background="rgba(255,255,255,0.08)";(e.currentTarget).style.color="rgba(255,255,255,0.85)";}}
                  onMouseLeave={e=>{(e.currentTarget).style.background="rgba(255,255,255,0.04)";(e.currentTarget).style.color="rgba(255,255,255,0.55)";}}>
                  <Download size={13}/> Export
                </button>
                <button onClick={() => setShowAddModal(true)}
                  style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 16px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#cf8f6d,#c47a4a)", color:"white", fontSize:13, fontWeight:500, cursor:"pointer" }}>
                  <Plus size={13}/> Add memory
                </button>
              </div>
            </div>

            {/* Natural language update bar */}
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              <div style={{ flex:1, position:"relative" }}>
                <Sparkles size={13} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"rgba(207,143,109,0.5)", pointerEvents:"none" }}/>
                <input value={nlInstruction} onChange={e => setNlInstruction(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && runNlUpdate()}
                  placeholder='e.g. "I switched jobs to Google" or "update my stack to include TypeScript"'
                  style={{ width:"100%", background:"rgba(207,143,109,0.05)", border:"1px solid rgba(207,143,109,0.15)", borderRadius:10, padding:"9px 14px 9px 34px", fontSize:13, color:"rgba(255,255,255,0.75)", outline:"none", boxSizing:"border-box" as const, fontFamily:"inherit" }}/>
              </div>
              <button onClick={runNlUpdate} disabled={!nlInstruction.trim() || nlUpdating}
                style={{ padding:"9px 16px", borderRadius:10, border:"none", background: nlInstruction.trim() && !nlUpdating ? "rgba(207,143,109,0.15)" : "rgba(255,255,255,0.05)", color: nlInstruction.trim() && !nlUpdating ? "rgba(207,143,109,0.9)" : "rgba(255,255,255,0.2)", fontSize:13, fontWeight:500, cursor: nlInstruction.trim() && !nlUpdating ? "pointer":"not-allowed", whiteSpace:"nowrap" as const, display:"flex", alignItems:"center", gap:6 }}>
                {nlUpdating ? <><RefreshCw size={12} style={{ animation:"spin 0.8s linear infinite" }}/> Updating…</> : "✦ Update"}
              </button>
              {nlResult && <span style={{ display:"flex", alignItems:"center", fontSize:12, color: nlResult.startsWith("✓") ? "rgba(78,236,216,0.8)" : "rgba(255,255,255,0.4)", whiteSpace:"nowrap" as const }}>{nlResult}</span>}
            </div>

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", marginBottom:12, borderRadius:10, background:"rgba(207,143,109,0.08)", border:"1px solid rgba(207,143,109,0.2)" }}>
                <span style={{ fontSize:13, color:"rgba(207,143,109,0.8)", fontWeight:500 }}>{selectedIds.size} selected</span>
                <button onClick={pinSelected} style={{ padding:"5px 12px", borderRadius:8, background:"rgba(207,143,109,0.12)", border:"1px solid rgba(207,143,109,0.25)", color:"rgba(207,143,109,0.85)", fontSize:12, cursor:"pointer" }}>Pin all</button>
                <button onClick={deleteSelected} style={{ padding:"5px 12px", borderRadius:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", color:"rgba(239,68,68,0.7)", fontSize:12, cursor:"pointer" }}>Delete all</button>
                <button onClick={() => setSelectedIds(new Set())} style={{ padding:"5px 12px", borderRadius:8, background:"transparent", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.35)", fontSize:12, cursor:"pointer" }}>Clear</button>
              </div>
            )}

            {/* Search + filter */}
            <div style={{ display:"flex", gap:10, marginBottom:24 }}>
              <div style={{ flex:1, position:"relative" }}>
                <Search size={14} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,0.25)", pointerEvents:"none" }}/>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search memories…"
                  style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"9px 14px 9px 36px", fontSize:13.5, color:"rgba(255,255,255,0.8)", outline:"none", boxSizing:"border-box" as const }}/>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" as const }}>
                {(["all", ...Object.keys(TOPIC_META)] as const).map(t => (
                  <button key={t} onClick={() => setFilterTopic(t as any)}
                    style={{ padding:"7px 13px", borderRadius:20, border:`1px solid ${filterTopic===t ? (t==="all"?"rgba(255,255,255,0.3)":TOPIC_META[t as Topic].color+"55") : "rgba(255,255,255,0.08)"}`, background: filterTopic===t ? (t==="all"?"rgba(255,255,255,0.08)":TOPIC_META[t as Topic].bg) : "transparent", color: filterTopic===t ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)", fontSize:12, cursor:"pointer", fontWeight: filterTopic===t ? 500 : 400 }}>
                    {t === "all" ? "All" : TOPIC_META[t as Topic].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pinned banner */}
            {filterTopic === "all" && !search && (
              <div style={{ marginBottom:20 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <Pin size={13} style={{ color:"rgba(207,143,109,0.7)" }}/>
                  <span style={{ fontSize:12, fontWeight:600, color:"rgba(207,143,109,0.7)", letterSpacing:"0.08em", textTransform:"uppercase" as const }}>Pinned — always injected</span>
                </div>
                {memories.filter(m => m.pinned).length === 0 ? (
                  <p style={{ fontSize:13, color:"rgba(255,255,255,0.2)", paddingLeft:21 }}>No pinned memories yet — pin important facts to always inject them into Claude.</p>
                ) : (
                  memories.filter(m => m.pinned).map(m => <MemoryRow key={m.id} m={m} editingId={editingId} editText={editText} setEditText={setEditText} onEdit={startEdit} onSave={saveEdit} onCancel={()=>setEditingId(null)} onDelete={deleteMemory} onPin={togglePin} highlight stale={false} selected={selectedIds.has(m.id)} onSelect={toggleSelect}/>)
                )}
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
                <div key={topic} style={{ marginBottom:20 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                    <span style={{ fontSize:14 }}>{meta.emoji}</span>
                    <span style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.35)", letterSpacing:"0.08em", textTransform:"uppercase" as const }}>{meta.label}</span>
                    <span style={{ fontSize:11, color:"rgba(255,255,255,0.2)" }}>({toShow.length})</span>
                  </div>
                  {toShow.map(m => <MemoryRow key={m.id} m={m} editingId={editingId} editText={editText} setEditText={setEditText} onEdit={startEdit} onSave={saveEdit} onCancel={()=>setEditingId(null)} onDelete={deleteMemory} onPin={togglePin} stale={isStale(m)} selected={selectedIds.has(m.id)} onSelect={toggleSelect}/>)}
                </div>
              );
            })}

            {memories.length === 0 && !loading && (
              <div style={{ textAlign:"center" as const, padding:"60px 0" }}>
                <p style={{ fontSize:16, color:"rgba(255,255,255,0.4)", marginBottom:6 }}>No memories yet</p>
                <p style={{ fontSize:13, color:"rgba(255,255,255,0.2)", marginBottom:20 }}>Connect an IDE or install the extension to start building your memory profile.</p>
                <a href="/onboarding" style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"10px 22px", borderRadius:10, background:"linear-gradient(135deg,#cf8f6d,#c47a4a)", color:"white", fontSize:13, fontWeight:500, textDecoration:"none" }}>
                  Get started →
                </a>
              </div>
            )}
            {memories.length > 0 && filtered.length === 0 && (
              <div style={{ textAlign:"center" as const, padding:"60px 0", color:"rgba(255,255,255,0.2)", fontSize:14 }}>
                No memories match your search.
              </div>
            )}
          </div>
        )}

        {/* ════ SESSIONS SECTION ════ */}
        {section === "sessions" && (
          <div style={{ animation:"fade-in 0.3s ease both" }}>
            <div style={{ marginBottom:28 }}>
              <h1 style={{ fontSize:24, fontWeight:700, color:"rgba(255,255,255,0.9)", letterSpacing:"-0.02em", marginBottom:4 }}>Chat Sessions</h1>
              <p style={{ fontSize:13.5, color:"rgba(255,255,255,0.3)" }}>Pin important conversations — they get re-summarised and injected into every new Claude session</p>
            </div>

            {/* Pinned sessions */}
            <div style={{ marginBottom:28 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                <Star size={13} style={{ color:"rgba(207,143,109,0.7)" }}/>
                <span style={{ fontSize:12, fontWeight:600, color:"rgba(207,143,109,0.7)", letterSpacing:"0.08em", textTransform:"uppercase" as const }}>Pinned Sessions</span>
              </div>
              {sessions.filter(s => s.pinned).length === 0 ? (
                <p style={{ fontSize:13, color:"rgba(255,255,255,0.2)", paddingLeft:21 }}>No pinned sessions yet. Pin a session to always include its context.</p>
              ) : (
                sessions.filter(s => s.pinned).map(s => <SessionRow key={s.id} s={s} onPin={toggleSessionPin} pinned/>)
              )}
            </div>

            <div style={{ height:1, background:"rgba(255,255,255,0.06)", marginBottom:24 }}/>

            {/* All sessions */}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <Clock size={13} style={{ color:"rgba(255,255,255,0.3)" }}/>
              <span style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.3)", letterSpacing:"0.08em", textTransform:"uppercase" as const }}>All Sessions</span>
            </div>
            {sessions.map(s => <SessionRow key={s.id} s={s} onPin={toggleSessionPin} pinned={false}/>)}
          </div>
        )}

        {/* ════ IMPORT SECTION ════ */}
        {section === "import" && (
          <div style={{ animation:"fade-in 0.3s ease both", maxWidth:640 }}>
            <div style={{ marginBottom:28 }}>
              <h1 style={{ fontSize:24, fontWeight:700, color:"rgba(255,255,255,0.9)", letterSpacing:"-0.02em", marginBottom:4 }}>Import Memories</h1>
              <p style={{ fontSize:13.5, color:"rgba(255,255,255,0.3)" }}>Paste anything — a bio, notes, preferences, a resume. Imprint will extract the key facts.</p>
            </div>

            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:24, marginBottom:16 }}>
              <label style={{ fontSize:12.5, fontWeight:600, color:"rgba(255,255,255,0.4)", letterSpacing:"0.06em", textTransform:"uppercase" as const, display:"block", marginBottom:10 }}>Paste your content</label>
              <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={8}
                placeholder="e.g. My name is Yashasvi. I'm a developer based in India building an AI memory app called Imprint for the H0 hackathon. I prefer concise code examples. I'm learning ML with Krish Naik..."
                style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"12px 14px", fontSize:14, color:"rgba(255,255,255,0.78)", outline:"none", resize:"none" as const, lineHeight:1.65, boxSizing:"border-box" as const, fontFamily:"inherit" }}
                onFocus={e => e.target.style.borderColor="rgba(207,143,109,0.3)"}
                onBlur={e => e.target.style.borderColor="rgba(255,255,255,0.08)"}
              />
              <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12, gap:10 }}>
                {importDone && (
                  <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:"rgba(78,236,216,0.8)" }}>
                    <Check size={14}/> Memories extracted!
                  </span>
                )}
                <button onClick={runImport} disabled={!importText.trim() || importing}
                  style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 22px", borderRadius:10, border:"none",
                    background: !importText.trim() || importing ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,#cf8f6d,#c47a4a)",
                    color: !importText.trim() || importing ? "rgba(255,255,255,0.25)" : "white",
                    fontSize:14, fontWeight:500, cursor: !importText.trim() || importing ? "not-allowed":"pointer" }}>
                  {importing
                    ? <><RefreshCw size={13} style={{ animation:"spin 0.8s linear infinite" }}/> Extracting…</>
                    : <><Sparkles size={13}/> Extract memories</>
                  }
                </button>
              </div>
            </div>

            {/* Voice memory card */}
            <VoiceMemoryCard userId={userId || ""} onSaved={loadMemories} />

            {/* Export card */}
            <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding:24 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:"rgba(207,143,109,0.1)", border:"1px solid rgba(207,143,109,0.15)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <FileText size={17} style={{ color:"rgba(207,143,109,0.7)" }}/>
                </div>
                <div>
                  <p style={{ fontSize:14, fontWeight:600, color:"rgba(255,255,255,0.8)", margin:0 }}>Export your memory profile</p>
                  <p style={{ fontSize:12.5, color:"rgba(255,255,255,0.3)", margin:0, marginTop:2 }}>Downloads as a clean, human-readable text file</p>
                </div>
              </div>
              {/* Preview */}
              <div style={{ background:"#111110", borderRadius:10, padding:"14px 16px", marginBottom:14, fontFamily:"monospace", fontSize:12, color:"rgba(255,255,255,0.45)", lineHeight:1.8, border:"1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ color:"rgba(255,255,255,0.25)" }}>═══════════════════════════════</span><br/>
                <span style={{ color:"rgba(207,143,109,0.8)" }}>  IMPRINT — My Claude Memory Profile</span><br/>
                <span style={{ color:"rgba(255,255,255,0.25)" }}>═══════════════════════════════</span><br/><br/>
                <span style={{ color:"rgba(255,255,255,0.55)" }}>📌 ALWAYS REMEMBER (Pinned)</span><br/>
                {memories.filter(m=>m.pinned).slice(0,2).map((m,i) => (
                  <span key={i}>  • {m.content.slice(0,50)}{m.content.length>50?"…":""}<br/></span>
                ))}<br/>
                <span style={{ color:"rgba(255,255,255,0.55)" }}>🚀 PROJECTS</span><br/>
                {memories.filter(m=>m.topic==="projects").slice(0,1).map((m,i) => (
                  <span key={i}>  • {m.content.slice(0,50)}{m.content.length>50?"…":""}<br/></span>
                ))}
                <span style={{ color:"rgba(255,255,255,0.2)" }}>  ...</span>
              </div>
              <button onClick={() => downloadText(generateReadableExport(memories, sessions), `imprint-memories-${new Date().toISOString().split("T")[0]}.txt`)}
                style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 22px", borderRadius:10, border:"1px solid rgba(207,143,109,0.25)", background:"rgba(207,143,109,0.07)", color:"rgba(207,143,109,0.85)", fontSize:14, fontWeight:500, cursor:"pointer", width:"100%", justifyContent:"center" as const }}
                onMouseEnter={e=>{(e.currentTarget).style.background="rgba(207,143,109,0.12)";}}
                onMouseLeave={e=>{(e.currentTarget).style.background="rgba(207,143,109,0.07)";}}>
                <Download size={14}/> Download memory profile (.txt)
              </button>
            </div>
          </div>
        )}

        {/* ════ RULES SECTION ════ */}
        {section === "rules" && userId && (
          <div style={{ animation:"fade-in 0.3s ease both", maxWidth: 680 }}>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 26, fontWeight: 600, color: "rgba(255,255,255,0.88)", margin: "0 0 6px", fontFamily:"'Instrument Serif', serif" }}>Memory Rules</h1>
              <p style={{ color:"rgba(255,255,255,0.35)", fontSize:14, margin:0 }}>
                Choose what Claude saves automatically from your conversations. Disabled topics are never stored.
              </p>
            </div>
            <MemoryRules userId={userId} />
          </div>
        )}

        {/* ════ CONNECT SECTION ════ */}
        {section === "connect" && (
          <ConnectSection userId={userId || ""} />
        )}

        {/* ════ ANALYTICS SECTION ════ */}
        {section === "analytics" && (
          <AnalyticsSection memories={memories} sessions={sessions} />
        )}

        {/* ════ TIMELINE SECTION ════ */}
        {section === "timeline" && (
          <TimelineSection memories={memories} onDelete={deleteMemory} onPin={togglePin} />
        )}

        {/* ════ CONTEXT PREVIEW SECTION ════ */}
        {section === "preview" && (
          <ContextPreviewSection memories={memories} />
        )}

        {/* ════ RESOLVER SECTION ════ */}
        {section === "resolver" && (
          <ResolverSection memories={memories} userId={userId || ""} onDelete={deleteMemory} onRefresh={loadMemories} />
        )}

        {/* ════ GRAPH SECTION ════ */}
        {section === "graph" && (
          <MemoryGraphSection memories={memories} />
        )}

      </main>

      {/* ── Share modal ── */}
      {shareModal && (
        <div style={{ position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:"100%", maxWidth:480, background:"#1e1d1c", border:"1px solid rgba(255,255,255,0.1)", borderRadius:18, padding:28, boxShadow:"0 24px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <h3 style={{ fontSize:17, fontWeight:600, color:"rgba(255,255,255,0.88)", margin:0 }}>Share your memory profile</h3>
              <button onClick={() => setShareModal(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.3)", padding:4 }}><X size={16}/></button>
            </div>
            <p style={{ fontSize:13, color:"rgba(255,255,255,0.35)", marginBottom:16, lineHeight:1.6 }}>
              Anyone with this link can view your <strong style={{ color:"rgba(207,143,109,0.8)" }}>pinned memories</strong> — the facts you've marked as always-remember.
            </p>
            <div style={{ display:"flex", gap:8 }}>
              <input readOnly value={shareUrl || "Generating…"} style={{ flex:1, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"9px 12px", fontSize:12.5, color:"rgba(255,255,255,0.6)", outline:"none", fontFamily:"monospace" }} />
              <button onClick={copyShareUrl} disabled={!shareUrl}
                style={{ padding:"9px 18px", borderRadius:10, border:`1px solid ${shareCopied ? "rgba(207,143,109,0.35)" : "rgba(255,255,255,0.12)"}`, background: shareCopied ? "rgba(207,143,109,0.12)" : "rgba(255,255,255,0.05)", color: shareCopied ? "#cf8f6d" : "rgba(255,255,255,0.6)", fontSize:13, cursor:"pointer", fontWeight:500, whiteSpace:"nowrap" as const }}>
                {shareCopied ? "✓ Copied!" : "Copy link"}
              </button>
            </div>
            <p style={{ fontSize:11, color:"rgba(255,255,255,0.2)", marginTop:10 }}>Only pinned memories are visible. No account required to view.</p>
          </div>
        </div>
      )}

      {/* ── Add Memory Modal ── */}
      {showAddModal && (
        <div style={{ position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:"100%", maxWidth:440, background:"#1e1d1c", border:"1px solid rgba(255,255,255,0.1)", borderRadius:18, padding:28, boxShadow:"0 24px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
              <h3 style={{ fontSize:17, fontWeight:600, color:"rgba(255,255,255,0.88)", margin:0 }}>Add memory manually</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.3)", padding:4 }}><X size={16}/></button>
            </div>
            <textarea value={newMemory} onChange={e => setNewMemory(e.target.value)} rows={3}
              placeholder="e.g. I prefer dark mode in all tools"
              style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"11px 13px", fontSize:14, color:"rgba(255,255,255,0.8)", outline:"none", resize:"none" as const, fontFamily:"inherit", boxSizing:"border-box" as const, marginBottom:12 }}/>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" as const, marginBottom:16 }}>
              {(Object.keys(TOPIC_META) as Topic[]).map(t => (
                <button key={t} onClick={() => setNewTopic(t)}
                  style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${newTopic===t ? TOPIC_META[t].color+"66" : "rgba(255,255,255,0.08)"}`, background: newTopic===t ? TOPIC_META[t].bg : "transparent", color: newTopic===t ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)", fontSize:12, cursor:"pointer", fontWeight: newTopic===t ? 500 : 400 }}>
                  {TOPIC_META[t].emoji} {TOPIC_META[t].label}
                </button>
              ))}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setShowAddModal(false)} style={{ flex:1, padding:"10px", borderRadius:10, background:"rgba(255,255,255,0.05)", border:"none", color:"rgba(255,255,255,0.4)", fontSize:14, cursor:"pointer" }}>Cancel</button>
              <button onClick={addMemory} disabled={!newMemory.trim()}
                style={{ flex:2, padding:"10px", borderRadius:10, border:"none", background: newMemory.trim()?"linear-gradient(135deg,#cf8f6d,#c47a4a)":"rgba(255,255,255,0.05)", color: newMemory.trim()?"white":"rgba(255,255,255,0.25)", fontSize:14, fontWeight:500, cursor: newMemory.trim()?"pointer":"not-allowed" }}>
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
          if (data.error) { setErr(data.error); } else { setResult({ transcript: data.transcript, count: data.count }); onSaved(); }
        } catch (e: any) { setErr(e.message); }
        setProcessing(false);
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e: any) { setErr("Microphone access denied."); }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: recording ? "rgba(239,68,68,0.12)" : "rgba(139,92,246,0.1)", border: `1px solid ${recording ? "rgba(239,68,68,0.25)" : "rgba(139,92,246,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Mic size={17} style={{ color: recording ? "#ef4444" : "#8b5cf6" }} />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)", margin: 0 }}>Voice memory</p>
          <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.3)", margin: 0, marginTop: 2 }}>Record a voice note — Imprint transcribes and extracts facts automatically</p>
        </div>
      </div>
      {result ? (
        <div style={{ background: "rgba(78,236,216,0.05)", border: "1px solid rgba(78,236,216,0.15)", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: "rgba(78,236,216,0.8)", margin: "0 0 6px", fontWeight: 600 }}>✓ Saved {result.count} memories</p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>"{result.transcript.slice(0, 120)}{result.transcript.length > 120 ? "…" : ""}"</p>
        </div>
      ) : err ? (
        <p style={{ fontSize: 12, color: "rgba(239,68,68,0.7)", marginBottom: 12 }}>{err}</p>
      ) : null}
      <button onClick={recording ? stopRecording : startRecording} disabled={processing}
        style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 10, border: "none", background: recording ? "rgba(239,68,68,0.15)" : "rgba(139,92,246,0.12)", color: recording ? "#ef4444" : "#a78bfa", fontSize: 13.5, fontWeight: 500, cursor: processing ? "not-allowed" : "pointer" }}>
        {processing ? <><RefreshCw size={13} style={{ animation: "spin 0.8s linear infinite" }} /> Transcribing…</> : recording ? <><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", animation: "spin 1s linear infinite" }} /> Stop recording</> : <><Mic size={13} /> Start recording</>}
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
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, githubToken: token, repo: repo.trim() || undefined }),
      });
      const data = await res.json();
      if (data.error) setErr(data.error);
      else setResult({ count: data.count });
    } catch (e: any) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "18px 20px", marginBottom: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <GitBranch size={16} style={{ color: "rgba(255,255,255,0.4)" }} />
        <p style={{ fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,0.7)", margin: 0 }}>GitHub context sync</p>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "2px 7px" }}>optional</span>
      </div>
      <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.3)", marginBottom: 14, lineHeight: 1.6 }}>
        Pull your open PRs, assigned issues, and GitHub profile into Imprint as memories. Claude will know your current workload without you saying a word.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        <input value={token} onChange={e => setToken(e.target.value)} type="password" placeholder="GitHub personal access token (repo, read:user)"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "rgba(255,255,255,0.7)", outline: "none", fontFamily: "monospace" }} />
        <input value={repo} onChange={e => setRepo(e.target.value)} placeholder="owner/repo — e.g. YashasviThakur03/Imprint (optional)"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "rgba(255,255,255,0.7)", outline: "none" }} />
      </div>
      {result && <p style={{ fontSize: 12, color: "rgba(78,236,216,0.8)", marginBottom: 10 }}>✓ Synced {result.count} memories from GitHub</p>}
      {err && <p style={{ fontSize: 12, color: "rgba(239,68,68,0.7)", marginBottom: 10 }}>{err}</p>}
      <button onClick={sync} disabled={loading || !token.trim()}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 9, border: "none", background: loading || !token.trim() ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.08)", color: loading || !token.trim() ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.65)", fontSize: 13, cursor: loading || !token.trim() ? "not-allowed" : "pointer", fontWeight: 500 }}>
        {loading ? <><RefreshCw size={12} style={{ animation: "spin 0.8s linear infinite" }} /> Syncing…</> : <><GitBranch size={12} /> Sync GitHub context</>}
      </button>
    </div>
  );
}

/* ── Connect Section ── */
const PLATFORMS = [
  {
    id: "claude-code",
    label: "Claude Code",
    tag: "MCP · CLI",
    accent: "#cf8f6d",
    icon: "◆",
    configKey: "mcpServers",
    configPath: "~/.claude/settings.json",
    verifyCmd: "claude mcp list",
  },
  {
    id: "cursor",
    label: "Cursor",
    tag: "MCP · Editor",
    accent: "#4eecd8",
    icon: "⌥",
    configKey: "mcpServers",
    configPath: ".cursor/mcp.json",
    verifyCmd: "Restart Cursor → open a chat",
  },
  {
    id: "codex",
    label: "Codex",
    tag: "MCP · CLI",
    accent: "#10a37f",
    icon: "⊕",
    configKey: "mcpServers",
    configPath: "~/.codex/config.json",
    verifyCmd: "codex → ask about yourself",
  },
  {
    id: "antigravity",
    label: "Antigravity",
    tag: "MCP · Editor",
    accent: "#a855f7",
    icon: "⊗",
    configKey: "mcpServers",
    configPath: "Preferences → AI Tools → MCP",
    verifyCmd: "Start a session → memories inject",
  },
  {
    id: "custom",
    label: "Other IDE",
    tag: "MCP · Any",
    accent: "#6b7280",
    icon: "+",
    configKey: "mcpServers",
    configPath: "See your IDE's MCP docs",
    verifyCmd: "Ask your AI: 'what do you know about me?'",
  },
];

function mcpConfig(platform: string, userId: string) {
  return JSON.stringify({
    mcpServers: {
      imprint: {
        command: "node",
        args: ["/path/to/imprint/mcp/server.js"],
        env: {
          IMPRINT_USER_ID: userId || "your-user-id",
          IMPRINT_PLATFORM: platform,
        },
      },
    },
  }, null, 2);
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
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 600, color: "rgba(255,255,255,0.88)", margin: "0 0 6px", fontFamily: "'Instrument Serif', serif" }}>
          Connect your IDE
        </h1>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, margin: 0 }}>
          One MCP server. Works in Claude Code, Cursor, Codex, Antigravity, and any MCP-compatible tool.
        </p>
      </div>

      {/* User ID card */}
      <div style={{ background: "rgba(207,143,109,0.06)", border: "1px solid rgba(207,143,109,0.18)", borderRadius: 12, padding: "14px 18px", marginBottom: 28, display: "flex", alignItems: "center", gap: 14 }}>
        <Brain size={16} style={{ color: "rgba(207,143,109,0.7)", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, color: "rgba(207,143,109,0.5)", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Your Imprint User ID</p>
          <code style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontFamily: "monospace", wordBreak: "break-all" }}>
            {userId || "Sign in to see your user ID"}
          </code>
        </div>
        {userId && (
          <button onClick={() => copy(userId, "uid")}
            style={{ padding: "6px 14px", borderRadius: 8, background: copied === "uid" ? "rgba(207,143,109,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${copied === "uid" ? "rgba(207,143,109,0.3)" : "rgba(255,255,255,0.1)"}`, color: copied === "uid" ? "rgba(207,143,109,0.9)" : "rgba(255,255,255,0.45)", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
            {copied === "uid" ? "✓ Copied" : "Copy ID"}
          </button>
        )}
      </div>

      {/* Platform tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {PLATFORMS.map(p => (
          <button key={p.id} onClick={() => setActivePlatform(p.id)}
            style={{ padding: "7px 16px", borderRadius: 100, border: `1px solid ${activePlatform === p.id ? p.accent + "55" : "rgba(255,255,255,0.08)"}`, background: activePlatform === p.id ? `${p.accent}12` : "transparent", color: activePlatform === p.id ? p.accent : "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: activePlatform === p.id ? 600 : 400, cursor: "pointer", transition: "all 0.2s" }}>
            {p.icon} {p.label}
            <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.05em" }}>{p.tag}</span>
          </button>
        ))}
      </div>

      {/* Custom IDE name input */}
      {activePlatform === "custom" && (
        <div style={{ marginBottom: 20 }}>
          <input
            value={customIde}
            onChange={e => setCustomIde(e.target.value)}
            placeholder="Enter your IDE name (e.g. Zed, VS Code, JetBrains)"
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", fontSize: 14, color: "rgba(255,255,255,0.8)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
          />
          {customIde && (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>
              IMPRINT_PLATFORM will be set to <code style={{ color: "rgba(255,255,255,0.45)" }}>"{effectivePlatform}"</code>
            </p>
          )}
        </div>
      )}

      {/* Steps */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Step 1: Install */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${platform.accent}18`, border: `1px solid ${platform.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: platform.accent }}>1</div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>Clone & install MCP server</span>
          </div>
          <pre style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", background: "rgba(0,0,0,0.35)", borderRadius: 8, padding: "10px 12px", margin: 0, fontFamily: "monospace", whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
            {`git clone https://github.com/YashasviThakur/imprint.git\ncd imprint/mcp && npm install`}
          </pre>
          <button onClick={() => copy("git clone https://github.com/YashasviThakur/imprint.git && cd imprint/mcp && npm install", "install")}
            style={{ marginTop: 10, padding: "5px 12px", borderRadius: 7, background: copied === "install" ? `${platform.accent}18` : "rgba(255,255,255,0.04)", border: `1px solid ${copied === "install" ? platform.accent + "44" : "rgba(255,255,255,0.08)"}`, color: copied === "install" ? platform.accent : "rgba(255,255,255,0.35)", fontSize: 11.5, cursor: "pointer" }}>
            {copied === "install" ? "✓ Copied" : "Copy command"}
          </button>
        </div>

        {/* Step 2: Config */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${platform.accent}18`, border: `1px solid ${platform.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: platform.accent }}>2</div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>Add to <code style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{platform.configPath}</code></span>
          </div>
          <pre style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", background: "rgba(0,0,0,0.35)", borderRadius: 8, padding: "10px 12px", margin: 0, fontFamily: "monospace", whiteSpace: "pre-wrap", lineHeight: 1.65, maxHeight: 160, overflow: "auto" }}>
            {config}
          </pre>
          <button onClick={() => copy(config, "config")}
            style={{ marginTop: 10, padding: "5px 12px", borderRadius: 7, background: copied === "config" ? `${platform.accent}18` : "rgba(255,255,255,0.04)", border: `1px solid ${copied === "config" ? platform.accent + "44" : "rgba(255,255,255,0.08)"}`, color: copied === "config" ? platform.accent : "rgba(255,255,255,0.35)", fontSize: 11.5, cursor: "pointer" }}>
            {copied === "config" ? "✓ Copied" : "Copy config"}
          </button>
        </div>
      </div>

      {/* Step 3: Verify */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "16px 18px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${platform.accent}18`, border: `1px solid ${platform.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: platform.accent }}>3</div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>Verify connection</span>
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>
          {platform.verifyCmd} — then ask your AI: <em style={{ color: "rgba(255,255,255,0.55)" }}>"What do you know about me?"</em><br/>
          Imprint will call <code style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>get_memories</code> and list your stored facts automatically.
        </p>
      </div>

      {/* GitHub sync */}
      <GitHubSyncCard userId={userId} />

      {/* Available MCP tools */}
      <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "16px 18px", marginTop: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Available MCP tools once connected</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["get_memories", "save_memory", "search_memories", "delete_memory", "pin_memory"].map(tool => (
            <span key={tool} style={{ fontSize: 12, fontFamily: "monospace", padding: "4px 10px", borderRadius: 6, background: `${platform.accent}10`, border: `1px solid ${platform.accent}25`, color: platform.accent }}>
              {tool}
            </span>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", margin: "12px 0 0" }}>
          Memories saved from any connected IDE are shared across all your tools — one memory graph, every environment.
        </p>
      </div>
    </div>
  );
}

/* ── Memory Row Component ── */
function MemoryRow({ m, editingId, editText, setEditText, onEdit, onSave, onCancel, onDelete, onPin, highlight, stale, selected, onSelect }:{
  m:Memory; editingId:string|null; editText:string; setEditText:(v:string)=>void;
  onEdit:(m:Memory)=>void; onSave:(id:string)=>void; onCancel:()=>void;
  onDelete:(id:string)=>void; onPin:(id:string)=>void; highlight?:boolean;
  stale?:boolean; selected?:boolean; onSelect?:(id:string)=>void;
}){
  const meta = TOPIC_META[m.topic];
  return (
    <div className="mem-row" style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"11px 14px", borderRadius:10,
      background: selected ? "rgba(207,143,109,0.08)" : highlight ? "rgba(207,143,109,0.04)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${selected ? "rgba(207,143,109,0.3)" : highlight ? "rgba(207,143,109,0.12)" : stale ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.05)"}`,
      marginBottom:6, transition:"background 0.15s" }}>
      {onSelect && (
        <input type="checkbox" checked={!!selected} onChange={() => onSelect(m.id)}
          style={{ marginTop:3, cursor:"pointer", accentColor:"#cf8f6d", flexShrink:0 }}/>
      )}
      <div style={{ display:"flex", flexDirection:"column" as const, gap:3, flexShrink:0, marginTop:2 }}>
        <span style={{ fontSize:10, fontWeight:600, color:meta.color, background:meta.bg, border:`1px solid ${meta.color}22`, borderRadius:20, padding:"2px 8px", textTransform:"uppercase" as const, letterSpacing:"0.04em", whiteSpace:"nowrap" as const }}>
          {meta.emoji} {meta.label}
        </span>
        {stale && <span style={{ fontSize:9, color:"rgba(251,191,36,0.7)", background:"rgba(251,191,36,0.08)", borderRadius:10, padding:"1px 6px", textAlign:"center" as const }}>stale</span>}
      </div>
      {editingId === m.id ? (
        <div style={{ flex:1 }}>
          <input value={editText} onChange={e => setEditText(e.target.value)}
            style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:8, padding:"7px 10px", fontSize:13.5, color:"rgba(255,255,255,0.85)", outline:"none", boxSizing:"border-box" as const, fontFamily:"inherit" }}
            autoFocus onKeyDown={e => { if(e.key==="Enter")onSave(m.id); if(e.key==="Escape")onCancel(); }}/>
          <div style={{ display:"flex", gap:6, marginTop:7 }}>
            <button onClick={() => onSave(m.id)} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:8, background:"linear-gradient(135deg,#cf8f6d,#c47a4a)", border:"none", color:"white", fontSize:12.5, cursor:"pointer" }}><Check size={11}/>Save</button>
            <button onClick={onCancel} style={{ padding:"5px 12px", borderRadius:8, background:"rgba(255,255,255,0.05)", border:"none", color:"rgba(255,255,255,0.4)", fontSize:12.5, cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <span style={{ flex:1, fontSize:13.5, color:"rgba(255,255,255,0.65)", lineHeight:1.5 }}>{m.content}</span>
      )}
      {editingId !== m.id && (
        <div className="mem-actions" style={{ display:"flex", gap:4, opacity:0, transition:"opacity 0.15s", flexShrink:0 }}>
          <button onClick={() => onPin(m.id)} title={m.pinned?"Unpin":"Pin"}
            style={{ width:26, height:26, borderRadius:6, background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color: m.pinned ? "rgba(207,143,109,0.8)" : "rgba(255,255,255,0.25)" }}>
            <Pin size={12} style={{ fill: m.pinned ? "rgba(207,143,109,0.5)" : "none" }}/>
          </button>
          <button onClick={() => onEdit(m)} title="Edit"
            style={{ width:26, height:26, borderRadius:6, background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.25)" }}>
            <Edit3 size={12}/>
          </button>
          <button onClick={() => onDelete(m.id)} title="Delete"
            style={{ width:26, height:26, borderRadius:6, background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.25)" }}
            onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.color="rgba(239,68,68,0.7)"}
            onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.color="rgba(255,255,255,0.25)"}>
            <Trash2 size={12}/>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Session Row Component ── */
function SessionRow({ s, onPin, pinned }:{s:Session; onPin:(id:string)=>void; pinned:boolean}){
  return(
    <div className="sess-row" style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 16px", borderRadius:10,
      background: s.pinned ? "rgba(207,143,109,0.04)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${s.pinned ? "rgba(207,143,109,0.12)" : "rgba(255,255,255,0.05)"}`,
      marginBottom:6 }}>
      <MessageSquare size={15} style={{ color: s.pinned ? "rgba(207,143,109,0.6)" : "rgba(255,255,255,0.2)", flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:14, color:"rgba(255,255,255,0.75)", margin:0, fontWeight: s.pinned ? 500 : 400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{s.title}</p>
        <p style={{ fontSize:12, color:"rgba(255,255,255,0.25)", margin:0, marginTop:2 }}>
          {s.date.toLocaleDateString()} · {s.messageCount} messages · {s.memoriesExtracted} memories extracted
        </p>
      </div>
      <div className="sess-actions" style={{ display:"flex", gap:6, opacity:0, transition:"opacity 0.15s" }}>
        <button onClick={() => onPin(s.id)}
          style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:8,
            background: s.pinned ? "rgba(207,143,109,0.1)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${s.pinned ? "rgba(207,143,109,0.2)" : "rgba(255,255,255,0.08)"}`,
            color: s.pinned ? "rgba(207,143,109,0.8)" : "rgba(255,255,255,0.4)", fontSize:12, cursor:"pointer", fontWeight:500 }}>
          <Star size={11} style={{ fill: s.pinned ? "rgba(207,143,109,0.5)" : "none" }}/>
          {s.pinned ? "Unpin" : "Pin"}
        </button>
      </div>
    </div>
  );
}
