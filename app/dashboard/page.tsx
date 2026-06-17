"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Pin, Trash2, Edit3, X, Plus, Download,
  Upload, Search, MessageSquare, RefreshCw, LogOut,
} from "lucide-react";
import ImprintLogo from "@/app/components/ImprintLogo";

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
  bg: string;
  side: "left" | "right";
  px: number;
  py: number;
  filter: (m: Memory[]) => Memory[];
}

const BRANCH_DEFS: BranchDef[] = [
  {
    id: "pinned", label: "Pinned", emoji: "📌",
    color: "#CF8F6D", bg: "rgba(207,143,109,0.12)", side: "left", px: 22, py: 30,
    filter: m => m.filter(x => x.pinned),
  },
  {
    id: "work", label: "Work & Projects", emoji: "💼",
    color: "#4EECD8", bg: "rgba(78,236,216,0.1)", side: "left", px: 22, py: 70,
    filter: m => m.filter(x => ["work", "projects"].includes(x.topic)),
  },
  {
    id: "prefs", label: "Preferences", emoji: "⭐",
    color: "#A78BFA", bg: "rgba(167,139,250,0.1)", side: "right", px: 78, py: 30,
    filter: m => m.filter(x => x.topic === "preferences"),
  },
  {
    id: "personal", label: "Personal", emoji: "👤",
    color: "#34D399", bg: "rgba(52,211,153,0.1)", side: "right", px: 78, py: 70,
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

/* ─── Sub-components ─── */
function TopBtn({
  icon, label, onClick, href, accent, danger,
}: {
  icon: React.ReactNode; label: string; onClick?: () => void;
  href?: string; accent?: boolean; danger?: boolean;
}) {
  const style: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 5, padding: "5px 11px",
    borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, flexShrink: 0,
    background: accent ? "linear-gradient(135deg,#cf8f6d,#c47a4a)" : "transparent",
    color: accent ? "white" : danger ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.45)",
    textDecoration: "none",
  };
  if (href) return <Link href={href} style={style}>{icon}<span>{label}</span></Link>;
  return <button onClick={onClick} style={style}>{icon}<span>{label}</span></button>;
}

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

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#111", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 18, padding: "24px 28px", width: "100%", maxWidth: 460,
        boxShadow: "0 32px 64px rgba(0,0,0,0.7)",
      }}>
        {children}
      </div>
    </div>
  );
}

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
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 1200, h: 600 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);
  const panelOpen = !!selectedBranch;

  // useEffect(() => {
  //   if (isLoaded && !user) router.push("/sign-in");
  // }, [isLoaded, user, router]);

  // Track canvas size for SVG coordinates
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

  // Real-time polling for new memories
  useEffect(() => {
    if (!userId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/memories?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();
        const incoming = (data.memories || []).map(mapApiMemory);
        if (lastCountRef.current > 0 && incoming.length > lastCountRef.current) {
          setMemories(incoming);
        }
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
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
    setMemories([]);
    setDeleteConfirm(false);
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
    } catch {}
    setImporting(false); setShowImport(false); setImportText("");
  }

  function doExport() {
    const pinned = memories.filter(m => m.pinned);
    const rest = memories.filter(m => !m.pinned);
    const lines = [
      "IMPRINT — Memory Export",
      `Generated: ${new Date().toLocaleDateString()}`,
      `Total: ${memories.length} memories`,
      "",
      "=== PINNED ===",
      ...pinned.map(m => `• [${m.topic}] ${m.content}`),
      "",
      "=== ALL MEMORIES ===",
      ...rest.map(m => `• [${m.topic}] ${m.content}`),
    ].join("\n");
    downloadText(lines, `imprint-${new Date().toISOString().split("T")[0]}.txt`);
  }

  // Mind map geometry
  const toX = (pct: number) => (pct / 100) * canvasSize.w;
  const toY = (pct: number) => (pct / 100) * canvasSize.h;
  const centerX = toX(50);
  const centerY = toY(50);

  function getLeafPos(branch: BranchDef, idx: number) {
    const dy = (idx - 1) * 13;
    return { x: branch.side === "left" ? 7 : 93, y: branch.py + dy };
  }

  // Panel data
  const activeBranch = BRANCH_DEFS.find(b => b.id === selectedBranch) ?? null;
  const activeMems = activeBranch ? activeBranch.filter(memories) : [];
  const filteredMems = panelSearch
    ? activeMems.filter(m => m.content.toLowerCase().includes(panelSearch.toLowerCase()))
    : activeMems;

  if (!isLoaded) return null;

  return (
    <div style={{
      height: "100vh", overflow: "hidden",
      background: "#0a0a0a", color: "white",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif",
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes panel-in { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
        .topbtn:hover { background: rgba(255,255,255,0.06) !important; color: rgba(255,255,255,0.7) !important; }
        .branch-node:hover .branch-inner { background: var(--branch-bg) !important; border-color: var(--branch-color) !important; box-shadow: 0 0 20px var(--branch-glow) !important; }
        .leaf-node:hover .leaf-inner { background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.14) !important; }
        .mem-row:hover { background: rgba(255,255,255,0.05) !important; }
        ::-webkit-scrollbar { width: 4px }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px }
      `}</style>

      {/* ═══ TOP BAR ═══ */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        height: 52, background: "rgba(10,10,10,0.93)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", padding: "0 18px", gap: 8,
      }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
          <ImprintLogo size={26} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", letterSpacing: "-0.02em" }}>Imprint</span>
        </Link>

        <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />

        {/* Search */}
        {showSearch ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "4px 10px", flex: 1, maxWidth: 300 }}>
            <Search size={12} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
            <input
              autoFocus
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              placeholder="Search memories…"
              style={{ background: "transparent", border: "none", outline: "none", color: "rgba(255,255,255,0.8)", fontSize: 13, flex: 1 }}
            />
            <button onClick={() => { setShowSearch(false); setGlobalSearch(""); }}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: 2 }}>
              <X size={12} />
            </button>
          </div>
        ) : (
          <button className="topbtn" onClick={() => setShowSearch(true)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
            <Search size={13} /><span>Search</span>
          </button>
        )}

        <div style={{ flex: 1 }} />

        {/* Stats pill */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 12px", borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: "rgba(207,143,109,0.85)", fontWeight: 600 }}>{memories.length}</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>memories</span>
          <span style={{ width: 1, height: 10, background: "rgba(255,255,255,0.07)" }} />
          <span style={{ fontSize: 12, color: "rgba(78,236,216,0.8)", fontWeight: 600 }}>{memories.filter(m => m.pinned).length}</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>pinned</span>
        </div>

        {/* Actions */}
        <TopBtn icon={<Plus size={13}/>} label="Add" onClick={() => setShowAddModal(true)} accent />
        <TopBtn icon={<MessageSquare size={13}/>} label="Chat" href="/chat" />
        <TopBtn icon={<Download size={13}/>} label="Export" onClick={doExport} />
        <TopBtn icon={<Upload size={13}/>} label="Import" onClick={() => setShowImport(true)} />
        <TopBtn icon={<Trash2 size={13}/>} label="Delete all" onClick={() => setDeleteConfirm(true)} danger />

        <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />

        {/* User avatar */}
        {user?.image ? (
          <img src={user.image} alt="" style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
            {((user?.name || user?.email || "?")[0]).toUpperCase()}
          </div>
        )}
        <button onClick={() => signOut({ callbackUrl: "/sign-in" })} title="Sign out"
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", padding: 4, flexShrink: 0 }}>
          <LogOut size={13} />
        </button>
      </div>

      {/* ═══ MIND MAP CANVAS ═══ */}
      <div
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 52, left: 0, bottom: 0,
          right: panelOpen ? 390 : 0,
          overflow: "hidden",
          transition: "right 0.25s ease",
        }}
      >
        {/* Ambient center glow */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 52% 52% at 50% 50%, rgba(207,143,109,0.045) 0%, transparent 70%)" }} />

        {/* SVG connection lines */}
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
          viewBox={`0 0 ${canvasSize.w} ${canvasSize.h}`}
          preserveAspectRatio="none"
        >
          {BRANCH_DEFS.map(branch => {
            const bx = toX(branch.px);
            const by = toY(branch.py);
            const leaves = branch.filter(memories);
            const displayLeaves = globalSearch
              ? leaves.filter(m => m.content.toLowerCase().includes(globalSearch.toLowerCase()))
              : leaves;
            const isActive = selectedBranch === branch.id;

            return (
              <g key={branch.id}>
                {/* Center → Branch */}
                <path
                  d={bezierPath(centerX, centerY, bx, by)}
                  fill="none"
                  stroke={branch.color}
                  strokeWidth={isActive ? 2 : 1.5}
                  strokeOpacity={isActive ? 0.5 : 0.2}
                />
                {/* Branch → Leaf previews */}
                {displayLeaves.slice(0, 3).map((_, i) => {
                  const lp = getLeafPos(branch, i);
                  return (
                    <path
                      key={i}
                      d={bezierPath(bx, by, toX(lp.x), toY(lp.y))}
                      fill="none"
                      stroke={branch.color}
                      strokeWidth="1"
                      strokeOpacity="0.14"
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* Center node */}
        <div style={{
          position: "absolute",
          left: centerX, top: centerY,
          transform: "translate(-50%, -50%)",
          zIndex: 10,
        }}>
          <div style={{
            width: 118, height: 118, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(207,143,109,0.1) 0%, rgba(10,10,10,0.97) 72%)",
            border: "1.5px solid rgba(207,143,109,0.22)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
            boxShadow: "0 0 56px rgba(207,143,109,0.07), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}>
            <ImprintLogo size={30} />
            <span style={{ fontSize: 26, fontWeight: 700, color: "rgba(207,143,109,0.9)", lineHeight: 1 }}>
              {loadingData ? "…" : memories.length}
            </span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              memories
            </span>
          </div>
        </div>

        {/* Branch nodes */}
        {BRANCH_DEFS.map(branch => {
          const mems = branch.filter(memories);
          const bx = toX(branch.px);
          const by = toY(branch.py);
          const isActive = selectedBranch === branch.id;

          return (
            <div
              key={branch.id}
              className="branch-node"
              onClick={() => { setSelectedBranch(isActive ? null : branch.id); setPanelSearch(""); }}
              style={{
                position: "absolute",
                left: bx, top: by,
                transform: "translate(-50%, -50%)",
                zIndex: 11, cursor: "pointer",
                ["--branch-color" as string]: branch.color,
                ["--branch-bg" as string]: branch.bg,
                ["--branch-glow" as string]: branch.color + "28",
              }}
            >
              <div className="branch-inner" style={{
                padding: "9px 16px", borderRadius: 40, backdropFilter: "blur(12px)",
                background: isActive ? branch.bg : "rgba(10,10,10,0.88)",
                border: `1.5px solid ${isActive ? branch.color : "rgba(255,255,255,0.1)"}`,
                boxShadow: isActive ? `0 0 22px ${branch.color}28` : "none",
                display: "flex", alignItems: "center", gap: 7,
                transition: "all 0.2s", whiteSpace: "nowrap" as const,
              }}>
                <span style={{ fontSize: 13 }}>{branch.emoji}</span>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)" }}>
                  {branch.label}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, color: branch.color, background: `${branch.color}22`, borderRadius: 10, padding: "1px 7px" }}>
                  {mems.length}
                </span>
              </div>
            </div>
          );
        })}

        {/* Leaf preview nodes */}
        {BRANCH_DEFS.map(branch => {
          let mems = branch.filter(memories);
          if (globalSearch) mems = mems.filter(m => m.content.toLowerCase().includes(globalSearch.toLowerCase()));
          return mems.slice(0, 3).map((mem, i) => {
            const lp = getLeafPos(branch, i);
            const lx = toX(lp.x);
            const ly = toY(lp.y);
            return (
              <div
                key={mem.id}
                className="leaf-node"
                onClick={() => { setSelectedBranch(branch.id); setPanelSearch(""); }}
                style={{
                  position: "absolute",
                  left: lx, top: ly,
                  transform: branch.side === "left" ? "translate(-100%, -50%)" : "translate(0, -50%)",
                  zIndex: 9, cursor: "pointer", maxWidth: 175,
                }}
              >
                <div className="leaf-inner" style={{
                  padding: "6px 10px", borderRadius: 9,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                  backdropFilter: "blur(8px)", transition: "all 0.15s",
                }}>
                  <p style={{
                    fontSize: 10.5, color: "rgba(255,255,255,0.38)", margin: 0,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    maxWidth: 153, lineHeight: 1.4,
                  }}>
                    {mem.pinned && <span style={{ color: "#CF8F6D", marginRight: 3 }}>●</span>}
                    {mem.content}
                  </p>
                </div>
              </div>
            );
          });
        })}

        {/* Empty state */}
        {!loadingData && memories.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.18)", margin: "0 0 6px" }}>No memories yet</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.1)" }}>Use "Add" above or connect your IDE via MCP</p>
            </div>
          </div>
        )}
      </div>

      {/* ═══ MEMORY SIDE PANEL ═══ */}
      {panelOpen && activeBranch && (
        <div style={{
          position: "fixed", top: 52, right: 0, bottom: 0, width: 390,
          background: "rgba(11,11,11,0.97)", backdropFilter: "blur(20px)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          display: "flex", flexDirection: "column",
          animation: "panel-in 0.2s ease both",
          zIndex: 40,
        }}>
          {/* Panel header */}
          <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>{activeBranch.emoji}</span>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: 0 }}>{activeBranch.label}</h2>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", margin: "2px 0 0" }}>{activeMems.length} memories</p>
            </div>
            <button onClick={() => { setSelectedBranch(null); setPanelSearch(""); }}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.22)", cursor: "pointer", padding: 4 }}>
              <X size={15} />
            </button>
          </div>

          {/* Panel search filter */}
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ position: "relative" }}>
              <Search size={11} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.2)", pointerEvents: "none" }} />
              <input
                value={panelSearch}
                onChange={e => setPanelSearch(e.target.value)}
                placeholder="Filter…"
                style={{
                  width: "100%", boxSizing: "border-box" as const,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 7, padding: "6px 10px 6px 26px",
                  color: "rgba(255,255,255,0.7)", fontSize: 12, outline: "none",
                }}
              />
            </div>
          </div>

          {/* Memory list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
            {filteredMems.length === 0 && (
              <p style={{ textAlign: "center", color: "rgba(255,255,255,0.18)", fontSize: 12, paddingTop: 28 }}>
                {panelSearch ? "No matches" : "No memories in this category"}
              </p>
            )}
            {filteredMems.map(mem => {
              const tm = TOPIC_META[mem.topic] ?? TOPIC_META.general;
              const isEditing = editingId === mem.id;
              return (
                <div
                  key={mem.id}
                  className="mem-row"
                  style={{
                    padding: "10px 12px", marginBottom: 5, borderRadius: 10,
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                    transition: "background 0.15s",
                  }}
                >
                  {isEditing ? (
                    <div>
                      <textarea
                        autoFocus
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={3}
                        style={{
                          width: "100%", boxSizing: "border-box" as const,
                          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 6, padding: "6px 8px", color: "rgba(255,255,255,0.8)",
                          fontSize: 12, outline: "none", resize: "vertical" as const, fontFamily: "inherit",
                        }}
                      />
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button onClick={() => saveEdit(mem.id)} style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(78,236,216,0.1)", border: "1px solid rgba(78,236,216,0.2)", color: "rgba(78,236,216,0.85)", fontSize: 11, cursor: "pointer" }}>Save</button>
                        <button onClick={() => setEditingId(null)} style={{ padding: "4px 10px", borderRadius: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.28)", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.7)", margin: "0 0 6px", lineHeight: 1.5 }}>{mem.content}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 10, color: tm.color, background: tm.bg, borderRadius: 8, padding: "1px 6px" }}>{tm.emoji} {tm.label}</span>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)" }}>
                            {timeAgo(new Date((mem as any)._raw?.createdAt ?? mem.createdAt))}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                        <IconBtn onClick={() => togglePin(mem.id)} title={mem.pinned ? "Unpin" : "Pin"} active={mem.pinned}>
                          <Pin size={11} />
                        </IconBtn>
                        <IconBtn onClick={() => { setEditingId(mem.id); setEditText(mem.content); }} title="Edit">
                          <Edit3 size={11} />
                        </IconBtn>
                        <IconBtn onClick={() => deleteMemory(mem.id)} title="Delete" danger>
                          <Trash2 size={11} />
                        </IconBtn>
                      </div>
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
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: "0 0 14px" }}>Add memory</h2>
          <textarea
            autoFocus
            value={newMemory}
            onChange={e => setNewMemory(e.target.value)}
            placeholder="What should Claude remember?"
            rows={4}
            style={{
              width: "100%", boxSizing: "border-box" as const,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, padding: "10px 14px", color: "rgba(255,255,255,0.8)",
              fontSize: 13, outline: "none", resize: "none" as const, fontFamily: "inherit", marginBottom: 12,
            }}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 18 }}>
            {(Object.keys(TOPIC_META) as Topic[]).map(t => (
              <button key={t} onClick={() => setNewTopic(t)} style={{
                padding: "5px 11px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                background: newTopic === t ? TOPIC_META[t].bg : "transparent",
                border: `1px solid ${newTopic === t ? TOPIC_META[t].color : "rgba(255,255,255,0.08)"}`,
                color: newTopic === t ? TOPIC_META[t].color : "rgba(255,255,255,0.3)",
              }}>
                {TOPIC_META[t].emoji} {TOPIC_META[t].label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => setShowAddModal(false)} style={{ padding: "8px 16px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={addMemory} disabled={!newMemory.trim()} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: newMemory.trim() ? "linear-gradient(135deg,#cf8f6d,#c47a4a)" : "rgba(255,255,255,0.05)", color: newMemory.trim() ? "white" : "rgba(255,255,255,0.2)", fontSize: 13, fontWeight: 500, cursor: newMemory.trim() ? "pointer" : "not-allowed" }}>Add</button>
          </div>
        </Modal>
      )}

      {/* ═══ IMPORT MODAL ═══ */}
      {showImport && (
        <Modal onClose={() => setShowImport(false)}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: "0 0 6px" }}>Import memories</h2>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", marginBottom: 14 }}>Paste any text — Claude extracts facts automatically.</p>
          <textarea
            autoFocus
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder="Paste notes, context, chat logs…"
            rows={6}
            style={{
              width: "100%", boxSizing: "border-box" as const,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, padding: "10px 14px", color: "rgba(255,255,255,0.8)",
              fontSize: 12, outline: "none", resize: "none" as const, fontFamily: "inherit", marginBottom: 14,
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => setShowImport(false)} style={{ padding: "8px 16px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={runImport} disabled={!importText.trim() || importing} style={{
              padding: "8px 20px", borderRadius: 8,
              background: importText.trim() ? "rgba(78,236,216,0.12)" : "rgba(255,255,255,0.04)",
              border: importText.trim() ? "1px solid rgba(78,236,216,0.25)" : "1px solid transparent",
              color: importText.trim() ? "rgba(78,236,216,0.85)" : "rgba(255,255,255,0.18)",
              fontSize: 13, cursor: importText.trim() ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {importing ? <><RefreshCw size={12} style={{ animation: "spin 0.8s linear infinite" }} /> Importing…</> : "Import"}
            </button>
          </div>
        </Modal>
      )}

      {/* ═══ DELETE ALL CONFIRM ═══ */}
      {deleteConfirm && (
        <Modal onClose={() => setDeleteConfirm(false)}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: "0 0 8px" }}>Delete all memories?</h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 22 }}>
            This permanently deletes all {memories.length} memories. There is no undo.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => setDeleteConfirm(false)} style={{ padding: "8px 16px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={deleteAll} style={{ padding: "8px 20px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.22)", color: "rgba(239,68,68,0.85)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Delete all</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
