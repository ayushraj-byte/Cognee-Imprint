"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Pin, Trash2, Edit3, X, Plus, Download, Upload, Search, MessageSquare, LogOut, RefreshCw } from "lucide-react";
import ImprintLogo from "@/app/components/ImprintLogo";
import BackgroundVideo from "@/app/components/BackgroundVideo";

/* ─── Types ─── */
type Topic = "work" | "personal" | "preferences" | "projects" | "health" | "relationships" | "general";
interface Memory {
  id: string;
  content: string;
  topic: Topic;
  pinned: boolean;
  createdAt: Date;
  source: string;
}

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

interface BranchDef {
  id: string;
  label: string;
  emoji: string;
  color: string;
  rgb: string;
  side: "left" | "right";
  px: number;
  py: number;
  filter: (m: Memory[]) => Memory[];
}

const BRANCH_DEFS: BranchDef[] = [
  {
    id: "pinned", label: "Pinned", emoji: "📌",
    color: "#CF8F6D", rgb: "207,143,109", side: "left", px: 170, py: 168,
    filter: m => m.filter(x => x.pinned),
  },
  {
    id: "work", label: "Work & Projects", emoji: "💼",
    color: "#4EECD8", rgb: "78,236,216", side: "left", px: 170, py: 428,
    filter: m => m.filter(x => ["work", "projects"].includes(x.topic)),
  },
  {
    id: "prefs", label: "Preferences", emoji: "⭐",
    color: "#A78BFA", rgb: "167,139,250", side: "right", px: 850, py: 168,
    filter: m => m.filter(x => x.topic === "preferences"),
  },
  {
    id: "personal", label: "Personal", emoji: "👤",
    color: "#34D399", rgb: "52,211,153", side: "right", px: 850, py: 428,
    filter: m => m.filter(x => ["personal", "health", "relationships", "general"].includes(x.topic)),
  },
];

/* ─── Helpers ─── */
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

function bezierPath(x1: number, y1: number, x2: number, y2: number) {
  const cx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`;
}

/* ─── Modal wrapper ─── */
function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(3,5,10,0.65)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "rgba(14,17,28,0.96)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 24, padding: "24px 28px", width: "100%", maxWidth: 480,
        boxShadow: "0 30px 80px rgba(0,0,0,0.6),inset 0 1px 1px rgba(255,255,255,0.06)",
      }}>
        {children}
      </div>
    </div>
  );
}

/* ─── Icon button ─── */
function IconBtn({
  onClick, title, active, danger, children,
}: {
  onClick: () => void; title: string; active?: boolean; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} title={title} style={{
      background: "none", border: "none", cursor: "pointer", padding: "4px 5px", borderRadius: 5,
      color: active ? "#CF8F6D" : danger ? "rgba(239,68,68,0.55)" : "rgba(255,255,255,0.22)",
    }}>
      {children}
    </button>
  );
}

/* ─── Header icon button ─── */
function HdrBtn({
  onClick, href, title, color, children,
}: {
  onClick?: () => void; href?: string; title: string; color?: string; children: React.ReactNode;
}) {
  const style: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 7,
    background: color ? `rgba(${color},0.08)` : "transparent",
    border: color ? `1px solid rgba(${color},0.14)` : "1px solid transparent",
    color: color ? `rgb(${color})` : "rgba(255,255,255,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", flexShrink: 0, textDecoration: "none", transition: "all 0.15s",
  };
  if (href) return <Link href={href} style={style} title={title}>{children}</Link>;
  return <button onClick={onClick} style={style} title={title}>{icon_btn_inner(children)}</button>;
}

function icon_btn_inner(children: React.ReactNode) { return children; }

/* ─── Main Dashboard ─── */
export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isLoaded = status !== "loading";
  const user = session?.user ?? null;
  const userId =
    (session?.user as { id?: string })?.id ??
    (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("userId") : null);

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
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
  const [centerPulse, setCenterPulse] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 1180, h: 640 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);
  const pulseTmer = useRef<ReturnType<typeof setTimeout>>();
  const panelOpen = !!selectedBranch;

  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setCanvasSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, []);

  function mapApiMemory(m: any): Memory {
    return {
      id: m.memoryId,
      content: m.content,
      topic: (m.topic || "general") as Topic,
      pinned: !!m.pinned,
      createdAt: new Date(m.createdAt),
      source: m.source || "chat",
      _raw: m,
    } as any;
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
      await fetch(`/api/memories/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, createdAt: rawOf(m).createdAt, pinned: next }),
      });
    } catch { setMemories(p => p.map(x => x.id === id ? { ...x, pinned: !next } : x)); }
  }

  async function deleteMemory(id: string) {
    const m = memories.find(x => x.id === id);
    if (!m || !userId) return;
    setMemories(p => p.filter(x => x.id !== id));
    try {
      await fetch(
        `/api/memories?userId=${encodeURIComponent(userId)}&memoryId=${id}&createdAt=${encodeURIComponent(rawOf(m).createdAt)}`,
        { method: "DELETE" }
      );
    } catch { loadMemories(); }
  }

  async function deleteAll() {
    if (!userId) return;
    const snapshot = [...memories];
    setMemories([]); setDeleteConfirm(false);
    for (const m of snapshot) {
      try {
        await fetch(
          `/api/memories?userId=${encodeURIComponent(userId)}&memoryId=${m.id}&createdAt=${encodeURIComponent(rawOf(m).createdAt)}`,
          { method: "DELETE" }
        );
      } catch {}
    }
  }

  async function saveEdit(id: string) {
    const m = memories.find(x => x.id === id);
    if (!m || !userId) return;
    setMemories(p => p.map(x => x.id === id ? { ...x, content: editText } : x));
    setEditingId(null);
    try {
      await fetch(`/api/memories/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, createdAt: rawOf(m).createdAt, content: editText }),
      });
    } catch { loadMemories(); }
  }

  async function addMemory() {
    if (!newMemory.trim() || !userId) return;
    try {
      const res = await fetch("/api/memories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, content: newMemory.trim(), topic: newTopic, pinned: newPin, source: "manual" }),
      });
      const data = await res.json();
      if (data.memory) setMemories(p => [mapApiMemory(data.memory), ...p]);
    } catch { loadMemories(); }
    setNewMemory(""); setNewTopic("general"); setNewPin(false); setShowAddModal(false);
  }

  async function runImport() {
    if (!importText.trim() || !userId) return;
    setImporting(true);
    try {
      const res = await fetch("/api/memories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, messages: [{ role: "user", content: importText }], source: "import" }),
      });
      const data = await res.json();
      if (data.memories) setMemories(p => [...data.memories.map(mapApiMemory), ...p]);
    } catch {}
    setImporting(false); setShowImport(false); setImportText("");
  }

  function doExport() {
    const lines = [
      "IMPRINT — Memory Export",
      `Generated: ${new Date().toLocaleDateString()}`,
      `Total: ${memories.length} memories`, "",
      "=== PINNED ===",
      ...memories.filter(m => m.pinned).map(m => `• [${m.topic}] ${m.content}`), "",
      "=== ALL MEMORIES ===",
      ...memories.filter(m => !m.pinned).map(m => `• [${m.topic}] ${m.content}`),
    ].join("\n");
    downloadText(lines, `imprint-${new Date().toISOString().split("T")[0]}.txt`);
  }

  function triggerPulse() {
    setCenterPulse(true);
    clearTimeout(pulseTmer.current);
    pulseTmer.current = setTimeout(() => setCenterPulse(false), 950);
  }

  // Geometry — map is 1180×640, scaled to fit canvas
  const MAP_W = 1180, MAP_H = 640;
  const mapScale = Math.min(1, (canvasSize.w - 32) / MAP_W, (canvasSize.h - 32) / MAP_H);
  const HUB = { x: MAP_W / 2, y: MAP_H / 2, r: 59 };

  function hubEdge(nx: number, ny: number): [number, number] {
    const a = Math.atan2(ny - HUB.y, nx - HUB.x);
    return [HUB.x + HUB.r * Math.cos(a), HUB.y + HUB.r * Math.sin(a)];
  }

  // Panel data
  const activeBranch = BRANCH_DEFS.find(b => b.id === selectedBranch) ?? null;
  const activeMems = activeBranch ? activeBranch.filter(memories) : [];
  const filteredMems = panelSearch
    ? activeMems.filter(m => m.content.toLowerCase().includes(panelSearch.toLowerCase()))
    : activeMems;

  if (!isLoaded) return null;

  const pinnedCount = memories.filter(m => m.pinned).length;

  return (
    <div style={{
      height: "100vh", overflow: "hidden",
      background: "#07090f", color: "white", position: "relative",
      fontFamily: "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif",
    }}>
      {/* Background video */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <BackgroundVideo overlayOpacity={0.78} />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes impFloat { 0%,100%{transform:translate(-50%,-50%) translateY(0);} 50%{transform:translate(-50%,-50%) translateY(-4px);} }
        @keyframes impPulse { 0%{box-shadow:0 0 0 0 rgba(207,143,109,0.45),0 0 50px rgba(207,143,109,0.16),inset 0 1px 1px rgba(255,255,255,0.12),inset 0 0 36px rgba(207,143,109,0.1);} 70%{box-shadow:0 0 0 26px rgba(207,143,109,0),0 0 50px rgba(207,143,109,0.16),inset 0 1px 1px rgba(255,255,255,0.12),inset 0 0 36px rgba(207,143,109,0.1);} 100%{box-shadow:0 0 0 0 rgba(207,143,109,0),0 0 50px rgba(207,143,109,0.16),inset 0 1px 1px rgba(255,255,255,0.12),inset 0 0 36px rgba(207,143,109,0.1);} }
        @keyframes flowDash { to{stroke-dashoffset:-100;} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes panel-in { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
        .branch-btn:hover { transform:scale(1.03) !important; }
        .leaf-pill:hover { background:rgba(255,255,255,0.07) !important; border-color:rgba(255,255,255,0.14) !important; }
        .mem-card:hover { background:rgba(255,255,255,0.05) !important; border-color:rgba(255,255,255,0.12) !important; }
        .mem-card:hover .mem-actions { opacity:1 !important; }
        .hdr-btn:hover { background:rgba(255,255,255,0.1) !important; color:rgba(255,255,255,0.85) !important; }
        .hdr-btn-teal:hover { background:rgba(78,236,216,0.16) !important; }
        .hdr-btn-red:hover { color:#f87171 !important; }
        ::-webkit-scrollbar { width:4px }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:4px }
      `}</style>

      {/* ═══ HEADER ═══ */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        height: 48, background: "rgba(8,11,20,0.65)", backdropFilter: "blur(18px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", padding: "0 14px", gap: 8,
      }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", flexShrink: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(145deg,rgba(207,143,109,0.22),rgba(207,143,109,0.06))",
            border: "1px solid rgba(207,143,109,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ImprintLogo size={16} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.88)", letterSpacing: "-0.01em" }}>Imprint</span>
        </Link>

        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", margin: "0 2px" }} />

        {/* Search */}
        {showSearch ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: "0 10px 0 10px", height: 32, flex: 1, maxWidth: 280 }}>
            <Search size={12} style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
            <input
              autoFocus
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              placeholder="Search memories…"
              style={{ background: "transparent", border: "none", outline: "none", color: "rgba(255,255,255,0.8)", fontSize: 12.5, flex: 1 }}
            />
            <button onClick={() => { setShowSearch(false); setGlobalSearch(""); }}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: 2, display: "flex" }}>
              <X size={12} />
            </button>
          </div>
        ) : (
          <button className="hdr-btn" onClick={() => setShowSearch(true)}
            style={{ width: 28, height: 28, borderRadius: 7, background: "transparent", border: "1px solid transparent", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s" }}>
            <Search size={14} />
          </button>
        )}

        <div style={{ flex: 1 }} />

        {/* Stats pill */}
        <div style={{ fontSize: 11, color: "#CF8F6D", background: "rgba(207,143,109,0.1)", border: "1px solid rgba(207,143,109,0.16)", padding: "4px 11px", borderRadius: 999, fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>
          {loadingData ? "…" : `${memories.length} memories · ${pinnedCount} pinned`}
        </div>

        {/* Action buttons */}
        <button className="hdr-btn" onClick={() => setShowAddModal(true)} title="Add memory"
          style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s" }}>
          <Plus size={14} />
        </button>
        <Link href="/chat" title="Chat"
          style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(78,236,216,0.08)", border: "1px solid rgba(78,236,216,0.14)", color: "#4EECD8", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s", textDecoration: "none" }}
          className="hdr-btn-teal">
          <MessageSquare size={14} />
        </Link>
        <button className="hdr-btn" onClick={doExport} title="Export"
          style={{ width: 28, height: 28, borderRadius: 7, background: "transparent", border: "1px solid transparent", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s" }}>
          <Download size={14} />
        </button>
        <button className="hdr-btn" onClick={() => setShowImport(true)} title="Import"
          style={{ width: 28, height: 28, borderRadius: 7, background: "transparent", border: "1px solid transparent", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s" }}>
          <Upload size={14} />
        </button>
        <button className="hdr-btn hdr-btn-red" onClick={() => setDeleteConfirm(true)} title="Delete all"
          style={{ width: 28, height: 28, borderRadius: 7, background: "transparent", border: "1px solid transparent", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s" }}>
          <Trash2 size={14} />
        </button>

        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />

        {/* User */}
        {user?.image ? (
          <img src={user.image} alt="" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(145deg,#CF8F6D,#8a5638)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#1a0f08", flexShrink: 0 }}>
            {((user?.name || user?.email || "?")[0]).toUpperCase()}
          </div>
        )}
        <button onClick={() => signOut({ callbackUrl: "/sign-in" })} title="Sign out"
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: 4, fontSize: 12, fontFamily: "inherit", transition: "color .15s" }}>
          <LogOut size={13} />
        </button>
      </div>

      {/* ═══ MIND MAP CANVAS ═══ */}
      <div
        ref={canvasRef}
        style={{
          position: "fixed", top: 48, left: 0, bottom: 0,
          right: panelOpen ? 390 : 0,
          overflow: "hidden", transition: "right 0.28s cubic-bezier(.22,.61,.36,1)",
          zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {/* Dot grid */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px,transparent 1px)",
          backgroundSize: "26px 26px", backgroundPosition: "center",
          maskImage: "radial-gradient(ellipse 70% 70% at center,#000 35%,transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 70% at center,#000 35%,transparent 80%)",
        }} />

        {/* Amber ambient glow */}
        <div style={{
          position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)",
          width: "60%", height: "50%", pointerEvents: "none",
          background: "radial-gradient(ellipse at center,rgba(207,143,109,0.1),transparent 68%)",
          filter: "blur(8px)",
        }} />

        {/* Scaled map container */}
        <div style={{
          position: "relative", width: MAP_W, height: MAP_H,
          transformOrigin: "center", transform: `scale(${mapScale})`,
          flexShrink: 0,
        }}>
          {/* SVG connection lines */}
          <svg
            width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
          >
            <defs>
              <filter id="impGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2.4" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {BRANCH_DEFS.map(branch => {
              const isActive = selectedBranch === branch.id;
              const bx = branch.px + 80;
              const by = branch.py + 22;
              const [sx, sy] = hubEdge(branch.px, branch.py);
              const leaves = branch.filter(memories);
              const displayLeaves = globalSearch
                ? leaves.filter(m => m.content.toLowerCase().includes(globalSearch.toLowerCase()))
                : leaves;

              return (
                <g key={branch.id}>
                  {/* Solid base line */}
                  <path
                    d={bezierPath(sx, sy, bx, by)}
                    fill="none" stroke={branch.color} strokeWidth="2.2"
                    strokeOpacity={isActive ? 0.62 : 0.3}
                    strokeLinecap="round" filter="url(#impGlow)"
                    style={{ transition: "stroke-opacity .2s" }}
                  />
                  {/* Animated flow dash */}
                  <path
                    d={bezierPath(sx, sy, bx, by)}
                    fill="none" stroke={branch.color} strokeWidth="2"
                    strokeOpacity={isActive ? 0.9 : 0.5}
                    strokeDasharray="7 14" strokeLinecap="round"
                    filter="url(#impGlow)"
                    style={{ animation: "flowDash 3.4s linear infinite", transition: "stroke-opacity .2s" }}
                  />
                  {/* Leaf connectors */}
                  {displayLeaves.slice(0, 3).map((_, i) => {
                    const ly = branch.py + 22 + (i - 1) * 54;
                    const lx = branch.side === "left" ? 148 : MAP_W - 148 - 4;
                    const pillEdge = branch.side === "left" ? branch.px : branch.px + 160;
                    const midX = (lx + pillEdge) / 2;
                    return (
                      <path
                        key={i}
                        d={`M ${pillEdge} ${by} C ${midX} ${by}, ${midX} ${ly + 14}, ${lx} ${ly + 14}`}
                        fill="none" stroke="#ffffff" strokeWidth="1"
                        strokeOpacity={isActive ? 0.22 : 0.1}
                        strokeDasharray="3 4" strokeLinecap="round"
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>

          {/* Center hub node */}
          <button
            onClick={triggerPulse}
            style={{
              position: "absolute", left: HUB.x, top: HUB.y,
              width: 118, height: 118, borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              border: "1.5px solid rgba(207,143,109,0.3)",
              background: "radial-gradient(circle at 50% 42%,rgba(207,143,109,0.16),rgba(207,143,109,0.03) 60%,rgba(8,11,20,0.4))",
              backdropFilter: "blur(10px)",
              boxShadow: "0 0 50px rgba(207,143,109,0.16),inset 0 1px 1px rgba(255,255,255,0.12),inset 0 0 36px rgba(207,143,109,0.1)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
              cursor: "pointer", color: "#fff", zIndex: 10,
              animation: centerPulse ? "impPulse 0.9s ease-out" : "impFloat 6s ease-in-out infinite",
            }}
          >
            <ImprintLogo size={26} />
            <span style={{ fontSize: 34, fontWeight: 700, color: "#CF8F6D", lineHeight: 1, letterSpacing: "-0.02em", marginTop: 3 }}>
              {loadingData ? "…" : memories.length}
            </span>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.22em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase" }}>
              memories
            </span>
          </button>

          {/* Branch nodes */}
          {BRANCH_DEFS.map(branch => {
            const mems = branch.filter(memories);
            const isActive = selectedBranch === branch.id;
            const displayMems = globalSearch
              ? mems.filter(m => m.content.toLowerCase().includes(globalSearch.toLowerCase()))
              : mems;

            return (
              <button
                key={branch.id}
                className="branch-btn"
                onClick={() => { setSelectedBranch(isActive ? null : branch.id); setPanelSearch(""); }}
                style={{
                  position: "absolute", left: branch.px, top: branch.py,
                  width: 160, height: 44, borderRadius: 999,
                  display: "flex", alignItems: "center", gap: 8, padding: "0 13px",
                  cursor: "pointer", fontFamily: "inherit",
                  background: `rgba(${branch.rgb},${isActive ? 0.18 : 0.1})`,
                  border: `1px solid rgba(${branch.rgb},${isActive ? 0.55 : 0.28})`,
                  color: branch.color,
                  backdropFilter: "blur(14px)",
                  boxShadow: `inset 0 1px 1px rgba(255,255,255,0.08),0 6px 18px rgba(0,0,0,0.3)${isActive ? `,0 0 22px rgba(${branch.rgb},0.25)` : ""}`,
                  transition: "transform .15s,border-color .15s,box-shadow .15s",
                }}
              >
                <span style={{ fontSize: 15, lineHeight: 1 }}>{branch.emoji}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, textAlign: "left", letterSpacing: "-0.01em" }}>
                  {branch.label}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.1)", minWidth: 18, height: 18, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                  {displayMems.length}
                </span>
              </button>
            );
          })}

          {/* Leaf pill nodes */}
          {BRANCH_DEFS.map(branch => {
            let mems = branch.filter(memories);
            if (globalSearch) mems = mems.filter(m => m.content.toLowerCase().includes(globalSearch.toLowerCase()));
            return mems.slice(0, 3).map((mem, i) => {
              const ly = branch.py + 22 + (i - 1) * 54;
              const lx = branch.side === "left" ? 0 : MAP_W - 148 - 4;
              const isLeft = branch.side === "left";
              return (
                <div
                  key={mem.id}
                  className="leaf-pill"
                  onClick={() => { setSelectedBranch(branch.id); setPanelSearch(""); }}
                  style={{
                    position: "absolute", left: lx, top: ly,
                    width: 148, height: 28, borderRadius: 999,
                    display: "flex", alignItems: "center", padding: "0 10px",
                    background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)",
                    backdropFilter: "blur(8px)", cursor: "pointer",
                    justifyContent: isLeft ? "flex-end" : "flex-start",
                    transition: "background .15s,border-color .15s",
                    zIndex: 9,
                  }}
                >
                  {isLeft && (
                    <>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: "0 6px", flex: 1, textAlign: "right" }}>
                        {mem.content}
                      </span>
                      <span style={{ width: 4, height: 4, borderRadius: 999, background: branch.color, flexShrink: 0 }} />
                    </>
                  )}
                  {!isLeft && (
                    <>
                      <span style={{ width: 4, height: 4, borderRadius: 999, background: branch.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: "0 6px", flex: 1 }}>
                        {mem.content}
                      </span>
                    </>
                  )}
                </div>
              );
            });
          })}

          {/* Empty state */}
          {!loadingData && memories.length === 0 && (
            <div style={{ position: "absolute", left: "50%", top: 400, transform: "translateX(-50%)", width: 440, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(14px)", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.06),0 16px 40px rgba(0,0,0,0.4)", padding: 18 }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 12, lineHeight: 1.5 }}>
                Connect Claude Code to start capturing memories <span style={{ color: "#CF8F6D" }}>→</span>
              </div>
              <pre style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, lineHeight: 1.6, color: "rgba(255,255,255,0.55)", background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px", overflowX: "auto" }}>
{`{
  "mcpServers": {
    "imprint": {
      "command": "npx imprint-mcp"
    }
  }
}`}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* ═══ MEMORY SIDE PANEL ═══ */}
      {panelOpen && activeBranch && (
        <div style={{
          position: "fixed", top: 48, right: 0, bottom: 0, width: 390,
          background: "rgba(10,12,22,0.92)", backdropFilter: "blur(24px)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          display: "flex", flexDirection: "column",
          animation: "panel-in 0.2s ease both",
          zIndex: 40, boxShadow: "-20px 0 50px rgba(0,0,0,0.4)",
        }}>
          {/* Panel header */}
          <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: activeBranch.color, boxShadow: `0 0 10px ${activeBranch.color}`, flexShrink: 0 }} />
              <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", flex: 1 }}>{activeBranch.label}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.08)", padding: "3px 8px", borderRadius: 999 }}>{activeMems.length}</span>
              <button onClick={() => { setSelectedBranch(null); setPanelSearch(""); }}
                style={{ width: 26, height: 26, borderRadius: 7, background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={13} />
              </button>
            </div>
            <div style={{ position: "relative", marginTop: 12 }}>
              <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", pointerEvents: "none" }} />
              <input
                value={panelSearch}
                onChange={e => setPanelSearch(e.target.value)}
                placeholder="Search this category…"
                style={{
                  width: "100%", boxSizing: "border-box", height: 32,
                  padding: "0 10px 0 30px", borderRadius: 9,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.7)", fontSize: 12, outline: "none", fontFamily: "inherit",
                }}
              />
            </div>
          </div>

          {/* Memory list */}
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredMems.length === 0 && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "50px 0", gap: 14 }}>
                <svg width="92" height="92" viewBox="0 0 92 92" fill="none" style={{ opacity: 0.5 }}>
                  <circle cx="46" cy="46" r="14" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
                  <circle cx="46" cy="46" r="26" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                  <circle cx="46" cy="46" r="38" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                </svg>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
                  {panelSearch ? "No matches" : "No memories yet"}
                </div>
                <button onClick={() => setShowAddModal(true)} style={{ background: "none", border: "none", color: "#CF8F6D", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                  Add your first memory →
                </button>
              </div>
            )}
            {filteredMems.map(mem => {
              const tm = TOPIC_META[mem.topic] ?? TOPIC_META.general;
              const isEditing = editingId === mem.id;
              return (
                <div
                  key={mem.id}
                  className="mem-card"
                  style={{
                    position: "relative", display: "flex", gap: 9, minHeight: 64,
                    padding: "11px 12px", borderRadius: 10,
                    background: mem.pinned ? "rgba(207,143,109,0.05)" : "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderLeft: mem.pinned ? "2px solid #CF8F6D" : "1px solid rgba(255,255,255,0.06)",
                    transition: "background .15s,border-color .15s",
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: tm.color, marginTop: 5, flexShrink: 0, boxShadow: `0 0 6px ${tm.color}` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <div>
                        <textarea
                          autoFocus value={editText}
                          onChange={e => setEditText(e.target.value)}
                          rows={3}
                          style={{
                            width: "100%", boxSizing: "border-box",
                            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 6, padding: "6px 8px", color: "rgba(255,255,255,0.8)",
                            fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit",
                          }}
                        />
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <button onClick={() => saveEdit(mem.id)} style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(78,236,216,0.1)", border: "1px solid rgba(78,236,216,0.2)", color: "rgba(78,236,216,0.85)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                          <button onClick={() => setEditingId(null)} style={{ padding: "4px 10px", borderRadius: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.28)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 13, lineHeight: 1.45, color: "rgba(255,255,255,0.78)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {mem.content}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7 }}>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                            {timeAgo(new Date((mem as any)._raw?.createdAt ?? mem.createdAt))}
                          </span>
                          <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 5 }}>
                            {mem.source}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  {!isEditing && (
                    <div className="mem-actions" style={{ position: "absolute", top: 9, right: 9, display: "flex", gap: 3, opacity: 0, transition: "opacity .15s" }}>
                      <button onClick={() => togglePin(mem.id)} title={mem.pinned ? "Unpin" : "Pin"}
                        style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "none", color: mem.pinned ? "#CF8F6D" : "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <Pin size={11} fill={mem.pinned ? "currentColor" : "none"} />
                      </button>
                      <button onClick={() => { setEditingId(mem.id); setEditText(mem.content); }} title="Edit"
                        style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "none", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <Edit3 size={11} />
                      </button>
                      <button onClick={() => deleteMemory(mem.id)} title="Delete"
                        style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "none", color: "rgba(248,113,113,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ ADD MODAL ═══ */}
      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
            <span style={{ fontSize: 18, fontWeight: 600, flex: 1, letterSpacing: "-0.01em" }}>Add Memory</span>
            <button onClick={() => setShowAddModal(false)} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "none", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={14} />
            </button>
          </div>
          <textarea
            autoFocus value={newMemory} onChange={e => setNewMemory(e.target.value)}
            placeholder="What should Imprint remember?"
            rows={4}
            style={{
              width: "100%", boxSizing: "border-box", resize: "none",
              padding: 13, borderRadius: 12,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff", fontSize: 13.5, lineHeight: 1.5, fontFamily: "inherit", outline: "none",
            }}
          />
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "16px 0 8px", fontWeight: 500, letterSpacing: "0.02em" }}>TOPIC</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["work", "personal", "preferences", "projects"] as Topic[]).map(t => (
              <button key={t} onClick={() => setNewTopic(t)} style={{
                flex: 1, minWidth: 80, height: 36, borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                fontFamily: "inherit", cursor: "pointer",
                background: newTopic === t ? TOPIC_META[t].bg : "rgba(255,255,255,0.04)",
                border: `1px solid ${newTopic === t ? TOPIC_META[t].color : "rgba(255,255,255,0.1)"}`,
                color: newTopic === t ? TOPIC_META[t].color : "rgba(255,255,255,0.6)",
                transition: "all .15s",
              }}>
                {TOPIC_META[t].emoji} {TOPIC_META[t].label}
              </button>
            ))}
          </div>
          {/* Pin toggle */}
          <div onClick={() => setNewPin(p => !p)} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, cursor: "pointer" }}>
            <div style={{ width: 38, height: 22, borderRadius: 999, background: newPin ? "rgba(207,143,109,0.7)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", position: "relative", transition: "background .15s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 2, left: newPin ? 18 : 2, width: 16, height: 16, borderRadius: 999, background: "#fff", transition: "left .18s", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }} />
            </div>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Pin this memory</span>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <button onClick={() => setShowAddModal(false)} style={{ height: 38, padding: "0 18px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: "pointer" }}>Cancel</button>
            <button onClick={addMemory} disabled={!newMemory.trim()} style={{ height: 38, padding: "0 20px", borderRadius: 10, background: newMemory.trim() ? "linear-gradient(145deg,#CF8F6D,#b9754f)" : "rgba(255,255,255,0.05)", border: "none", color: newMemory.trim() ? "#1a0f08" : "rgba(255,255,255,0.2)", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: newMemory.trim() ? "pointer" : "not-allowed", boxShadow: newMemory.trim() ? "0 4px 16px rgba(207,143,109,0.3)" : "none" }}>
              Save Memory
            </button>
          </div>
        </Modal>
      )}

      {/* ═══ IMPORT MODAL ═══ */}
      {showImport && (
        <Modal onClose={() => setShowImport(false)}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
            <span style={{ fontSize: 18, fontWeight: 600, flex: 1, letterSpacing: "-0.01em" }}>Import Memories</span>
            <button onClick={() => setShowImport(false)} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "none", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={14} />
            </button>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 14, lineHeight: 1.5 }}>Paste any text — Claude extracts facts automatically.</p>
          <textarea
            autoFocus value={importText} onChange={e => setImportText(e.target.value)}
            placeholder="Paste notes, context, chat logs…"
            rows={6}
            style={{
              width: "100%", boxSizing: "border-box", resize: "none",
              padding: "13px 14px", borderRadius: 12,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff", fontSize: 12, lineHeight: 1.5, fontFamily: "inherit", outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
            <button onClick={() => setShowImport(false)} style={{ height: 38, padding: "0 18px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: "pointer" }}>Cancel</button>
            <button onClick={runImport} disabled={!importText.trim() || importing} style={{
              height: 38, padding: "0 20px", borderRadius: 10,
              background: importText.trim() ? "linear-gradient(145deg,#CF8F6D,#b9754f)" : "rgba(255,255,255,0.05)",
              border: "none", color: importText.trim() ? "#1a0f08" : "rgba(255,255,255,0.2)",
              fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              cursor: importText.trim() ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {importing ? <><RefreshCw size={12} style={{ animation: "spin 0.8s linear infinite" }} /> Importing…</> : "Import"}
            </button>
          </div>
        </Modal>
      )}

      {/* ═══ DELETE ALL MODAL ═══ */}
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
