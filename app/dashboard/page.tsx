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

const IDE_IMG: Record<string, string> = {
  cc:  "/claude-code.png",
  cur: "/cursor.png",
  cod: "/codex.png",
  ag:  "/antigravity.png",
};

/* ════ Brand-accurate SVG logos ════ */
function BrandLogo({ id, color, size = 22 }: { id: string; color: string; size?: number }) {
  const s = size;
  switch (id) {
    case "ag": return (
      <svg width={s} height={s} viewBox="0 0 100 100" fill="none">
        <defs>
          <linearGradient id="ag-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#FF4500"/>
            <stop offset="30%"  stopColor="#FFA800"/>
            <stop offset="62%"  stopColor="#00CC80"/>
            <stop offset="100%" stopColor="#1A58FF"/>
          </linearGradient>
        </defs>
        <path d="M10 98C0 82 0 62 0 50 0 24 22 4 50 4 78 4 100 24 100 50 100 62 100 82 90 98L74 98C82 80 84 64 84 50 84 32 68.5 16 50 16 31.5 16 16 32 16 50 16 64 18 80 26 98Z" fill="url(#ag-g)"/>
      </svg>
    );
    case "cod": return (
      <svg width={s} height={s} viewBox="0 0 100 100" fill="none">
        <defs>
          <linearGradient id="cod-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#88B4FF"/>
            <stop offset="100%" stopColor="#5530E8"/>
          </linearGradient>
        </defs>
        <rect x="6" y="38" width="88" height="56" rx="16" fill="url(#cod-g)"/>
        <ellipse cx="26" cy="41" rx="18" ry="20" fill="url(#cod-g)"/>
        <ellipse cx="50" cy="32" rx="24" ry="28" fill="url(#cod-g)"/>
        <ellipse cx="74" cy="41" rx="18" ry="20" fill="url(#cod-g)"/>
        <path d="M22 72L38 58L22 44" stroke="white" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M50 58H78" stroke="white" strokeWidth="9" strokeLinecap="round"/>
      </svg>
    );
    case "cur": return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11.5" fill="#111"/>
        <path d="M12 5L19 9V17L12 21L5 17V9Z" stroke="white" strokeWidth="1.4" fill="rgba(255,255,255,0.07)" strokeLinejoin="round"/>
        <path d="M12 5V13M5 9L12 13L19 9" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    );
    case "cc": {
      const OR = '#C97040', EY = '#7A3018';
      const tiles: [number, number, string][] = [
        [1,0,OR],[2,0,OR],[3,0,OR],[4,0,OR],[5,0,OR],
        [0,1,OR],[2,1,EY],[3,1,OR],[4,1,EY],[6,1,OR],
        [0,2,OR],[1,2,OR],[2,2,OR],[3,2,OR],[4,2,OR],[5,2,OR],[6,2,OR],
        [2,3,OR],[4,3,OR],
        [2,4,OR],[4,4,OR],
      ];
      return (
        <svg width={s} height={Math.round(s*50/70)} viewBox="0 0 70 50" fill="none" shapeRendering="crispEdges">
          {tiles.map(([c, r, col], i) => (
            <rect key={i} x={c*10} y={r*10} width={10} height={10} rx={1} fill={col}/>
          ))}
        </svg>
      );
    }
    case "mcp": return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="2.8" fill={color}/>
        <circle cx="4.5" cy="5"  r="1.8" stroke={color} strokeWidth="1.4" fill="none"/>
        <circle cx="19.5" cy="5" r="1.8" stroke={color} strokeWidth="1.4" fill="none"/>
        <circle cx="4.5" cy="19" r="1.8" stroke={color} strokeWidth="1.4" fill="none"/>
        <circle cx="19.5" cy="19" r="1.8" stroke={color} strokeWidth="1.4" fill="none"/>
        <line x1="12" y1="9.2" x2="4.5"  y2="6.8" stroke={color} strokeWidth="1.2" strokeOpacity="0.55"/>
        <line x1="12" y1="9.2" x2="19.5" y2="6.8" stroke={color} strokeWidth="1.2" strokeOpacity="0.55"/>
        <line x1="12" y1="14.8" x2="4.5"  y2="17.2" stroke={color} strokeWidth="1.2" strokeOpacity="0.55"/>
        <line x1="12" y1="14.8" x2="19.5" y2="17.2" stroke={color} strokeWidth="1.2" strokeOpacity="0.55"/>
      </svg>
    );
    case "work": return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="8" width="18" height="12" rx="2" stroke={color} strokeWidth="1.7"/>
        <path d="M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2" stroke={color} strokeWidth="1.7"/>
        <line x1="3" y1="14" x2="21" y2="14" stroke={color} strokeWidth="1.3" strokeOpacity="0.5"/>
      </svg>
    );
    case "proj": return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="4" width="20" height="15" rx="2" stroke={color} strokeWidth="1.7"/>
        <path d="M8 10.5L5 13l3 2.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16 10.5l3 2.5-3 2.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="13" y1="9" x2="11" y2="16" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    );
    case "pref": return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.7"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={color} strokeWidth="1.7"/>
      </svg>
    );
    case "pers": return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8.5" r="3.5" stroke={color} strokeWidth="1.7"/>
        <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
      </svg>
    );
    case "health": return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke={color} strokeWidth="1.7" fill={color} fillOpacity="0.18"/>
        <path d="M7 12h2l2-4 2 8 2-4h2" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      </svg>
    );
    default: return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1.7"/>
      </svg>
    );
  }
}

interface IDENode { id: string; title: string; tag?: string; sub?: string; isConfig?: boolean; color: string; cx: number; cy: number; sources: string[]; }
interface NSNode  { id: string; title: string; color: string; cx: number; cy: number; topic: Topic; }

const IDE_NODES: IDENode[] = [
  { id:"cc",  title:"Claude Code",  sub:"94 tagged", color:"#22d3ee", cx:192, cy:152, sources:["claude-code","claude_code","claudecode","cc"] },
  { id:"cur", title:"Cursor",       sub:"61 tagged", color:"#6ee7b7", cx:158, cy:296, sources:["cursor"] },
  { id:"cod", title:"Codex",        tag:"GitHub Copilot", sub:"38 tagged", color:"#818cf8", cx:145, cy:440, sources:["codex","github-copilot","copilot"] },
  { id:"ag",  title:"Antigravity",  sub:"12 tagged", color:"#c084fc", cx:158, cy:584, sources:["antigravity"] },
  { id:"mcp", title:"Custom MCP",   isConfig:true,   color:"#d946ef", cx:192, cy:728, sources:["custom-mcp","custommcp","mcp"] },
];
const NS_NODES: NSNode[] = [
  { id:"work",   title:"Work",        color:"#f472b6", cx:1248, cy:152, topic:"work"        },
  { id:"proj",   title:"Projects",    color:"#fb7185", cx:1282, cy:296, topic:"projects"    },
  { id:"pref",   title:"Preferences", color:"#fb923c", cx:1295, cy:440, topic:"preferences" },
  { id:"pers",   title:"Personal",    color:"#fbbf24", cx:1282, cy:584, topic:"personal"    },
  { id:"health", title:"Health",      color:"#a3e635", cx:1248, cy:728, topic:"health"      },
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

const GLASS_NODE  = "rgba(255,255,255,0.10)";
const GLASS_CARD  = "rgba(255,255,255,0.05)";
const BLUR_NODE   = "blur(44px) saturate(2.2) brightness(1.08)";
const INSET_SHINE = "inset 0 1.5px 0 rgba(255,255,255,0.62), inset 1px 0 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.30)";
const SHADOW_BASE = "0 20px 64px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.06)";

function glassBorder(active: boolean) {
  return active ? `1px solid rgba(255,255,255,0.20)` : `1px solid rgba(255,255,255,0.07)`;
}
function glassShadow() {
  return `${INSET_SHINE}, ${SHADOW_BASE}`;
}

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

/* ════ NodeTooltip — hover card showing memory stats ════ */
function NodeTooltip({ node, memories, side }: { node: IDENode | NSNode; memories: Memory[]; side: "right" | "left" }) {
  const isIde = "sources" in node;
  const mems = isIde
    ? memories.filter(m => (node as IDENode).sources.some(s => (m.source || "").toLowerCase().includes(s)))
    : memories.filter(m => m.topic === (node as NSNode).topic);
  const pinned = mems.filter(m => m.pinned).length;
  const latest = [...mems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const topicCounts = mems.reduce((acc, m) => { acc[m.topic] = (acc[m.topic] || 0) + 1; return acc; }, {} as Record<string, number>);
  const topicEntries = Object.entries(topicCounts);

  return (
    <div style={{
      position: "absolute",
      ...(side === "right" ? { left: "calc(100% + 14px)" } : { right: "calc(100% + 14px)", left: "auto" }),
      top: "50%", transform: "translateY(-50%)",
      width: 182, padding: "13px 15px", borderRadius: 14,
      background: "rgba(5, 7, 16, 0.95)",
      backdropFilter: "blur(32px) saturate(2.6)",
      WebkitBackdropFilter: "blur(32px) saturate(2.6)",
      border: "1px solid rgba(255,255,255,0.16)",
      boxShadow: "0 16px 52px rgba(0,0,0,0.8), 0 0 0 0.5px rgba(255,255,255,0.06)",
      animation: "tooltipIn 0.16s cubic-bezier(0.34,1.56,0.64,1) both",
      zIndex: 50, pointerEvents: "none",
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.92)", marginBottom: 10, letterSpacing: "-0.015em" }}>{node.title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[
          { l: "Memories",  v: String(mems.length), c: "rgba(255,255,255,0.82)" },
          { l: "Pinned",    v: String(pinned),       c: pinned > 0 ? "#f0b46a" : "rgba(255,255,255,0.3)" },
          { l: "Last saved", v: latest ? timeAgo(new Date(latest.createdAt)) : "—", c: "rgba(255,255,255,0.44)" },
        ].map((row, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.34)" }}>{row.l}</span>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: row.c }}>{row.v}</span>
          </div>
        ))}
      </div>
      {mems.length > 0 && topicEntries.length > 0 && (
        <div style={{ marginTop: 11, padding: "8px 10px", borderRadius: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", marginBottom: 6, letterSpacing: "0.08em", fontWeight: 600 }}>TOPIC MIX</div>
          <div style={{ display: "flex", gap: 2, height: 4, borderRadius: 2, overflow: "hidden", marginBottom: 7 }}>
            {topicEntries.map(([t, c]) => (
              <div key={t} style={{ flex: c, background: TOPIC_META[t as Topic]?.color || "#6b7280", minWidth: 2 }} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {topicEntries.map(([t, c]) => (
              <span key={t} style={{ fontSize: 9, color: TOPIC_META[t as Topic]?.color || "#6b7280", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4 }}>
                {t} {c}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════ MemoryChart — animated bar chart by IDE or topic ════ */
function MemoryChart({ memories }: { memories: Memory[] }) {
  const [view, setView] = useState<"ide" | "topic">("ide");

  const ideData = IDE_NODES.filter(n => n.id !== "mcp").map(n => ({
    id: n.id, label: n.title, color: n.color,
    count: memories.filter(m => n.sources.some(s => (m.source || "").toLowerCase().includes(s))).length,
  }));
  const topicData = NS_NODES.map(n => ({
    id: n.id, label: n.title, color: n.color,
    count: memories.filter(m => m.topic === n.topic).length,
  }));
  const data = view === "ide" ? ideData : topicData;
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const total = memories.length;

  return (
    <div style={{ marginBottom: 32, padding: "22px 26px", borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(16px)" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.42)", textTransform: "uppercase", letterSpacing: "0.09em" }}>Memory Distribution</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.24)", marginTop: 2 }}>{total} memories total</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 0, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: 3 }}>
          {(["ide", "topic"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ height: 24, padding: "0 12px", borderRadius: 7, background: view === v ? "rgba(255,255,255,0.12)" : "transparent", border: "none", color: view === v ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.35)", fontSize: 10.5, fontWeight: view === v ? 600 : 400, fontFamily: "inherit", cursor: "pointer", transition: "all .15s" }}>
              {v === "ide" ? "By IDE" : "By Topic"}
            </button>
          ))}
        </div>
      </div>
      <div key={view} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.map((d, i) => {
          const pct = maxCount === 0 ? 0 : Math.round((d.count / maxCount) * 100);
          return (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 92, fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "right", flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</div>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", position: "relative", overflow: "hidden" }}>
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 4,
                  width: `${pct}%`, background: d.color,
                  transformOrigin: "left",
                  boxShadow: `0 0 12px ${d.color}55`,
                  animation: `barScale 0.55s ${i * 0.07}s cubic-bezier(0.34,1.56,0.64,1) both`,
                }} />
              </div>
              <div style={{ width: 28, fontSize: 12, fontWeight: 700, color: d.count > 0 ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.2)", textAlign: "right", flexShrink: 0 }}>{d.count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════ NodeModal — full glass management window ════════════ */
interface NodeModalProps {
  nodeId: string; memories: Memory[]; userId: string | null;
  onClose: () => void; onAddNew: () => void;
  onPin: (id: string) => void; onDelete: (id: string) => void;
  onSaveEdit: (id: string, text: string) => void;
}
function NodeModal({ nodeId, memories, onClose, onAddNew, onPin, onDelete, onSaveEdit }: NodeModalProps) {
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState<"all"|"pinned"|"recent">("all");
  const [editId,    setEditId]    = useState<string|null>(null);
  const [editText,  setEditText]  = useState("");
  const [syncOn,    setSyncOn]    = useState(true);
  const [tagInject, setTagInject] = useState(false);

  const ide = IDE_NODES.find(n => n.id === nodeId);
  const ns  = NS_NODES.find(n => n.id === nodeId);
  const node = (ide || ns)!;
  const color = node.color;

  const nodeMems = ide
    ? memories.filter(m => ide.sources.some(s => (m.source || "").toLowerCase().includes(s)))
    : memories.filter(m => ns && m.topic === ns.topic);

  const filtered = nodeMems
    .filter(m => !search || m.content.toLowerCase().includes(search.toLowerCase()))
    .filter(m => filter === "pinned" ? m.pinned : true)
    .sort((a,b) => filter === "recent"
      ? new Date((b as any)._raw?.createdAt ?? b.createdAt).getTime() - new Date((a as any)._raw?.createdAt ?? a.createdAt).getTime()
      : b.pinned === a.pinned ? 0 : b.pinned ? 1 : -1);

  const pinnedCnt = nodeMems.filter(m => m.pinned).length;

  function doExport() {
    downloadText(
      [`${node.title} — Memory Export`, `Total: ${nodeMems.length}`, "",
       ...nodeMems.map(m => `[${m.topic}] ${m.content}`)].join("\n"),
      `imprint-${nodeId}-${new Date().toISOString().split("T")[0]}.txt`
    );
  }

  const MODAL_GLASS = `inset 0 1.5px 0 rgba(255,255,255,0.65), inset 1px 0 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.28), 0 40px 100px rgba(0,0,0,0.7), 0 0 60px ${color}18`;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(14px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif" }}>

      <div style={{ width:"100%", maxWidth:940, maxHeight:"88vh", borderRadius:28, background:"rgba(255,255,255,0.09)", backdropFilter:"blur(60px) saturate(2.4) brightness(1.06)", WebkitBackdropFilter:"blur(60px) saturate(2.4) brightness(1.06)", border:`1px solid rgba(255,255,255,0.18)`, boxShadow:MODAL_GLASS, display:"flex", flexDirection:"column", overflow:"hidden", animation:"modalSpring 0.32s cubic-bezier(0.34,1.56,0.64,1) both", position:"relative" }}>

        <div style={{ position:"absolute", inset:-1, borderRadius:28, padding:"1.2px", background:"linear-gradient(145deg,rgba(255,255,255,0.70) 0%,rgba(255,255,255,0.25) 18%,rgba(255,255,255,0) 45%,rgba(255,255,255,0) 55%,rgba(255,255,255,0.12) 80%,rgba(255,255,255,0.45) 100%)", WebkitMask:"linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0)", WebkitMaskComposite:"xor", maskComposite:"exclude", pointerEvents:"none", zIndex:1 }}/>

        {/* ── Header ── */}
        <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
          <div style={{ width:50, height:50, borderRadius:15, background: ide ? "transparent" : "rgba(255,255,255,0.06)", border: ide ? "none" : "1px solid rgba(255,255,255,0.12)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow: ide ? "none" : INSET_SHINE }}>
            {ide
              ? <img src={IDE_IMG[nodeId]} alt={node.title} style={{ width:46, height:46, objectFit:"contain" }}/>
              : <BrandLogo id={nodeId} color={color} size={27}/>
            }
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:19, fontWeight:700, letterSpacing:"-0.02em", color:"rgba(255,255,255,0.96)", display:"flex", alignItems:"baseline", gap:8 }}>
              {node.title}
              {ide?.tag && <span style={{ fontSize:11, color:"rgba(255,255,255,0.33)", fontWeight:400 }}>{ide.tag}</span>}
            </div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.38)", marginTop:2 }}>
              {ide ? `${nodeMems.length} memories · source: ${ide.sources[0]}` : `${nodeMems.length} memories · ${(ns as NSNode).topic}`}
            </div>
          </div>
          <button onClick={onClose} style={{ width:34, height:34, borderRadius:10, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.5)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}><X size={16}/></button>
        </div>

        {/* ── Body ── */}
        <div style={{ display:"flex", flex:1, overflow:"hidden", minHeight:0 }}>

          {/* Left panel */}
          <div style={{ width:248, borderRight:"1px solid rgba(255,255,255,0.07)", padding:"18px 18px", display:"flex", flexDirection:"column", gap:18, overflowY:"auto", flexShrink:0 }}>
            <div>
              <div style={{ fontSize:9.5, color:"rgba(255,255,255,0.28)", fontWeight:600, letterSpacing:"0.08em", marginBottom:10 }}>OVERVIEW</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[
                  { v:nodeMems.length,  l:"memories" },
                  { v:pinnedCnt,        l:"pinned"   },
                  { v: nodeMems.filter(m => !m.pinned && (Date.now()-new Date(m.createdAt).getTime())/86400000 > 23).length, l:"decaying" },
                  { v: nodeMems.filter(m => m.source === "import").length, l:"imported" },
                ].map((s, i) => (
                  <div key={i} style={{ padding:"10px 12px", borderRadius:12, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)", backdropFilter:"blur(8px)" }}>
                    <div style={{ fontSize:21, fontWeight:700, color:"rgba(255,255,255,0.82)", letterSpacing:"-0.025em", lineHeight:1 }}>{s.v}</div>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.28)", marginTop:3 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {ide && (
              <div>
                <div style={{ fontSize:9.5, color:"rgba(255,255,255,0.28)", fontWeight:600, letterSpacing:"0.08em", marginBottom:10 }}>CONFIGURATION</div>
                <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                  {[
                    { label:"Auto-sync",    val:syncOn,    set:setSyncOn    },
                    { label:"Tag injection", val:tagInject, set:setTagInject },
                  ].map((row, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px", borderRadius:11, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", cursor:"pointer" }} onClick={() => row.set(v => !v)}>
                      <span style={{ fontSize:12.5, color:"rgba(255,255,255,0.55)" }}>{row.label}</span>
                      <div style={{ width:38, height:21, borderRadius:999, background:row.val?"rgba(255,255,255,0.22)":"rgba(255,255,255,0.08)", border:`1px solid ${row.val?"rgba(255,255,255,0.28)":"rgba(255,255,255,0.12)"}`, position:"relative", transition:"background .2s,border-color .2s", flexShrink:0 }}>
                        <div style={{ position:"absolute", top:2.5, left:row.val?18:2.5, width:14, height:14, borderRadius:999, background:"#fff", transition:"left .18s", boxShadow:"0 1px 3px rgba(0,0,0,0.3)" }}/>
                      </div>
                    </div>
                  ))}
                  {ide.isConfig && (
                    <div style={{ padding:"10px 12px", borderRadius:11, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginBottom:6 }}>MCP endpoint</div>
                      <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.65)", fontFamily:"'JetBrains Mono',monospace", wordBreak:"break-all" }}>localhost:3100</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {ns && (
              <div>
                <div style={{ fontSize:9.5, color:"rgba(255,255,255,0.28)", fontWeight:600, letterSpacing:"0.08em", marginBottom:10 }}>NAMESPACE</div>
                <div style={{ padding:"12px", borderRadius:11, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.38)", marginBottom:4 }}>Topic tag</div>
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.72)", fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>#{ns.topic}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.28)", marginTop:8, lineHeight:1.5 }}>Memories tagged with this topic are automatically routed here.</div>
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize:9.5, color:"rgba(255,255,255,0.28)", fontWeight:600, letterSpacing:"0.08em", marginBottom:10 }}>ACTIONS</div>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                <button onClick={onAddNew} style={{ width:"100%", height:36, borderRadius:10, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.7)", fontSize:12.5, fontWeight:500, fontFamily:"inherit", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7, transition:"background .15s" }}>
                  <Plus size={14}/> Add Memory
                </button>
                <button onClick={doExport} style={{ width:"100%", height:36, borderRadius:10, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.6)", fontSize:12.5, fontWeight:500, fontFamily:"inherit", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
                  <Download size={14}/> Export
                </button>
              </div>
            </div>
          </div>

          {/* Right panel — memory list */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>
            <div style={{ padding:"14px 18px 10px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
              <div style={{ position:"relative", marginBottom:10 }}>
                <Search size={13} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,0.28)", pointerEvents:"none" }}/>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${node.title} memories…`}
                  style={{ width:"100%", boxSizing:"border-box", height:34, padding:"0 10px 0 30px", borderRadius:10, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", color:"rgba(255,255,255,0.82)", fontSize:12.5, outline:"none", fontFamily:"inherit" }}/>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                {(["all","pinned","recent"] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{ height:27, padding:"0 13px", borderRadius:8, background:filter===f?"rgba(255,255,255,0.1)":"transparent", border:`1px solid ${filter===f?"rgba(255,255,255,0.22)":"rgba(255,255,255,0.08)"}`, color:filter===f?"rgba(255,255,255,0.92)":"rgba(255,255,255,0.38)", fontSize:11.5, fontWeight:filter===f?600:400, fontFamily:"inherit", cursor:"pointer", transition:"all .15s", textTransform:"capitalize" }}>
                    {f}
                  </button>
                ))}
                <span style={{ marginLeft:"auto", fontSize:11, color:"rgba(255,255,255,0.22)", alignSelf:"center" }}>{filtered.length} / {nodeMems.length}</span>
              </div>
            </div>

            <div style={{ flex:1, overflowY:"auto", padding:"10px 14px", display:"flex", flexDirection:"column", gap:7 }}>
              {filtered.length === 0 && (
                <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:48, gap:12 }}>
                  <div style={{ fontSize:13.5, color:"rgba(255,255,255,0.2)" }}>{search ? "No matches found" : `No ${node.title} memories yet`}</div>
                  <button onClick={onAddNew} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>Add the first memory →</button>
                </div>
              )}
              {filtered.map(mem => {
                const tm  = TOPIC_META[mem.topic] ?? TOPIC_META.general;
                const isEd = editId === mem.id;
                return (
                  <div key={mem.id} className="mem-card" style={{ position:"relative", padding:"12px 14px", borderRadius:13, background:mem.pinned?"rgba(240,180,106,0.07)":GLASS_CARD, backdropFilter:"blur(8px)", border:`1px solid ${mem.pinned?"rgba(240,180,106,0.22)":"rgba(255,255,255,0.08)"}`, borderLeft:mem.pinned?"2.5px solid #f0b46a":undefined, transition:"background .15s,border-color .15s" }}>
                    {isEd ? (
                      <div>
                        <textarea autoFocus value={editText} onChange={e => setEditText(e.target.value)} rows={3}
                          style={{ width:"100%", boxSizing:"border-box", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.14)", borderRadius:8, padding:"7px 9px", color:"rgba(255,255,255,0.88)", fontSize:13, outline:"none", resize:"none", fontFamily:"inherit", lineHeight:1.5 }}/>
                        <div style={{ display:"flex", gap:7, marginTop:7 }}>
                          <button onClick={() => { onSaveEdit(mem.id, editText); setEditId(null); }} style={{ padding:"4px 14px", borderRadius:7, background:"rgba(52,211,153,0.12)", border:"1px solid rgba(52,211,153,0.3)", color:"rgba(52,211,153,0.9)", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Save</button>
                          <button onClick={() => setEditId(null)} style={{ padding:"4px 10px", borderRadius:7, background:"transparent", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.35)", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                          <span style={{ width:5, height:5, borderRadius:999, background:tm.color, marginTop:6, flexShrink:0 }}/>
                          <span style={{ fontSize:13, lineHeight:1.5, color:"rgba(255,255,255,0.83)", flex:1 }}>{mem.content}</span>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:7, paddingLeft:13 }}>
                          <span style={{ fontSize:10.5, color:"rgba(255,255,255,0.22)" }}>{timeAgo(new Date((mem as any)._raw?.createdAt ?? mem.createdAt))}</span>
                          <span style={{ fontSize:9.5, fontFamily:"'JetBrains Mono',monospace", color:"rgba(255,255,255,0.28)", background:"rgba(255,255,255,0.05)", padding:"2px 7px", borderRadius:5 }}>{mem.source}</span>
                          {mem.pinned && <span style={{ fontSize:10, color:"#f0b46a" }}>📌</span>}
                        </div>
                      </>
                    )}
                    {!isEd && (
                      <div className="mem-act" style={{ position:"absolute", top:10, right:10, display:"flex", gap:4, opacity:0, transition:"opacity .15s" }}>
                        <button onClick={() => onPin(mem.id)} title={mem.pinned?"Unpin":"Pin"} style={{ width:26, height:26, borderRadius:7, background:"rgba(255,255,255,0.07)", border:"none", color:mem.pinned?"#f0b46a":"rgba(255,255,255,0.42)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><Pin size={11} fill={mem.pinned?"currentColor":"none"}/></button>
                        <button onClick={() => { setEditId(mem.id); setEditText(mem.content); }} title="Edit" style={{ width:26, height:26, borderRadius:7, background:"rgba(255,255,255,0.07)", border:"none", color:"rgba(255,255,255,0.42)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><Edit3 size={11}/></button>
                        <button onClick={() => onDelete(mem.id)} title="Delete" style={{ width:26, height:26, borderRadius:7, background:"rgba(255,255,255,0.07)", border:"none", color:"rgba(248,113,113,0.55)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><Trash2 size={11}/></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════ Simple modal wrapper ════ */
function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:"rgba(255,255,255,0.11)", backdropFilter:"blur(52px) saturate(2.2) brightness(1.06)", border:"1px solid rgba(255,255,255,0.28)", borderRadius:24, padding:"28px 30px", width:"100%", maxWidth:480, boxShadow:`${INSET_SHINE}, 0 40px 80px rgba(0,0,0,0.5)` }}>
        {children}
      </div>
    </div>
  );
}

/* ════════════════════════════════ DASHBOARD ════════════════════════════════ */
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
  const [openAnim,      setOpenAnim]      = useState<string | null>(null);
  const [scrollFilter,  setScrollFilter]  = useState<string>("all");
  const [showSearch,    setShowSearch]    = useState(false);
  const [globalSearch,  setGlobalSearch]  = useState("");
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [newMemory,     setNewMemory]     = useState("");
  const [newTopic,      setNewTopic]      = useState<Topic>("general");
  const [newPin,        setNewPin]        = useState(false);
  const [showImport,    setShowImport]    = useState(false);
  const [importText,    setImportText]    = useState("");
  const [importing,     setImporting]     = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [mapScale,      setMapScale]      = useState(0.8);
  const mapRef   = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

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
  async function saveEdit(id: string, text: string) {
    const m = memories.find(x => x.id === id); if (!m || !userId) return;
    setMemories(p => p.map(x => x.id === id ? { ...x, content: text } : x));
    try { await fetch(`/api/memories/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId, createdAt: raw(m).createdAt, content: text }) }); }
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

  function openNode(id: string, isSel: boolean) {
    if (isSel) { setSelectedId(null); return; }
    setOpenAnim(id);
    setSelectedId(id);
    setTimeout(() => setOpenAnim(prev => prev === id ? null : prev), 500);
  }

  function nodeOp(id: string) {
    if (selectedId && selectedId !== id) return 0.28;
    if (!hovered) return 1;
    return hovered === id ? 1 : 0.28;
  }
  function connOps(id: string) {
    if (selectedId === id)               return { base: 0.18, flow: 0.40 };
    if (selectedId && selectedId !== id) return { base: 0.04, flow: 0.05 };
    if (!hovered)                        return { base: 0.09, flow: 0.20 };
    return hovered === id ? { base: 0.20, flow: 0.45 } : { base: 0.04, flow: 0.05 };
  }

  const pinnedCount   = memories.filter(m => m.pinned).length;
  const importedCount = memories.filter(m => m.source === "import").length;
  const decayingCount = memories.filter(m => !m.pinned && (Date.now() - new Date(m.createdAt).getTime()) / 86400000 > 23).length;

  /* scroll-view filter helpers */
  const sfIde = scrollFilter.startsWith("ide:") ? scrollFilter.slice(4) : null;
  const sfNs  = scrollFilter.startsWith("ns:")  ? scrollFilter.slice(3) : null;

  const filterChips = [
    { id: "all", label: "All", color: "rgba(255,255,255,0.6)" },
    ...IDE_NODES.filter(n => n.id !== "mcp").map(n => ({ id: `ide:${n.id}`, label: n.title, color: n.color })),
    ...NS_NODES.map(n => ({ id: `ns:${n.id}`, label: n.title, color: n.color })),
  ];

  if (!isLoaded) return null;

  /* ─────────────────────────── RENDER ─────────────────────────── */
  return (
    <div style={{ minHeight:"100vh", overflowY:"auto", background:"#000", color:"white", position:"relative", fontFamily:"Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif" }}>

      <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none" }}>
        <BackgroundVideo overlayOpacity={0.76} />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        @keyframes hubGlow {
          0%,100%{ filter: drop-shadow(0 0 18px rgba(94,234,212,0.7)) drop-shadow(0 0 40px rgba(252,211,77,0.35)); }
          50%    { filter: drop-shadow(0 0 28px rgba(94,234,212,0.95)) drop-shadow(0 0 60px rgba(252,211,77,0.55)); }
        }
        @keyframes flowDash  { to { stroke-dashoffset: -320; } }
        @keyframes spin      { to { transform: rotate(360deg); } }

        @keyframes modalSpring {
          from { opacity:0; transform:scale(0.86) translateY(22px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes nodeIn {
          from { opacity:0; transform:translateY(4px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes nodePulse {
          0%   { transform: scale(1); }
          35%  { transform: scale(1.18) translateY(-4px); filter: drop-shadow(0 0 22px rgba(255,255,255,0.55)); }
          70%  { transform: scale(0.97) translateY(0); }
          100% { transform: scale(1); }
        }
        @keyframes tooltipIn {
          from { opacity:0; transform:translateY(-50%) scale(0.92); }
          to   { opacity:1; transform:translateY(-50%) scale(1); }
        }
        @keyframes barScale {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }

        .node-card {
          transition: opacity .22s, border-color .18s, box-shadow .18s, transform .16s;
          animation: nodeIn 0.3s ease both;
        }
        .node-card:hover { transform: scale(1.026) translateY(-1px); }
        .node-opening    { animation: nodePulse 0.48s cubic-bezier(0.34,1.56,0.64,1) both !important; }

        .mem-card:hover { background: rgba(255,255,255,0.07) !important; border-color: rgba(255,255,255,0.13) !important; }
        .mem-card:hover .mem-act { opacity: 1 !important; }
        .hbtn:hover { background: rgba(255,255,255,0.1) !important; color: rgba(255,255,255,0.9) !important; }
        .filter-chip:hover { opacity: 0.85; }

        .glass-node-ide { position: relative; }
        .glass-node-ide::after {
          content:''; position:absolute; inset:-1px; border-radius:inherit; padding:1.2px;
          background: linear-gradient(145deg,rgba(255,255,255,0.72) 0%,rgba(255,255,255,0.32) 18%,rgba(255,255,255,0.06) 45%,rgba(255,255,255,0) 55%,rgba(255,255,255,0.14) 80%,rgba(255,255,255,0.48) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none;
        }
        .glass-node-ide::before {
          content:''; position:absolute; top:1px; left:12px; right:12px; height:36%;
          border-radius:50%; background:radial-gradient(ellipse at 50% 0%,rgba(255,255,255,0.13) 0%,transparent 70%); pointer-events:none;
        }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>

      {/* ════ HEADER ════ */}
      <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:50, height:52, background:"rgba(255,255,255,0.07)", backdropFilter:"blur(44px) saturate(2) brightness(1.05)", borderBottom:"1px solid rgba(255,255,255,0.18)", display:"flex", alignItems:"center", padding:"0 16px", gap:8 }}>
        <Link href="/" style={{ display:"flex", alignItems:"center", gap:9, textDecoration:"none", flexShrink:0 }}>
          <div style={{ width:30, height:30, borderRadius:9, background:"rgba(255,255,255,0.06)", backdropFilter:"blur(12px)", border:"1px solid rgba(240,180,106,0.45)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:INSET_SHINE }}>
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
        {[
          { icon:<Plus size={14}/>,          onClick:()=>setShowAddModal(true),   title:"Add",    bg:"rgba(255,255,255,0.07)", col:"#fff"                    },
          { icon:<MessageSquare size={14}/>,  href:"/chat",                        title:"Chat",   bg:"transparent",            col:"rgba(255,255,255,0.5)"   },
          { icon:<Download size={14}/>,       onClick:doExport,                    title:"Export", bg:"transparent",            col:"rgba(255,255,255,0.5)"   },
          { icon:<Upload size={14}/>,         onClick:()=>setShowImport(true),     title:"Import", bg:"transparent",            col:"rgba(255,255,255,0.5)"   },
          { icon:<Trash2 size={14}/>,         onClick:()=>setDeleteConfirm(true),  title:"Delete", bg:"transparent",            col:"rgba(255,255,255,0.35)"  },
        ].map((b, i) => b.href
          ? <Link key={i} href={b.href!} title={b.title} style={{ width:30, height:30, borderRadius:8, background:b.bg, border:`1px solid ${b.col}30`, color:b.col, display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none", transition:"all .15s", backdropFilter:"blur(8px)" }}>{b.icon}</Link>
          : <button key={i} className="hbtn" onClick={b.onClick} title={b.title} style={{ width:30, height:30, borderRadius:8, background:b.bg, border:`1px solid ${b.col}22`, color:b.col, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all .15s" }}>{b.icon}</button>
        )}
        <div style={{ width:1, height:22, background:"rgba(255,255,255,0.07)" }} />
        {user?.image
          ? <img src={user.image} alt="" style={{ width:30, height:30, borderRadius:"50%", flexShrink:0, border:"1.5px solid rgba(255,255,255,0.15)" }} />
          : <div style={{ width:30, height:30, borderRadius:"50%", background:"linear-gradient(145deg,#f0b46a,#b97e35)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#1a0f08", flexShrink:0 }}>{((user?.name||user?.email||"?")[0]).toUpperCase()}</div>
        }
        <button onClick={() => signOut({ callbackUrl:"/sign-in" })} title="Sign out" style={{ background:"none", border:"none", color:"rgba(255,255,255,0.28)", cursor:"pointer", padding:4 }}><LogOut size={13} /></button>
      </div>

      {/* ════ CANVAS ════ */}
      <div ref={mapRef} style={{ position:"relative", height:"calc(100vh - 52px)", marginTop:52, overflow:"hidden", zIndex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>

        <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:1000, height:900, pointerEvents:"none", background:"radial-gradient(ellipse at center, rgba(120,60,220,0.10) 0%, rgba(60,40,180,0.04) 38%, transparent 65%)", filter:"blur(10px)" }} />
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", backgroundImage:"radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)", backgroundSize:"28px 28px", maskImage:"radial-gradient(ellipse 62% 58% at center, #000 25%, transparent 75%)", WebkitMaskImage:"radial-gradient(ellipse 62% 58% at center, #000 25%, transparent 75%)" }} />

        <div style={{ position:"relative", width:MAP_W, height:MAP_H, transformOrigin:"center", transform:`scale(${mapScale})`, flexShrink:0 }}>

          {/* ── SVG lines ── */}
          <svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ position:"absolute", inset:0, overflow:"visible", pointerEvents:"none" }}>
            {IDE_NODES.map(n => {
              const [sx,sy] = hubStart(n.cx, n.cy);
              const d = pathH(sx, sy, n.cx + 108, n.cy);
              const op = connOps(n.id);
              return (
                <g key={n.id}>
                  <path d={d} fill="none" stroke="rgba(255,255,255,1)" strokeWidth="1.4" strokeOpacity={op.base} strokeLinecap="round" style={{transition:"stroke-opacity .22s"}}/>
                  <path d={d} fill="none" stroke="rgba(255,255,255,1)" strokeWidth="1.6" strokeOpacity={op.flow} strokeDasharray="8 16" strokeLinecap="round" style={{animation:"flowDash 3.5s linear infinite",transition:"stroke-opacity .22s"}}/>
                </g>
              );
            })}
            {NS_NODES.map(n => {
              const [sx,sy] = hubStart(n.cx, n.cy);
              const d = pathH(sx, sy, n.cx - 100, n.cy);
              const op = connOps(n.id);
              return (
                <g key={n.id}>
                  <path d={d} fill="none" stroke="rgba(255,255,255,1)" strokeWidth="1.4" strokeOpacity={op.base} strokeLinecap="round" style={{transition:"stroke-opacity .22s"}}/>
                  <path d={d} fill="none" stroke="rgba(255,255,255,1)" strokeWidth="1.6" strokeOpacity={op.flow} strokeDasharray="8 16" strokeLinecap="round" style={{animation:"flowDash 3.5s linear infinite",transition:"stroke-opacity .22s"}}/>
                </g>
              );
            })}
          </svg>

          {/* ── HUB ── */}
          <div onMouseEnter={()=>setHovered("hub")} onMouseLeave={()=>setHovered(null)}
            style={{ position:"absolute", left:HUB.x, top:HUB.y, width:128, height:128, transform:"translate(-50%,-50%)", background:"transparent", border:"none", display:"flex", alignItems:"center", justifyContent:"center", zIndex:10, opacity:nodeOp("hub"), transition:"opacity .22s, filter .22s", cursor:"default", filter:"drop-shadow(0 0 18px rgba(94,234,212,0.7)) drop-shadow(0 0 40px rgba(252,211,77,0.35))", animation:"hubGlow 3.8s ease-in-out infinite" }}>
            <ImprintLogo size={52} />
          </div>

          {/* ── IDE NODES ── */}
          {IDE_NODES.map(n => {
            const hl = hovered === n.id, sel = selectedId === n.id, active = hl || sel;
            const isMcp = n.id === "mcp";
            return isMcp ? (
              <div key={n.id}
                className={openAnim === n.id ? "node-card node-opening" : "node-card"}
                onMouseEnter={()=>setHovered(n.id)} onMouseLeave={()=>setHovered(null)}
                onClick={()=>openNode(n.id, sel)}
                style={{ position:"absolute", left:n.cx-108, top:n.cy-34, width:215, height:68, background:"transparent", border:"none", display:"flex", alignItems:"center", gap:12, padding:"0 15px", opacity:nodeOp(n.id), cursor:"pointer" }}>
                <div style={{ width:42, height:42, borderRadius:13, flexShrink:0, background:"rgba(255,255,255,0.09)", backdropFilter:"blur(16px) saturate(1.8)", WebkitBackdropFilter:"blur(16px) saturate(1.8)", border:"1px solid rgba(255,255,255,0.18)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:INSET_SHINE, transition:"transform .15s", transform:active?"scale(1.08)":"scale(1)" }}>
                  <BrandLogo id="mcp" color={n.color} size={21}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"rgba(255,255,255,0.92)" }}>Custom MCP</div>
                  <button style={{ marginTop:5, height:22, padding:"0 10px", borderRadius:7, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.14)", color:"rgba(255,255,255,0.55)", fontSize:10.5, fontWeight:500, fontFamily:"inherit", cursor:"pointer" }}>Configure</button>
                </div>
                {hl && <NodeTooltip node={n} memories={memories} side="right" />}
              </div>
            ) : (
              <div key={n.id}
                className={openAnim === n.id ? "node-card node-opening" : "node-card"}
                onMouseEnter={()=>setHovered(n.id)} onMouseLeave={()=>setHovered(null)}
                onClick={()=>openNode(n.id, sel)}
                style={{ position:"absolute", left:n.cx-108, top:n.cy-32, width:215, height:64, background:"transparent", border:"none", display:"flex", alignItems:"center", gap:10, padding:"0 12px", opacity:nodeOp(n.id), cursor:"pointer" }}>
                <div style={{ width:46, height:46, flexShrink:0, borderRadius:13, background:"rgba(255,255,255,0.09)", backdropFilter:"blur(16px) saturate(1.8)", WebkitBackdropFilter:"blur(16px) saturate(1.8)", border:`1px solid ${active?"rgba(255,255,255,0.28)":"rgba(255,255,255,0.15)"}`, boxShadow:INSET_SHINE, display:"flex", alignItems:"center", justifyContent:"center", transition:"transform .15s, border-color .2s", transform:active?"scale(1.08)":"scale(1)" }}>
                  <img src={IDE_IMG[n.id]} alt={n.title} style={{ width:30, height:30, objectFit:"contain", filter:active?"drop-shadow(0 0 10px rgba(255,255,255,0.5))":"none", transition:"filter .2s" }} />
                </div>
                <span style={{ fontSize:12.5, fontWeight:600, color:active?"rgba(255,255,255,0.95)":"rgba(255,255,255,0.65)", letterSpacing:"0.01em", transition:"color .2s", whiteSpace:"nowrap" }}>{n.title}</span>
                {hl && <NodeTooltip node={n} memories={memories} side="right" />}
              </div>
            );
          })}

          {/* ── NS NODES ── */}
          {NS_NODES.map(n => {
            const hl = hovered === n.id, sel = selectedId === n.id, active = hl || sel;
            const cnt = memories.filter(m => m.topic === n.topic).length;
            const pin = memories.filter(m => m.topic === n.topic && m.pinned).length;
            return (
              <div key={n.id}
                className={openAnim === n.id ? "node-card node-opening" : "node-card"}
                onMouseEnter={()=>setHovered(n.id)} onMouseLeave={()=>setHovered(null)}
                onClick={()=>openNode(n.id, sel)}
                style={{ position:"absolute", left:n.cx-100, top:n.cy-34, width:200, height:68, background:"transparent", border:"none", display:"flex", alignItems:"center", gap:12, padding:"0 14px", opacity:nodeOp(n.id), cursor:"pointer" }}>
                <div style={{ width:40, height:40, borderRadius:13, flexShrink:0, background:"rgba(255,255,255,0.09)", backdropFilter:"blur(16px) saturate(1.8)", WebkitBackdropFilter:"blur(16px) saturate(1.8)", border:"1px solid rgba(255,255,255,0.18)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:INSET_SHINE, transition:"transform .15s", transform:active?"scale(1.08)":"scale(1)" }}>
                  <BrandLogo id={n.id} color={n.color} size={19}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"rgba(255,255,255,0.92)" }}>{n.title}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.38)", marginTop:2 }}>{cnt} {cnt===1?"memory":"memories"}</div>
                </div>
                {pin > 0 && <span style={{ fontSize:10, fontWeight:600, color:"#f0b46a" }}>📌{pin}</span>}
                {hl && <NodeTooltip node={n} memories={memories} side="left" />}
              </div>
            );
          })}

        </div>
      </div>

      {/* ════ DETAILED SCROLL VIEW ════ */}
      <div style={{ position:"relative", zIndex:2, background:"rgba(0,0,0,0.22)", backdropFilter:"blur(28px) saturate(2.2) brightness(0.9)", WebkitBackdropFilter:"blur(28px) saturate(2.2) brightness(0.9)", borderTop:"1px solid rgba(255,255,255,0.09)", padding:"56px 48px 96px" }}>
        <div style={{ maxWidth:1160, margin:"0 auto" }}>

          {/* Header */}
          <div style={{ display:"flex", alignItems:"baseline", gap:12, marginBottom:28 }}>
            <span style={{ fontSize:26, fontWeight:700, letterSpacing:"-0.025em", color:"rgba(255,255,255,0.92)" }}>Memories</span>
            <span style={{ fontSize:13, color:"rgba(255,255,255,0.3)" }}>{memories.length} total · {pinnedCount} pinned</span>
          </div>

          {/* Memory Distribution Chart */}
          {memories.length > 0 && <MemoryChart memories={memories} />}

          {/* Filter chips */}
          <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:32 }}>
            {filterChips.map(chip => {
              const active = scrollFilter === chip.id;
              return (
                <button key={chip.id} className="filter-chip"
                  onClick={() => setScrollFilter(chip.id)}
                  style={{
                    height: 30, padding: "0 14px", borderRadius: 9,
                    background: active ? `${chip.color}18` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${active ? `${chip.color}55` : "rgba(255,255,255,0.08)"}`,
                    color: active ? chip.color : "rgba(255,255,255,0.4)",
                    fontSize: 11.5, fontWeight: active ? 600 : 400,
                    fontFamily: "inherit", cursor: "pointer",
                    transition: "all .18s", letterSpacing: active ? "0.01em" : "0",
                    boxShadow: active ? `0 0 14px ${chip.color}22` : "none",
                  }}>
                  {chip.id === "all" ? "All" : chip.label}
                </button>
              );
            })}
          </div>

          {memories.length === 0 && (
            <div style={{ textAlign:"center", padding:"80px 0", color:"rgba(255,255,255,0.2)", fontSize:15 }}>No memories yet — add your first above.</div>
          )}

          {/* NS sections */}
          {[...NS_NODES].map(ns => {
            if (sfIde) return null;
            if (sfNs && sfNs !== ns.id) return null;
            const nsMems = memories.filter(m => m.topic === ns.topic);
            if (nsMems.length === 0) return null;
            return (
              <div key={ns.id} style={{ marginBottom:44 }}>
                <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:16, paddingBottom:12, borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ width:26, height:26, borderRadius:8, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <BrandLogo id={ns.id} color={ns.color} size={13}/>
                  </div>
                  <span style={{ fontSize:11.5, fontWeight:600, color:ns.color, textTransform:"uppercase", letterSpacing:"0.1em" }}>{ns.title}</span>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.25)" }}>{nsMems.length}</span>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:10 }}>
                  {nsMems.map(m => (
                    <div key={m.id} style={{ padding:"13px 15px", borderRadius:14, background:m.pinned?"rgba(240,180,106,0.06)":"rgba(255,255,255,0.04)", border:`1px solid ${m.pinned?"rgba(240,180,106,0.18)":"rgba(255,255,255,0.07)"}`, borderLeft:m.pinned?"2px solid #f0b46a":undefined, backdropFilter:"blur(12px)" }}>
                      <p style={{ fontSize:13, color:"rgba(255,255,255,0.82)", lineHeight:1.6, margin:0 }}>{m.content}</p>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:9 }}>
                        <span style={{ fontSize:10, color:"rgba(255,255,255,0.25)" }}>{timeAgo(new Date(m.createdAt))}</span>
                        <span style={{ fontSize:9.5, color:"rgba(255,255,255,0.22)", background:"rgba(255,255,255,0.05)", padding:"1px 6px", borderRadius:4, fontFamily:"monospace" }}>{m.source}</span>
                        {m.pinned && <span style={{ fontSize:10, color:"#f0b46a" }}>📌</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* IDE sections */}
          {IDE_NODES.filter(n => n.id !== "mcp").map(n => {
            if (sfNs) return null;
            if (sfIde && sfIde !== n.id) return null;
            const ideMems = memories.filter(m => n.sources.some(s => (m.source||"").toLowerCase().includes(s)));
            if (ideMems.length === 0) return null;
            return (
              <div key={n.id} style={{ marginBottom:44 }}>
                <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:16, paddingBottom:12, borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ width:26, height:26, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <img src={IDE_IMG[n.id]} alt={n.title} style={{ width:22, height:22, objectFit:"contain" }}/>
                  </div>
                  <span style={{ fontSize:11.5, fontWeight:600, color:"rgba(255,255,255,0.65)", textTransform:"uppercase", letterSpacing:"0.1em" }}>{n.title}</span>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.25)" }}>{ideMems.length}</span>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:10 }}>
                  {ideMems.map(m => (
                    <div key={m.id} style={{ padding:"13px 15px", borderRadius:14, background:m.pinned?"rgba(240,180,106,0.06)":"rgba(255,255,255,0.04)", border:`1px solid ${m.pinned?"rgba(240,180,106,0.18)":"rgba(255,255,255,0.07)"}`, backdropFilter:"blur(12px)" }}>
                      <p style={{ fontSize:13, color:"rgba(255,255,255,0.82)", lineHeight:1.6, margin:0 }}>{m.content}</p>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:9 }}>
                        <span style={{ fontSize:10, color:"rgba(255,255,255,0.25)" }}>{timeAgo(new Date(m.createdAt))}</span>
                        <span style={{ fontSize:9.5, color:"rgba(255,255,255,0.22)", background:"rgba(255,255,255,0.05)", padding:"1px 6px", borderRadius:4, fontFamily:"monospace" }}>{m.source}</span>
                        {m.pinned && <span style={{ fontSize:10, color:"#f0b46a" }}>📌</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ════ NODE MODAL ════ */}
      {selectedId && (
        <NodeModal
          nodeId={selectedId}
          memories={memories}
          userId={userId}
          onClose={() => setSelectedId(null)}
          onAddNew={() => { setSelectedId(null); setShowAddModal(true); }}
          onPin={togglePin}
          onDelete={deleteMemory}
          onSaveEdit={saveEdit}
        />
      )}

      {/* ════ ADD MODAL ════ */}
      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)}>
          <div style={{ display:"flex", alignItems:"center", marginBottom:20 }}>
            <span style={{ fontSize:19, fontWeight:600, flex:1, letterSpacing:"-0.015em" }}>Add Memory</span>
            <button onClick={() => setShowAddModal(false)} style={{ width:30, height:30, borderRadius:9, background:"rgba(255,255,255,0.05)", border:"none", color:"rgba(255,255,255,0.5)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><X size={14}/></button>
          </div>
          <textarea autoFocus value={newMemory} onChange={e => setNewMemory(e.target.value)} placeholder="What should Imprint remember?" rows={4} style={{ width:"100%", boxSizing:"border-box", resize:"none", padding:14, borderRadius:13, background:"rgba(255,255,255,0.05)", backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", fontSize:13.5, lineHeight:1.55, fontFamily:"inherit", outline:"none" }}/>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", margin:"18px 0 9px", fontWeight:500, letterSpacing:"0.04em" }}>TOPIC</div>
          <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
            {(["work","personal","preferences","projects"] as Topic[]).map(t => (
              <button key={t} onClick={() => setNewTopic(t)} style={{ flex:1, minWidth:80, height:38, borderRadius:10, fontSize:12.5, fontWeight:600, fontFamily:"inherit", cursor:"pointer", backdropFilter:"blur(8px)", background:newTopic===t?TOPIC_META[t].bg:"rgba(255,255,255,0.04)", border:`1px solid ${newTopic===t?TOPIC_META[t].color:"rgba(255,255,255,0.1)"}`, color:newTopic===t?TOPIC_META[t].color:"rgba(255,255,255,0.55)", transition:"all .15s" }}>
                {TOPIC_META[t].emoji} {TOPIC_META[t].label}
              </button>
            ))}
          </div>
          <div onClick={() => setNewPin(p => !p)} style={{ display:"flex", alignItems:"center", gap:11, marginTop:20, cursor:"pointer" }}>
            <div style={{ width:40, height:23, borderRadius:999, background:newPin?"rgba(240,180,106,0.75)":"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.08)", position:"relative", transition:"background .18s", flexShrink:0 }}>
              <div style={{ position:"absolute", top:2.5, left:newPin?19:2.5, width:16, height:16, borderRadius:999, background:"#fff", transition:"left .18s", boxShadow:"0 1px 4px rgba(0,0,0,0.45)" }}/>
            </div>
            <span style={{ fontSize:13.5, color:"rgba(255,255,255,0.7)" }}>Pin this memory</span>
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:26 }}>
            <button onClick={() => setShowAddModal(false)} style={{ height:40, padding:"0 20px", borderRadius:11, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.7)", fontSize:13.5, fontWeight:500, fontFamily:"inherit", cursor:"pointer" }}>Cancel</button>
            <button onClick={addMemory} disabled={!newMemory.trim()} style={{ height:40, padding:"0 22px", borderRadius:11, background:newMemory.trim()?"linear-gradient(145deg,#f0b46a,#b97e35)":"rgba(255,255,255,0.05)", border:"none", color:newMemory.trim()?"#1a0f08":"rgba(255,255,255,0.2)", fontSize:13.5, fontWeight:600, fontFamily:"inherit", cursor:newMemory.trim()?"pointer":"not-allowed", boxShadow:newMemory.trim()?"0 4px 20px rgba(240,180,106,0.35)":"none" }}>Save Memory</button>
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
          <textarea autoFocus value={importText} onChange={e => setImportText(e.target.value)} placeholder="Paste notes, context, chat logs…" rows={6} style={{ width:"100%", boxSizing:"border-box", resize:"none", padding:14, borderRadius:13, background:"rgba(255,255,255,0.05)", backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", fontSize:12.5, lineHeight:1.55, fontFamily:"inherit", outline:"none" }}/>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
            <button onClick={() => setShowImport(false)} style={{ height:40, padding:"0 20px", borderRadius:11, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.7)", fontSize:13.5, fontWeight:500, fontFamily:"inherit", cursor:"pointer" }}>Cancel</button>
            <button onClick={runImport} disabled={!importText.trim()||importing} style={{ height:40, padding:"0 22px", borderRadius:11, background:importText.trim()?"linear-gradient(145deg,#f0b46a,#b97e35)":"rgba(255,255,255,0.05)", border:"none", color:importText.trim()?"#1a0f08":"rgba(255,255,255,0.2)", fontSize:13.5, fontWeight:600, fontFamily:"inherit", cursor:importText.trim()?"pointer":"not-allowed", display:"flex", alignItems:"center", gap:7, boxShadow:importText.trim()?"0 4px 20px rgba(240,180,106,0.35)":"none" }}>
              {importing ? <><RefreshCw size={13} style={{ animation:"spin 0.8s linear infinite" }}/>Importing…</> : "Import"}
            </button>
          </div>
        </Modal>
      )}

      {/* ════ DELETE ALL ════ */}
      {deleteConfirm && (
        <div onClick={() => setDeleteConfirm(false)} style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.8)", backdropFilter:"blur(8px)", padding:24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width:390, maxWidth:"100%", borderRadius:22, background:"rgba(255,255,255,0.10)", backdropFilter:"blur(52px) saturate(2.2) brightness(1.06)", border:"1px solid rgba(255,255,255,0.26)", boxShadow:`${INSET_SHINE}, 0 40px 80px rgba(0,0,0,0.75)`, padding:28, textAlign:"center" }}>
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
