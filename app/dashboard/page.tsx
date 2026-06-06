"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Brain, Pin, Trash2, Edit3, Check, X, Plus, Download,
  Upload, Search, Filter, Clock, MessageSquare, Star,
  ChevronRight, RefreshCw, ArrowLeft, FileText, Sparkles,
  BookOpen, Settings, LogOut, MoreHorizontal, Copy,
  ExternalLink
} from "lucide-react";

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
type ActiveSection = "memories" | "sessions" | "import";

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
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [sessions, setSessions] = useState<Session[]>(MOCK_SESSIONS);

  // Resolve userId: ?userId= from extension popup link, else persisted in localStorage
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("userId");
    let id = fromUrl || localStorage.getItem("imprint_user_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("imprint_user_id", id);
    } else {
      localStorage.setItem("imprint_user_id", id);
    }
    setUserId(id);
  }, []);

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

  useEffect(() => { if (userId) loadMemories(); }, [userId]);
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

  const pinnedCount = memories.filter(m => m.pinned).length;
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
            { id:"memories", icon:<Brain size={15}/>, label:"Memories", badge: memories.length },
            { id:"sessions", icon:<MessageSquare size={15}/>, label:"Sessions", badge: sessions.filter(s=>s.pinned).length || null },
            { id:"import",   icon:<Upload size={15}/>, label:"Import" },
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
                  memories.filter(m => m.pinned).map(m => <MemoryRow key={m.id} m={m} editingId={editingId} editText={editText} setEditText={setEditText} onEdit={startEdit} onSave={saveEdit} onCancel={()=>setEditingId(null)} onDelete={deleteMemory} onPin={togglePin} highlight/>)
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
                  {toShow.map(m => <MemoryRow key={m.id} m={m} editingId={editingId} editText={editText} setEditText={setEditText} onEdit={startEdit} onSave={saveEdit} onCancel={()=>setEditingId(null)} onDelete={deleteMemory} onPin={togglePin}/>)}
                </div>
              );
            })}

            {filtered.length === 0 && (
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
      </main>

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

/* ── Memory Row Component ── */
function MemoryRow({ m, editingId, editText, setEditText, onEdit, onSave, onCancel, onDelete, onPin, highlight }:{
  m:Memory; editingId:string|null; editText:string; setEditText:(v:string)=>void;
  onEdit:(m:Memory)=>void; onSave:(id:string)=>void; onCancel:()=>void;
  onDelete:(id:string)=>void; onPin:(id:string)=>void; highlight?:boolean;
}){
  const meta = TOPIC_META[m.topic];
  return (
    <div className="mem-row" style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"11px 14px", borderRadius:10,
      background: highlight ? "rgba(207,143,109,0.04)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${highlight ? "rgba(207,143,109,0.12)" : "rgba(255,255,255,0.05)"}`,
      marginBottom:6, transition:"background 0.15s" }}>
      <span style={{ fontSize:10, fontWeight:600, color:meta.color, background:meta.bg, border:`1px solid ${meta.color}22`, borderRadius:20, padding:"2px 8px", flexShrink:0, marginTop:2, textTransform:"uppercase" as const, letterSpacing:"0.04em", whiteSpace:"nowrap" as const }}>
        {meta.emoji} {meta.label}
      </span>
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
