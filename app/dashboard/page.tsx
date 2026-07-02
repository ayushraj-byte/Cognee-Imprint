"use client";

import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Pin, Trash2, Edit3, X, Plus, Download, Upload, Search, LogOut, RefreshCw, Link2, ChevronDown, ChevronRight, FolderPlus, Tag, Camera, Check } from "lucide-react";
import ImprintLogo from "@/app/components/ImprintLogo";
import BackgroundVideo from "@/app/components/BackgroundVideo";

type Topic = "work" | "personal" | "preferences" | "projects" | "health" | "relationships" | "general";
interface Memory { id: string; content: string; topic: Topic; pinned: boolean; createdAt: Date; source: string; tags?: string[]; contradicts?: string[]; conflictReasons?: Record<string, string>; }
interface CustomProject { id: string; name: string; color: string; }
const PROJECT_COLORS = ["#60a5fa","#f472b6","#34d399","#fb923c","#a78bfa","#38bdf8","#e879f9","#fbbf24"];

const MAP_W = 1440, MAP_H = 900;
const HUB = { x: 720, y: 450, r: 110 };

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
  { id:"cc",  title:"Claude Code",  sub:"94 tagged", color:"#22d3ee", cx:192, cy:152, sources:["claude-code","claude_code","claudecode","cc","stop-hook","extract-and-save","imprint"] },
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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return "Good Morning";
  if (h >= 12 && h < 17) return "Good Afternoon";
  return "Good Evening";
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

  const tipRef = useRef<HTMLDivElement>(null);
  const [xShift, setXShift] = useState(0);
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    const { left, right } = el.getBoundingClientRect();
    if (left < 8) setXShift(8 - left);
    else if (right > window.innerWidth - 8) setXShift(window.innerWidth - 8 - right);
  }, []);

  return (
    <div ref={tipRef} style={{
      position: "absolute",
      ...(side === "right" ? { left: "calc(100% + 14px)" } : { right: "calc(100% + 14px)", left: "auto" }),
      top: "50%", transform: `translateY(-50%) translateX(${xShift}px)`,
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

// Time buckets for the node modal's memory list — newest-first, collapsible.
const TIME_BUCKETS: { key: string; label: string; maxH: number }[] = [
  { key:"h1",  label:"Past hour",        maxH: 1 },
  { key:"h12", label:"1–12 hours ago",   maxH: 12 },
  { key:"h24", label:"12–24 hours ago",  maxH: 24 },
  { key:"d7",  label:"1–7 days ago",     maxH: 24 * 7 },
  { key:"d30", label:"1–4 weeks ago",    maxH: 24 * 30 },
  { key:"m3",  label:"1–3 months ago",   maxH: 24 * 90 },
  { key:"m6",  label:"3–6 months ago",   maxH: 24 * 180 },
  { key:"y1",  label:"6–12 months ago",  maxH: 24 * 365 },
  { key:"old", label:"Over a year ago",  maxH: Infinity },
];
function bucketOf(createdAt: string | Date): string {
  const ageH = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  return (TIME_BUCKETS.find(b => ageH < b.maxH) ?? TIME_BUCKETS[TIME_BUCKETS.length - 1]).key;
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
  const [openBuckets, setOpenBuckets] = useState<Set<string> | null>(null);

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

  // Group the (filtered) memories into collapsible time buckets, newest-first.
  const createdOf = (m: Memory) => (m as any)._raw?.createdAt ?? m.createdAt;
  const timeGroups = (() => {
    const sorted = [...filtered].sort((a, b) => new Date(createdOf(b)).getTime() - new Date(createdOf(a)).getTime());
    return TIME_BUCKETS
      .map(b => ({ ...b, items: sorted.filter(m => bucketOf(createdOf(m)) === b.key) }))
      .filter(g => g.items.length);
  })();
  // First non-empty bucket is open by default; once the user toggles, their set wins.
  const defaultOpen = new Set(timeGroups.slice(0, 1).map(g => g.key));
  const effectiveOpen = openBuckets ?? defaultOpen;
  const isBucketOpen = (k: string) => !!search || effectiveOpen.has(k); // searching expands all
  const toggleBucket = (k: string) => setOpenBuckets(prev => {
    const next = new Set(prev ?? defaultOpen);
    next.has(k) ? next.delete(k) : next.add(k);
    return next;
  });

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
                  <div style={{ fontSize:13.5, color:"rgba(255,255,255,0.2)" }}>{search ? "No matches found" : (ide ? "No memories synced yet" : `No ${node.title} memories yet`)}</div>
                  <button onClick={onAddNew} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>Add the first memory →</button>
                </div>
              )}
              {timeGroups.map(g => (
                <div key={g.key} style={{ display:"flex", flexDirection:"column", gap:7 }}>
                  <button onClick={() => toggleBucket(g.key)} style={{ display:"flex", alignItems:"center", gap:7, width:"100%", boxSizing:"border-box", padding:"7px 8px", marginTop:2, borderRadius:8, background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", color:"rgba(255,255,255,0.55)" }}>
                    {isBucketOpen(g.key) ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
                    <span style={{ fontSize:11.5, fontWeight:600, letterSpacing:"0.02em" }}>{g.label}</span>
                    <span style={{ marginLeft:"auto", fontSize:10.5, color:"rgba(255,255,255,0.32)", background:"rgba(255,255,255,0.06)", padding:"1px 7px", borderRadius:999 }}>{g.items.length}</span>
                  </button>
                  {isBucketOpen(g.key) && g.items.map(mem => {
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
                          {(mem.contradicts?.length || 0) > 0 && <span title="Conflicts with another memory" style={{ fontSize:9.5, color:"#f87171", background:"rgba(248,113,113,0.12)", padding:"2px 7px", borderRadius:5, fontWeight:600 }}>⚠ conflict</span>}
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
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════ Quick Tag Modal ════ */
function QuickTagModal({ projects, memories, onClose, onTag }: {
  projects: CustomProject[]; memories: Memory[];
  onClose: () => void; onTag: (memId: string, projectId: string, add: boolean) => void;
}) {
  const [selected, setSelected]   = useState<CustomProject | null>(null);
  const [search,   setSearch]     = useState("");
  const [pending,  setPending]    = useState<Set<string>>(new Set());

  const displayed = memories.filter(m =>
    !search || m.content.toLowerCase().includes(search.toLowerCase())
  );

  async function toggle(m: Memory) {
    if (!selected || pending.has(m.id)) return;
    setPending(p => new Set([...p, m.id]));
    await onTag(m.id, selected.id, !m.tags?.includes(selected.id));
    setPending(p => { const n = new Set(p); n.delete(m.id); return n; });
  }

  const taggedCount = selected ? memories.filter(m => m.tags?.includes(selected.id)).length : 0;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, zIndex:210, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(14px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"Inter,-apple-system,sans-serif" }}>
      <div style={{ width:"100%", maxWidth:820, maxHeight:"85vh", borderRadius:24, background:"rgba(255,255,255,0.09)", backdropFilter:"blur(60px) saturate(2.4)", WebkitBackdropFilter:"blur(60px) saturate(2.4)", border:"1px solid rgba(255,255,255,0.18)", boxShadow:"inset 0 1.5px 0 rgba(255,255,255,0.65), 0 40px 100px rgba(0,0,0,0.7)", display:"flex", flexDirection:"column", overflow:"hidden", animation:"modalSpring 0.28s cubic-bezier(0.34,1.56,0.64,1) both" }}>

        {/* Header */}
        <div style={{ padding:"18px 22px 14px", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", gap:10 }}>
          <Tag size={16} style={{ color:"rgba(255,255,255,0.5)" }} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:17, fontWeight:700, color:"rgba(255,255,255,0.95)", letterSpacing:"-0.02em" }}>Quick Tag</div>
            <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.3)", marginTop:1 }}>
              {selected ? `${taggedCount} memories tagged with #${selected.name}` : "Select a project to tag memories"}
            </div>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:10, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.5)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><X size={15}/></button>
        </div>

        <div style={{ display:"flex", flex:1, overflow:"hidden", minHeight:0 }}>
          {/* Left — project selector */}
          <div style={{ width:210, borderRight:"1px solid rgba(255,255,255,0.07)", padding:"14px 12px", display:"flex", flexDirection:"column", gap:6, overflowY:"auto", flexShrink:0 }}>
            <div style={{ fontSize:9.5, color:"rgba(255,255,255,0.25)", fontWeight:600, letterSpacing:"0.08em", padding:"0 4px", marginBottom:4 }}>PROJECTS</div>
            {projects.length === 0 && (
              <div style={{ fontSize:12.5, color:"rgba(255,255,255,0.25)", padding:"12px 4px", lineHeight:1.6 }}>
                No projects yet. Click &ldquo;New project&rdquo; on the canvas to create one.
              </div>
            )}
            {projects.map(p => {
              const cnt = memories.filter(m => m.tags?.includes(p.id)).length;
              const active = selected?.id === p.id;
              return (
                <div key={p.id} onClick={() => setSelected(active ? null : p)}
                  style={{ padding:"10px 12px", borderRadius:11, display:"flex", alignItems:"center", gap:10, cursor:"pointer", transition:"all .15s",
                    background: active ? `${p.color}14` : "rgba(255,255,255,0.03)",
                    border:`1px solid ${active ? p.color+"44" : "rgba(255,255,255,0.07)"}` }}>
                  <div style={{ width:10, height:10, borderRadius:"50%", background:p.color, flexShrink:0, boxShadow:`0 0 8px ${p.color}` }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:active?600:400, color:active?"rgba(255,255,255,0.92)":"rgba(255,255,255,0.6)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</div>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", marginTop:1 }}>{cnt} tagged</div>
                  </div>
                  {active && <div style={{ width:6, height:6, borderRadius:"50%", background:p.color, flexShrink:0 }}/>}
                </div>
              );
            })}
          </div>

          {/* Right — memory list */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>
            <div style={{ padding:"12px 16px 10px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ position:"relative" }}>
                <Search size={13} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,0.28)", pointerEvents:"none" }}/>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search memories…" disabled={!selected}
                  style={{ width:"100%", boxSizing:"border-box", height:34, padding:"0 10px 0 30px", borderRadius:10, background:selected?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.09)", color:"rgba(255,255,255,0.82)", fontSize:12.5, outline:"none", fontFamily:"inherit", opacity:selected?1:0.4 }}/>
              </div>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"8px 12px", display:"flex", flexDirection:"column", gap:6 }}>
              {!selected ? (
                <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, padding:40 }}>
                  <div style={{ fontSize:24 }}>&#8592;</div>
                  <div style={{ fontSize:13.5, color:"rgba(255,255,255,0.2)" }}>Select a project first</div>
                </div>
              ) : displayed.length === 0 ? (
                <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.2)", fontSize:14 }}>No memories match</div>
              ) : displayed.map(m => {
                const isTagged = !!m.tags?.includes(selected.id);
                const isBusy   = pending.has(m.id);
                return (
                  <div key={m.id} onClick={() => toggle(m)}
                    style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"11px 12px", borderRadius:12, cursor:isBusy?"wait":"pointer", transition:"all .15s",
                      background: isTagged ? `${selected.color}0d` : "rgba(255,255,255,0.03)",
                      border:`1px solid ${isTagged ? selected.color+"44" : "rgba(255,255,255,0.07)"}`,
                      borderLeft: isTagged ? `2.5px solid ${selected.color}` : "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ width:20, height:20, borderRadius:6, flexShrink:0, marginTop:1,
                      background: isTagged ? selected.color : "rgba(255,255,255,0.06)",
                      border:`1.5px solid ${isTagged ? selected.color : "rgba(255,255,255,0.16)"}`,
                      display:"flex", alignItems:"center", justifyContent:"center", transition:"all .18s" }}>
                      {isTagged && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, color:"rgba(255,255,255,0.82)", lineHeight:1.5 }}>{m.content}</div>
                      <div style={{ display:"flex", gap:6, marginTop:5 }}>
                        <span style={{ fontSize:10, color:"rgba(255,255,255,0.25)", background:"rgba(255,255,255,0.05)", padding:"2px 7px", borderRadius:4 }}>{m.topic}</span>
                        {isTagged && <span style={{ fontSize:10, fontWeight:600, color:selected.color }}>#{selected.name}</span>}
                      </div>
                    </div>
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

/* ════ Project Manager Modal — NodeModal-style two-panel layout ════ */
function ProjectManagerModal({ project, memories, onClose, onAddNew, onTag }: {
  project: CustomProject; memories: Memory[];
  onClose: () => void; onAddNew: () => void; onTag: (memId: string, add: boolean) => void;
}) {
  const [filter, setFilter]   = useState<"all"|"tagged"|"untagged"|"recent">("all");
  const [search, setSearch]   = useState("");
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [showIde, setShowIde] = useState(false);
  const [copied,  setCopied]  = useState(false);
  const [autoSync, setAutoSync]   = useState(true);
  const [tagInject, setTagInject] = useState(false);

  const tagged   = memories.filter(m => m.tags?.includes(project.id));
  const pinned   = tagged.filter(m => m.pinned).length;
  const decaying = tagged.filter(m => !m.pinned && (Date.now() - new Date(m.createdAt).getTime()) / 86400000 > 23).length;

  const displayed = memories
    .filter(m => {
      if (filter === "tagged")   return !!m.tags?.includes(project.id);
      if (filter === "untagged") return !m.tags?.includes(project.id);
      return true;
    })
    .filter(m => !search || m.content.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => filter === "recent"
      ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      : (b.tags?.includes(project.id) ? 1 : 0) - (a.tags?.includes(project.id) ? 1 : 0));

  async function toggleTag(m: Memory) {
    if (pending.has(m.id)) return;
    setPending(p => new Set([...p, m.id]));
    await onTag(m.id, !m.tags?.includes(project.id));
    setPending(p => { const n = new Set(p); n.delete(m.id); return n; });
  }

  const claudeMd = `## Imprint Project: ${project.name}\nWhen saving memories in this project, include "project:${project.name}" in the content, or tell Claude:\n"Tag this as project:${project.name}"`;
  async function copy() {
    await navigator.clipboard.writeText(claudeMd).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  }

  const MODAL_GLASS = `inset 0 1.5px 0 rgba(255,255,255,0.65), inset 1px 0 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.30), 0 40px 100px rgba(0,0,0,0.7), 0 0 60px ${project.color}18`;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(14px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ width:"100%", maxWidth:940, maxHeight:"88vh", borderRadius:28, background:"rgba(255,255,255,0.09)", backdropFilter:"blur(60px) saturate(2.4) brightness(1.06)", WebkitBackdropFilter:"blur(60px) saturate(2.4) brightness(1.06)", border:`1px solid rgba(255,255,255,0.18)`, boxShadow:MODAL_GLASS, display:"flex", flexDirection:"column", overflow:"hidden", animation:"modalSpring 0.32s cubic-bezier(0.34,1.56,0.64,1) both", position:"relative" }}>

        {/* glass rim */}
        <div style={{ position:"absolute", inset:-1, borderRadius:28, padding:"1.2px", background:"linear-gradient(145deg,rgba(255,255,255,0.70) 0%,rgba(255,255,255,0.25) 18%,rgba(255,255,255,0) 45%,rgba(255,255,255,0) 55%,rgba(255,255,255,0.12) 80%,rgba(255,255,255,0.45) 100%)", WebkitMask:"linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0)", WebkitMaskComposite:"xor", maskComposite:"exclude", pointerEvents:"none", zIndex:1 }}/>

        {/* ── Header ── */}
        <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
          <div style={{ width:50, height:50, borderRadius:15, background:`${project.color}18`, border:`1px solid ${project.color}44`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:INSET_SHINE }}>
            <div style={{ width:18, height:18, borderRadius:"50%", background:project.color, boxShadow:`0 0 14px ${project.color}` }}/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:19, fontWeight:700, letterSpacing:"-0.02em", color:"rgba(255,255,255,0.96)" }}>{project.name}</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.38)", marginTop:2 }}>{tagged.length} memories · project tag</div>
          </div>
          <button onClick={onClose} style={{ width:34, height:34, borderRadius:10, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.5)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><X size={16}/></button>
        </div>

        {/* ── Body ── */}
        <div style={{ display:"flex", flex:1, overflow:"hidden", minHeight:0 }}>

          {/* Left panel */}
          <div style={{ width:248, borderRight:"1px solid rgba(255,255,255,0.07)", padding:"18px", display:"flex", flexDirection:"column", gap:18, overflowY:"auto", flexShrink:0 }}>

            {/* Overview */}
            <div>
              <div style={{ fontSize:9.5, color:"rgba(255,255,255,0.28)", fontWeight:600, letterSpacing:"0.08em", marginBottom:10 }}>OVERVIEW</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[
                  { v: tagged.length,   l: "memories" },
                  { v: pinned,          l: "pinned"   },
                  { v: decaying,        l: "decaying" },
                  { v: memories.length, l: "total"    },
                ].map((s, i) => (
                  <div key={i} style={{ padding:"10px 12px", borderRadius:12, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)", backdropFilter:"blur(8px)" }}>
                    <div style={{ fontSize:21, fontWeight:700, color:"rgba(255,255,255,0.82)", letterSpacing:"-0.025em", lineHeight:1 }}>{s.v}</div>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.28)", marginTop:3 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Configuration */}
            <div>
              <div style={{ fontSize:9.5, color:"rgba(255,255,255,0.28)", fontWeight:600, letterSpacing:"0.08em", marginBottom:10 }}>CONFIGURATION</div>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                {[
                  { label:"Auto-sync",     val:autoSync,   set:setAutoSync   },
                  { label:"Tag injection", val:tagInject,  set:setTagInject  },
                ].map((row, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px", borderRadius:11, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", cursor:"pointer" }} onClick={() => row.set((v: boolean) => !v)}>
                    <span style={{ fontSize:12.5, color:"rgba(255,255,255,0.55)" }}>{row.label}</span>
                    <div style={{ width:38, height:21, borderRadius:999, background:row.val?"rgba(255,255,255,0.22)":"rgba(255,255,255,0.08)", border:`1px solid ${row.val?"rgba(255,255,255,0.28)":"rgba(255,255,255,0.12)"}`, position:"relative", transition:"background .2s,border-color .2s", flexShrink:0 }}>
                      <div style={{ position:"absolute", top:2.5, left:row.val?18:2.5, width:14, height:14, borderRadius:999, background:"#fff", transition:"left .18s", boxShadow:"0 1px 3px rgba(0,0,0,0.3)" }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <div style={{ fontSize:9.5, color:"rgba(255,255,255,0.28)", fontWeight:600, letterSpacing:"0.08em", marginBottom:10 }}>ACTIONS</div>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                <button onClick={onAddNew} style={{ width:"100%", height:36, borderRadius:10, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.7)", fontSize:12.5, fontWeight:500, fontFamily:"inherit", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
                  <Plus size={14}/> Add Memory
                </button>
                <button onClick={() => setShowIde(v => !v)} style={{ width:"100%", height:36, borderRadius:10, background:showIde?`${project.color}14`:"rgba(255,255,255,0.05)", border:`1px solid ${showIde?project.color+"44":"rgba(255,255,255,0.1)"}`, color:showIde?project.color:"rgba(255,255,255,0.6)", fontSize:12.5, fontWeight:500, fontFamily:"inherit", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
                  <Link2 size={14}/> IDE Command
                </button>
              </div>
            </div>

            {/* IDE snippet — expands in panel */}
            {showIde && (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ fontSize:9.5, color:"rgba(255,255,255,0.28)", fontWeight:600, letterSpacing:"0.08em" }}>CLAUDE.md SNIPPET</div>
                <div style={{ position:"relative" }}>
                  <pre style={{ margin:0, padding:"11px 44px 11px 11px", borderRadius:10, background:"rgba(0,0,0,0.4)", border:`1px solid ${project.color}22`, fontSize:10, fontFamily:"'JetBrains Mono','Fira Mono',monospace", lineHeight:1.7, color:"rgba(255,255,255,0.65)", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
                    {claudeMd}
                  </pre>
                  <button onClick={copy} style={{ position:"absolute", top:7, right:7, height:22, padding:"0 8px", borderRadius:6, background:copied?`${project.color}20`:"rgba(255,255,255,0.06)", border:`1px solid ${copied?project.color+"55":"rgba(255,255,255,0.1)"}`, color:copied?project.color:"rgba(255,255,255,0.45)", fontSize:9.5, fontWeight:600, fontFamily:"inherit", cursor:"pointer", transition:"all .2s" }}>
                    {copied ? "✓" : "Copy"}
                  </button>
                </div>
                <div style={{ fontSize:10.5, color:"rgba(255,255,255,0.28)", lineHeight:1.55 }}>
                  Or tell Claude: <span style={{ color:"rgba(255,255,255,0.5)" }}>"Tag this as project:{project.name}"</span>
                </div>
              </div>
            )}
          </div>

          {/* Right panel — memory list */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>
            <div style={{ padding:"14px 18px 10px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
              <div style={{ position:"relative", marginBottom:10 }}>
                <Search size={13} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,0.28)", pointerEvents:"none" }}/>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${project.name} memories…`}
                  style={{ width:"100%", boxSizing:"border-box", height:34, padding:"0 10px 0 30px", borderRadius:10, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", color:"rgba(255,255,255,0.82)", fontSize:12.5, outline:"none", fontFamily:"inherit" }}/>
              </div>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                {(["all","tagged","untagged","recent"] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{ height:27, padding:"0 13px", borderRadius:8, background:filter===f?"rgba(255,255,255,0.1)":"transparent", border:`1px solid ${filter===f?"rgba(255,255,255,0.22)":"rgba(255,255,255,0.08)"}`, color:filter===f?"rgba(255,255,255,0.92)":"rgba(255,255,255,0.38)", fontSize:11.5, fontWeight:filter===f?600:400, fontFamily:"inherit", cursor:"pointer", transition:"all .15s", textTransform:"capitalize" }}>
                    {f}
                  </button>
                ))}
                <span style={{ marginLeft:"auto", fontSize:11, color:"rgba(255,255,255,0.22)", alignSelf:"center" }}>{displayed.length} / {memories.length}</span>
              </div>
            </div>

            <div style={{ flex:1, overflowY:"auto", padding:"10px 14px", display:"flex", flexDirection:"column", gap:7 }}>
              {displayed.length === 0 && (
                <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:48, gap:12 }}>
                  <div style={{ fontSize:13.5, color:"rgba(255,255,255,0.2)" }}>{search ? "No matches found" : "No memories yet"}</div>
                  <button onClick={onAddNew} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>Add the first memory →</button>
                </div>
              )}
              {displayed.map(m => {
                const isTagged = !!m.tags?.includes(project.id);
                const isBusy = pending.has(m.id);
                return (
                  <div key={m.id} className="mem-card"
                    style={{ position:"relative", padding:"12px 14px", borderRadius:13, display:"flex", alignItems:"flex-start", gap:12,
                      background: isTagged ? `${project.color}0c` : "rgba(255,255,255,0.04)",
                      border:`1px solid ${isTagged ? project.color+"44" : "rgba(255,255,255,0.08)"}`,
                      borderLeft: isTagged ? `2.5px solid ${project.color}` : "1px solid rgba(255,255,255,0.08)",
                      backdropFilter:"blur(8px)", transition:"background .15s,border-color .15s" }}>
                    {/* Checkbox */}
                    <button onClick={() => toggleTag(m)} disabled={isBusy}
                      title={isTagged ? `Remove from ${project.name}` : `Add to ${project.name}`}
                      style={{ width:22, height:22, borderRadius:7, flexShrink:0, marginTop:1,
                        background: isTagged ? project.color : "rgba(255,255,255,0.07)",
                        border:`1.5px solid ${isTagged ? project.color : "rgba(255,255,255,0.18)"}`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        cursor: isBusy ? "wait" : "pointer", transition:"all .18s", padding:0 }}>
                      {isTagged && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </button>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, color:"rgba(255,255,255,0.83)", lineHeight:1.5 }}>{m.content}</div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6 }}>
                        <span style={{ fontSize:10, color:"rgba(255,255,255,0.22)" }}>{new Date(m.createdAt).toLocaleDateString()}</span>
                        <span style={{ fontSize:9.5, fontFamily:"'JetBrains Mono',monospace", color:"rgba(255,255,255,0.28)", background:"rgba(255,255,255,0.05)", padding:"2px 7px", borderRadius:5 }}>{m.source}</span>
                        {m.pinned && <span style={{ fontSize:10, color:"#f0b46a" }}>📌</span>}
                        {isTagged && <span style={{ fontSize:10, fontWeight:600, color:project.color }}>#{project.name}</span>}
                      </div>
                    </div>
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

/* ════ Connect IDE config tabs ════ */
interface ConnectTab { id: string; name: string; color: string; platform: string; configFile: string; pathParts: string[]; format?: "json" | "toml"; manual?: boolean; }
const CONNECT_TABS: ConnectTab[] = [
  { id:"cc",  name:"Claude Code",  color:"#22d3ee", platform:"claude-code",  configFile:"~/.claude.json",                  pathParts:[".claude.json"] },
  { id:"cur", name:"Cursor",       color:"#6ee7b7", platform:"cursor",        configFile:"~/.cursor/mcp.json",              pathParts:[".cursor","mcp.json"] },
  { id:"cod", name:"Codex",        color:"#818cf8", platform:"codex",         configFile:"~/.codex/config.toml",            pathParts:[".codex","config.toml"], format:"toml" },
  { id:"ag",  name:"Antigravity",  color:"#c084fc", platform:"antigravity",   configFile:"~/.gemini/config/mcp_config.json", pathParts:[".gemini","config","mcp_config.json"] },
  { id:"oth", name:"Other IDE",    color:"#9ca3af", platform:"custom",        configFile:"your IDE's MCP config file",       pathParts:[], manual:true },
];

// Raw URLs of the committed installer/uninstaller scripts. The dashboard no longer
// inlines the install logic as a `node -e "..."` wall of code — that form is fragile
// across shells (most infamously zsh history-expands the "!" in `if(!f.existsSync…)`
// and aborts with "event not found" on a default macOS terminal). Instead we emit a
// tiny bootstrap that downloads the committed script to a temp file and runs it with
// node. The bootstrap contains no "!", no inner quotes, and no $HOME/%USERPROFILE%
// differences, so it behaves identically in zsh, bash, PowerShell and cmd.exe.
const RAW_BASE = "https://raw.githubusercontent.com/ayushraj-byte/Cognee-Imprint/main/mcp";

// Build the bootstrap one-liner. `scriptUrl` is fetched to os.tmpdir() then executed
// with `args` appended. `args` is rendered as JS string literals (e.g. "'cursor'").
function makeBootstrap(scriptUrl: string, tmpName: string, args: string[]): string {
  const argList = args.join(",");
  return (
    `node -e "` +
    `const https=require('https'),os=require('os'),p=require('path'),f=require('fs'),cp=require('child_process');` +
    `const dst=p.join(os.tmpdir(),'${tmpName}');` +
    `https.get('${scriptUrl}',res=>{` +
    `if((res.statusCode===200)===false){console.error('Download failed: HTTP '+res.statusCode);process.exit(1);}` +
    `const w=f.createWriteStream(dst);res.pipe(w);` +
    `w.on('close',()=>cp.execFileSync(process.execPath,[dst,${argList}],{stdio:'inherit'}));` +
    `}).on('error',e=>{console.error('Download failed: '+e.message);process.exit(1);});"`
  );
}

// Auto-configure: download + run mcp/install.js with <platform> <uid> <format> <pathSegs…>.
function makeAutoScript(pathParts: string[], uid: string, platform: string, format: "json" | "toml" = "json"): string {
  const segs = pathParts.map(seg => `'${seg}'`);
  return makeBootstrap(`${RAW_BASE}/install.cjs`, "imprint-install.cjs",
    [`'${platform}'`, `'${uid}'`, `'${format}'`, ...segs]);
}

// Uninstall: download + run mcp/uninstall.js with <format> <pathSegs…>.
function makeRemoveScript(pathParts: string[], format: "json" | "toml" = "json"): string {
  const segs = pathParts.map(seg => `'${seg}'`);
  return makeBootstrap(`${RAW_BASE}/uninstall.cjs`, "imprint-uninstall.cjs",
    [`'${format}'`, ...segs]);
}

// Delete the cloned ~/Cognee-Imprint files (cross-platform, no rm/rmdir shell differences).
const REMOVE_FOLDER_CMD = `node -e "const o=require('os'),p=require('path'),f=require('fs');const d=p.join(o.homedir(),'Cognee-Imprint');f.rmSync(d,{recursive:true,force:true});console.log('Deleted '+d);"`;

// Portable clone + install: a node one-liner (node is required anyway) that
// works identically in bash, zsh, PowerShell and cmd.exe — no $HOME/%USERPROFILE%
// shell differences. Clones into ~/Cognee-Imprint to match the auto-configure path.
const INSTALL_CMD = `node -e "const{execSync}=require('child_process'),o=require('os'),p=require('path'),f=require('fs');const d=p.join(o.homedir(),'Cognee-Imprint');if(f.existsSync(d)===false){process.chdir(o.homedir());execSync('git clone https://github.com/ayushraj-byte/Cognee-Imprint Cognee-Imprint',{stdio:'inherit'});}execSync('npm install',{cwd:p.join(d,'mcp'),stdio:'inherit'});console.log('Done. Cognee-Imprint cloned to '+d);"`;

function ConnectIDEModal({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const [tab, setTab] = useState<number>(0);
  const [copied, setCopied] = useState<string | null>(null);
  const ct = CONNECT_TABS[tab];
  const uid = userId || "your-user-id";

  const autoScript = ct.pathParts.length ? makeAutoScript(ct.pathParts, uid, ct.platform, ct.format) : "";
  const removeScript = ct.pathParts.length ? makeRemoveScript(ct.pathParts, ct.format) : "";

  // Generic config for any other MCP-capable IDE (paste into its config file manually)
  const manualCfg = JSON.stringify(
    { mcpServers: { imprint: {
      command: "node",
      args: ["/ABSOLUTE/PATH/TO/Cognee-Imprint/mcp/server.js"],
      env: { IMPRINT_USER_ID: uid, IMPRINT_API_BASE: "http://localhost:3000", IMPRINT_PLATFORM: "custom" },
    } } },
    null, 2
  );

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2500);
  }

  const MODAL_SHADOW = `inset 0 1.5px 0 rgba(255,255,255,0.65),inset 1px 0 0 rgba(255,255,255,0.22),inset 0 -1px 0 rgba(0,0,0,0.28),0 40px 100px rgba(0,0,0,0.7),0 0 60px ${ct.color}18`;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(14px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ width:"100%", maxWidth:660, borderRadius:28, background:"rgba(255,255,255,0.09)", backdropFilter:"blur(60px) saturate(2.4) brightness(1.06)", WebkitBackdropFilter:"blur(60px) saturate(2.4) brightness(1.06)", border:"1px solid rgba(255,255,255,0.18)", boxShadow:MODAL_SHADOW, overflow:"hidden", animation:"modalSpring 0.32s cubic-bezier(0.34,1.56,0.64,1) both", position:"relative" }}>

        {/* glass rim */}
        <div style={{ position:"absolute", inset:-1, borderRadius:28, padding:"1.2px", background:"linear-gradient(145deg,rgba(255,255,255,0.70) 0%,rgba(255,255,255,0.25) 18%,rgba(255,255,255,0) 45%,rgba(255,255,255,0) 55%,rgba(255,255,255,0.12) 80%,rgba(255,255,255,0.45) 100%)", WebkitMask:"linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0)", WebkitMaskComposite:"xor", maskComposite:"exclude", pointerEvents:"none", zIndex:1 }}/>

        {/* Header */}
        <div style={{ padding:"22px 24px 0", display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:20, fontWeight:700, color:"rgba(255,255,255,0.96)", letterSpacing:"-0.022em" }}>Connect your IDE</div>
            <div style={{ fontSize:12.5, color:"rgba(255,255,255,0.34)", marginTop:3 }}>Your user ID is pre-filled — copy, paste, done</div>
          </div>
          <button onClick={onClose} style={{ width:34, height:34, borderRadius:10, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.5)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><X size={16}/></button>
        </div>

        {/* Platform tabs */}
        <div style={{ display:"flex", padding:"16px 24px 0", borderBottom:"1px solid rgba(255,255,255,0.07)", overflowX:"auto", gap:0 }}>
          {CONNECT_TABS.map((t, i) => (
            <button key={t.id} onClick={() => setTab(i)}
              style={{ padding:"10px 16px", background:"transparent", border:"none", borderBottom:`2.5px solid ${tab===i ? t.color : "transparent"}`, color:tab===i ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.38)", fontSize:13, fontWeight:tab===i ? 600 : 400, fontFamily:"inherit", cursor:"pointer", transition:"all .18s", whiteSpace:"nowrap", flexShrink:0 }}>
              {t.name}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding:"22px 24px 24px", display:"flex", flexDirection:"column", gap:18, maxHeight:"calc(100vh - 150px)", overflowY:"auto" }}>

          {/* Step 1: Install */}
          <div>
            <div style={{ fontSize:10.5, color:"rgba(255,255,255,0.28)", fontWeight:700, letterSpacing:"0.09em", marginBottom:9 }}>STEP 1 — INSTALL MCP SERVER <span style={{ color:"rgba(255,255,255,0.18)", fontWeight:400 }}>(skip if already done)</span></div>
            <div style={{ position:"relative" }}>
              <pre style={{ margin:0, padding:"12px 50px 12px 14px", borderRadius:11, background:"rgba(0,0,0,0.4)", border:"1px solid rgba(255,255,255,0.07)", fontSize:12, fontFamily:"'JetBrains Mono','Fira Mono',monospace", lineHeight:1.75, color:"rgba(255,255,255,0.65)", whiteSpace:"pre", overflowX:"auto" }}>
                {INSTALL_CMD}
              </pre>
              <button onClick={() => copy(INSTALL_CMD, "install")} style={{ position:"absolute", top:8, right:8, height:26, padding:"0 11px", borderRadius:7, background:copied==="install"?"rgba(94,234,212,0.15)":"rgba(255,255,255,0.06)", border:`1px solid ${copied==="install"?"rgba(94,234,212,0.4)":"rgba(255,255,255,0.1)"}`, color:copied==="install"?"#5EEAD4":"rgba(255,255,255,0.45)", fontSize:10.5, fontWeight:600, fontFamily:"inherit", cursor:"pointer", transition:"all .2s" }}>
                {copied==="install" ? "✓" : "Copy"}
              </button>
            </div>
          </div>

          {/* Step 2 */}
          {ct.pathParts.length ? (
            <div>
              <div style={{ fontSize:10.5, color:"rgba(255,255,255,0.28)", fontWeight:700, letterSpacing:"0.09em", marginBottom:4 }}>
                STEP 2 — AUTO-CONFIGURE{" "}<span style={{ color:ct.color, fontFamily:"'JetBrains Mono',monospace", fontWeight:500 }}>{ct.configFile}</span>
              </div>
              <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.25)", marginBottom:9, lineHeight:1.45 }}>
                Run in terminal — finds the file, creates it if needed, patches it automatically.
              </div>
              <div style={{ position:"relative" }}>
                <pre style={{ margin:0, padding:"12px 50px 12px 14px", borderRadius:11, background:"rgba(0,0,0,0.4)", border:"1px solid rgba(255,255,255,0.07)", fontSize:11, fontFamily:"'JetBrains Mono','Fira Mono',monospace", lineHeight:1.75, color:"rgba(255,255,255,0.65)", whiteSpace:"pre-wrap", wordBreak:"break-all", overflowX:"auto" }}>
                  {autoScript}
                </pre>
                <button onClick={() => copy(autoScript, "config")} style={{ position:"absolute", top:8, right:8, height:26, padding:"0 11px", borderRadius:7, background:copied==="config"?"rgba(94,234,212,0.15)":"rgba(255,255,255,0.06)", border:`1px solid ${copied==="config"?"rgba(94,234,212,0.4)":"rgba(255,255,255,0.1)"}`, color:copied==="config"?"#5EEAD4":"rgba(255,255,255,0.45)", fontSize:10.5, fontWeight:600, fontFamily:"inherit", cursor:"pointer", transition:"all .2s" }}>
                  {copied==="config" ? "✓" : "Copy"}
                </button>
              </div>
              <div style={{ marginTop:8, padding:"8px 12px", borderRadius:9, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", fontSize:11, color:"rgba(255,255,255,0.28)", lineHeight:1.5 }}>
                After running, restart {ct.name}. Imprint will load your memories automatically at every session start.
              </div>
              {/* Copy all CTA */}
              <button onClick={() => copy(`${INSTALL_CMD}\n\n${autoScript}`, "all")}
                style={{ marginTop:14, width:"100%", height:42, borderRadius:13, background:copied==="all"?"rgba(94,234,212,0.15)":`${ct.color}14`, border:`1px solid ${copied==="all"?"rgba(94,234,212,0.5)":ct.color+"44"}`, color:copied==="all"?"#5EEAD4":ct.color, fontSize:13.5, fontWeight:600, fontFamily:"inherit", cursor:"pointer", transition:"all .22s", boxShadow:copied==="all"?"0 0 18px rgba(94,234,212,0.2)":`0 0 18px ${ct.color}18` }}>
                {copied==="all" ? "Copied everything ✓" : "Copy all (step 1 + step 2)"}
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize:10.5, color:"rgba(255,255,255,0.28)", fontWeight:700, letterSpacing:"0.09em", marginBottom:4 }}>STEP 2 — ADD THIS TO YOUR IDE'S MCP CONFIG</div>
              <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.25)", marginBottom:9, lineHeight:1.45 }}>
                Replace the path with your absolute path to <span style={{ fontFamily:"'JetBrains Mono',monospace", color:"rgba(255,255,255,0.4)" }}>imprint/mcp/server.js</span>. Your user ID is already filled in.
              </div>
              <div style={{ position:"relative" }}>
                <pre style={{ margin:0, padding:"12px 50px 12px 14px", borderRadius:11, background:"rgba(0,0,0,0.4)", border:"1px solid rgba(255,255,255,0.07)", fontSize:11.5, fontFamily:"'JetBrains Mono','Fira Mono',monospace", lineHeight:1.7, color:"rgba(255,255,255,0.65)", whiteSpace:"pre", overflowX:"auto" }}>
                  {manualCfg}
                </pre>
                <button onClick={() => copy(manualCfg, "config")} style={{ position:"absolute", top:8, right:8, height:26, padding:"0 11px", borderRadius:7, background:copied==="config"?"rgba(94,234,212,0.15)":"rgba(255,255,255,0.06)", border:`1px solid ${copied==="config"?"rgba(94,234,212,0.4)":"rgba(255,255,255,0.1)"}`, color:copied==="config"?"#5EEAD4":"rgba(255,255,255,0.45)", fontSize:10.5, fontWeight:600, fontFamily:"inherit", cursor:"pointer", transition:"all .2s" }}>
                  {copied==="config" ? "✓" : "Copy"}
                </button>
              </div>
              <div style={{ marginTop:8, padding:"10px 12px", borderRadius:9, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", fontSize:11, color:"rgba(255,255,255,0.3)", lineHeight:1.55 }}>
                Three config shapes cover almost every IDE:<br/>
                • <b style={{ color:"rgba(255,255,255,0.5)" }}>mcpServers</b> JSON (above) — Cursor, Windsurf, Claude, Antigravity<br/>
                • <b style={{ color:"rgba(255,255,255,0.5)" }}>servers</b> JSON — VS Code → <span style={{ fontFamily:"monospace" }}>.vscode/mcp.json</span><br/>
                • <b style={{ color:"rgba(255,255,255,0.5)" }}>[mcp_servers.x]</b> TOML — Codex → <span style={{ fontFamily:"monospace" }}>~/.codex/config.toml</span>
              </div>
            </div>
          )}

          {/* Remove / uninstall */}
          <div style={{ borderTop:"1px solid rgba(255,255,255,0.07)", paddingTop:16 }}>
            <div style={{ fontSize:10.5, color:"rgba(255,255,255,0.28)", fontWeight:700, letterSpacing:"0.09em", marginBottom:6 }}>REMOVE IMPRINT <span style={{ color:"rgba(255,255,255,0.18)", fontWeight:400 }}>(uninstall)</span></div>
            {ct.pathParts.length ? (
              <>
                <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.25)", marginBottom:9, lineHeight:1.45 }}>Deletes the Imprint entry from <span style={{ color:ct.color, fontFamily:"'JetBrains Mono',monospace" }}>{ct.configFile}</span>, then restart {ct.name}.</div>
                <div style={{ position:"relative" }}>
                  <pre style={{ margin:0, padding:"12px 50px 12px 14px", borderRadius:11, background:"rgba(0,0,0,0.4)", border:"1px solid rgba(255,255,255,0.07)", fontSize:11, fontFamily:"'JetBrains Mono','Fira Mono',monospace", lineHeight:1.75, color:"rgba(255,255,255,0.6)", whiteSpace:"pre-wrap", wordBreak:"break-all", overflowX:"auto" }}>{removeScript}</pre>
                  <button onClick={() => copy(removeScript, "remove")} style={{ position:"absolute", top:8, right:8, height:26, padding:"0 11px", borderRadius:7, background:copied==="remove"?"rgba(248,113,113,0.15)":"rgba(255,255,255,0.06)", border:`1px solid ${copied==="remove"?"rgba(248,113,113,0.4)":"rgba(255,255,255,0.1)"}`, color:copied==="remove"?"#f87171":"rgba(255,255,255,0.45)", fontSize:10.5, fontWeight:600, fontFamily:"inherit", cursor:"pointer", transition:"all .2s" }}>{copied==="remove"?"✓":"Copy"}</button>
                </div>
              </>
            ) : (
              <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.4)", lineHeight:1.5 }}>Open your IDE&apos;s MCP config and delete the <span style={{ fontFamily:"monospace", color:"rgba(255,255,255,0.6)" }}>imprint</span> entry, then restart the IDE.</div>
            )}
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", margin:"12px 0 6px" }}>Optional — also delete the cloned files (<span style={{ fontFamily:"monospace" }}>~/Cognee-Imprint</span>):</div>
            <div style={{ position:"relative" }}>
              <pre style={{ margin:0, padding:"12px 50px 12px 14px", borderRadius:11, background:"rgba(0,0,0,0.4)", border:"1px solid rgba(255,255,255,0.07)", fontSize:11, fontFamily:"'JetBrains Mono','Fira Mono',monospace", lineHeight:1.75, color:"rgba(255,255,255,0.6)", whiteSpace:"pre-wrap", wordBreak:"break-all", overflowX:"auto" }}>{REMOVE_FOLDER_CMD}</pre>
              <button onClick={() => copy(REMOVE_FOLDER_CMD, "rmfolder")} style={{ position:"absolute", top:8, right:8, height:26, padding:"0 11px", borderRadius:7, background:copied==="rmfolder"?"rgba(248,113,113,0.15)":"rgba(255,255,255,0.06)", border:`1px solid ${copied==="rmfolder"?"rgba(248,113,113,0.4)":"rgba(255,255,255,0.1)"}`, color:copied==="rmfolder"?"#f87171":"rgba(255,255,255,0.45)", fontSize:10.5, fontWeight:600, fontFamily:"inherit", cursor:"pointer", transition:"all .2s" }}>{copied==="rmfolder"?"✓":"Copy"}</button>
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

// Shared field styles for the profile dropdown.
const PROFILE_INP: React.CSSProperties = { width:"100%", boxSizing:"border-box", padding:"7px 10px", marginBottom:10, borderRadius:9, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", fontSize:12.5, outline:"none", fontFamily:"inherit" };
const PROFILE_LBL: React.CSSProperties = { display:"block", fontSize:10, color:"rgba(255,255,255,0.4)", marginBottom:4, fontWeight:600, letterSpacing:"0.04em", textTransform:"uppercase" };
const BULK_BTN: React.CSSProperties = { fontSize:12.5, fontWeight:600, color:"rgba(255,255,255,0.82)", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"6px 11px", cursor:"pointer", fontFamily:"inherit" };
// Friendly labels for the `source` a memory was captured from.
const SOURCE_LABELS: Record<string, string> = {
  "claude-code":"Claude Code", cursor:"Cursor", codex:"Codex", antigravity:"Antigravity",
  mcp:"MCP", "stop-hook":"Auto", manual:"Manual", import:"Import", chat:"Chat", web:"Web",
  "session-summary":"Session", onboarding:"Starter",
};

/* ═══════════════════════════ CONFLICTS RESOLVER ════════════════════════════ */
// Surfaces the actual conflicting PAIRS — each memory, its partner, WHY they
// conflict, and one-click resolution (keep one / mark as not-a-conflict).
function ConflictsModal({ memories, onClose, onKeep, onUnlink }: {
  memories: Memory[];
  onClose: () => void;
  onKeep: (keepId: string, dropId: string) => void;
  onUnlink: (aId: string, bId: string) => void;
}) {
  const byId = new Map(memories.map(m => [m.id, m]));
  const seen = new Set<string>();
  const pairs: { a: Memory; b: Memory; reason: string }[] = [];
  for (const m of memories) {
    for (const pid of (m.contradicts || [])) {
      const other = byId.get(pid);
      if (!other) continue;                       // partner not loaded / already deleted
      const key = [m.id, pid].sort().join("|");
      if (seen.has(key)) continue;                // each unordered pair once
      seen.add(key);
      const reason = m.conflictReasons?.[pid] || other.conflictReasons?.[m.id] || "";
      pairs.push({ a: m, b: other, reason });
    }
  }

  const memCard = (m: Memory, keepId: string, dropId: string) => {
    const tm = TOPIC_META[m.topic] || TOPIC_META.general;
    return (
      <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:9, padding:14, borderRadius:14, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
          <span style={{ fontSize:10, color:tm.color, background:tm.bg, padding:"2px 8px", borderRadius:5, fontWeight:600 }}>{tm.emoji} {tm.label}</span>
          <span style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>{timeAgo(new Date(m.createdAt))}</span>
          {m.pinned && <span style={{ fontSize:11, color:"#f0b46a" }}>📌</span>}
        </div>
        <div style={{ fontSize:13.5, lineHeight:1.45, color:"rgba(255,255,255,0.92)", flex:1 }}>{m.content}</div>
        <button onClick={() => onKeep(keepId, dropId)} style={{ alignSelf:"flex-start", fontSize:11.5, fontWeight:600, color:"#34d399", background:"rgba(52,211,153,0.12)", border:"1px solid rgba(52,211,153,0.3)", borderRadius:8, padding:"5px 12px", cursor:"pointer", fontFamily:"inherit" }}>✓ Keep this, drop the other</button>
      </div>
    );
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:120, background:"rgba(0,0,0,0.78)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:"rgba(20,20,22,0.92)", backdropFilter:"blur(52px) saturate(2) brightness(1.04)", border:"1px solid rgba(255,255,255,0.16)", borderRadius:22, width:"100%", maxWidth:680, maxHeight:"86vh", display:"flex", flexDirection:"column", boxShadow:"0 40px 90px rgba(0,0,0,0.6)", animation:"modalSpring 0.4s cubic-bezier(0.22,1,0.36,1)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"22px 26px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
          <div>
            <div style={{ fontSize:19, fontWeight:700, color:"#fff", display:"flex", alignItems:"center", gap:9 }}><span style={{ color:"#f87171" }}>⚠</span> Resolve conflicts</div>
            <div style={{ fontSize:12.5, color:"rgba(255,255,255,0.45)", marginTop:3 }}>{pairs.length ? `${pairs.length} memory pair${pairs.length === 1 ? "" : "s"} disagree with each other` : "Your memory is consistent"}</div>
          </div>
          <button onClick={onClose} style={{ fontSize:20, color:"rgba(255,255,255,0.5)", background:"none", border:"none", cursor:"pointer", lineHeight:1 }}>✕</button>
        </div>

        <div style={{ overflowY:"auto", padding:"18px 26px 24px", display:"flex", flexDirection:"column", gap:18 }}>
          {pairs.length === 0 && (
            <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.5)" }}>
              <div style={{ fontSize:42, marginBottom:10, color:"#34d399" }}>✓</div>
              <div style={{ fontSize:15, fontWeight:600, color:"rgba(255,255,255,0.8)" }}>No conflicts</div>
              <div style={{ fontSize:12.5, marginTop:4 }}>None of your memories contradict each other right now.</div>
            </div>
          )}
          {pairs.map(({ a, b, reason }) => (
            <div key={[a.id, b.id].sort().join("|")} style={{ borderRadius:16, border:"1px solid rgba(248,113,113,0.25)", background:"rgba(248,113,113,0.05)", padding:16 }}>
              <div style={{ display:"flex", gap:12, alignItems:"stretch" }}>
                {memCard(a, a.id, b.id)}
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"#f87171", letterSpacing:"0.06em" }}>VS</span>
                </div>
                {memCard(b, b.id, a.id)}
              </div>
              {reason && (
                <div style={{ marginTop:12, fontSize:12.5, lineHeight:1.5, color:"rgba(255,255,255,0.7)", background:"rgba(0,0,0,0.25)", borderRadius:10, padding:"9px 12px" }}>
                  <span style={{ color:"#f87171", fontWeight:600 }}>Why this conflicts: </span>{reason}
                </div>
              )}
              <div style={{ marginTop:12, display:"flex", justifyContent:"center" }}>
                <button onClick={() => onUnlink(a.id, b.id)} style={{ fontSize:11.5, fontWeight:500, color:"rgba(255,255,255,0.55)", background:"transparent", border:"1px solid rgba(255,255,255,0.15)", borderRadius:8, padding:"5px 14px", cursor:"pointer", fontFamily:"inherit" }}>These don&apos;t actually conflict</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════ DUPLICATES RESOLVER ═════════════════════════ */
type DupMem = { id: string; content: string; topic: string; createdAt: string; pinned: boolean };
function DuplicatesModal({ clusters, loading, onClose, onMerge }: {
  clusters: DupMem[][];
  loading: boolean;
  onClose: () => void;
  onMerge: (keepId: string, dropIds: string[]) => void;
}) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:120, background:"rgba(0,0,0,0.78)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:"rgba(20,20,22,0.92)", backdropFilter:"blur(52px) saturate(2) brightness(1.04)", border:"1px solid rgba(255,255,255,0.16)", borderRadius:22, width:"100%", maxWidth:660, maxHeight:"86vh", display:"flex", flexDirection:"column", boxShadow:"0 40px 90px rgba(0,0,0,0.6)", animation:"modalSpring 0.4s cubic-bezier(0.22,1,0.36,1)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"22px 26px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
          <div>
            <div style={{ fontSize:19, fontWeight:700, color:"#fff", display:"flex", alignItems:"center", gap:9 }}><span>🧹</span> Merge duplicates</div>
            <div style={{ fontSize:12.5, color:"rgba(255,255,255,0.45)", marginTop:3 }}>{loading ? "Scanning your memories…" : clusters.length ? `${clusters.length} group${clusters.length === 1 ? "" : "s"} of near-identical memories` : "No duplicates found"}</div>
          </div>
          <button onClick={onClose} style={{ fontSize:20, color:"rgba(255,255,255,0.5)", background:"none", border:"none", cursor:"pointer", lineHeight:1 }}>✕</button>
        </div>
        <div style={{ overflowY:"auto", padding:"18px 26px 24px", display:"flex", flexDirection:"column", gap:16 }}>
          {!loading && clusters.length === 0 && (
            <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.5)" }}>
              <div style={{ fontSize:42, marginBottom:10, color:"#34d399" }}>✓</div>
              <div style={{ fontSize:15, fontWeight:600, color:"rgba(255,255,255,0.8)" }}>No duplicates</div>
              <div style={{ fontSize:12.5, marginTop:4 }}>Your memories are all distinct.</div>
            </div>
          )}
          {clusters.map((group, gi) => {
            const tm = (t: string) => TOPIC_META[t as Topic] || TOPIC_META.general;
            return (
              <div key={gi} style={{ borderRadius:16, border:"1px solid rgba(94,234,212,0.22)", background:"rgba(94,234,212,0.04)", padding:14 }}>
                <div style={{ fontSize:11.5, fontWeight:600, color:"#5EEAD4", marginBottom:10 }}>{group.length} near-identical — keep one, drop the rest</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {group.map(m => (
                    <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 11px", borderRadius:11, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, color:"rgba(255,255,255,0.9)", lineHeight:1.45 }}>{m.content}</div>
                        <div style={{ display:"flex", alignItems:"center", gap:7, marginTop:4 }}>
                          <span style={{ fontSize:9.5, color:tm(m.topic).color, background:tm(m.topic).bg, padding:"1px 7px", borderRadius:4, fontWeight:600 }}>{tm(m.topic).label}</span>
                          <span style={{ fontSize:9.5, color:"rgba(255,255,255,0.3)" }}>{timeAgo(new Date(m.createdAt))}</span>
                          {m.pinned && <span style={{ fontSize:10, color:"#f0b46a" }}>📌</span>}
                        </div>
                      </div>
                      <button onClick={() => onMerge(m.id, group.filter(x => x.id !== m.id).map(x => x.id))} style={{ flexShrink:0, fontSize:11.5, fontWeight:600, color:"#34d399", background:"rgba(52,211,153,0.12)", border:"1px solid rgba(52,211,153,0.3)", borderRadius:8, padding:"5px 11px", cursor:"pointer", fontFamily:"inherit" }}>✓ Keep this</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════ MEMORY HEALTH (STATS) ═══════════════════════ */
function MemoryHealthModal({ memories, conflictPairs, dupGroups, dupLoading, autoClean, onToggleAutoClean, onClose, onOpenConflicts, onOpenDuplicates }: {
  memories: Memory[];
  conflictPairs: number;
  dupGroups: number;
  dupLoading: boolean;
  autoClean: boolean;
  onToggleAutoClean: () => void;
  onClose: () => void;
  onOpenConflicts: () => void;
  onOpenDuplicates: () => void;
}) {
  const total = memories.length;
  const pinned = memories.filter(m => m.pinned).length;
  const decaying = memories.filter(m => !m.pinned && (Date.now() - new Date(m.createdAt).getTime()) / 86400000 > 23).length;
  const byTopic = NS_NODES.map(n => ({ ...n, count: memories.filter(m => m.topic === n.topic).length })).sort((a, b) => b.count - a.count);
  const maxT = Math.max(1, ...byTopic.map(t => t.count));
  const Stat = ({ label, value, color }: { label: string; value: number | string; color?: string }) => (
    <div style={{ flex:1, minWidth:90, padding:"12px 14px", borderRadius:12, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ fontSize:22, fontWeight:700, color:color || "#fff" }}>{value}</div>
      <div style={{ fontSize:10.5, color:"rgba(255,255,255,0.45)", marginTop:2, fontWeight:600, letterSpacing:"0.03em" }}>{label}</div>
    </div>
  );
  return (
    <div style={{ position:"fixed", inset:0, zIndex:115, background:"rgba(0,0,0,0.78)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:"rgba(20,20,22,0.94)", backdropFilter:"blur(52px) saturate(2) brightness(1.04)", border:"1px solid rgba(255,255,255,0.16)", borderRadius:22, width:"100%", maxWidth:560, maxHeight:"86vh", display:"flex", flexDirection:"column", boxShadow:"0 40px 90px rgba(0,0,0,0.6)", animation:"modalSpring 0.4s cubic-bezier(0.22,1,0.36,1)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"22px 26px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize:19, fontWeight:700, color:"#fff", display:"flex", alignItems:"center", gap:9 }}><span>📊</span> Memory health</div>
          <button onClick={onClose} style={{ fontSize:20, color:"rgba(255,255,255,0.5)", background:"none", border:"none", cursor:"pointer", lineHeight:1 }}>✕</button>
        </div>
        <div style={{ overflowY:"auto", padding:"18px 26px 24px", display:"flex", flexDirection:"column", gap:18 }}>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <Stat label="MEMORIES" value={total} />
            <Stat label="PINNED" value={pinned} color="#f0b46a" />
            <Stat label="DECAYING" value={decaying} color={decaying ? "#fb923c" : "#fff"} />
          </div>
          <div>
            <div style={{ fontSize:10.5, fontWeight:600, letterSpacing:"0.06em", color:"rgba(255,255,255,0.35)", marginBottom:9 }}>BY TOPIC</div>
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {byTopic.map(t => (
                <div key={t.id} style={{ display:"flex", alignItems:"center", gap:9 }}>
                  <span style={{ width:88, fontSize:11.5, color:"rgba(255,255,255,0.6)", flexShrink:0 }}>{t.title}</span>
                  <div style={{ flex:1, height:8, borderRadius:5, background:"rgba(255,255,255,0.05)", overflow:"hidden" }}>
                    <div style={{ width:`${(t.count / maxT) * 100}%`, height:"100%", background:t.color, borderRadius:5, transition:"width .3s" }} />
                  </div>
                  <span style={{ width:30, textAlign:"right", fontSize:11.5, color:"rgba(255,255,255,0.5)", flexShrink:0 }}>{t.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
            <button onClick={onOpenConflicts} disabled={conflictPairs === 0} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderRadius:12, background: conflictPairs ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.04)", border:`1px solid ${conflictPairs ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.08)"}`, color:"#fff", cursor: conflictPairs ? "pointer" : "default", fontFamily:"inherit", fontSize:13.5, fontWeight:600, opacity: conflictPairs ? 1 : 0.55 }}>
              <span><span style={{ color:"#f87171" }}>⚠</span> {conflictPairs} conflict{conflictPairs === 1 ? "" : "s"}</span>
              {conflictPairs > 0 && <span style={{ fontSize:12, color:"#f87171" }}>Resolve →</span>}
            </button>
            <button onClick={onOpenDuplicates} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderRadius:12, background:"rgba(94,234,212,0.1)", border:"1px solid rgba(94,234,212,0.28)", color:"#fff", cursor:"pointer", fontFamily:"inherit", fontSize:13.5, fontWeight:600 }}>
              <span><span style={{ color:"#5EEAD4" }}>🧹</span> {dupLoading ? "Scanning duplicates…" : `${dupGroups} duplicate group${dupGroups === 1 ? "" : "s"}`}</span>
              <span style={{ fontSize:12, color:"#5EEAD4" }}>Review →</span>
            </button>
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderRadius:12, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ minWidth:0, paddingRight:12 }}>
              <div style={{ fontSize:13, fontWeight:600, color:"#fff" }}>Auto-clean on load</div>
              <div style={{ fontSize:10.5, color:"rgba(255,255,255,0.4)", marginTop:2, lineHeight:1.4 }}>Remove duplicates &amp; resolve clear conflicts automatically. Never touches pinned memories.</div>
            </div>
            <button onClick={onToggleAutoClean} title={autoClean ? "Turn off" : "Turn on"} style={{ width:42, height:24, borderRadius:999, background:autoClean ? "#34d399" : "rgba(255,255,255,0.18)", border:"none", cursor:"pointer", position:"relative", transition:"background .15s", flexShrink:0 }}>
              <span style={{ position:"absolute", top:3, left:autoClean ? 21 : 3, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left .15s" }}/>
            </button>
          </div>
        </div>
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
  const [showIntro,     setShowIntro]     = useState(false);
  const [introFading,   setIntroFading]   = useState(false);
  const [globalSearch,  setGlobalSearch]  = useState("");
  const [asking,        setAsking]        = useState(false);
  const [askAnswer,     setAskAnswer]     = useState<{ answer: string; sources: { content: string; topic: string; id: string }[] } | null>(null);
  const [dateFilter,    setDateFilter]    = useState("");
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [newMemory,     setNewMemory]     = useState("");
  const [newTopic,      setNewTopic]      = useState<Topic>("general");
  const [newPin,        setNewPin]        = useState(false);
  const [showImport,    setShowImport]    = useState(false);
  const [importText,    setImportText]    = useState("");
  const [importing,     setImporting]     = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [mapScale,      setMapScale]      = useState(0.8);
  const [configCopied,  setConfigCopied]  = useState(false);
  const [visibleCount,  setVisibleCount]  = useState(20);
  const [expandedDays,  setExpandedDays]  = useState<Set<string>>(() => new Set([new Date().toDateString()]));
  const [customProjects, setCustomProjects] = useState<CustomProject[]>([]);
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [editId,        setEditId]        = useState<string|null>(null);
  const [editText,      setEditText]      = useState("");
  const [editTopic,     setEditTopic]     = useState<Topic>("general");
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(() => new Set());
  const [showConnect,    setShowConnect]    = useState(false);
  const [managerProject, setManagerProject] = useState<CustomProject | null>(null);
  const [showQuickTag,   setShowQuickTag]   = useState(false);
  // ── Editable profile (name / avatar / age / role) ──
  const [profile,        setProfile]        = useState<{ name: string; image: string; age: string; role: string }>({ name: "", image: "", age: "", role: "" });
  const [showProfile,    setShowProfile]    = useState(false);
  const [showConflicts,  setShowConflicts]  = useState(false);
  const [showHealth,     setShowHealth]     = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [dupClusters,    setDupClusters]    = useState<DupMem[][]>([]);
  const [dupLoading,     setDupLoading]     = useState(false);
  const [autoClean,      setAutoClean]      = useState<boolean>(() => typeof window !== "undefined" && localStorage.getItem("imprint-auto-clean") !== "off");
  function toggleAutoClean() {
    setAutoClean(v => { const next = !v; try { localStorage.setItem("imprint-auto-clean", next ? "on" : "off"); } catch {} return next; });
  }
  const [editName,       setEditName]       = useState("");
  const [editImage,      setEditImage]      = useState("");
  const [editAge,        setEditAge]        = useState("");
  const [editRole,       setEditRole]       = useState("");
  const [savingProfile,  setSavingProfile]  = useState(false);
  const [avatarBroken,   setAvatarBroken]   = useState(false);
  const mapRef        = useRef<HTMLDivElement>(null);
  const lastCount     = useRef(0);
  const introStarted  = useRef(false);
  const autoCleanRan  = useRef(false);

  // ── Toasts ─────────────────────────────────────────────────────────────
  // Surface failures (and notable successes) instead of silently rolling back
  // optimistic updates. Auto-dismiss after a few seconds; click to dismiss now.
  type Toast = { id: number; msg: string; kind: "error" | "success" | "info" };
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  function pushToast(msg: string, kind: Toast["kind"] = "error") {
    const id = ++toastSeq.current;
    setToasts(t => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), kind === "error" ? 5000 : 3500);
  }
  function dismissToast(id: number) { setToasts(t => t.filter(x => x.id !== id)); }

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
      pinned: !!m.pinned, createdAt: new Date(m.createdAt), source: m.source || "chat", tags: m.tags || [],
      contradicts: m.contradicts || [], conflictReasons: m.conflictReasons || {}, _raw: m } as any;
  }
  async function loadMemories(silent = false) {
    if (!userId) return; setLoadingData(true);
    try {
      const r = await fetch(`/api/memories?userId=${encodeURIComponent(userId)}&limit=1000`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      const ms = (d.memories || []).map(mapApi); setMemories(ms); lastCount.current = ms.length;
    } catch { if (!silent) pushToast("Couldn't load your memories — check your connection."); }
    setLoadingData(false);
  }
  async function loadProjects() {
    if (!userId) return;
    try {
      const d = await (await fetch(`/api/projects?userId=${encodeURIComponent(userId)}`)).json();
      const cloud: CustomProject[] = Array.isArray(d.projects) ? d.projects : [];
      // One-time migration: lift any legacy localStorage projects into the cloud.
      if (cloud.length === 0 && typeof window !== "undefined") {
        try {
          const legacy = JSON.parse(localStorage.getItem("imprint-custom-projects") || "[]");
          if (Array.isArray(legacy) && legacy.length) {
            saveProjects(legacy);
            localStorage.removeItem("imprint-custom-projects");
            return;
          }
        } catch {}
      }
      setCustomProjects(cloud);
    } catch {}
  }
  async function loadProfile() {
    if (!userId) return;
    try {
      const d = await (await fetch(`/api/user?userId=${encodeURIComponent(userId)}`)).json();
      setProfile({ name: d.name || "", image: d.image || "", age: d.age || "", role: d.role || "" });
    } catch {}
  }
  useEffect(() => { if (isLoaded && userId) { loadMemories(); loadProjects(); loadProfile(); } }, [isLoaded, userId]);

  // Fully-automatic background cleanup, once per dashboard load: removes safe
  // duplicates and resolves clear "supersede" conflicts, then notifies. Never
  // touches pinned memories (enforced server-side).
  useEffect(() => {
    if (!isLoaded || !userId || autoCleanRan.current || !autoClean) return;
    autoCleanRan.current = true;
    (async () => {
      try {
        const r = await fetch("/api/memories/auto-clean", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId }) });
        if (!r.ok) return;
        const d = await r.json();
        const dup = d.duplicatesRemoved || 0, con = d.conflictsResolved || 0;
        if (dup + con > 0) {
          const parts: string[] = [];
          if (dup) parts.push(`${dup} duplicate${dup === 1 ? "" : "s"}`);
          if (con) parts.push(`${con} conflict${con === 1 ? "" : "s"}`);
          pushToast(`🧹 Auto-cleaned: removed ${parts.join(" + ")}.`, "success");
          loadMemories(true);
        }
      } catch { /* best-effort */ }
    })();
  }, [isLoaded, userId]);
  useEffect(() => { setVisibleCount(20); }, [scrollFilter]);

  // Effective display values: the user's saved overrides win, else the Google session.
  const displayName  = profile.name  || user?.name  || "";
  const displayImage = profile.image || user?.image || "";
  const displayEmail = user?.email || "";
  // Up to two initials, never a bare "?". Falls back to "U" so an empty session
  // still renders a clean avatar instead of a question mark.
  const initials = (() => {
    const base = (displayName || displayEmail || "").trim();
    if (!base) return "U";
    const parts = base.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return base[0].toUpperCase();
  })();

  function openProfile() {
    setEditName(profile.name || user?.name || "");
    setEditImage(profile.image || user?.image || "");
    setEditAge(profile.age || "");
    setEditRole(profile.role || "");
    setShowProfile(true);
  }

  // Resize an uploaded image to a small square and store it as a compact JPEG
  // data: URL — no blob storage needed, and it stays well under the DynamoDB limit.
  function onAvatarFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const min = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
        setEditImage(canvas.toDataURL("image/jpeg", 0.82));
        setAvatarBroken(false);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function saveProfile() {
    if (!userId) return;
    setSavingProfile(true);
    const next = { name: editName.trim(), image: editImage.trim(), age: editAge.trim(), role: editRole.trim() };
    try {
      const r = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...next }),
      });
      if (r.ok) {
        setProfile(next);
        setAvatarBroken(false);
        setShowProfile(false);
        pushToast("Profile saved.", "success");
      } else throw new Error();
    } catch { pushToast("Couldn't save your profile — try again."); }
    setSavingProfile(false);
  }

  async function copyConfig() {
    if (!userId) return;
    const snippet = JSON.stringify({
      mcpServers: {
        imprint: {
          command: "node",
          args: ["/path/to/Cognee-Imprint/mcp/server.js"],
          env: { IMPRINT_USER_ID: userId, IMPRINT_API_BASE: "http://localhost:3000" },
        },
      },
    }, null, 2);
    try {
      await navigator.clipboard.writeText(snippet);
      setConfigCopied(true);
      setTimeout(() => setConfigCopied(false), 2500);
    } catch { pushToast("Couldn't access the clipboard — copy the config manually."); }
  }

  useEffect(() => {
    if (!isLoaded || !user || introStarted.current) return;
    introStarted.current = true;
    setShowIntro(true);
    // No cleanup return — auth re-renders must NOT cancel these timeouts
    setTimeout(() => setIntroFading(true), 2200);
    setTimeout(() => setShowIntro(false), 3700); // panels merge (0.68s) + burst (0.9s) + overlay fade (0.6s @ 0.85s delay)
  }, [isLoaded, user]);

  function dismissIntro() {
    if (introStarted.current) {
      setIntroFading(true);
      setTimeout(() => setShowIntro(false), 1600);
    }
  }
  useEffect(() => {
    if (!userId) return;
    const iv = setInterval(async () => {
      try {
        const d = await (await fetch(`/api/memories?userId=${encodeURIComponent(userId)}&limit=1000`)).json();
        const ms = (d.memories || []).map(mapApi);
        if (ms.length !== lastCount.current) setMemories(ms);
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
    try {
      const r = await fetch(`/api/memories/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId, createdAt: raw(m).createdAt, pinned: next }) });
      if (!r.ok) throw new Error();
    } catch {
      setMemories(p => p.map(x => x.id === id ? { ...x, pinned: !next } : x));
      pushToast(`Couldn't ${next ? "pin" : "unpin"} that memory — try again.`);
    }
  }
  async function deleteMemory(id: string) {
    const m = memories.find(x => x.id === id); if (!m || !userId) return;
    const refs = memories.filter(x => x.id !== id && (x.contradicts || []).includes(id));
    setMemories(p => p.filter(x => x.id !== id).map(x => stripConflictRef(x, id)));
    try {
      const r = await fetch(`/api/memories?userId=${encodeURIComponent(userId)}&memoryId=${id}&createdAt=${encodeURIComponent(raw(m).createdAt)}`, { method:"DELETE" });
      if (!r.ok) throw new Error();
      await purgeConflictRefs(id, refs);  // strip the deleted id from every memory that pointed at it
    } catch { loadMemories(true); pushToast("Couldn't delete that memory — try again."); }
  }
  async function deleteAll() {
    if (!userId) return; const snap = [...memories]; setMemories([]); setDeleteConfirm(false);
    let failed = 0;
    for (const m of snap) {
      try {
        const r = await fetch(`/api/memories?userId=${encodeURIComponent(userId)}&memoryId=${m.id}&createdAt=${encodeURIComponent(raw(m).createdAt)}`, { method:"DELETE" });
        if (!r.ok) throw new Error();
      } catch { failed++; }
    }
    if (failed) { loadMemories(true); pushToast(`${failed} of ${snap.length} memories couldn't be deleted.`); }
    else pushToast(`Cleared all ${snap.length} memories.`, "success");
  }
  async function saveEdit(id: string, text: string, topic?: Topic) {
    const m = memories.find(x => x.id === id); if (!m || !userId) return;
    const changeTopic = topic && topic !== m.topic;
    const body: Record<string, unknown> = { userId, createdAt: raw(m).createdAt, content: text };
    if (changeTopic) body.topic = topic;
    setMemories(p => p.map(x => x.id === id ? { ...x, content: text, ...(changeTopic ? { topic } : {}) } : x));
    try {
      const r = await fetch(`/api/memories/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      if (!r.ok) throw new Error();
    } catch { loadMemories(true); pushToast("Couldn't save your edit — try again."); }
  }
  async function tagMemoryWithProject(memId: string, projectId: string, add: boolean) {
    const m = memories.find(x => x.id === memId); if (!m || !userId) return;
    const current = m.tags || [];
    const next = add ? [...new Set([...current, projectId])] : current.filter(t => t !== projectId);
    setMemories(p => p.map(x => x.id === memId ? { ...x, tags: next } : x));
    try {
      const r = await fetch(`/api/memories/${memId}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId, createdAt: raw(m).createdAt, tags: next }) });
      if (!r.ok) throw new Error();
    } catch { loadMemories(true); pushToast("Couldn't update tags — try again."); }
  }

  // Remove a (now-deleted) memory id from another memory's conflict links.
  function stripConflictRef(m: Memory, id: string): Memory {
    if (!(m.contradicts || []).includes(id)) return m;
    const cr = { ...(m.conflictReasons || {}) }; delete cr[id];
    return { ...m, contradicts: (m.contradicts || []).filter(x => x !== id), conflictReasons: cr };
  }
  // After a memory is deleted, strip its id from every memory that referenced it
  // (server-side) so no phantom conflicts linger. `refs` is the pre-delete snapshot.
  async function purgeConflictRefs(deletedId: string, refs: Memory[]) {
    if (!userId || !refs.length) return;
    await Promise.all(refs.map(m => {
      const next = stripConflictRef(m, deletedId);
      return fetch(`/api/memories/${m.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId, createdAt: raw(m).createdAt, contradicts: next.contradicts, conflictReasons: next.conflictReasons }) }).catch(() => {});
    }));
  }

  // Resolve a conflict by keeping one memory and deleting its conflicting partner.
  // The dropped id is stripped from EVERY memory that referenced it (not just the
  // kept one), so no third memory is left pointing at a deleted partner.
  async function resolveConflictKeep(keepId: string, dropId: string) {
    const drop = memories.find(m => m.id === dropId);
    if (!userId || !drop) return;
    const refs = memories.filter(m => m.id !== dropId && (m.contradicts || []).includes(dropId));
    setMemories(p => p.filter(m => m.id !== dropId).map(m => stripConflictRef(m, dropId)));
    try {
      const rd = await fetch(`/api/memories?userId=${encodeURIComponent(userId)}&memoryId=${dropId}&createdAt=${encodeURIComponent(raw(drop).createdAt)}`, { method:"DELETE" });
      if (!rd.ok) throw new Error();
      await purgeConflictRefs(dropId, refs);
      pushToast("Conflict resolved.", "success");
    } catch { loadMemories(true); pushToast("Couldn't resolve that conflict — try again."); }
  }

  // Mark two memories as not actually conflicting: drop the link from both sides.
  async function unlinkConflict(aId: string, bId: string) {
    const a = memories.find(m => m.id === aId), b = memories.find(m => m.id === bId);
    if (!userId || !a || !b) return;
    const aNext = (a.contradicts || []).filter(x => x !== bId);
    const bNext = (b.contradicts || []).filter(x => x !== aId);
    const aReasons = { ...(a.conflictReasons || {}) }; delete aReasons[bId];
    const bReasons = { ...(b.conflictReasons || {}) }; delete bReasons[aId];
    setMemories(p => p.map(m => m.id === aId ? { ...m, contradicts: aNext, conflictReasons: aReasons }
                            : m.id === bId ? { ...m, contradicts: bNext, conflictReasons: bReasons } : m));
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/memories/${aId}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId, createdAt: raw(a).createdAt, contradicts: aNext, conflictReasons: aReasons }) }),
        fetch(`/api/memories/${bId}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId, createdAt: raw(b).createdAt, contradicts: bNext, conflictReasons: bReasons }) }),
      ]);
      if (!r1.ok || !r2.ok) throw new Error();
      pushToast("Marked as not a conflict.", "success");
    } catch { loadMemories(true); pushToast("Couldn't update that conflict — try again."); }
  }

  // ── Bulk select & actions ──────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  async function bulkDelete() {
    const ids = [...selectedIds]; if (!ids.length || !userId) return;
    const snap = memories.filter(m => ids.includes(m.id));
    setSelectedIds(new Set());
    setMemories(p => p.filter(m => !ids.includes(m.id)).map(m => ids.reduce((mm, id) => stripConflictRef(mm, id), m)));
    let failed = 0;
    for (const m of snap) {
      try {
        const r = await fetch(`/api/memories?userId=${encodeURIComponent(userId)}&memoryId=${m.id}&createdAt=${encodeURIComponent(raw(m).createdAt)}`, { method:"DELETE" });
        if (!r.ok) throw new Error();
      } catch { failed++; }
    }
    if (failed) { loadMemories(true); pushToast(`${failed} of ${ids.length} couldn't be deleted.`); }
    else pushToast(`Deleted ${ids.length} memor${ids.length === 1 ? "y" : "ies"}.`, "success");
  }
  async function bulkPatch(patch: Record<string, unknown>, optimistic: (m: Memory) => Memory, label: string) {
    const ids = [...selectedIds]; if (!ids.length || !userId) return;
    const snap = memories.filter(m => ids.includes(m.id));
    setSelectedIds(new Set());
    setMemories(p => p.map(m => ids.includes(m.id) ? optimistic(m) : m));
    let failed = 0;
    for (const m of snap) {
      try {
        const r = await fetch(`/api/memories/${m.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId, createdAt: raw(m).createdAt, ...patch }) });
        if (!r.ok) throw new Error();
      } catch { failed++; }
    }
    if (failed) { loadMemories(true); pushToast(`${failed} of ${ids.length} couldn't be updated.`); }
    else pushToast(`${label} ${ids.length} memor${ids.length === 1 ? "y" : "ies"}.`, "success");
  }
  const bulkSetPinned = (pinned: boolean) => bulkPatch({ pinned }, m => ({ ...m, pinned }), pinned ? "Pinned" : "Unpinned");
  const bulkSetTopic  = (topic: Topic)    => bulkPatch({ topic },  m => ({ ...m, topic }),  `Moved`);

  // ── Duplicates / memory health ─────────────────────────────────────────
  async function loadDuplicates() {
    if (!userId) return;
    setDupLoading(true);
    try {
      const r = await fetch("/api/duplicates", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId }) });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setDupClusters(Array.isArray(d.clusters) ? d.clusters : []);
    } catch { setDupClusters([]); pushToast("Couldn't scan for duplicates — try again."); }
    setDupLoading(false);
  }
  function openHealth() { setShowHealth(true); loadDuplicates(); }

  // Merge a duplicate cluster: keep one, delete the rest (with conflict-ref cleanup).
  async function mergeCluster(keepId: string, dropIds: string[]) {
    if (!userId || !dropIds.length) return;
    const snap = memories.filter(m => dropIds.includes(m.id));
    setMemories(p => p.filter(m => !dropIds.includes(m.id)).map(m => dropIds.reduce((mm, id) => stripConflictRef(mm, id), m)));
    setDupClusters(prev => prev.filter(group => !group.some(x => x.id === keepId)));
    let failed = 0;
    for (const m of snap) {
      try {
        const r = await fetch(`/api/memories?userId=${encodeURIComponent(userId)}&memoryId=${m.id}&createdAt=${encodeURIComponent(raw(m).createdAt)}`, { method:"DELETE" });
        if (!r.ok) throw new Error();
      } catch { failed++; }
    }
    if (failed) { loadMemories(true); pushToast(`${failed} couldn't be removed.`); }
    else pushToast(`Merged — removed ${dropIds.length} duplicate${dropIds.length === 1 ? "" : "s"}.`, "success");
  }

  async function addMemory() {
    if (!newMemory.trim() || !userId) return;
    try {
      const r = await fetch("/api/memories", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId, content:newMemory.trim(), topic:newTopic, pinned:newPin, source:"manual" }) });
      if (!r.ok) throw new Error();
      const d = await r.json();
      if (d.memory) { setMemories(p => [mapApi(d.memory), ...p]); pushToast("Memory added.", "success"); }
    } catch { loadMemories(true); pushToast("Couldn't add that memory — try again."); }
    setNewMemory(""); setNewTopic("general"); setNewPin(false); setShowAddModal(false);
  }
  async function runImport() {
    if (!importText.trim() || !userId) return; setImporting(true);
    try {
      const r = await fetch("/api/memories", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId, messages:[{ role:"user", content:importText }], source:"import" }) });
      if (!r.ok) throw new Error();
      const d = await r.json();
      const added = (d.memories || []).map(mapApi);
      if (added.length) { setMemories(p => [...added, ...p]); pushToast(`Imported ${added.length} ${added.length === 1 ? "memory" : "memories"}.`, "success"); }
      else pushToast("No new memories found in that text.", "info");
    } catch { pushToast("Import failed — try again."); }
    setImporting(false); setShowImport(false); setImportText("");
  }

  // Ask-your-memory: natural-language question → AI answer grounded in memories.
  // Reads the streamed SSE response so the answer appears token-by-token.
  async function askMemory(q: string) {
    const query = q.trim();
    if (!query || !userId) return;
    setAsking(true); setAskAnswer({ answer: "", sources: [] });
    try {
      const r = await fetch("/api/ask", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId, query }) });
      if (!r.ok || !r.body) throw new Error();
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "", answer = "";
      let sources: { content: string; topic: string; id: string }[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const ev = JSON.parse(line.slice(5).trim());
            if (ev.type === "sources") { sources = ev.sources || []; setAskAnswer({ answer, sources }); }
            else if (ev.type === "delta") { answer += ev.text || ""; setAskAnswer({ answer, sources }); }
          } catch { /* ignore */ }
        }
      }
      setAskAnswer({ answer: answer || "No answer.", sources });
    } catch { setAskAnswer({ answer: "Couldn't get an answer — try again.", sources: [] }); pushToast("Ask failed — try again."); }
    setAsking(false);
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
  // Distinct conflicting PAIRS (matches what the resolver modal shows) — counting
  // memories-with-conflicts would double-count, since each pair flags both sides.
  const conflictCount = (() => {
    const ids = new Set(memories.map(m => m.id));
    const seen = new Set<string>();
    for (const m of memories) for (const pid of (m.contradicts || [])) {
      if (ids.has(pid)) seen.add([m.id, pid].sort().join("|"));
    }
    return seen.size;
  })();

  /* scroll-view filter helpers */
  const sfIde = scrollFilter.startsWith("ide:") ? scrollFilter.slice(4) : null;
  const sfNs  = scrollFilter.startsWith("ns:")  ? scrollFilter.slice(3) : null;
  const sfCp  = scrollFilter.startsWith("cp:")  ? scrollFilter.slice(3) : null;

  function saveProjects(list: CustomProject[]) {
    setCustomProjects(list);
    if (!userId) return;
    fetch("/api/projects", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, projects: list }),
    })
      .then(r => { if (!r.ok) throw new Error(); })
      .catch(() => pushToast("Couldn't save your project changes — try again."));
  }
  function addCustomProject() {
    const name = newProjectName.trim();
    if (!name) return;
    const color = PROJECT_COLORS[customProjects.length % PROJECT_COLORS.length];
    const proj: CustomProject = { id: `proj-${Date.now()}`, name, color };
    saveProjects([...customProjects, proj]);
    setNewProjectName("");
    setShowAddProject(false);
    setScrollFilter(`cp:${proj.id}`);
  }
  function deleteCustomProject(id: string) {
    saveProjects(customProjects.filter(p => p.id !== id));
    if (scrollFilter === `cp:${id}`) setScrollFilter("all");
  }

  const filterChips = [
    { id: "all", label: "All", color: "rgba(255,255,255,0.6)" },
    ...IDE_NODES.filter(n => n.id !== "mcp").map(n => ({ id: `ide:${n.id}`, label: n.title, color: n.color })),
    ...NS_NODES.map(n => ({ id: `ns:${n.id}`, label: n.title, color: n.color })),
    ...customProjects.map(p => ({ id: `cp:${p.id}`, label: p.name, color: p.color })),
  ];

  if (!isLoaded) return null;

  /* ─────────────────────────── RENDER ─────────────────────────── */
  return (
    <div style={{ minHeight:"100vh", overflowY:"auto", background:"#000", color:"white", position:"relative", fontFamily:"Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif" }}>

      <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none" }}>
        <BackgroundVideo overlayOpacity={0.76} />
      </div>

      {/* Toasts — surface failures and notable successes, top-right above all modals */}
      <div style={{ position:"fixed", top:18, right:18, zIndex:99999, display:"flex", flexDirection:"column", gap:10, pointerEvents:"none", maxWidth:"min(92vw, 380px)" }}>
        {toasts.map(t => {
          const accent = t.kind === "success" ? "#34d399" : t.kind === "info" ? "#60a5fa" : "#f87171";
          const icon   = t.kind === "success" ? "✓" : t.kind === "info" ? "ℹ" : "✕";
          return (
            <div
              key={t.id}
              onClick={() => dismissToast(t.id)}
              style={{
                pointerEvents:"auto", cursor:"pointer",
                display:"flex", alignItems:"flex-start", gap:10,
                padding:"12px 14px", borderRadius:14,
                background:"rgba(18,18,20,0.82)",
                backdropFilter:"blur(18px) saturate(1.6)",
                WebkitBackdropFilter:"blur(18px) saturate(1.6)",
                border:`1px solid ${accent}55`,
                borderLeft:`3px solid ${accent}`,
                boxShadow:"0 12px 40px rgba(0,0,0,0.5)",
                color:"#fff", fontSize:13.5, lineHeight:1.4, fontWeight:500,
                animation:"toastIn 0.28s cubic-bezier(0.22,1,0.36,1)",
              }}
            >
              <span style={{ color:accent, fontWeight:700, fontSize:13, marginTop:1, flexShrink:0 }}>{icon}</span>
              <span style={{ flex:1 }}>{t.msg}</span>
            </div>
          );
        })}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        @keyframes hubGlow {
          0%,100%{ filter: drop-shadow(0 0 18px rgba(94,234,212,0.7)) drop-shadow(0 0 40px rgba(252,211,77,0.35)); }
          50%    { filter: drop-shadow(0 0 28px rgba(94,234,212,0.95)) drop-shadow(0 0 60px rgba(252,211,77,0.55)); }
        }
        @keyframes flowDash  { to { stroke-dashoffset: -320; } }
        @keyframes spin      { to { transform: rotate(360deg); } }
        @keyframes toastIn {
          from { opacity:0; transform:translateX(16px) scale(0.96); }
          to   { opacity:1; transform:translateX(0) scale(1); }
        }

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
        @keyframes introLogo {
          from { opacity:0; transform:scale(0.80) translateY(6px); }
          to   { opacity:1; transform:scale(1)    translateY(0); }
        }
        @keyframes introGreet {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes introSub {
          from { opacity:0; }
          to   { opacity:0.45; }
        }
        @keyframes panelTopIn    { from { transform: translateY(-100%) } to { transform: translateY(0) } }
        @keyframes panelBotIn    { from { transform: translateY(100%)  } to { transform: translateY(0) } }
        @keyframes panelTopMerge { from { transform: translateY(0) } to { transform: translateY(-110%) } }
        @keyframes panelBotMerge { from { transform: translateY(0) } to { transform: translateY(110%) } }
        @keyframes logoBurst {
          0%   { transform:scale(1);    filter:none; }
          40%  { transform:scale(1.44); filter:drop-shadow(0 0 40px #f0b46a) drop-shadow(0 0 70px #5EEAD4); }
          78%  { transform:scale(1.08); filter:drop-shadow(0 0 18px #f0b46a) drop-shadow(0 0 28px #5EEAD4); }
          100% { transform:scale(1);    filter:drop-shadow(0 0 28px rgba(94,234,212,0.8)) drop-shadow(0 0 55px rgba(252,211,77,0.45)); }
        }
        @keyframes introOverlayFade { from { opacity:1 } to { opacity:0 } }
        @media (prefers-reduced-motion: reduce) {
          .intro-logo, .intro-greet, .intro-sub { animation: none !important; opacity: 1 !important; transform: none !important; }
        }

        .node-card {
          transition: opacity .22s, border-color .18s, box-shadow .18s, transform .16s;
          animation: nodeIn 0.3s ease both;
        }
        .node-card:hover { transform: scale(1.026) translateY(-1px); }
        .node-opening    { animation: nodePulse 0.48s cubic-bezier(0.34,1.56,0.64,1) both !important; }

        .mem-card:hover { background: rgba(255,255,255,0.07) !important; border-color: rgba(255,255,255,0.13) !important; }
        .mem-card:hover .mem-act { opacity: 1 !important; }
        .mem-card:hover .mem-check { opacity: 1 !important; }
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
      <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:50, height:52, background:"transparent", display:"flex", alignItems:"center", padding:"0 16px", gap:8 }}>
        <Link href="/" style={{ display:"flex", alignItems:"center", gap:9, textDecoration:"none", flexShrink:0 }}>
          <ImprintLogo size={22} />
          <span style={{ fontSize:15, fontWeight:600, color:"rgba(255,255,255,0.92)", letterSpacing:"-0.01em" }}>Imprint</span>
        </Link>
        <div style={{ width:1, height:22, background:"rgba(255,255,255,0.08)", margin:"0 4px" }} />
        <div style={{ position:"relative", flex:1, maxWidth:320 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.06)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"0 8px 0 10px", height:34 }}>
              <Search size={13} style={{ color:"rgba(255,255,255,0.35)", flexShrink:0 }} />
              <input value={globalSearch}
                onChange={e => { setGlobalSearch(e.target.value); if (askAnswer) setAskAnswer(null); }}
                onKeyDown={e => { if (e.key === "Enter") askMemory(globalSearch); }}
                placeholder="Search or ask your memory…"
                style={{ background:"transparent", border:"none", outline:"none", color:"rgba(255,255,255,0.85)", fontSize:13, flex:1, minWidth:0 }} />
              {globalSearch.trim() && (
                <button onClick={() => askMemory(globalSearch)} title="Ask AI (Enter)" style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(94,234,212,0.14)", border:"1px solid rgba(94,234,212,0.35)", color:"#5EEAD4", fontSize:11, fontWeight:600, borderRadius:7, padding:"3px 8px", cursor:"pointer", flexShrink:0, fontFamily:"inherit" }}>✨ Ask</button>
              )}
              {(globalSearch || askAnswer) && <button onClick={() => { setGlobalSearch(""); setAskAnswer(null); }} title="Clear" style={{ background:"none", border:"none", color:"rgba(255,255,255,0.35)", cursor:"pointer", padding:2, display:"flex", flexShrink:0 }}><X size={12} /></button>}
            </div>
            {(asking || askAnswer) && (
              <div style={{ position:"absolute", top:42, left:0, right:0, zIndex:70, background:"rgba(18,18,22,0.97)", backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)", border:"1px solid rgba(94,234,212,0.22)", borderRadius:14, padding:16, boxShadow:"0 24px 60px rgba(0,0,0,0.6)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
                  <span style={{ fontSize:13 }}>✨</span>
                  <span style={{ fontSize:10.5, fontWeight:700, letterSpacing:"0.07em", color:"#5EEAD4" }}>MEMORY ANSWER</span>
                  <span style={{ fontSize:9, fontWeight:600, letterSpacing:"0.04em", color:"rgba(94,234,212,0.75)", background:"rgba(94,234,212,0.1)", border:"1px solid rgba(94,234,212,0.28)", borderRadius:999, padding:"1px 7px" }}>⚡ Cognee recall</span>
                </div>
                {(asking && !askAnswer?.answer) ? (
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)" }}>Searching your memory…</div>
                ) : (
                  <>
                    <div style={{ fontSize:13.5, lineHeight:1.55, color:"rgba(255,255,255,0.9)", whiteSpace:"pre-wrap" }}>{askAnswer?.answer}{asking && <span style={{ opacity:0.55 }}> ▍</span>}</div>
                    {!!askAnswer?.sources?.length && (
                      <div style={{ marginTop:12, paddingTop:10, borderTop:"1px solid rgba(255,255,255,0.07)" }}>
                        <div style={{ fontSize:9.5, fontWeight:600, letterSpacing:"0.06em", color:"rgba(255,255,255,0.3)", marginBottom:6 }}>BASED ON</div>
                        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                          {askAnswer.sources.map((s, i) => (
                            <div key={i} style={{ fontSize:11.5, color:"rgba(255,255,255,0.55)", lineHeight:1.4 }}>• <span style={{ color:(TOPIC_META[s.topic as Topic] || TOPIC_META.general).color }}>[{s.topic}]</span> {s.content}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {!asking && askAnswer?.answer && /couldn't|try again|isn't configured|went wrong/i.test(askAnswer.answer) && (
                      <button onClick={() => askMemory(globalSearch)} style={{ marginTop:12, fontSize:12, fontWeight:600, color:"#5EEAD4", background:"rgba(94,234,212,0.12)", border:"1px solid rgba(94,234,212,0.3)", borderRadius:8, padding:"5px 12px", cursor:"pointer", fontFamily:"inherit" }}>↻ Try again</button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        <div style={{ flex:1 }} />
        <button className="hbtn" onClick={() => setShowConnect(true)} title="Connect your IDE" style={{ display:"flex", alignItems:"center", gap:6, height:30, padding:"0 12px", borderRadius:8, background:"rgba(94,234,212,0.14)", border:"1px solid rgba(94,234,212,0.45)", color:"#5EEAD4", fontSize:12.5, fontWeight:600, fontFamily:"inherit", cursor:"pointer", whiteSpace:"nowrap", transition:"all .15s" }}>
          <Link2 size={14}/> Connect
        </button>
        <button className="hbtn" onClick={openHealth} title="Memory health & cleanup" style={{ display:"flex", alignItems:"center", gap:5, height:30, padding:"0 11px", borderRadius:8, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.72)", fontSize:12.5, fontWeight:600, fontFamily:"inherit", cursor:"pointer", whiteSpace:"nowrap" }}>📊 Health</button>
        {([
          { icon:<Plus size={14}/>,   onClick:()=>setShowAddModal(true),  title:"Add",    bg:"rgba(255,255,255,0.07)", col:"#fff"                   },
          { icon:<Tag size={14}/>,    onClick:()=>setShowQuickTag(true),  title:"Tag",    bg:"transparent",            col:"rgba(255,255,255,0.5)"  },
          { icon:<Download size={14}/>, onClick:doExport,                 title:"Export", bg:"transparent",            col:"rgba(255,255,255,0.5)"  },
          { icon:<Upload size={14}/>,   onClick:()=>setShowImport(true),  title:"Import", bg:"transparent",            col:"rgba(255,255,255,0.5)"  },
          { icon:<Trash2 size={14}/>,   onClick:()=>setDeleteConfirm(true), title:"Delete", bg:"transparent",          col:"rgba(255,255,255,0.35)" },
        ] as { icon: React.ReactNode; onClick: () => void; title: string; bg: string; col: string }[]).map((b, i) => (
          <button key={i} className="hbtn" onClick={b.onClick} title={b.title} style={{ width:30, height:30, borderRadius:8, background:b.bg, border:`1px solid ${b.col}22`, color:b.col, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all .15s" }}>{b.icon}</button>
        ))}
        <div style={{ width:1, height:22, background:"rgba(255,255,255,0.07)" }} />

        {/* ── Profile avatar + dropdown editor ── */}
        <div style={{ position:"relative", flexShrink:0 }}>
          <button
            onClick={() => (showProfile ? setShowProfile(false) : openProfile())}
            title="Profile"
            style={{ display:"flex", alignItems:"center", gap:4, background:"none", border:"none", cursor:"pointer", padding:0 }}
          >
            {displayImage && !avatarBroken
              ? <img src={displayImage} alt="" onError={() => setAvatarBroken(true)} style={{ width:30, height:30, borderRadius:"50%", flexShrink:0, border:"1.5px solid rgba(255,255,255,0.15)", objectFit:"cover" }} />
              : <div style={{ width:30, height:30, borderRadius:"50%", background:"linear-gradient(145deg,#f0b46a,#b97e35)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#1a0f08", flexShrink:0 }}>{initials}</div>
            }
            <ChevronDown size={12} style={{ color:"rgba(255,255,255,0.3)" }} />
          </button>

          {showProfile && (
            <>
              <div onClick={() => setShowProfile(false)} style={{ position:"fixed", inset:0, zIndex:60 }} />
              <div style={{ position:"absolute", top:42, right:0, width:300, zIndex:61, background:"rgba(18,18,22,0.94)", backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:16, padding:16, boxShadow:"0 24px 60px rgba(0,0,0,0.6)" }}>
                {/* avatar preview + upload */}
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                  <div style={{ position:"relative", width:54, height:54, flexShrink:0 }}>
                    {editImage
                      ? <img src={editImage} alt="" style={{ width:54, height:54, borderRadius:"50%", objectFit:"cover", border:"1.5px solid rgba(255,255,255,0.15)" }} />
                      : <div style={{ width:54, height:54, borderRadius:"50%", background:"linear-gradient(145deg,#f0b46a,#b97e35)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:700, color:"#1a0f08" }}>{initials}</div>
                    }
                    <label title="Upload photo" style={{ position:"absolute", bottom:-2, right:-2, width:22, height:22, borderRadius:"50%", background:"#5EEAD4", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", border:"2px solid #141418" }}>
                      <Camera size={11} color="#0a0a0a" />
                      <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) onAvatarFile(f); e.currentTarget.value = ""; }} style={{ display:"none" }} />
                    </label>
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#fff", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{displayName || "Your profile"}</div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{displayEmail}</div>
                  </div>
                </div>

                <label style={PROFILE_LBL}>Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Your name" style={PROFILE_INP} />

                <div style={{ display:"flex", gap:10 }}>
                  <div style={{ flex:"0 0 84px" }}>
                    <label style={PROFILE_LBL}>Age</label>
                    <input value={editAge} onChange={e => setEditAge(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))} inputMode="numeric" placeholder="—" style={PROFILE_INP} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <label style={PROFILE_LBL}>Role</label>
                    <input value={editRole} onChange={e => setEditRole(e.target.value)} placeholder="e.g. Student, Developer" style={PROFILE_INP} />
                  </div>
                </div>

                <div style={{ display:"flex", gap:8, marginTop:4 }}>
                  <button onClick={saveProfile} disabled={savingProfile} style={{ flex:1, padding:"8px 0", borderRadius:9, border:"none", background:"#5EEAD4", color:"#06201c", fontSize:12.5, fontWeight:600, cursor: savingProfile ? "default" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, opacity: savingProfile ? 0.6 : 1 }}>
                    <Check size={13} /> {savingProfile ? "Saving…" : "Save"}
                  </button>
                  <button onClick={() => signOut({ callbackUrl:"/sign-in" })} title="Sign out" style={{ padding:"8px 12px", borderRadius:9, border:"1px solid rgba(255,255,255,0.12)", background:"transparent", color:"rgba(255,255,255,0.55)", fontSize:12.5, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                    <LogOut size={13} /> Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ════ CANVAS ════ */}
      <div ref={mapRef} style={{ position:"relative", height:"calc(100vh - 52px)", marginTop:52, overflow:"visible", zIndex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>

<div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:1000, height:900, pointerEvents:"none", background:"radial-gradient(ellipse at center, rgba(120,60,220,0.10) 0%, rgba(60,40,180,0.04) 38%, transparent 65%)", filter:"blur(10px)" }} />
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", backgroundImage:"radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)", backgroundSize:"28px 28px", maskImage:"radial-gradient(ellipse 62% 58% at center, #000 25%, transparent 75%)", WebkitMaskImage:"radial-gradient(ellipse 62% 58% at center, #000 25%, transparent 75%)" }} />

        <div style={{ position:"relative", width:MAP_W, height:MAP_H, transformOrigin:"center", transform:`scale(${mapScale})`, flexShrink:0 }}>

          {/* ── SVG lines ── */}
          <svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ position:"absolute", inset:0, overflow:"visible", pointerEvents:"none" }}>
            {IDE_NODES.map(n => {
              const [sx,sy] = hubStart(n.cx, n.cy);
              const d = pathH(sx, sy, n.cx + 50, n.cy);
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
            style={{ position:"absolute", left:HUB.x, top:HUB.y, width:240, height:240, transform:"translate(-50%,-50%)", background:"transparent", border:"none", display:"flex", alignItems:"center", justifyContent:"center", zIndex:10, opacity:nodeOp("hub"), transition:"opacity .22s, filter .22s", cursor:"default", filter:"drop-shadow(0 0 28px rgba(94,234,212,0.8)) drop-shadow(0 0 60px rgba(252,211,77,0.45))", animation:"hubGlow 3.8s ease-in-out infinite" }}>
            <ImprintLogo size={130} />
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
                style={{ position:"absolute", left:n.cx-108, top:n.cy-34, width:215, height:68, background:"transparent", border:"none", display:"flex", alignItems:"center", gap:12, padding:"0 15px", opacity:nodeOp(n.id), cursor:"pointer", zIndex:hl?100:1 }}>
                <div style={{ width:42, height:42, borderRadius:13, flexShrink:0, background:"rgba(255,255,255,0.09)", backdropFilter:"blur(16px) saturate(1.8)", WebkitBackdropFilter:"blur(16px) saturate(1.8)", border:"1px solid rgba(255,255,255,0.18)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:INSET_SHINE, transition:"transform .15s", transform:active?"scale(1.08)":"scale(1)" }}>
                  <BrandLogo id="mcp" color={n.color} size={21}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"rgba(255,255,255,0.92)" }}>Custom MCP</div>
                  <button style={{ marginTop:5, height:22, padding:"0 10px", borderRadius:7, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.14)", color:"rgba(255,255,255,0.55)", fontSize:10.5, fontWeight:500, fontFamily:"inherit", cursor:"pointer" }}>Configure</button>
                </div>
                {hl && <NodeTooltip node={n} memories={memories} side="left" />}
              </div>
            ) : (
              <div key={n.id}
                className={openAnim === n.id ? "node-card node-opening" : "node-card"}
                onMouseEnter={()=>setHovered(n.id)} onMouseLeave={()=>setHovered(null)}
                onClick={()=>openNode(n.id, sel)}
                style={{ position:"absolute", left:n.cx-108, top:n.cy-32, width:215, height:64, background:"transparent", border:"none", display:"flex", alignItems:"center", gap:10, padding:"0 12px", opacity:nodeOp(n.id), cursor:"pointer", zIndex:hl?100:1 }}>
                <div style={{ width:46, height:46, flexShrink:0, borderRadius:13, background:"rgba(255,255,255,0.09)", backdropFilter:"blur(16px) saturate(1.8)", WebkitBackdropFilter:"blur(16px) saturate(1.8)", border:`1px solid ${active?"rgba(255,255,255,0.28)":"rgba(255,255,255,0.15)"}`, boxShadow:INSET_SHINE, display:"flex", alignItems:"center", justifyContent:"center", transition:"transform .15s, border-color .2s", transform:active?"scale(1.08)":"scale(1)" }}>
                  <img src={IDE_IMG[n.id]} alt={n.title} style={{ width:30, height:30, objectFit:"contain", filter:active?"drop-shadow(0 0 10px rgba(255,255,255,0.5))":"none", transition:"filter .2s" }} />
                </div>
                <span style={{ fontSize:12.5, fontWeight:600, color:active?"rgba(255,255,255,0.95)":"rgba(255,255,255,0.65)", letterSpacing:"0.01em", transition:"color .2s", whiteSpace:"nowrap" }}>{n.title}</span>
                {hl && <NodeTooltip node={n} memories={memories} side="left" />}
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
                style={{ position:"absolute", left:n.cx-100, top:n.cy-34, width:200, height:68, background:"transparent", border:"none", display:"flex", alignItems:"center", gap:12, padding:"0 14px", opacity:nodeOp(n.id), cursor:"pointer", zIndex:hl?100:1 }}>
                <div style={{ width:40, height:40, borderRadius:13, flexShrink:0, background:"rgba(255,255,255,0.09)", backdropFilter:"blur(16px) saturate(1.8)", WebkitBackdropFilter:"blur(16px) saturate(1.8)", border:"1px solid rgba(255,255,255,0.18)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:INSET_SHINE, transition:"transform .15s", transform:active?"scale(1.08)":"scale(1)" }}>
                  <BrandLogo id={n.id} color={n.color} size={19}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"rgba(255,255,255,0.92)" }}>{n.title}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.38)", marginTop:2 }}>{cnt} {cnt===1?"memory":"memories"}</div>
                </div>
                {pin > 0 && <span style={{ fontSize:10, fontWeight:600, color:"#f0b46a" }}>📌{pin}</span>}
                {hl && <NodeTooltip node={n} memories={memories} side="right" />}
              </div>
            );
          })}

          {/* ── CUSTOM PROJECT BRANCH NODES — fan right of Projects NS node (cx=1282,cy=296) ── */}
          {(() => {
            const projNode = NS_NODES.find(n => n.id === "proj")!;
            const BX = 1530; // center-x of sub-nodes — far enough right to avoid overlap
            const W = 192, H = 64, spacing = 72;
            const total = customProjects.length + 1; // +1 for the "add" stub
            const startY = projNode.cy - ((total - 1) * spacing) / 2;

            return (
              <>
                {/* SVG branch paths */}
                <svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`}
                  style={{ position:"absolute", inset:0, overflow:"visible", pointerEvents:"none" }}>
                  {[...customProjects.map((p,i) => ({ color:p.color, active: scrollFilter===`cp:${p.id}`, ny: startY+i*spacing, dashed:false })),
                    { color:"rgba(255,255,255,0.18)", active:false, ny: startY+customProjects.length*spacing, dashed:true }
                  ].map(({ color, active, ny, dashed }, i) => {
                    const d = `M ${projNode.cx} ${projNode.cy} C ${projNode.cx+80} ${projNode.cy}, ${BX-80} ${ny}, ${BX} ${ny}`;
                    return (
                      <g key={i}>
                        <path d={d} fill="none" stroke={color} strokeWidth="1.4"
                          strokeOpacity={active ? 0.65 : 0.22} strokeLinecap="round"
                          strokeDasharray={dashed ? "5 10" : undefined}
                          style={{ transition:"stroke-opacity .22s" }}/>
                        {active && <path d={d} fill="none" stroke={color} strokeWidth="1.6"
                          strokeOpacity={0.45} strokeDasharray="8 16" strokeLinecap="round"
                          style={{ animation:"flowDash 3.5s linear infinite" }}/>}
                      </g>
                    );
                  })}
                </svg>

                {/* Custom project nodes — same glass-pill style as NS nodes */}
                {customProjects.map((p, i) => {
                  const ny = startY + i * spacing;
                  const cnt = memories.filter(m =>
                    m.tags?.includes(p.id) ||
                    m.content.toLowerCase().includes(p.name.toLowerCase()) ||
                    (m.source||"").toLowerCase().includes(p.name.toLowerCase())
                  ).length;
                  return (
                    <div key={p.id}
                      className="node-card"
                      onClick={() => setManagerProject(p)}
                      style={{ position:"absolute", left:BX-W/2, top:ny-H/2, width:W, height:H,
                        display:"flex", alignItems:"center", gap:12, padding:"0 14px",
                        background:"rgba(255,255,255,0.04)",
                        border:`1px solid rgba(255,255,255,0.13)`,
                        borderRadius:14, backdropFilter:"blur(16px) saturate(1.8)",
                        WebkitBackdropFilter:"blur(16px) saturate(1.8)",
                        boxShadow:INSET_SHINE,
                        cursor:"pointer", transition:"all .18s" }}>
                      <div style={{ width:38, height:38, borderRadius:11, flexShrink:0,
                        background:`${p.color}18`, border:`1px solid ${p.color}44`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        boxShadow:INSET_SHINE }}>
                        <div style={{ width:10, height:10, borderRadius:"50%", background:p.color,
                          boxShadow:`0 0 10px ${p.color}` }}/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13.5, fontWeight:600, color:"rgba(255,255,255,0.92)",
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</div>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,0.38)", marginTop:2 }}>
                          {cnt} {cnt===1?"memory":"memories"}
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); deleteCustomProject(p.id); }}
                        style={{ background:"none", border:"none", color:"rgba(255,255,255,0.18)",
                          cursor:"pointer", padding:2, display:"flex", flexShrink:0 }}>
                        <X size={11}/>
                      </button>
                    </div>
                  );
                })}

                {/* "Add project" node — always shows dashed; click opens modal */}
                <div className="node-card" onClick={() => setShowAddProject(true)}
                  style={{ position:"absolute", left:BX-W/2, top:startY+customProjects.length*spacing-H/2,
                    width:W, height:H, display:"flex", alignItems:"center", gap:12, padding:"0 14px",
                    background:"rgba(255,255,255,0.02)", border:"1px dashed rgba(255,255,255,0.14)",
                    borderRadius:14, backdropFilter:"blur(16px)", cursor:"pointer", transition:"all .18s" }}>
                  <div style={{ width:38, height:38, borderRadius:11, flexShrink:0,
                    background:"rgba(255,255,255,0.04)", border:"1px dashed rgba(255,255,255,0.14)",
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <FolderPlus size={15} color="rgba(255,255,255,0.3)"/>
                  </div>
                  <div>
                    <div style={{ fontSize:13.5, fontWeight:600, color:"rgba(255,255,255,0.35)" }}>New project</div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,0.2)", marginTop:2 }}>Click to add</div>
                  </div>
                </div>
              </>
            );
          })()}

        </div>
      </div>

      {/* ════ DETAILED SCROLL VIEW ════ */}
      <div style={{ position:"relative", zIndex:2, background:"rgba(0,0,0,0.22)", backdropFilter:"blur(28px) saturate(2.2) brightness(0.9)", WebkitBackdropFilter:"blur(28px) saturate(2.2) brightness(0.9)", borderTop:"1px solid rgba(255,255,255,0.09)", padding:"56px 48px 96px" }}>
        <div style={{ maxWidth:1160, margin:"0 auto" }}>

          {/* Header */}
          <div style={{ display:"flex", alignItems:"baseline", gap:12, marginBottom:28 }}>
            <span style={{ fontSize:26, fontWeight:700, letterSpacing:"-0.025em", color:"rgba(255,255,255,0.92)" }}>Memories</span>
            <span style={{ fontSize:13, color:"rgba(255,255,255,0.3)" }}>{memories.length} total · {pinnedCount} pinned</span>
            {conflictCount > 0 && <button onClick={() => setShowConflicts(true)} title="Review & resolve conflicting memories" style={{ fontSize:13, fontWeight:600, color:"#f87171", background:"rgba(248,113,113,0.12)", border:"1px solid rgba(248,113,113,0.25)", cursor:"pointer", padding:"2px 10px", borderRadius:7, fontFamily:"inherit" }}>⚠ {conflictCount} conflict{conflictCount === 1 ? "" : "s"} · Resolve</button>}
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

          {/* Date filter */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:24, flexWrap:"wrap" }}>
            <span style={{ fontSize:11.5, color:"rgba(255,255,255,0.35)" }}>Filter by date</span>
            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
              style={{ height:30, padding:"0 10px", borderRadius:9, background:"rgba(255,255,255,0.05)", border:`1px solid ${dateFilter ? "rgba(94,234,212,0.45)" : "rgba(255,255,255,0.1)"}`, color:"rgba(255,255,255,0.85)", fontSize:12, fontFamily:"inherit", colorScheme:"dark", cursor:"pointer" }} />
            {dateFilter && <button onClick={() => setDateFilter("")} style={{ height:30, padding:"0 12px", borderRadius:9, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.5)", fontSize:11.5, cursor:"pointer", fontFamily:"inherit" }}>Clear</button>}
          </div>

          {(() => {
            const filtered = [...memories]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .filter(m => {
                if (globalSearch && !m.content.toLowerCase().includes(globalSearch.toLowerCase())) return false;
                if (dateFilter && new Date(m.createdAt).toLocaleDateString("en-CA") !== dateFilter) return false;
                if (sfIde) { const n = IDE_NODES.find(x => x.id === sfIde); return n ? n.sources.some(s => (m.source||"").toLowerCase().includes(s)) : false; }
                if (sfNs)  { const n = NS_NODES.find(x => x.id === sfNs);  return n ? m.topic === n.topic : false; }
                if (sfCp)  { const p = customProjects.find(x => x.id === sfCp); return p ? (m.tags?.includes(p.id) || m.content.toLowerCase().includes(p.name.toLowerCase()) || (m.source||"").toLowerCase().includes(p.name.toLowerCase())) : false; }
                return true;
              });

            const topicColor = (t: string) => NS_NODES.find(n => n.topic === t)?.color || "rgba(255,255,255,0.3)";

            if (filtered.length === 0) return (
              <div style={{ textAlign:"center", padding:"80px 0", color:"rgba(255,255,255,0.2)", fontSize:15 }}>
                {memories.length === 0 ? (
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
                    <div>No memories yet — connect an IDE so Imprint starts remembering.</div>
                    <button onClick={() => setShowConnect(true)} style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"10px 20px", borderRadius:11, background:"rgba(94,234,212,0.14)", border:"1px solid rgba(94,234,212,0.4)", color:"#5EEAD4", fontSize:14, fontWeight:600, fontFamily:"inherit", cursor:"pointer" }}>
                      <Link2 size={15}/> Connect your IDE
                    </button>
                  </div>
                ) : "No memories match this filter."}
              </div>
            );

            /* ── group by calendar day ── */
            const grouped: Record<string, Memory[]> = {};
            for (const m of filtered) {
              const key = new Date(m.createdAt).toDateString();
              (grouped[key] = grouped[key] || []).push(m);
            }
            const dayKeys = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

            function dayLabel(key: string) {
              return new Date(key).toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short", year:"numeric" });
            }

            function toggleDay(key: string) {
              setExpandedDays(prev => {
                const next = new Set(prev);
                next.has(key) ? next.delete(key) : next.add(key);
                return next;
              });
            }

            return (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {dayKeys.map(key => {
                  const mems = grouped[key];
                  const open = expandedDays.has(key);
                  return (
                    <div key={key} style={{ borderRadius:14, border:"1px solid rgba(255,255,255,0.08)", overflow:"hidden" }}>
                      {/* Day header — clickable */}
                      <button onClick={() => toggleDay(key)}
                        style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"12px 16px",
                          background: open ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                          border:"none", cursor:"pointer", fontFamily:"inherit", textAlign:"left",
                          borderBottom: open ? "1px solid rgba(255,255,255,0.07)" : "none",
                          transition:"background .15s" }}>
                        {open
                          ? <ChevronDown size={14} color="rgba(255,255,255,0.4)"/>
                          : <ChevronRight size={14} color="rgba(255,255,255,0.3)"/>}
                        <span style={{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.82)", letterSpacing:"0.01em" }}>{dayLabel(key)}</span>
                        <span style={{ marginLeft:"auto", fontSize:11, color:"rgba(255,255,255,0.28)", fontWeight:500 }}>{mems.length} {mems.length === 1 ? "memory" : "memories"}</span>
                      </button>

                      {/* Day content */}
                      {open && (
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))", gap:8, padding:12 }}>
                          {mems.map(m => {
                            const tc = topicColor(m.topic);
                            const isEd = editId === m.id;
                            const isSel = selectedIds.has(m.id);
                            return (
                              <div key={m.id} className="mem-card" style={{ position:"relative", padding:"12px 14px", borderRadius:11,
                                background:m.pinned?"rgba(240,180,106,0.06)":"rgba(255,255,255,0.04)",
                                border:`1px solid ${isSel?"#5EEAD4":(m.pinned?"rgba(240,180,106,0.18)":"rgba(255,255,255,0.07)")}`,
                                borderLeft:`2px solid ${isSel?"#5EEAD4":(m.pinned?"#f0b46a":tc+"66")}`,
                                backdropFilter:"blur(12px)" }}>
                                {!isEd && (
                                  <button className="mem-check" onClick={() => toggleSelect(m.id)} title="Select" style={{ position:"absolute", top:11, left:10, width:16, height:16, borderRadius:5, border:`1.5px solid ${isSel?"#5EEAD4":"rgba(255,255,255,0.35)"}`, background:isSel?"#5EEAD4":"transparent", display:"flex", alignItems:"center", justifyContent:"center", padding:0, cursor:"pointer", opacity:isSel?1:0, transition:"opacity .15s", zIndex:2 }}>{isSel && <span style={{ fontSize:10, fontWeight:800, color:"#0a0a0a", lineHeight:1 }}>✓</span>}</button>
                                )}
                                {!isEd && (
                                  <div className="mem-act" style={{ position:"absolute", top:9, right:9, display:"flex", gap:4, opacity:0, transition:"opacity .15s" }}>
                                    <button onClick={() => togglePin(m.id)} title={m.pinned?"Unpin":"Pin"} style={{ width:24, height:24, borderRadius:7, background:"rgba(255,255,255,0.07)", border:"none", color:m.pinned?"#f0b46a":"rgba(255,255,255,0.42)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><Pin size={10} fill={m.pinned?"currentColor":"none"}/></button>
                                    <button onClick={() => { setEditId(m.id); setEditText(m.content); setEditTopic(m.topic); }} title="Edit" style={{ width:24, height:24, borderRadius:7, background:"rgba(255,255,255,0.07)", border:"none", color:"rgba(255,255,255,0.42)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><Edit3 size={10}/></button>
                                    <button onClick={() => deleteMemory(m.id)} title="Delete" style={{ width:24, height:24, borderRadius:7, background:"rgba(255,255,255,0.07)", border:"none", color:"rgba(248,113,113,0.55)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><Trash2 size={10}/></button>
                                  </div>
                                )}
                                {isEd ? (
                                  <div>
                                    <textarea autoFocus value={editText} onChange={e => setEditText(e.target.value)} rows={3}
                                      style={{ width:"100%", boxSizing:"border-box", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.14)", borderRadius:8, padding:"7px 9px", color:"rgba(255,255,255,0.88)", fontSize:13, outline:"none", resize:"none", fontFamily:"inherit", lineHeight:1.5 }}/>
                                    <div style={{ display:"flex", gap:7, marginTop:7, alignItems:"center", flexWrap:"wrap" }}>
                                      <select value={editTopic} onChange={e => setEditTopic(e.target.value as Topic)} title="Topic"
                                        style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.14)", borderRadius:7, color:"rgba(255,255,255,0.85)", fontSize:12, padding:"4px 6px", fontFamily:"inherit", outline:"none", cursor:"pointer" }}>
                                        {(["work","personal","preferences","projects","health","relationships","general"] as Topic[]).map(t => (
                                          <option key={t} value={t} style={{ background:"#1a1a1f" }}>{t}</option>
                                        ))}
                                      </select>
                                      <button onClick={() => { saveEdit(m.id, editText, editTopic); setEditId(null); }} style={{ padding:"4px 14px", borderRadius:7, background:"rgba(52,211,153,0.12)", border:"1px solid rgba(52,211,153,0.3)", color:"rgba(52,211,153,0.9)", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Save</button>
                                      <button onClick={() => setEditId(null)} style={{ padding:"4px 10px", borderRadius:7, background:"transparent", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.35)", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <p style={{ fontSize:13, color:"rgba(255,255,255,0.82)", lineHeight:1.6, margin:0, paddingLeft:22, paddingRight:60 }}>{m.content}</p>
                                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8, flexWrap:"wrap" }}>
                                      <span style={{ fontSize:9.5, color:tc, background:`${tc}15`, padding:"2px 7px", borderRadius:4, fontWeight:600 }}>{m.topic}</span>
                                      <span style={{ fontSize:9.5, color:"rgba(255,255,255,0.18)" }}>{timeAgo(new Date(m.createdAt))}</span>
                                      {m.source && <span title={`Captured via ${m.source}`} style={{ fontSize:9, color:"rgba(255,255,255,0.3)", background:"rgba(255,255,255,0.05)", padding:"2px 6px", borderRadius:4, fontWeight:500 }}>{SOURCE_LABELS[m.source] || m.source}</span>}
                                      {(m.contradicts?.length || 0) > 0 && <span title="Conflicts with another memory" style={{ fontSize:9.5, color:"#f87171", background:"rgba(248,113,113,0.12)", padding:"2px 7px", borderRadius:4, fontWeight:600 }}>⚠ conflict</span>}
                                      {m.pinned && <span style={{ fontSize:10, color:"#f0b46a" }}>📌</span>}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
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

      {/* ════ LOGIN INTRO ANIMATION ════ */}
      {showIntro && (
        <>
          {/* ── Fading layer: panels + greeting + hint (logo is NOT here) ── */}
          <div onClick={dismissIntro} style={{
            position:"fixed", inset:0, zIndex:9999, overflow:"hidden", cursor:"pointer",
            animation: introFading ? "introOverlayFade 0.25s 0.7s ease both" : undefined,
          }}>
            {/* Golden upper diagonal panel — diagonal at 55%/65% passes through logo center (~60%) */}
            <div style={{
              position:"absolute", inset:0, pointerEvents:"none",
              background:"linear-gradient(158deg, #c97740 0%, #d4a85a 30%, #e8b86d 60%, #b97e35 100%)",
              clipPath:"polygon(0 0, 100% 0, 100% 55%, 0 65%)",
              animation: introFading ? "panelTopMerge 0.72s cubic-bezier(0.7,0,0.3,1) both" : "panelTopIn 0.55s cubic-bezier(0.22,1,0.36,1) both",
              willChange:"transform",
            }} />
            {/* Teal lower diagonal panel */}
            <div style={{
              position:"absolute", inset:0, pointerEvents:"none",
              background:"linear-gradient(158deg, #134e4a 0%, #0f766e 35%, #0d9488 65%, #2dd4bf 100%)",
              clipPath:"polygon(0 65%, 100% 55%, 100% 100%, 0 100%)",
              animation: introFading ? "panelBotMerge 0.72s cubic-bezier(0.7,0,0.3,1) both" : "panelBotIn 0.55s cubic-bezier(0.22,1,0.36,1) both",
              willChange:"transform",
            }} />
            {/* Greeting — just above the hub logo, fades out when closing */}
            <div style={{
              position:"absolute", top:"calc(50% + 26px - 215px)", left:0, right:0, textAlign:"center", pointerEvents:"none",
              animation: introFading ? "introOverlayFade 0.28s ease both" : undefined,
            }}>
              <div className="intro-greet" style={{ animation: introFading ? undefined : "introGreet 0.5s 0.3s ease both", fontSize:58, fontWeight:800, color:"#ffffff", letterSpacing:"-0.04em", lineHeight:1, willChange:"transform,opacity", textShadow:"0 2px 24px rgba(0,0,0,0.35)" }}>
                {getGreeting()}<span style={{ color:"#f0b46a" }}>,</span>
              </div>
              {user?.name && (
                <div className="intro-sub" style={{ animation: introFading ? undefined : "introSub 0.5s 0.55s ease both", fontSize:44, fontWeight:800, color:"#ffffff", letterSpacing:"-0.03em", lineHeight:1, marginTop:8, willChange:"opacity", textShadow:"0 2px 20px rgba(0,0,0,0.3)", opacity:0.9 }}>
                  {user.name.split(" ")[0]}
                </div>
              )}
            </div>
            <div style={{ position:"absolute", bottom:22, left:0, right:0, textAlign:"center", fontSize:11, color:"rgba(255,255,255,0.22)", letterSpacing:"0.06em", pointerEvents:"none" }}>tap to skip</div>
          </div>

          {/* ── Logo layer — pixel-perfect over the hub ──
               Hub is always at screen (50vw, 50vh+26px):
               HUB=(720,450)=center of 1440×900 canvas, header=52px, paddingTop=0
               → offset from 50vh = (52+0)/2 = 26px
               Size = 130×mapScale to match the hub's rendered size exactly */}
          <div style={{
            position:"fixed",
            left:"50%", top:"calc(50% + 26px)",
            transform:"translate(-50%,-50%)",
            zIndex:10000,
            pointerEvents:"none",
          }}>
            <div className="intro-logo" style={{
              animation: introFading
                ? "logoBurst 0.9s 0.15s ease forwards"
                : "introLogo 0.6s 0.2s cubic-bezier(0.34,1.56,0.64,1) both",
              willChange:"transform,filter",
            }}>
              <ImprintLogo size={Math.round(130 * mapScale)} />
            </div>
          </div>
        </>
      )}

      {/* ════ CONNECT IDE MODAL ════ */}
      {showConnect && (
        <ConnectIDEModal userId={userId} onClose={() => setShowConnect(false)} />
      )}

      {/* ════ NEW PROJECT MODAL ════ */}
      {showAddProject && (
        <Modal onClose={() => { setShowAddProject(false); setNewProjectName(""); }}>
          <div style={{ display:"flex", alignItems:"center", marginBottom:20 }}>
            <span style={{ fontSize:19, fontWeight:600, flex:1, letterSpacing:"-0.015em" }}>New Project</span>
            <button onClick={() => { setShowAddProject(false); setNewProjectName(""); }} style={{ width:30, height:30, borderRadius:9, background:"rgba(255,255,255,0.05)", border:"none", color:"rgba(255,255,255,0.5)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><X size={14}/></button>
          </div>
          <p style={{ fontSize:12.5, color:"rgba(255,255,255,0.3)", marginBottom:18, lineHeight:1.55 }}>
            Creates a project tag. You can then tag existing memories or add a snippet to your IDE&apos;s CLAUDE.md to auto-save future memories here.
          </p>
          <input
            autoFocus
            value={newProjectName}
            onChange={e => setNewProjectName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && newProjectName.trim()) addCustomProject(); if (e.key === "Escape") { setShowAddProject(false); setNewProjectName(""); } }}
            placeholder="Project name…"
            style={{ width:"100%", boxSizing:"border-box", height:46, padding:"0 14px", borderRadius:13, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.12)", color:"#fff", fontSize:15, fontFamily:"inherit", outline:"none" }}
          />
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:22 }}>
            <button onClick={() => { setShowAddProject(false); setNewProjectName(""); }} style={{ height:40, padding:"0 20px", borderRadius:11, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.7)", fontSize:13.5, fontWeight:500, fontFamily:"inherit", cursor:"pointer" }}>Cancel</button>
            <button onClick={addCustomProject} disabled={!newProjectName.trim()} style={{ height:40, padding:"0 22px", borderRadius:11, background:newProjectName.trim()?"linear-gradient(145deg,#5EEAD4,#0d9488)":"rgba(255,255,255,0.05)", border:"none", color:newProjectName.trim()?"#0a1a18":"rgba(255,255,255,0.2)", fontSize:13.5, fontWeight:600, fontFamily:"inherit", cursor:newProjectName.trim()?"pointer":"not-allowed", boxShadow:newProjectName.trim()?"0 4px 20px rgba(94,234,212,0.3)":"none" }}>Create Project</button>
          </div>
        </Modal>
      )}

      {/* ════ PROJECT MANAGER MODAL ════ */}
      {managerProject && (
        <ProjectManagerModal
          project={managerProject}
          memories={memories}
          onClose={() => setManagerProject(null)}
          onAddNew={() => { setManagerProject(null); setShowAddModal(true); }}
          onTag={(memId, add) => tagMemoryWithProject(memId, managerProject.id, add)}
        />
      )}

      {showQuickTag && (
        <QuickTagModal
          projects={customProjects}
          memories={memories}
          onClose={() => setShowQuickTag(false)}
          onTag={(memId, projectId, add) => tagMemoryWithProject(memId, projectId, add)}
        />
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

      {/* ════ CONFLICTS RESOLVER ════ */}
      {showConflicts && (
        <ConflictsModal
          memories={memories}
          onClose={() => setShowConflicts(false)}
          onKeep={resolveConflictKeep}
          onUnlink={unlinkConflict}
        />
      )}

      {/* ════ MEMORY HEALTH ════ */}
      {showHealth && (
        <MemoryHealthModal
          memories={memories}
          conflictPairs={conflictCount}
          dupGroups={dupClusters.length}
          dupLoading={dupLoading}
          autoClean={autoClean}
          onToggleAutoClean={toggleAutoClean}
          onClose={() => setShowHealth(false)}
          onOpenConflicts={() => { setShowHealth(false); setShowConflicts(true); }}
          onOpenDuplicates={() => { setShowHealth(false); setShowDuplicates(true); }}
        />
      )}
      {showDuplicates && (
        <DuplicatesModal
          clusters={dupClusters}
          loading={dupLoading}
          onClose={() => setShowDuplicates(false)}
          onMerge={mergeCluster}
        />
      )}

      {/* ════ BULK ACTION BAR ════ */}
      {selectedIds.size > 0 && (
        <div style={{ position:"fixed", bottom:22, left:"50%", transform:"translateX(-50%)", zIndex:90, display:"flex", alignItems:"center", gap:8, padding:"9px 12px", borderRadius:14, background:"rgba(20,20,24,0.96)", backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)", border:"1px solid rgba(255,255,255,0.14)", boxShadow:"0 18px 50px rgba(0,0,0,0.6)" }}>
          <span style={{ fontSize:13, fontWeight:600, color:"#fff", padding:"0 4px" }}>{selectedIds.size} selected</span>
          <div style={{ width:1, height:20, background:"rgba(255,255,255,0.12)" }}/>
          <button onClick={() => bulkSetPinned(true)} style={BULK_BTN}>📌 Pin</button>
          <button onClick={() => bulkSetPinned(false)} style={BULK_BTN}>Unpin</button>
          <select defaultValue="" onChange={e => { if (e.target.value) { bulkSetTopic(e.target.value as Topic); e.currentTarget.value = ""; } }} style={{ ...BULK_BTN, cursor:"pointer" }}>
            <option value="" disabled>Move to…</option>
            {(["work","personal","preferences","projects","health","relationships","general"] as Topic[]).map(t => (
              <option key={t} value={t} style={{ background:"#1a1a1f" }}>{t}</option>
            ))}
          </select>
          <button onClick={bulkDelete} style={{ ...BULK_BTN, color:"#f87171", background:"rgba(248,113,113,0.12)", border:"1px solid rgba(248,113,113,0.3)" }}>🗑 Delete</button>
          <button onClick={() => setSelectedIds(new Set())} style={{ ...BULK_BTN, color:"rgba(255,255,255,0.5)" }}>Clear</button>
        </div>
      )}
    </div>
  );
}
