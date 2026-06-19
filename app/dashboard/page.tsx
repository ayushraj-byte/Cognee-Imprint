"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Pin, Trash2, Edit3, X, Plus, Download, Upload, Search, MessageSquare, LogOut, RefreshCw } from "lucide-react";
import ImprintLogo from "@/app/components/ImprintLogo";
import BackgroundVideo from "@/app/components/BackgroundVideo";

type Topic = "work" | "personal" | "preferences" | "projects" | "health" | "relationships" | "general";
interface Memory {
  id: string; content: string; topic: Topic; pinned: boolean; createdAt: Date; source: string;
}

const MAP_W = 1440, MAP_H = 900;
const HUB = { x: 720, y: 450, r: 60 };

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

interface IDENode {
  id: string; title: string; tag?: string; status?: string; dot?: string; sub?: string;
  isConfig?: boolean; icon: string; fill?: boolean; color: string; cx: number; cy: number;
  sources: string[];
}
interface NSNode {
  id: string; title: string; icon: string; fill?: boolean; color: string;
  cx: number; cy: number; topic: Topic;
}

const IDE_NODES: IDENode[] = [
  { id: "cc",  title: "Claude Code",  status: "Connected", dot: "#34d399", sub: "94 tagged", icon: "star",     fill: true, color: "#22d3ee", cx: 182, cy: 152, sources: ["claude-code", "claude_code", "claudecode", "cc"] },
  { id: "cur", title: "Cursor",       status: "Connected", dot: "#34d399", sub: "61 tagged", icon: "cursor",              color: "#34d399", cx: 150, cy: 294, sources: ["cursor"] },
  { id: "cod", title: "Codex",        tag: "GitHub Copilot", status: "Connected", dot: "#34d399", sub: "38 tagged", icon: "brackets", color: "#818cf8", cx: 138, cy: 436, sources: ["codex", "github-copilot", "copilot"] },
  { id: "ag",  title: "Antigravity",  status: "Idle",      dot: "#f59e0b", sub: "12 tagged", icon: "uparrow",             color: "#c084fc", cx: 150, cy: 578, sources: ["antigravity"] },
  { id: "mcp", title: "Custom MCP",   isConfig: true,                                          icon: "plug",               color: "#e879f9", cx: 182, cy: 720, sources: ["custom-mcp", "custommcp", "mcp"] },
];
const NS_NODES: NSNode[] = [
  { id: "work",   title: "Work",        icon: "folder",  color: "#f472b6", cx: 1258, cy: 152, topic: "work"        },
  { id: "proj",   title: "Projects",    icon: "layers",  color: "#fb7185", cx: 1290, cy: 294, topic: "projects"    },
  { id: "pref",   title: "Preferences", icon: "sliders", color: "#fb923c", cx: 1302, cy: 436, topic: "preferences" },
  { id: "pers",   title: "Personal",    icon: "user",    color: "#fbbf24", cx: 1290, cy: 578, topic: "personal"    },
  { id: "health", title: "Health",      icon: "heart",   fill: true, color: "#a3e635", cx: 1258, cy: 720, topic: "health" },
];

const TOPIC_META: Record<Topic, { color: string; bg: string; label: string; emoji: string }> = {
  projects:      { color: "#7c3aed", bg: "rgba(124,58,237,0.1)",  label: "Projects",      emoji: "🚀" },
  work:          { color: "#0070f3", bg: "rgba(0,112,243,0.1)",   label: "Work",           emoji: "💼" },
  preferences:   { color: "#d97706", bg: "rgba(217,119,6,0.1)",   label: "Preferences",   emoji: "⭐" },
  personal:      { color: "#059669", bg: "rgba(5,150,105,0.1)",   label: "Personal",      emoji: "👤" },
  health:        { color: "#e11d48", bg: "rgba(225,29,72,0.1)",   label: "Health",        emoji: "❤️" },
  relationships: { color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",  label: "Relationships", emoji: "🤝" },
  general:       { color: "#6b7280", bg: "rgba(107,114,128,0.1)", label: "General",       emoji: "📌" },
};

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(3,5,10,0.65)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "rgba(14,17,28,0.96)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: "24px 28px", width: "100%", maxWidth: 480, boxShadow: "0 30px 80px rgba(0,0,0,0.6),inset 0 1px 1px rgba(255,255,255,0.06)" }}>
        {children}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const isLoaded = status !== "loading";
  const user = session?.user ?? null;
  const userId =
    (session?.user as { id?: string })?.id ??
    (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("userId") : null);

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selectedNs, setSelectedNs] = useState<string | null>(null);
  const [selectedIde, setSelectedIde] = useState<string | null>(null);
  const [panelSearch, setPanelSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMemory, setNewMemory] = useState("");
  const [newTopic, setNewTopic] = useState<Topic>("general");
  const [newPin, setNewPin] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [mapScale, setMapScale] = useState(1);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);
  const pulseTmer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const panelOpen = !!(selectedNs || selectedIde);

  useEffect(() => {
    const fit = () => {
      const el = mapContainerRef.current;
      if (!el) return;
      const s = Math.min(1, (el.clientWidth - 32) / MAP_W, (el.clientHeight - 32) / MAP_H);
      setMapScale(Math.max(0.3, s));
    };
    const ro = new ResizeObserver(fit);
    if (mapContainerRef.current) ro.observe(mapContainerRef.current);
    fit();
    return () => ro.disconnect();
  }, []);

  function mapApiMemory(m: any): Memory {
    return { id: m.memoryId, content: m.content, topic: (m.topic || "general") as Topic, pinned: !!m.pinned, createdAt: new Date(m.createdAt), source: m.source || "chat", _raw: m } as any;
  }

  async function loadMemories() {
    if (!userId) return;
    setLoadingData(true);
    try {
      const res = await fetch(`/api/memories?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      const mems = (data.memories || []).map(mapApiMemory);
      setMemories(mems);
      lastCountRef.current = mems.length;
    } catch {}
    setLoadingData(false);
  }

  useEffect(() => { if (isLoaded && userId) loadMemories(); }, [isLoaded, userId]);

  useEffect(() => {
    if (!userId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/memories?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();
        const incoming = (data.memories || []).map(mapApiMemory);
        if (lastCountRef.current > 0 && incoming.length > lastCountRef.current) setMemories(incoming);
        lastCountRef.current = incoming.length;
      } catch {}
    };
    const iv = setInterval(poll, 5000);
    return () => clearInterval(iv);
  }, [userId]);

  function rawOf(m: Memory) { return (m as any)._raw || {}; }

  async function togglePin(id: string) {
    const m = memories.find(x => x.id === id);
    if (!m || !userId) return;
    const next = !m.pinned;
    setMemories(p => p.map(x => x.id === id ? { ...x, pinned: next } : x));
    try {
      await fetch(`/api/memories/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, createdAt: rawOf(m).createdAt, pinned: next }) });
    } catch { setMemories(p => p.map(x => x.id === id ? { ...x, pinned: !next } : x)); }
  }

  async function deleteMemory(id: string) {
    const m = memories.find(x => x.id === id);
    if (!m || !userId) return;
    setMemories(p => p.filter(x => x.id !== id));
    try {
      await fetch(`/api/memories?userId=${encodeURIComponent(userId)}&memoryId=${id}&createdAt=${encodeURIComponent(rawOf(m).createdAt)}`, { method: "DELETE" });
    } catch { loadMemories(); }
  }

  async function deleteAll() {
    if (!userId) return;
    const snapshot = [...memories];
    setMemories([]); setDeleteConfirm(false);
    for (const m of snapshot) {
      try { await fetch(`/api/memories?userId=${encodeURIComponent(userId)}&memoryId=${m.id}&createdAt=${encodeURIComponent(rawOf(m).createdAt)}`, { method: "DELETE" }); } catch {}
    }
  }

  async function saveEdit(id: string) {
    const m = memories.find(x => x.id === id);
    if (!m || !userId) return;
    setMemories(p => p.map(x => x.id === id ? { ...x, content: editText } : x));
    setEditingId(null);
    try {
      await fetch(`/api/memories/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, createdAt: rawOf(m).createdAt, content: editText }) });
    } catch { loadMemories(); }
  }

  async function addMemory() {
    if (!newMemory.trim() || !userId) return;
    try {
      const res = await fetch("/api/memories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, content: newMemory.trim(), topic: newTopic, pinned: newPin, source: "manual" }) });
      const data = await res.json();
      if (data.memory) setMemories(p => [mapApiMemory(data.memory), ...p]);
    } catch { loadMemories(); }
    setNewMemory(""); setNewTopic("general"); setNewPin(false); setShowAddModal(false);
  }

  async function runImport() {
    if (!importText.trim() || !userId) return;
    setImporting(true);
    try {
      const res = await fetch("/api/memories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, messages: [{ role: "user", content: importText }], source: "import" }) });
      const data = await res.json();
      if (data.memories) setMemories(p => [...data.memories.map(mapApiMemory), ...p]);
    } catch {}
    setImporting(false); setShowImport(false); setImportText("");
  }

  function doExport() {
    const lines = ["IMPRINT — Memory Export", `Generated: ${new Date().toLocaleDateString()}`, `Total: ${memories.length} memories`, "", "=== PINNED ===", ...memories.filter(m => m.pinned).map(m => `• [${m.topic}] ${m.content}`), "", "=== ALL MEMORIES ===", ...memories.filter(m => !m.pinned).map(m => `• [${m.topic}] ${m.content}`)].join("\n");
    downloadText(lines, `imprint-${new Date().toISOString().split("T")[0]}.txt`);
  }

  function nodeOp(id: string) { return !hovered ? 1 : hovered === id ? 1 : 0.32; }
  function connOps(id: string) {
    if (!hovered) return { base: 0.16, flow: 0.55 };
    return hovered === id ? { base: 0.3, flow: 1 } : { base: 0.04, flow: 0.04 };
  }

  const pinnedCount = memories.filter(m => m.pinned).length;
  const importedCount = memories.filter(m => m.source === "import").length;
  const decayingCount = memories.filter(m => !m.pinned && (Date.now() - new Date(m.createdAt).getTime()) / 86400000 > 23).length;

  const activeNs = NS_NODES.find(n => n.id === selectedNs) ?? null;
  const activeIde = IDE_NODES.find(n => n.id === selectedIde) ?? null;
  const activePanelNode = activeNs ?? activeIde;
  const activeMems = activeNs
    ? memories.filter(m => m.topic === activeNs.topic)
    : activeIde
    ? memories.filter(m => activeIde.sources.some(s => (m.source || "").toLowerCase().includes(s.toLowerCase())))
    : [];
  const filteredMems = panelSearch ? activeMems.filter(m => m.content.toLowerCase().includes(panelSearch.toLowerCase())) : activeMems;

  if (!isLoaded) return null;

  return (
    <div style={{ height: "100vh", overflow: "hidden", background: "#08080f", color: "white", position: "relative", fontFamily: "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <BackgroundVideo overlayOpacity={0.78} />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes hubPulse{0%,100%{box-shadow:0 0 0 0 rgba(240,180,106,0.42),0 0 60px rgba(240,180,106,0.3),inset 0 0 34px rgba(240,180,106,0.22);}50%{box-shadow:0 0 0 13px rgba(240,180,106,0),0 0 82px rgba(240,180,106,0.45),inset 0 0 34px rgba(240,180,106,0.22);}}
        @keyframes flowDash{to{stroke-dashoffset:-320;}}
        @keyframes ping{0%{transform:scale(1);opacity:0.6;}70%,100%{transform:scale(2.6);opacity:0;}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes panel-in{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
        .node-card{transition:opacity .2s,border-color .2s,box-shadow .2s,transform .15s;}
        .node-card:hover{transform:scale(1.02);}
        .mem-card:hover{background:rgba(255,255,255,0.05)!important;border-color:rgba(255,255,255,0.12)!important;}
        .mem-card:hover .mem-actions{opacity:1!important;}
        .hdr-btn:hover{background:rgba(255,255,255,0.1)!important;color:rgba(255,255,255,0.85)!important;}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:4px}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, height: 48, background: "rgba(8,11,20,0.65)", backdropFilter: "blur(18px)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 14px", gap: 8 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(145deg,rgba(240,180,106,0.3),rgba(240,180,106,0.08))", border: "1px solid rgba(240,180,106,0.42)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ImprintLogo size={16} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.88)", letterSpacing: "-0.01em" }}>Imprint</span>
        </Link>
        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", margin: "0 2px" }} />
        {showSearch ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: "0 10px", height: 32, flex: 1, maxWidth: 280 }}>
            <Search size={12} style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
            <input autoFocus value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} placeholder="Search memories…" style={{ background: "transparent", border: "none", outline: "none", color: "rgba(255,255,255,0.8)", fontSize: 12.5, flex: 1 }} />
            <button onClick={() => { setShowSearch(false); setGlobalSearch(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: 2, display: "flex" }}><X size={12} /></button>
          </div>
        ) : (
          <button className="hdr-btn" onClick={() => setShowSearch(true)} style={{ width: 28, height: 28, borderRadius: 7, background: "transparent", border: "1px solid transparent", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s" }}>
            <Search size={14} />
          </button>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: "#f0b46a", background: "rgba(240,180,106,0.1)", border: "1px solid rgba(240,180,106,0.16)", padding: "4px 11px", borderRadius: 999, fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>
          {loadingData ? "…" : `${memories.length} memories · ${pinnedCount} pinned`}
        </div>
        <button className="hdr-btn" onClick={() => setShowAddModal(true)} title="Add memory" style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s" }}><Plus size={14} /></button>
        <Link href="/chat" title="Chat" style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.14)", color: "#34d399", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s", textDecoration: "none" }}><MessageSquare size={14} /></Link>
        <button className="hdr-btn" onClick={doExport} title="Export" style={{ width: 28, height: 28, borderRadius: 7, background: "transparent", border: "1px solid transparent", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s" }}><Download size={14} /></button>
        <button className="hdr-btn" onClick={() => setShowImport(true)} title="Import" style={{ width: 28, height: 28, borderRadius: 7, background: "transparent", border: "1px solid transparent", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s" }}><Upload size={14} /></button>
        <button className="hdr-btn" onClick={() => setDeleteConfirm(true)} title="Delete all" style={{ width: 28, height: 28, borderRadius: 7, background: "transparent", border: "1px solid transparent", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s" }}><Trash2 size={14} /></button>
        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />
        {user?.image ? (
          <img src={user.image} alt="" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(145deg,#f0b46a,#b97e35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#1a0f08", flexShrink: 0 }}>
            {((user?.name || user?.email || "?")[0]).toUpperCase()}
          </div>
        )}
        <button onClick={() => signOut({ callbackUrl: "/sign-in" })} title="Sign out" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: 4, transition: "color .15s" }}><LogOut size={13} /></button>
      </div>

      {/* ── MIND MAP CANVAS ── */}
      <div ref={mapContainerRef} style={{
        position: "fixed", top: 48, left: 0, bottom: 0, right: panelOpen ? 390 : 0,
        overflow: "hidden", transition: "right 0.28s cubic-bezier(.22,.61,.36,1)",
        zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {/* Purple glow */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 1100, height: 900, pointerEvents: "none", background: "radial-gradient(ellipse at center,rgba(124,58,237,0.16),rgba(79,70,229,0.06) 36%,transparent 66%)", filter: "blur(6px)" }} />
        {/* Dot grid */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(rgba(255,255,255,0.045) 1px,transparent 1px)", backgroundSize: "30px 30px", maskImage: "radial-gradient(ellipse 65% 65% at center,#000 30%,transparent 78%)", WebkitMaskImage: "radial-gradient(ellipse 65% 65% at center,#000 30%,transparent 78%)" }} />

        {/* Scaled map container */}
        <div style={{ position: "relative", width: MAP_W, height: MAP_H, transformOrigin: "center", transform: `scale(${mapScale})`, flexShrink: 0 }}>

          {/* SVG connections */}
          <svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
            <defs>
              <filter id="ln" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2.6" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {IDE_NODES.map(n => {
              const [sx, sy] = hubStart(n.cx, n.cy);
              const d = pathH(sx, sy, n.cx + 100, n.cy);
              const op = connOps(n.id);
              return (
                <g key={n.id}>
                  <path d={d} fill="none" stroke={n.color} strokeWidth="2" strokeOpacity={op.base} strokeLinecap="round" filter="url(#ln)" style={{ transition: "stroke-opacity .2s" }} />
                  <path d={d} fill="none" stroke={n.color} strokeWidth="2.2" strokeOpacity={op.flow} strokeDasharray="7 14" strokeLinecap="round" filter="url(#ln)" style={{ animation: "flowDash 3.4s linear infinite", transition: "stroke-opacity .2s" }} />
                </g>
              );
            })}
            {NS_NODES.map(n => {
              const [sx, sy] = hubStart(n.cx, n.cy);
              const d = pathH(sx, sy, n.cx - 95, n.cy);
              const op = connOps(n.id);
              return (
                <g key={n.id}>
                  <path d={d} fill="none" stroke={n.color} strokeWidth="2" strokeOpacity={op.base} strokeLinecap="round" filter="url(#ln)" style={{ transition: "stroke-opacity .2s" }} />
                  <path d={d} fill="none" stroke={n.color} strokeWidth="2.2" strokeOpacity={op.flow} strokeDasharray="7 14" strokeLinecap="round" filter="url(#ln)" style={{ animation: "flowDash 3.4s linear infinite", transition: "stroke-opacity .2s" }} />
                </g>
              );
            })}
            {(() => {
              const [sx, sy] = hubStart(720, 128);
              const d = pathV(sx, sy, 720, 169);
              const op = connOps("top");
              return (
                <g>
                  <path d={d} fill="none" stroke="#f97316" strokeWidth="2" strokeOpacity={op.base} strokeLinecap="round" filter="url(#ln)" style={{ transition: "stroke-opacity .2s" }} />
                  <path d={d} fill="none" stroke="#f97316" strokeWidth="2.2" strokeOpacity={op.flow} strokeDasharray="7 14" strokeLinecap="round" filter="url(#ln)" style={{ animation: "flowDash 3.4s linear infinite", transition: "stroke-opacity .2s" }} />
                </g>
              );
            })()}
            {(() => {
              const [sx, sy] = hubStart(720, 805);
              const d = pathV(sx, sy, 720, 771);
              const op = connOps("bottom");
              return (
                <g>
                  <path d={d} fill="none" stroke="#a855f7" strokeWidth="2" strokeOpacity={op.base} strokeLinecap="round" filter="url(#ln)" style={{ transition: "stroke-opacity .2s" }} />
                  <path d={d} fill="none" stroke="#a855f7" strokeWidth="2.2" strokeOpacity={op.flow} strokeDasharray="7 14" strokeLinecap="round" filter="url(#ln)" style={{ animation: "flowDash 3.4s linear infinite", transition: "stroke-opacity .2s" }} />
                </g>
              );
            })()}
          </svg>

          {/* Hub */}
          <div
            onMouseEnter={() => setHovered("hub")}
            onMouseLeave={() => setHovered(null)}
            style={{
              position: "absolute", left: HUB.x, top: HUB.y, width: 120, height: 120, borderRadius: "50%",
              transform: "translate(-50%,-50%)",
              border: "1.5px solid rgba(240,180,106,0.55)",
              background: "radial-gradient(circle at 50% 40%,rgba(240,180,106,0.24),rgba(207,143,109,0.05) 60%,rgba(18,12,8,0.5))",
              backdropFilter: "blur(12px)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
              zIndex: 10, animation: "hubPulse 3.6s ease-in-out infinite",
              opacity: nodeOp("hub"), transition: "opacity .2s",
            }}
          >
            <ImprintLogo size={22} />
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1, marginTop: 2 }}>Imprint</span>
            <span style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: "0.14em", color: "rgba(240,200,150,0.7)", textTransform: "uppercase" }}>Memory Layer</span>
          </div>

          {/* Memory badge below hub */}
          <div style={{ position: "absolute", left: 0, top: 524, width: MAP_W, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 11 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#f0b46a", background: "rgba(240,180,106,0.12)", border: "1px solid rgba(240,180,106,0.3)", padding: "4px 12px", borderRadius: 999 }}>
              {loadingData ? "…" : `${memories.length} memories`}
            </span>
          </div>

          {/* IDE nodes (left) */}
          {IDE_NODES.map(n => {
            const hl = hovered === n.id;
            const isSelected = selectedIde === n.id;
            const iconFill = n.fill ? n.color : "none";
            const iconStroke = n.fill ? "none" : n.color;
            return (
              <div key={n.id} className="node-card"
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => { setSelectedIde(isSelected ? null : n.id); setSelectedNs(null); setPanelSearch(""); }}
                style={{
                  position: "absolute", left: n.cx - 100, top: n.cy - 35,
                  width: 200, height: 70, borderRadius: 16,
                  display: "flex", alignItems: "center", gap: 11, padding: "0 13px",
                  background: "rgba(15,16,28,0.72)",
                  border: `1px solid ${hl || isSelected ? n.color : n.color + "55"}`,
                  backdropFilter: "blur(14px)",
                  boxShadow: `0 8px 24px rgba(0,0,0,0.35),inset 0 1px 1px rgba(255,255,255,0.05),0 0 18px ${hl || isSelected ? n.color + "44" : "rgba(0,0,0,0)"}`,
                  opacity: nodeOp(n.id), cursor: "pointer",
                }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: n.color + "16", border: `1px solid ${n.color}38`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                    <path d={ICONS[n.icon]} fill={iconFill} stroke={iconStroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em", display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span>{n.title}</span>
                    {n.tag && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>{n.tag}</span>}
                  </div>
                  {!n.isConfig && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: n.dot, boxShadow: `0 0 6px ${n.dot}`, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: n.dot, fontWeight: 500 }}>{n.status}</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>· {n.sub}</span>
                    </div>
                  )}
                  {n.isConfig && (
                    <button style={{ marginTop: 5, height: 22, padding: "0 11px", borderRadius: 7, background: "rgba(0,229,255,0.07)", border: "1px solid rgba(0,229,255,0.28)", color: "#00e5ff", fontSize: 10.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Configure</button>
                  )}
                </div>
              </div>
            );
          })}

          {/* NS nodes (right) */}
          {NS_NODES.map(n => {
            const hl = hovered === n.id;
            const isSelected = selectedNs === n.id;
            const iconFill = n.fill ? n.color : "none";
            const iconStroke = n.fill ? "none" : n.color;
            const count = memories.filter(m => m.topic === n.topic).length;
            const pinned = memories.filter(m => m.topic === n.topic && m.pinned).length;
            return (
              <div key={n.id} className="node-card"
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => { setSelectedNs(isSelected ? null : n.id); setSelectedIde(null); setPanelSearch(""); }}
                style={{
                  position: "absolute", left: n.cx - 95, top: n.cy - 32,
                  width: 190, height: 64, borderRadius: 16,
                  display: "flex", alignItems: "center", gap: 11, padding: "0 13px",
                  background: isSelected ? "rgba(17,14,28,0.9)" : "rgba(17,14,28,0.72)",
                  border: `1px solid ${hl || isSelected ? n.color : n.color + "55"}`,
                  backdropFilter: "blur(14px)",
                  boxShadow: `0 8px 24px rgba(0,0,0,0.35),inset 0 1px 1px rgba(255,255,255,0.05),0 0 18px ${hl || isSelected ? n.color + "48" : "rgba(0,0,0,0)"}`,
                  opacity: nodeOp(n.id), cursor: "pointer",
                }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: n.color + "18", border: `1px solid ${n.color}3a`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d={ICONS[n.icon]} fill={iconFill} stroke={iconStroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em" }}>{n.title}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{count} memories</div>
                </div>
                {pinned > 0 && (
                  <span style={{ fontSize: 9.5, fontWeight: 600, color: "#f0b46a", background: "rgba(240,180,106,0.12)", border: "1px solid rgba(240,180,106,0.25)", padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap" }}>📌 {pinned}</span>
                )}
              </div>
            );
          })}

          {/* Contradiction Engine (top center) */}
          <div className="node-card"
            onMouseEnter={() => setHovered("top")}
            onMouseLeave={() => setHovered(null)}
            style={{
              position: "absolute", left: 585, top: 89, width: 270, height: 80,
              borderRadius: 16, display: "flex", alignItems: "center", gap: 12, padding: "0 16px",
              background: "rgba(26,16,12,0.74)",
              border: `1px solid ${hovered === "top" ? "rgba(249,115,22,0.6)" : "rgba(249,115,22,0.26)"}`,
              backdropFilter: "blur(14px)",
              boxShadow: `0 8px 24px rgba(0,0,0,0.35),inset 0 1px 1px rgba(255,255,255,0.05),0 0 20px ${hovered === "top" ? "rgba(249,115,22,0.25)" : "rgba(249,115,22,0)"}`,
              opacity: nodeOp("top"), cursor: "pointer",
            }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 3l9.5 16.5H2.5L12 3z" stroke="#fb923c" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M12 9v5M12 17v.01" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>Contradiction Engine</div>
              <div style={{ fontSize: 11, color: "#fb923c", fontWeight: 500, marginTop: 3 }}>3 active contradictions</div>
              <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.3)", marginTop: 2, fontFamily: "'JetBrains Mono',monospace" }}>Lambda + DDB Streams · real-time</div>
            </div>
          </div>

          {/* Stats bar (bottom center) */}
          <div className="node-card"
            onMouseEnter={() => setHovered("bottom")}
            onMouseLeave={() => setHovered(null)}
            style={{
              position: "absolute", left: 450, top: 771, width: 540, height: 68,
              borderRadius: 16, display: "flex", alignItems: "stretch",
              background: "rgba(14,14,26,0.78)",
              border: `1px solid ${hovered === "bottom" ? "rgba(168,85,247,0.5)" : "rgba(255,255,255,0.1)"}`,
              backdropFilter: "blur(16px)",
              boxShadow: `0 10px 30px rgba(0,0,0,0.4),inset 0 1px 1px rgba(255,255,255,0.05),0 0 20px ${hovered === "bottom" ? "rgba(168,85,247,0.2)" : "rgba(0,0,0,0)"}`,
              opacity: nodeOp("bottom"), overflow: "hidden", cursor: "default",
            }}>
            {[
              { value: memories.length, label: "total",              color: "#c084fc", divider: false },
              { value: pinnedCount,     label: "pinned",             color: "#f0b46a", divider: true  },
              { value: decayingCount,   label: "decaying · TTL<7d",  color: "#fb7185", divider: true  },
              { value: importedCount,   label: "imported",           color: "#00e5ff", divider: true  },
            ].map((seg, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, borderLeft: seg.divider ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: seg.color, lineHeight: 1, letterSpacing: "-0.02em" }}>{loadingData ? "…" : seg.value}</span>
                <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)", fontWeight: 500, letterSpacing: "0.03em" }}>{seg.label}</span>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ── MEMORY SIDE PANEL ── */}
      {panelOpen && activePanelNode && (
        <div style={{ position: "fixed", top: 48, right: 0, bottom: 0, width: 390, background: "rgba(10,12,22,0.92)", backdropFilter: "blur(24px)", borderLeft: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", animation: "panel-in 0.2s ease both", zIndex: 40, boxShadow: "-20px 0 50px rgba(0,0,0,0.4)" }}>
          <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: activePanelNode.color, boxShadow: `0 0 10px ${activePanelNode.color}`, flexShrink: 0 }} />
              <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", flex: 1 }}>{activePanelNode.title}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.08)", padding: "3px 8px", borderRadius: 999 }}>{activeMems.length}</span>
              <button onClick={() => { setSelectedNs(null); setSelectedIde(null); setPanelSearch(""); }} style={{ width: 26, height: 26, borderRadius: 7, background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={13} /></button>
            </div>
            <div style={{ position: "relative", marginTop: 12 }}>
              <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", pointerEvents: "none" }} />
              <input value={panelSearch} onChange={e => setPanelSearch(e.target.value)} placeholder="Search this namespace…" style={{ width: "100%", boxSizing: "border-box", height: 32, padding: "0 10px 0 30px", borderRadius: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontSize: 12, outline: "none", fontFamily: "inherit" }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredMems.length === 0 && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "50px 0", gap: 14 }}>
                <svg width="92" height="92" viewBox="0 0 92 92" fill="none" style={{ opacity: 0.5 }}>
                  <circle cx="46" cy="46" r="14" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
                  <circle cx="46" cy="46" r="26" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                  <circle cx="46" cy="46" r="38" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                </svg>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>{panelSearch ? "No matches" : "No memories yet"}</div>
                <button onClick={() => setShowAddModal(true)} style={{ background: "none", border: "none", color: "#f0b46a", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Add your first memory →</button>
              </div>
            )}
            {filteredMems.map(mem => {
              const tm = TOPIC_META[mem.topic] ?? TOPIC_META.general;
              const isEditing = editingId === mem.id;
              return (
                <div key={mem.id} className="mem-card" style={{ position: "relative", display: "flex", gap: 9, minHeight: 64, padding: "11px 12px", borderRadius: 10, background: mem.pinned ? "rgba(240,180,106,0.05)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderLeft: mem.pinned ? "2px solid #f0b46a" : "1px solid rgba(255,255,255,0.06)", transition: "background .15s,border-color .15s" }}>
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: tm.color, marginTop: 5, flexShrink: 0, boxShadow: `0 0 6px ${tm.color}` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <div>
                        <textarea autoFocus value={editText} onChange={e => setEditText(e.target.value)} rows={3} style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 8px", color: "rgba(255,255,255,0.8)", fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <button onClick={() => saveEdit(mem.id)} style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: "rgba(52,211,153,0.85)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                          <button onClick={() => setEditingId(null)} style={{ padding: "4px 10px", borderRadius: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.28)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 13, lineHeight: 1.45, color: "rgba(255,255,255,0.78)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{mem.content}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7 }}>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>{timeAgo(new Date((mem as any)._raw?.createdAt ?? mem.createdAt))}</span>
                          <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 5 }}>{mem.source}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {!isEditing && (
                    <div className="mem-actions" style={{ position: "absolute", top: 9, right: 9, display: "flex", gap: 3, opacity: 0, transition: "opacity .15s" }}>
                      <button onClick={() => togglePin(mem.id)} title={mem.pinned ? "Unpin" : "Pin"} style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "none", color: mem.pinned ? "#f0b46a" : "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Pin size={11} fill={mem.pinned ? "currentColor" : "none"} /></button>
                      <button onClick={() => { setEditingId(mem.id); setEditText(mem.content); }} title="Edit" style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "none", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Edit3 size={11} /></button>
                      <button onClick={() => deleteMemory(mem.id)} title="Delete" style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "none", color: "rgba(248,113,113,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Trash2 size={11} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ADD MODAL ── */}
      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
            <span style={{ fontSize: 18, fontWeight: 600, flex: 1, letterSpacing: "-0.01em" }}>Add Memory</span>
            <button onClick={() => setShowAddModal(false)} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "none", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={14} /></button>
          </div>
          <textarea autoFocus value={newMemory} onChange={e => setNewMemory(e.target.value)} placeholder="What should Imprint remember?" rows={4} style={{ width: "100%", boxSizing: "border-box", resize: "none", padding: 13, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 13.5, lineHeight: 1.5, fontFamily: "inherit", outline: "none" }} />
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "16px 0 8px", fontWeight: 500, letterSpacing: "0.02em" }}>TOPIC</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["work", "personal", "preferences", "projects"] as Topic[]).map(t => (
              <button key={t} onClick={() => setNewTopic(t)} style={{ flex: 1, minWidth: 80, height: 36, borderRadius: 9, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: newTopic === t ? TOPIC_META[t].bg : "rgba(255,255,255,0.04)", border: `1px solid ${newTopic === t ? TOPIC_META[t].color : "rgba(255,255,255,0.1)"}`, color: newTopic === t ? TOPIC_META[t].color : "rgba(255,255,255,0.6)", transition: "all .15s" }}>
                {TOPIC_META[t].emoji} {TOPIC_META[t].label}
              </button>
            ))}
          </div>
          <div onClick={() => setNewPin(p => !p)} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, cursor: "pointer" }}>
            <div style={{ width: 38, height: 22, borderRadius: 999, background: newPin ? "rgba(240,180,106,0.7)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", position: "relative", transition: "background .15s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 2, left: newPin ? 18 : 2, width: 16, height: 16, borderRadius: 999, background: "#fff", transition: "left .18s", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }} />
            </div>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Pin this memory</span>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <button onClick={() => setShowAddModal(false)} style={{ height: 38, padding: "0 18px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: "pointer" }}>Cancel</button>
            <button onClick={addMemory} disabled={!newMemory.trim()} style={{ height: 38, padding: "0 20px", borderRadius: 10, background: newMemory.trim() ? "linear-gradient(145deg,#f0b46a,#b97e35)" : "rgba(255,255,255,0.05)", border: "none", color: newMemory.trim() ? "#1a0f08" : "rgba(255,255,255,0.2)", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: newMemory.trim() ? "pointer" : "not-allowed", boxShadow: newMemory.trim() ? "0 4px 16px rgba(240,180,106,0.3)" : "none" }}>Save Memory</button>
          </div>
        </Modal>
      )}

      {/* ── IMPORT MODAL ── */}
      {showImport && (
        <Modal onClose={() => setShowImport(false)}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
            <span style={{ fontSize: 18, fontWeight: 600, flex: 1, letterSpacing: "-0.01em" }}>Import Memories</span>
            <button onClick={() => setShowImport(false)} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "none", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={14} /></button>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 14, lineHeight: 1.5 }}>Paste any text — Claude extracts facts automatically.</p>
          <textarea autoFocus value={importText} onChange={e => setImportText(e.target.value)} placeholder="Paste notes, context, chat logs…" rows={6} style={{ width: "100%", boxSizing: "border-box", resize: "none", padding: "13px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, lineHeight: 1.5, fontFamily: "inherit", outline: "none" }} />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
            <button onClick={() => setShowImport(false)} style={{ height: 38, padding: "0 18px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: "pointer" }}>Cancel</button>
            <button onClick={runImport} disabled={!importText.trim() || importing} style={{ height: 38, padding: "0 20px", borderRadius: 10, background: importText.trim() ? "linear-gradient(145deg,#f0b46a,#b97e35)" : "rgba(255,255,255,0.05)", border: "none", color: importText.trim() ? "#1a0f08" : "rgba(255,255,255,0.2)", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: importText.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 6 }}>
              {importing ? <><RefreshCw size={12} style={{ animation: "spin 0.8s linear infinite" }} /> Importing…</> : "Import"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── DELETE ALL MODAL ── */}
      {deleteConfirm && (
        <div onClick={() => setDeleteConfirm(false)} style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(3,5,10,0.65)", backdropFilter: "blur(6px)", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 380, maxWidth: "100%", borderRadius: 20, background: "rgba(24,12,12,0.96)", border: "1px solid rgba(248,113,113,0.22)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)", padding: 24, textAlign: "center" }}>
            <div style={{ width: 46, height: 46, borderRadius: 999, background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Trash2 size={22} color="#f87171" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Delete all {memories.length} memories?</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, marginBottom: 22 }}>This permanently erases everything Imprint remembers. This action cannot be undone.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(false)} style={{ flex: 1, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: "pointer" }}>Cancel</button>
              <button onClick={deleteAll} style={{ flex: 1, height: 38, borderRadius: 10, background: "#ef4444", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 4px 16px rgba(239,68,68,0.3)" }}>Delete everything</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
