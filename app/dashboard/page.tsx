"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Pin, Trash2, Edit3, X, Plus, Download, Upload, Search, MessageSquare, LogOut, RefreshCw } from "lucide-react";
import ImprintLogo from "@/app/components/ImprintLogo";
import BackgroundVideo from "@/app/components/BackgroundVideo";

type Topic = "work" | "personal" | "preferences" | "projects" | "health" | "relationships" | "general";
interface Memory { id: string; content: string; topic: Topic; pinned: boolean; createdAt: Date; source: string; }

const MAP_W = 1440, MAP_H = 900;
const HUB = { x: 720, y: 450, r: 62 };
const OV_W = 270, OV_H = 330;

/* ── geometry helpers ── */
function hubStart(nx: number, ny: number): [number, number] {
  const a = Math.atan2(ny - HUB.y, nx - HUB.x);
  return [HUB.x + HUB.r * Math.cos(a), HUB.y + HUB.r * Math.sin(a)];
}
function pathH(sx: number, sy: number, ex: number, ey: number) {
  const mx = (sx + ex) / 2;
  return `M${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`;
}
function pathV(sx: number, sy: number, ex: number, ey: number) {
  const my = (sy + ey) / 2;
  return `M${sx} ${sy} C ${sx} ${my}, ${ex} ${my}, ${ex} ${ey}`;
}

/* ── icon paths ── */
const ICONS: Record<string, string> = {
  star:     "M12 3.5l2.1 6.2 6.5 .1-5.2 3.9 1.9 6.3L12 16.4 6.7 20l1.9-6.3-5.2-3.9 6.5-.1z",
  cursor:   "M5 4l13 6.4-5.5 1.7L9.5 18z",
  brackets: "M9.5 7l-4 5 4 5M14.5 7l4 5-4 5",
  uparrow:  "M12 5l6 6h-3.4v7h-5.2v-7H6z",
  plug:     "M9 4v4M15 4v4M7 8h10v3a5 5 0 01-10 0zM12 16v4",
  folder:   "M3.5 7.5h5.5l2 2h9.5v9h-17z",
  layers:   "M12 4.5l8.5 4.5-8.5 4.5-8.5-4.5zM4 14l8 4.5 8-4.5",
  sliders:  "M4 8h16M4 16h16M9 6v4M15 14v4",
  user:     "M12 11.5a3.6 3.6 0 100-7.2 3.6 3.6 0 000 7.2zM4.6 20.4a7.4 7.4 0 0114.8 0",
  heart:    "M12 20.4l-1.3-1.2C6 14.9 3.6 12.6 3.6 9.6 3.6 7.3 5.4 5.5 7.7 5.5c1.3 0 2.5.6 3.3 1.6l1 1.1 1-1.1c.8-1 2-1.6 3.3-1.6 2.3 0 4.1 1.8 4.1 4.1 0 3-2.4 5.3-7.1 9.5z",
};

interface IDENode { id: string; title: string; tag?: string; status?: string; dot?: string; sub?: string; isConfig?: boolean; icon: string; fill?: boolean; color: string; cx: number; cy: number; sources: string[]; }
interface NSNode  { id: string; title: string; icon: string; fill?: boolean; color: string; cx: number; cy: number; topic: Topic; }

const IDE_NODES: IDENode[] = [
  { id:"cc",  title:"Claude Code",  status:"Connected", dot:"#34d399", sub:"94 tagged", icon:"star",     fill:true, color:"#22d3ee", cx:192, cy:152, sources:["claude-code","claude_code","claudecode","cc"] },
  { id:"cur", title:"Cursor",       status:"Connected", dot:"#34d399", sub:"61 tagged", icon:"cursor",              color:"#34d399", cx:158, cy:296, sources:["cursor"] },
  { id:"cod", title:"Codex",        tag:"GitHub Copilot", status:"Connected", dot:"#34d399", sub:"38 tagged", icon:"brackets", color:"#818cf8", cx:145, cy:440, sources:["codex","github-copilot","copilot"] },
  { id:"ag",  title:"Antigravity",  status:"Idle",      dot:"#f59e0b", sub:"12 tagged", icon:"uparrow",             color:"#c084fc", cx:158, cy:584, sources:["antigravity"] },
  { id:"mcp", title:"Custom MCP",   isConfig:true,                                       icon:"plug",               color:"#e879f9", cx:192, cy:728, sources:["custom-mcp","custommcp","mcp"] },
];
const NS_NODES: NSNode[] = [
  { id:"work",   title:"Work",        icon:"folder",  color:"#f472b6", cx:1248, cy:152, topic:"work"        },
  { id:"proj",   title:"Projects",    icon:"layers",  color:"#fb7185", cx:1282, cy:296, topic:"projects"    },
  { id:"pref",   title:"Preferences", icon:"sliders", color:"#fb923c", cx:1295, cy:440, topic:"preferences" },
  { id:"pers",   title:"Personal",    icon:"user",    color:"#fbbf24", cx:1282, cy:584, topic:"personal"    },
  { id:"health", title:"Health",      icon:"heart",   fill:true, color:"#a3e635", cx:1248, cy:728, topic:"health" },
];

const TOPIC_META: Record<Topic, { color: string; bg: string; label: string; emoji: string }> = {
  projects:      { color:"#818cf8", bg:"rgba(129,140,248,0.1)",  label:"Projects",      emoji:"🚀" },
  work:          { color:"#f472b6", bg:"rgba(244,114,182,0.1)",  label:"Work",           emoji:"💼" },
  preferences:   { color:"#fb923c", bg:"rgba(251,146,60,0.1)",   label:"Preferences",   emoji:"⭐" },
  personal:      { color:"#fbbf24", bg:"rgba(251,191,36,0.1)",   label:"Personal",      emoji:"👤" },
  health:        { color:"#a3e635", bg:"rgba(163,230,53,0.1)",   label:"Health",        emoji:"❤️" },
  relationships: { color:"#8b5cf6", bg:"rgba(139,92,246,0.1)",  label:"Relationships", emoji:"🤝" },
  general:       { color:"#6b7280", bg:"rgba(107,114,128,0.1)", label:"General",       emoji:"📌" },
};

/* overlay card position — IDE nodes open to right, NS nodes open to left */
function ovPos(nodeId: string) {
  const ide = IDE_NODES.find(n => n.id === nodeId);
  if (ide) {
    const left = ide.cx + 122;
    const top  = Math.max(8, Math.min(ide.cy - OV_H / 2, MAP_H - OV_H - 8));
    const lx1  = ide.cx + 108, ly1 = ide.cy;
    const lx2  = left,          ly2 = top + OV_H / 2;
    return { left, top, color: ide.color, title: ide.title, linePath: pathH(lx1, ly1, lx2, ly2) };
  }
  const ns = NS_NODES.find(n => n.id === nodeId);
  if (ns) {
    const left = ns.cx - 100 - 128 - OV_W;
    const top  = Math.max(8, Math.min(ns.cy - OV_H / 2, MAP_H - OV_H - 8));
    const lx1  = ns.cx - 100, ly1 = ns.cy;
    const lx2  = left + OV_W, ly2 = top + OV_H / 2;
    return { left, top, color: ns.color, title: ns.title, linePath: pathH(lx1, ly1, lx2, ly2) };
  }
  return null;
}

/* ── small helpers ── */
function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function downloadText(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

/* ── reusable glass tokens ── */
const GLASS_NODE  = "rgba(255,255,255,0.06)";
const GLASS_CARD  = "rgba(255,255,255,0.04)";
const BLUR_NODE   = "blur(32px) saturate(1.9)";
const INSET_SHINE = "inset 0 1px 0 rgba(255,255,255,0.18)";
const SHADOW_BASE = "0 16px 48px rgba(0,0,0,0.65)";

function glassBorder(color: string, active: boolean) {
  return `1px solid ${active ? color + "99" : color + "55"}`;
}
function glassShadow(color: string, active: boolean) {
  return `${INSET_SHINE}, ${SHADOW_BASE}${active ? `, 0 0 28px ${color}30` : ""}`;
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:"rgba(10,10,14,0.96)", backdropFilter:"blur(32px)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:24, padding:"28px 30px", width:"100%", maxWidth:480, boxShadow:`${INSET_SHINE}, 0 40px 80px rgba(0,0,0,0.7)` }}>
        {children}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { data: session, status } = useSession();
  const isLoaded = status !== "loading";
  const user = session?.user ?? null;
  const userId = (session?.user as { id?: string })?.id ??
    (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("userId") : null);

  const [memories,      setMemories]      = useState<Memory[]>([]);
  const [loadingData,   setLoadingData]   = useState(true);
  const [hovered,       setHovered]       = useState<string | null>(null);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [ovSearch,      setOvSearch]      = useState("");
  const [showSearch,    setShowSearch]    = useState(false);
  const [globalSearch,  setGlobalSearch]  = useState("");
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [newMemory,     setNewMemory]     = useState("");
  const [newTopic,      setNewTopic]      = useState<Topic>("general");
  const [newPin,        setNewPin]        = useState(false);
  const [showImport,    setShowImport]    = useState(false);
  const [importText,    setImportText]    = useState("");
  const [importing,     setImporting]     = useState(false);
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [editText,      setEditText]      = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [mapScale,      setMapScale]      = useState(0.8);
  const mapRef    = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  /* auto-scale to viewport */
  useEffect(() => {
    const fit = () => {
      const el = mapRef.current; if (!el) return;
      const s = Math.min(0.96, (el.clientWidth - 16) / MAP_W, (el.clientHeight - 16) / MAP_H);
      setMapScale(Math.max(0.3, s));
    };
    const ro = new ResizeObserver(fit);
    if (mapRef.current) ro.observe(mapRef.current);
    fit();
    return () => ro.disconnect();
  }, []);

  /* ── API helpers ── */
  function mapApi(m: any): Memory {
    return { id: m.memoryId, content: m.content, topic: (m.topic || "general") as Topic,
      pinned: !!m.pinned, createdAt: new Date(m.createdAt), source: m.source || "chat", _raw: m } as any;
  }
  async function loadMemories() {
    if (!userId) return; setLoadingData(true);
    try {
      const d = await (await fetch(`/api/memories?userId=${encodeURIComponent(userId)}`)).json();
      const ms = (d.memories || []).map(mapApi); setMemories(ms); lastCount.current = ms.length;
    } catch {} setLoadingData(false);
  }
  useEffect(() => { if (isLoaded && userId) loadMemories(); }, [isLoaded, userId]);
  useEffect(() => {
    if (!userId) return;
    const iv = setInterval(async () => {
      try {
        const d = await (await fetch(`/api/memories?userId=${encodeURIComponent(userId)}`)).json();
        const ms = (d.memories || []).map(mapApi);
        if (lastCount.current > 0 && ms.length > lastCount.current) setMemories(ms);
        lastCount.current = ms.length;
      } catch {}
    }, 5000);
    return () => clearInterval(iv);
  }, [userId]);

  function raw(m: Memory) { return (m as any)._raw || {}; }

  async function togglePin(id: string) {
    const m = memories.find(x => x.id === id); if (!m || !userId) return;
    const next = !m.pinned;
    setMemories(p => p.map(x => x.id === id ? { ...x, pinned: next } : x));
    try { await fetch(`/api/memories/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId, createdAt: raw(m).createdAt, pinned: next }) }); }
    catch { setMemories(p => p.map(x => x.id === id ? { ...x, pinned: !next } : x)); }
  }
  async function deleteMemory(id: string) {
    const m = memories.find(x => x.id === id); if (!m || !userId) return;
    setMemories(p => p.filter(x => x.id !== id));
    try { await fetch(`/api/memories?userId=${encodeURIComponent(userId)}&memoryId=${id}&createdAt=${encodeURIComponent(raw(m).createdAt)}`, { method:"DELETE" }); }
    catch { loadMemories(); }
  }
  async function deleteAll() {
    if (!userId) return; const snap = [...memories]; setMemories([]); setDeleteConfirm(false);
    for (const m of snap) try { await fetch(`/api/memories?userId=${encodeURIComponent(userId)}&memoryId=${m.id}&createdAt=${encodeURIComponent(raw(m).createdAt)}`, { method:"DELETE" }); } catch {}
  }
  async function saveEdit(id: string) {
    const m = memories.find(x => x.id === id); if (!m || !userId) return;
    setMemories(p => p.map(x => x.id === id ? { ...x, content: editText } : x)); setEditingId(null);
    try { await fetch(`/api/memories/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId, createdAt: raw(m).createdAt, content: editText }) }); }
    catch { loadMemories(); }
  }
  async function addMemory() {
    if (!newMemory.trim() || !userId) return;
    try {
      const d = await (await fetch("/api/memories", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId, content:newMemory.trim(), topic:newTopic, pinned:newPin, source:"manual" }) })).json();
      if (d.memory) setMemories(p => [mapApi(d.memory), ...p]);
    } catch { loadMemories(); }
    setNewMemory(""); setNewTopic("general"); setNewPin(false); setShowAddModal(false);
  }
  async function runImport() {
    if (!importText.trim() || !userId) return; setImporting(true);
    try {
      const d = await (await fetch("/api/memories", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId, messages:[{ role:"user", content:importText }], source:"import" }) })).json();
      if (d.memories) setMemories(p => [...d.memories.map(mapApi), ...p]);
    } catch {} setImporting(false); setShowImport(false); setImportText("");
  }
  function doExport() {
    downloadText(["IMPRINT — Memory Export", `Generated: ${new Date().toLocaleDateString()}`, `Total: ${memories.length}`, "", ...memories.map(m => `• [${m.topic}] ${m.content}`)].join("\n"),
      `imprint-${new Date().toISOString().split("T")[0]}.txt`);
  }

  /* ── opacity helpers ── */
  function nodeOp(id: string) {
    if (selectedId && selectedId !== id) return 0.28;
    if (!hovered) return 1;
    return hovered === id ? 1 : 0.28;
  }
  function connOps(id: string) {
    if (selectedId === id)               return { base: 0.35, flow: 1.0 };
    if (selectedId && selectedId !== id) return { base: 0.04, flow: 0.04 };
    if (!hovered)                        return { base: 0.18, flow: 0.6 };
    return hovered === id ? { base: 0.35, flow: 1.0 } : { base: 0.04, flow: 0.04 };
  }

  /* ── derived values ── */
  const pinnedCount   = memories.filter(m => m.pinned).length;
  const importedCount = memories.filter(m => m.source === "import").length;
  const decayingCount = memories.filter(m => !m.pinned && (Date.now() - new Date(m.createdAt).getTime()) / 86400000 > 23).length;

  const activeOv = selectedId ? ovPos(selectedId) : null;
  const ovMems   = selectedId ? (() => {
    const ide = IDE_NODES.find(n => n.id === selectedId);
    if (ide) return memories.filter(m => ide.sources.some(s => (m.source || "").toLowerCase().includes(s)));
    const ns  = NS_NODES.find(n => n.id === selectedId);
    if (ns)  return memories.filter(m => m.topic === ns.topic);
    return [];
  })() : [];
  const filtOvMems = ovSearch ? ovMems.filter(m => m.content.toLowerCase().includes(ovSearch.toLowerCase())) : ovMems;

  if (!isLoaded) return null;

  /* ════════════════════════════════════ RENDER ════════════════════════════════════ */
  return (
    <div style={{ height:"100vh", overflow:"hidden", background:"#000", color:"white", position:"relative", fontFamily:"Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif" }}>

      {/* background video — very dark overlay so background is near-black */}
      <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none" }}>
        <BackgroundVideo overlayOpacity={0.88} />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        @keyframes hubPulse {
          0%,100%{ box-shadow: 0 0 0 0 rgba(240,180,106,0.5), 0 0 70px rgba(240,180,106,0.35), inset 0 0 40px rgba(240,180,106,0.2); }
          50%    { box-shadow: 0 0 0 16px rgba(240,180,106,0), 0 0 100px rgba(240,180,106,0.55), inset 0 0 40px rgba(240,180,106,0.2); }
        }
        @keyframes flowDash  { to { stroke-dashoffset: -320; } }
        @keyframes spin      { to { transform: rotate(360deg); } }
        @keyframes ovIn      { from { opacity:0; transform:scale(0.93) } to { opacity:1; transform:scale(1) } }
        @keyframes nodeIn    { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }

        .node-card {
          transition: opacity .22s ease, border-color .18s, box-shadow .18s, transform .16s ease;
          animation: nodeIn 0.3s ease both;
        }
        .node-card:hover { transform: scale(1.025) translateY(-1px); }

        .mem-card:hover { background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.14) !important; }
        .mem-card:hover .mem-act { opacity: 1 !important; }

        .hbtn:hover { background: rgba(255,255,255,0.1) !important; color: rgba(255,255,255,0.9) !important; }

        /* liquid border: top-edge highlight + bottom-edge glow */
        .glass-node-ide::after {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(160deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.06) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>

      {/* ════ HEADER ════ */}
      <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:50, height:52, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(24px) saturate(1.4)", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", padding:"0 16px", gap:8 }}>
        <Link href="/" style={{ display:"flex", alignItems:"center", gap:9, textDecoration:"none", flexShrink:0 }}>
          <div style={{ width:30, height:30, borderRadius:9, background:"rgba(255,255,255,0.06)", backdropFilter:"blur(12px)", border:"1px solid rgba(240,180,106,0.45)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`${INSET_SHINE}` }}>
            <ImprintLogo size={16} />
          </div>
          <span style={{ fontSize:15, fontWeight:600, color:"rgba(255,255,255,0.92)", letterSpacing:"-0.01em" }}>Imprint</span>
        </Link>

        <div style={{ width:1, height:22, background:"rgba(255,255,255,0.08)", margin:"0 4px" }} />

        {showSearch ? (
          <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.06)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"0 10px", height:34, flex:1, maxWidth:300 }}>
            <Search size={13} style={{ color:"rgba(255,255,255,0.35)", flexShrink:0 }} />
            <input autoFocus value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} placeholder="Search memories…" style={{ background:"transparent", border:"none", outline:"none", color:"rgba(255,255,255,0.85)", fontSize:13, flex:1 }} />
            <button onClick={() => { setShowSearch(false); setGlobalSearch(""); }} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.35)", cursor:"pointer", padding:2, display:"flex" }}><X size={12} /></button>
          </div>
        ) : (
          <button className="hbtn" onClick={() => setShowSearch(true)} style={{ width:30, height:30, borderRadius:8, background:"transparent", border:"1px solid transparent", color:"rgba(255,255,255,0.5)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all .15s" }}>
            <Search size={14} />
          </button>
        )}

        <div style={{ flex:1 }} />

        {/* memory pill */}
        <div style={{ fontSize:11.5, color:"#f0b46a", background:"rgba(240,180,106,0.1)", backdropFilter:"blur(8px)", border:"1px solid rgba(240,180,106,0.2)", padding:"5px 13px", borderRadius:999, fontWeight:500, whiteSpace:"nowrap", flexShrink:0, boxShadow:`${INSET_SHINE}` }}>
          {loadingData ? "…" : `${memories.length} memories · ${pinnedCount} pinned`}
        </div>

        {[
          { icon:<Plus size={14}/>,        onClick:()=>setShowAddModal(true),   title:"Add",        bg:"rgba(255,255,255,0.07)", col:"#fff" },
          { icon:<MessageSquare size={14}/>,href:"/chat",                        title:"Chat",       bg:"rgba(52,211,153,0.09)", col:"#34d399" },
          { icon:<Download size={14}/>,     onClick:doExport,                   title:"Export",     bg:"transparent", col:"rgba(255,255,255,0.5)" },
          { icon:<Upload size={14}/>,       onClick:()=>setShowImport(true),    title:"Import",     bg:"transparent", col:"rgba(255,255,255,0.5)" },
          { icon:<Trash2 size={14}/>,       onClick:()=>setDeleteConfirm(true), title:"Delete all", bg:"transparent", col:"rgba(255,255,255,0.35)" },
        ].map((b,i) => b.href
          ? <Link key={i} href={b.href!} title={b.title} style={{ width:30, height:30, borderRadius:8, background:b.bg, border:`1px solid ${b.col}30`, color:b.col, display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none", transition:"all .15s", backdropFilter:"blur(8px)" }}>{b.icon}</Link>
          : <button key={i} className="hbtn" onClick={b.onClick} title={b.title} style={{ width:30, height:30, borderRadius:8, background:b.bg, border:`1px solid ${b.col}22`, color:b.col, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all .15s" }}>{b.icon}</button>
        )}

        <div style={{ width:1, height:22, background:"rgba(255,255,255,0.07)" }} />

        {user?.image
          ? <img src={user.image} alt="" style={{ width:30, height:30, borderRadius:"50%", flexShrink:0, border:"1.5px solid rgba(255,255,255,0.15)" }} />
          : <div style={{ width:30, height:30, borderRadius:"50%", background:"linear-gradient(145deg,#f0b46a,#b97e35)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#1a0f08", flexShrink:0 }}>{((user?.name||user?.email||"?")[0]).toUpperCase()}</div>
        }
        <button onClick={() => signOut({ callbackUrl:"/sign-in" })} title="Sign out" style={{ background:"none", border:"none", color:"rgba(255,255,255,0.28)", cursor:"pointer", padding:4, transition:"color .15s" }}><LogOut size={13} /></button>
      </div>

      {/* ════ CANVAS ════ */}
      <div ref={mapRef} style={{ position:"fixed", top:52, left:0, right:0, bottom:0, overflow:"hidden", zIndex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>

        {/* ambient glow behind hub */}
        <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:1000, height:900, pointerEvents:"none", background:"radial-gradient(ellipse at center, rgba(100,60,200,0.12) 0%, rgba(60,40,180,0.05) 35%, transparent 65%)", filter:"blur(8px)" }} />

        {/* dot grid */}
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", backgroundImage:"radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)", backgroundSize:"28px 28px", maskImage:"radial-gradient(ellipse 62% 58% at center, #000 25%, transparent 75%)", WebkitMaskImage:"radial-gradient(ellipse 62% 58% at center, #000 25%, transparent 75%)" }} />

        {/* ── scaled map ── */}
        <div style={{ position:"relative", width:MAP_W, height:MAP_H, transformOrigin:"center", transform:`scale(${mapScale})`, flexShrink:0 }}>

          {/* ── SVG connections ── */}
          <svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ position:"absolute", inset:0, overflow:"visible", pointerEvents:"none" }}>
            <defs>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* IDE → Hub lines */}
            {IDE_NODES.map(n => {
              const [sx,sy] = hubStart(n.cx, n.cy);
              const d = pathH(sx, sy, n.cx + 108, n.cy);
              const op = connOps(n.id);
              return (
                <g key={n.id}>
                  <path d={d} fill="none" stroke={n.color} strokeWidth="2.2" strokeOpacity={op.base}  strokeLinecap="round" filter="url(#glow)" style={{transition:"stroke-opacity .22s"}}/>
                  <path d={d} fill="none" stroke={n.color} strokeWidth="2.4" strokeOpacity={op.flow}  strokeDasharray="8 15" strokeLinecap="round" filter="url(#glow)" style={{animation:"flowDash 3s linear infinite",transition:"stroke-opacity .22s"}}/>
                </g>
              );
            })}

            {/* NS → Hub lines */}
            {NS_NODES.map(n => {
              const [sx,sy] = hubStart(n.cx, n.cy);
              const d = pathH(sx, sy, n.cx - 100, n.cy);
              const op = connOps(n.id);
              return (
                <g key={n.id}>
                  <path d={d} fill="none" stroke={n.color} strokeWidth="2.2" strokeOpacity={op.base}  strokeLinecap="round" filter="url(#glow)" style={{transition:"stroke-opacity .22s"}}/>
                  <path d={d} fill="none" stroke={n.color} strokeWidth="2.4" strokeOpacity={op.flow}  strokeDasharray="8 15" strokeLinecap="round" filter="url(#glow)" style={{animation:"flowDash 3s linear infinite",transition:"stroke-opacity .22s"}}/>
                </g>
              );
            })}

            {/* vertical top/bottom */}
            {(()=>{ const [sx,sy]=hubStart(720,120); const d=pathV(sx,sy,720,166); const op=connOps("top"); return (<g><path d={d} fill="none" stroke="#f97316" strokeWidth="2.2" strokeOpacity={op.base} strokeLinecap="round" filter="url(#glow)" style={{transition:"stroke-opacity .22s"}}/><path d={d} fill="none" stroke="#f97316" strokeWidth="2.4" strokeOpacity={op.flow} strokeDasharray="8 15" strokeLinecap="round" filter="url(#glow)" style={{animation:"flowDash 3s linear infinite",transition:"stroke-opacity .22s"}}/></g>); })()}
            {(()=>{ const [sx,sy]=hubStart(720,808); const d=pathV(sx,sy,720,775); const op=connOps("bottom"); return (<g><path d={d} fill="none" stroke="#a855f7" strokeWidth="2.2" strokeOpacity={op.base} strokeLinecap="round" filter="url(#glow)" style={{transition:"stroke-opacity .22s"}}/><path d={d} fill="none" stroke="#a855f7" strokeWidth="2.4" strokeOpacity={op.flow} strokeDasharray="8 15" strokeLinecap="round" filter="url(#glow)" style={{animation:"flowDash 3s linear infinite",transition:"stroke-opacity .22s"}}/></g>); })()}

            {/* branch line to overlay */}
            {activeOv && (
              <g>
                <path d={activeOv.linePath} fill="none" stroke={activeOv.color} strokeWidth="3" strokeOpacity="0.4"  strokeLinecap="round" filter="url(#glow)"/>
                <path d={activeOv.linePath} fill="none" stroke={activeOv.color} strokeWidth="3" strokeOpacity="1.0"  strokeDasharray="7 12" strokeLinecap="round" filter="url(#glow)" style={{animation:"flowDash 1.6s linear infinite"}}/>
              </g>
            )}
          </svg>

          {/* ── HUB ── */}
          <div
            onMouseEnter={() => setHovered("hub")}
            onMouseLeave={() => setHovered(null)}
            style={{
              position:"absolute", left:HUB.x, top:HUB.y,
              width:128, height:128, borderRadius:"50%",
              transform:"translate(-50%,-50%)",
              background:"rgba(255,255,255,0.07)",
              backdropFilter:"blur(24px) saturate(2)",
              WebkitBackdropFilter:"blur(24px) saturate(2)",
              border:"1.5px solid rgba(240,180,106,0.65)",
              boxShadow:"inset 0 2px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.3)",
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
              gap:2, zIndex:10,
              animation:"hubPulse 3.8s ease-in-out infinite",
              opacity: nodeOp("hub"),
              transition:"opacity .22s",
              cursor:"default",
            }}>
            <ImprintLogo size={24} />
            <span style={{ fontSize:19, fontWeight:700, letterSpacing:"-0.025em", lineHeight:1, marginTop:3, color:"#fff" }}>Imprint</span>
            <span style={{ fontSize:9, fontWeight:500, letterSpacing:"0.16em", color:"rgba(240,200,150,0.65)", textTransform:"uppercase" }}>Memory Layer</span>
          </div>

          {/* memory count badge */}
          <div style={{ position:"absolute", left:0, top:530, width:MAP_W, display:"flex", justifyContent:"center", pointerEvents:"none", zIndex:11 }}>
            <span style={{ fontSize:11.5, fontWeight:600, color:"#f0b46a", background:"rgba(240,180,106,0.1)", backdropFilter:"blur(8px)", border:"1px solid rgba(240,180,106,0.25)", padding:"5px 14px", borderRadius:999, boxShadow:`${INSET_SHINE}` }}>
              {loadingData ? "loading…" : `${memories.length} memories`}
            </span>
          </div>

          {/* ── IDE NODES ── */}
          {IDE_NODES.map(n => {
            const hl = hovered === n.id, sel = selectedId === n.id;
            const active = hl || sel;
            return (
              <div
                key={n.id}
                className="node-card glass-node-ide"
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => { setSelectedId(sel ? null : n.id); setOvSearch(""); }}
                style={{
                  position:"absolute", left:n.cx - 108, top:n.cy - 38,
                  width:215, height:76,
                  borderRadius:20,
                  display:"flex", alignItems:"center", gap:12, padding:"0 15px",
                  background: active ? "rgba(255,255,255,0.09)" : GLASS_NODE,
                  backdropFilter: BLUR_NODE,
                  WebkitBackdropFilter: BLUR_NODE,
                  border: glassBorder(n.color, active),
                  boxShadow: glassShadow(n.color, active),
                  opacity: nodeOp(n.id),
                  cursor:"pointer",
                }}>
                <div style={{ width:40, height:40, borderRadius:12, flexShrink:0, background:`${n.color}18`, border:`1px solid ${n.color}40`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 0 14px ${n.color}20` }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d={ICONS[n.icon]} fill={n.fill ? n.color : "none"} stroke={n.fill ? "none" : n.color} strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, letterSpacing:"-0.01em", color:"rgba(255,255,255,0.95)", display:"flex", alignItems:"baseline", gap:6 }}>
                    <span>{n.title}</span>
                    {n.tag && <span style={{ fontSize:9.5, color:"rgba(255,255,255,0.3)", fontWeight:400 }}>{n.tag}</span>}
                  </div>
                  {!n.isConfig && (
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5 }}>
                      <span style={{ width:6, height:6, borderRadius:999, background:n.dot, boxShadow:`0 0 8px ${n.dot}`, flexShrink:0 }}/>
                      <span style={{ fontSize:11, color:n.dot, fontWeight:500 }}>{n.status}</span>
                      <span style={{ fontSize:10.5, color:"rgba(255,255,255,0.32)" }}>· {n.sub}</span>
                    </div>
                  )}
                  {n.isConfig && (
                    <button style={{ marginTop:5, height:23, padding:"0 12px", borderRadius:7, background:"rgba(0,229,255,0.07)", border:"1px solid rgba(0,229,255,0.3)", color:"#00e5ff", fontSize:10.5, fontWeight:600, fontFamily:"inherit", cursor:"pointer", backdropFilter:"blur(8px)" }}>Configure</button>
                  )}
                </div>
              </div>
            );
          })}

          {/* ── NS NODES ── */}
          {NS_NODES.map(n => {
            const hl = hovered === n.id, sel = selectedId === n.id;
            const active = hl || sel;
            const cnt = memories.filter(m => m.topic === n.topic).length;
            const pin = memories.filter(m => m.topic === n.topic && m.pinned).length;
            return (
              <div
                key={n.id}
                className="node-card glass-node-ide"
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => { setSelectedId(sel ? null : n.id); setOvSearch(""); }}
                style={{
                  position:"absolute", left:n.cx - 100, top:n.cy - 34,
                  width:200, height:68,
                  borderRadius:20,
                  display:"flex", alignItems:"center", gap:12, padding:"0 14px",
                  background: active ? "rgba(255,255,255,0.09)" : GLASS_NODE,
                  backdropFilter: BLUR_NODE,
                  WebkitBackdropFilter: BLUR_NODE,
                  border: glassBorder(n.color, active),
                  boxShadow: glassShadow(n.color, active),
                  opacity: nodeOp(n.id),
                  cursor:"pointer",
                }}>
                <div style={{ width:38, height:38, borderRadius:12, flexShrink:0, background:`${n.color}18`, border:`1px solid ${n.color}40`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 0 14px ${n.color}20` }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                    <path d={ICONS[n.icon]} fill={n.fill ? n.color : "none"} stroke={n.fill ? "none" : n.color} strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, letterSpacing:"-0.01em", color:"rgba(255,255,255,0.95)" }}>{n.title}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:3 }}>{cnt} {cnt === 1 ? "memory" : "memories"}</div>
                </div>
                {pin > 0 && (
                  <span style={{ fontSize:10, fontWeight:600, color:"#f0b46a", background:"rgba(240,180,106,0.1)", border:"1px solid rgba(240,180,106,0.28)", padding:"3px 8px", borderRadius:999, whiteSpace:"nowrap", boxShadow:`${INSET_SHINE}` }}>📌 {pin}</span>
                )}
              </div>
            );
          })}

          {/* ── Contradiction Engine ── */}
          <div
            className="node-card glass-node-ide"
            onMouseEnter={() => setHovered("top")}
            onMouseLeave={() => setHovered(null)}
            style={{
              position:"absolute", left:580, top:82, width:280, height:84,
              borderRadius:20,
              display:"flex", alignItems:"center", gap:13, padding:"0 18px",
              background: hovered === "top" ? "rgba(255,255,255,0.09)" : GLASS_NODE,
              backdropFilter: BLUR_NODE,
              WebkitBackdropFilter: BLUR_NODE,
              border: glassBorder("#f97316", hovered === "top"),
              boxShadow: glassShadow("#f97316", hovered === "top"),
              opacity: nodeOp("top"),
              cursor:"default",
            }}>
            <div style={{ width:42, height:42, borderRadius:13, flexShrink:0, background:"rgba(249,115,22,0.12)", border:"1px solid rgba(249,115,22,0.36)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 16px rgba(249,115,22,0.2)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 3l9.5 16.5H2.5L12 3z" stroke="#fb923c" strokeWidth="1.7" strokeLinejoin="round"/>
                <path d="M12 9v5M12 17v.01" stroke="#fb923c" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14.5, fontWeight:600, letterSpacing:"-0.01em", color:"rgba(255,255,255,0.95)" }}>Contradiction Engine</div>
              <div style={{ fontSize:11.5, color:"#fb923c", fontWeight:500, marginTop:3 }}>3 active contradictions</div>
              <div style={{ fontSize:9.5, color:"rgba(255,255,255,0.3)", marginTop:2, fontFamily:"'JetBrains Mono',monospace" }}>Lambda + DDB Streams · real-time</div>
            </div>
          </div>

          {/* ── Stats bar ── */}
          <div
            className="node-card glass-node-ide"
            onMouseEnter={() => setHovered("bottom")}
            onMouseLeave={() => setHovered(null)}
            style={{
              position:"absolute", left:440, top:774, width:560, height:72,
              borderRadius:20,
              display:"flex", alignItems:"stretch",
              background: hovered === "bottom" ? "rgba(255,255,255,0.09)" : GLASS_NODE,
              backdropFilter: BLUR_NODE,
              WebkitBackdropFilter: BLUR_NODE,
              border: glassBorder("#a855f7", hovered === "bottom"),
              boxShadow: glassShadow("#a855f7", hovered === "bottom"),
              opacity: nodeOp("bottom"),
              overflow:"hidden",
              cursor:"default",
            }}>
            {[
              { v: memories.length,  l:"total",             c:"#c084fc", div:false },
              { v: pinnedCount,      l:"pinned",            c:"#f0b46a", div:true  },
              { v: decayingCount,    l:"decaying",          c:"#fb7185", div:true  },
              { v: importedCount,    l:"imported",          c:"#22d3ee", div:true  },
            ].map((seg, i) => (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, borderLeft: seg.div ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                <span style={{ fontSize:22, fontWeight:700, color:seg.c, lineHeight:1, letterSpacing:"-0.025em" }}>{loadingData ? "–" : seg.v}</span>
                <span style={{ fontSize:10, color:"rgba(255,255,255,0.38)", fontWeight:500, letterSpacing:"0.04em" }}>{seg.l}</span>
              </div>
            ))}
          </div>

          {/* ── BRANCH OVERLAY ── */}
          {selectedId && activeOv && (
            <div style={{
              position:"absolute", left:activeOv.left, top:activeOv.top,
              width:OV_W, height:OV_H,
              borderRadius:22,
              background:"rgba(0,0,0,0.82)",
              backdropFilter:"blur(40px) saturate(2)",
              WebkitBackdropFilter:"blur(40px) saturate(2)",
              border:`1px solid ${activeOv.color}60`,
              boxShadow:`${INSET_SHINE}, 0 32px 80px rgba(0,0,0,0.8), 0 0 40px ${activeOv.color}18`,
              zIndex:20,
              display:"flex", flexDirection:"column",
              animation:"ovIn 0.15s ease both",
            }}>
              {/* overlay header */}
              <div style={{ padding:"13px 14px 10px", borderBottom:`1px solid ${activeOv.color}20`, flexShrink:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ width:9, height:9, borderRadius:999, background:activeOv.color, boxShadow:`0 0 10px ${activeOv.color}`, flexShrink:0 }}/>
                  <span style={{ fontSize:13.5, fontWeight:600, letterSpacing:"-0.01em", flex:1, color:"rgba(255,255,255,0.95)" }}>{activeOv.title}</span>
                  <span style={{ fontSize:10, fontWeight:600, color:"rgba(255,255,255,0.4)", background:"rgba(255,255,255,0.06)", padding:"2px 8px", borderRadius:999 }}>{ovMems.length}</span>
                  <button onClick={() => { setSelectedId(null); setOvSearch(""); }} style={{ width:24, height:24, borderRadius:7, background:"rgba(255,255,255,0.06)", border:"none", color:"rgba(255,255,255,0.4)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"background .15s" }}>
                    <X size={12}/>
                  </button>
                </div>
                <div style={{ position:"relative", marginTop:9 }}>
                  <Search size={11} style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,0.25)", pointerEvents:"none" }}/>
                  <input
                    value={ovSearch}
                    onChange={e => setOvSearch(e.target.value)}
                    placeholder="Search…"
                    style={{ width:"100%", boxSizing:"border-box", height:29, padding:"0 9px 0 26px", borderRadius:9, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.75)", fontSize:12, outline:"none", fontFamily:"inherit" }}
                  />
                </div>
              </div>

              {/* memory list */}
              <div style={{ flex:1, overflowY:"auto", padding:"7px 9px", display:"flex", flexDirection:"column", gap:5 }}>
                {filtOvMems.length === 0 && (
                  <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"28px 0", gap:12 }}>
                    <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.22)" }}>{ovSearch ? "No matches" : "No memories yet"}</div>
                    <button onClick={() => setShowAddModal(true)} style={{ background:"none", border:"none", color:activeOv.color, fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>Add memory →</button>
                  </div>
                )}
                {filtOvMems.map(mem => {
                  const tm  = TOPIC_META[mem.topic] ?? TOPIC_META.general;
                  const isEd = editingId === mem.id;
                  return (
                    <div key={mem.id} className="mem-card" style={{ position:"relative", padding:"9px 10px", borderRadius:11, background: mem.pinned ? "rgba(240,180,106,0.06)" : GLASS_CARD, backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,0.07)", borderLeft: mem.pinned ? "2px solid #f0b46a" : "1px solid rgba(255,255,255,0.07)", transition:"background .15s,border-color .15s", minHeight:46 }}>
                      {isEd ? (
                        <div>
                          <textarea autoFocus value={editText} onChange={e => setEditText(e.target.value)} rows={3} style={{ width:"100%", boxSizing:"border-box", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:6, padding:"5px 7px", color:"rgba(255,255,255,0.85)", fontSize:11.5, outline:"none", resize:"none", fontFamily:"inherit" }}/>
                          <div style={{ display:"flex", gap:6, marginTop:5 }}>
                            <button onClick={() => saveEdit(mem.id)} style={{ padding:"3px 12px", borderRadius:6, background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.25)", color:"rgba(52,211,153,0.9)", fontSize:10.5, cursor:"pointer", fontFamily:"inherit" }}>Save</button>
                            <button onClick={() => setEditingId(null)} style={{ padding:"3px 9px", borderRadius:6, background:"transparent", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.3)", fontSize:10.5, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display:"flex", gap:7, alignItems:"flex-start" }}>
                            <span style={{ width:5, height:5, borderRadius:999, background:tm.color, marginTop:5, flexShrink:0 }}/>
                            <span style={{ fontSize:12, lineHeight:1.45, color:"rgba(255,255,255,0.8)", flex:1, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{mem.content}</span>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:7, marginTop:6, paddingLeft:12 }}>
                            <span style={{ fontSize:10, color:"rgba(255,255,255,0.22)" }}>{timeAgo(new Date((mem as any)._raw?.createdAt ?? mem.createdAt))}</span>
                            <span style={{ fontSize:9, fontFamily:"'JetBrains Mono',monospace", color:"rgba(255,255,255,0.3)", background:"rgba(255,255,255,0.05)", padding:"1px 6px", borderRadius:4 }}>{mem.source}</span>
                          </div>
                        </>
                      )}
                      {!isEd && (
                        <div className="mem-act" style={{ position:"absolute", top:8, right:8, display:"flex", gap:3, opacity:0, transition:"opacity .15s" }}>
                          <button onClick={() => togglePin(mem.id)} title={mem.pinned ? "Unpin" : "Pin"} style={{ width:22, height:22, borderRadius:6, background:"rgba(255,255,255,0.06)", border:"none", color: mem.pinned ? "#f0b46a" : "rgba(255,255,255,0.4)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><Pin size={10} fill={mem.pinned ? "currentColor" : "none"}/></button>
                          <button onClick={() => { setEditingId(mem.id); setEditText(mem.content); }} title="Edit" style={{ width:22, height:22, borderRadius:6, background:"rgba(255,255,255,0.06)", border:"none", color:"rgba(255,255,255,0.4)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><Edit3 size={10}/></button>
                          <button onClick={() => deleteMemory(mem.id)} title="Delete" style={{ width:22, height:22, borderRadius:6, background:"rgba(255,255,255,0.06)", border:"none", color:"rgba(248,113,113,0.55)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><Trash2 size={10}/></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>{/* end scaled map */}
      </div>{/* end canvas */}

      {/* ════ ADD MODAL ════ */}
      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)}>
          <div style={{ display:"flex", alignItems:"center", marginBottom:20 }}>
            <span style={{ fontSize:19, fontWeight:600, flex:1, letterSpacing:"-0.015em" }}>Add Memory</span>
            <button onClick={() => setShowAddModal(false)} style={{ width:30, height:30, borderRadius:9, background:"rgba(255,255,255,0.05)", border:"none", color:"rgba(255,255,255,0.5)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><X size={14}/></button>
          </div>
          <textarea autoFocus value={newMemory} onChange={e => setNewMemory(e.target.value)} placeholder="What should Imprint remember?" rows={4}
            style={{ width:"100%", boxSizing:"border-box", resize:"none", padding:"14px", borderRadius:13, background:"rgba(255,255,255,0.05)", backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", fontSize:13.5, lineHeight:1.55, fontFamily:"inherit", outline:"none" }}/>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", margin:"18px 0 9px", fontWeight:500, letterSpacing:"0.04em" }}>TOPIC</div>
          <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
            {(["work","personal","preferences","projects"] as Topic[]).map(t => (
              <button key={t} onClick={() => setNewTopic(t)} style={{ flex:1, minWidth:80, height:38, borderRadius:10, fontSize:12.5, fontWeight:600, fontFamily:"inherit", cursor:"pointer", backdropFilter:"blur(8px)", background: newTopic===t ? TOPIC_META[t].bg : "rgba(255,255,255,0.04)", border:`1px solid ${newTopic===t ? TOPIC_META[t].color : "rgba(255,255,255,0.1)"}`, color: newTopic===t ? TOPIC_META[t].color : "rgba(255,255,255,0.55)", transition:"all .15s" }}>
                {TOPIC_META[t].emoji} {TOPIC_META[t].label}
              </button>
            ))}
          </div>
          <div onClick={() => setNewPin(p => !p)} style={{ display:"flex", alignItems:"center", gap:11, marginTop:20, cursor:"pointer" }}>
            <div style={{ width:40, height:23, borderRadius:999, background: newPin ? "rgba(240,180,106,0.75)" : "rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.08)", position:"relative", transition:"background .18s", flexShrink:0 }}>
              <div style={{ position:"absolute", top:2.5, left: newPin ? 19 : 2.5, width:16, height:16, borderRadius:999, background:"#fff", transition:"left .18s", boxShadow:"0 1px 4px rgba(0,0,0,0.45)" }}/>
            </div>
            <span style={{ fontSize:13.5, color:"rgba(255,255,255,0.7)" }}>Pin this memory</span>
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:26 }}>
            <button onClick={() => setShowAddModal(false)} style={{ height:40, padding:"0 20px", borderRadius:11, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.7)", fontSize:13.5, fontWeight:500, fontFamily:"inherit", cursor:"pointer" }}>Cancel</button>
            <button onClick={addMemory} disabled={!newMemory.trim()} style={{ height:40, padding:"0 22px", borderRadius:11, background: newMemory.trim() ? "linear-gradient(145deg,#f0b46a,#b97e35)" : "rgba(255,255,255,0.05)", border:"none", color: newMemory.trim() ? "#1a0f08" : "rgba(255,255,255,0.2)", fontSize:13.5, fontWeight:600, fontFamily:"inherit", cursor: newMemory.trim() ? "pointer" : "not-allowed", boxShadow: newMemory.trim() ? "0 4px 20px rgba(240,180,106,0.35)" : "none" }}>Save Memory</button>
          </div>
        </Modal>
      )}

      {/* ════ IMPORT MODAL ════ */}
      {showImport && (
        <Modal onClose={() => setShowImport(false)}>
          <div style={{ display:"flex", alignItems:"center", marginBottom:20 }}>
            <span style={{ fontSize:19, fontWeight:600, flex:1, letterSpacing:"-0.015em" }}>Import Memories</span>
            <button onClick={() => setShowImport(false)} style={{ width:30, height:30, borderRadius:9, background:"rgba(255,255,255,0.05)", border:"none", color:"rgba(255,255,255,0.5)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><X size={14}/></button>
          </div>
          <p style={{ fontSize:12.5, color:"rgba(255,255,255,0.3)", marginBottom:16, lineHeight:1.55 }}>Paste any text — Claude extracts facts automatically.</p>
          <textarea autoFocus value={importText} onChange={e => setImportText(e.target.value)} placeholder="Paste notes, context, chat logs…" rows={6}
            style={{ width:"100%", boxSizing:"border-box", resize:"none", padding:"14px", borderRadius:13, background:"rgba(255,255,255,0.05)", backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", fontSize:12.5, lineHeight:1.55, fontFamily:"inherit", outline:"none" }}/>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
            <button onClick={() => setShowImport(false)} style={{ height:40, padding:"0 20px", borderRadius:11, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.7)", fontSize:13.5, fontWeight:500, fontFamily:"inherit", cursor:"pointer" }}>Cancel</button>
            <button onClick={runImport} disabled={!importText.trim() || importing} style={{ height:40, padding:"0 22px", borderRadius:11, background: importText.trim() ? "linear-gradient(145deg,#f0b46a,#b97e35)" : "rgba(255,255,255,0.05)", border:"none", color: importText.trim() ? "#1a0f08" : "rgba(255,255,255,0.2)", fontSize:13.5, fontWeight:600, fontFamily:"inherit", cursor: importText.trim() ? "pointer" : "not-allowed", display:"flex", alignItems:"center", gap:7, boxShadow: importText.trim() ? "0 4px 20px rgba(240,180,106,0.35)" : "none" }}>
              {importing ? <><RefreshCw size={13} style={{ animation:"spin 0.8s linear infinite" }}/>Importing…</> : "Import"}
            </button>
          </div>
        </Modal>
      )}

      {/* ════ DELETE ALL ════ */}
      {deleteConfirm && (
        <div onClick={() => setDeleteConfirm(false)} style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.8)", backdropFilter:"blur(8px)", padding:24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width:390, maxWidth:"100%", borderRadius:22, background:"rgba(15,5,5,0.95)", backdropFilter:"blur(32px)", border:"1px solid rgba(248,113,113,0.2)", boxShadow:`${INSET_SHINE}, 0 40px 80px rgba(0,0,0,0.75)`, padding:28, textAlign:"center" }}>
            <div style={{ width:50, height:50, borderRadius:999, background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.22)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}><Trash2 size={24} color="#f87171"/></div>
            <div style={{ fontSize:17, fontWeight:600, marginBottom:8 }}>Delete all {memories.length} memories?</div>
            <div style={{ fontSize:13.5, color:"rgba(255,255,255,0.38)", lineHeight:1.55, marginBottom:24 }}>This permanently erases everything Imprint remembers. Cannot be undone.</div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setDeleteConfirm(false)} style={{ flex:1, height:40, borderRadius:11, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.7)", fontSize:13.5, fontWeight:500, fontFamily:"inherit", cursor:"pointer" }}>Cancel</button>
              <button onClick={deleteAll} style={{ flex:1, height:40, borderRadius:11, background:"#ef4444", border:"none", color:"#fff", fontSize:13.5, fontWeight:600, fontFamily:"inherit", cursor:"pointer", boxShadow:"0 4px 20px rgba(239,68,68,0.35)" }}>Delete everything</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
