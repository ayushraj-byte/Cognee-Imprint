"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Memory, Topic } from "@/lib/dynamodb";

const TOPICS: Topic[] = ["work","personal","preferences","health","projects","relationships","general"];

const TOPIC_COLOR: Record<string, string> = {
  work:          "#60a5fa",
  personal:      "#a78bfa",
  preferences:   "#fbbf24",
  health:        "#34d399",
  projects:      "#22d3ee",
  relationships: "#f472b6",
  general:       "#6b7280",
};

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Dashboard() {
  const [userId, setUserId]           = useState("");
  const [memories, setMemories]       = useState<Memory[]>([]);
  const [activeTopic, setActiveTopic] = useState<Topic | "all">("all");
  const [search, setSearch]           = useState("");
  const [loading, setLoading]         = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [importOpen, setImportOpen]   = useState(false);
  const [importText, setImportText]   = useState("");
  const [importing, setImporting]     = useState(false);
  const [stats, setStats]             = useState({ total: 0, pinned: 0, contradictions: 0 });

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const id = p.get("userId") || localStorage.getItem("imprint_user_id") || "";
    setUserId(id);
    if (id) localStorage.setItem("imprint_user_id", id);
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const url = search
        ? `/api/memories?userId=${userId}&search=${encodeURIComponent(search)}`
        : activeTopic !== "all"
          ? `/api/memories?userId=${userId}&topic=${activeTopic}`
          : `/api/memories?userId=${userId}`;
      const data = await fetch(url).then(r => r.json());
      const m: Memory[] = data.memories || [];
      setMemories(m);
      setStats({ total: m.length, pinned: m.filter(x => x.pinned).length, contradictions: m.filter(x => x.contradicts?.length > 0).length });
    } finally { setLoading(false); }
  }, [userId, activeTopic, search]);

  useEffect(() => { load(); }, [load]);

  async function del(mem: Memory) {
    await fetch(`/api/memories/${mem.memoryId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, createdAt: mem.createdAt }) });
    load();
  }
  async function pin(mem: Memory) {
    await fetch(`/api/memories/${mem.memoryId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, createdAt: mem.createdAt, pinned: !mem.pinned }) });
    load();
  }
  async function saveEdit(mem: Memory) {
    await fetch(`/api/memories/${mem.memoryId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, createdAt: mem.createdAt, content: editContent }) });
    setEditingId(null); load();
  }
  async function runImport() {
    if (!importText.trim() || !userId) return;
    setImporting(true);
    try {
      const data = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, text: importText }) }).then(r => r.json());
      setImportText(""); setImportOpen(false); load();
    } finally { setImporting(false); }
  }

  const topicCounts = TOPICS.reduce((a, t) => ({ ...a, [t]: memories.filter(m => m.topic === t).length }), {} as Record<string, number>);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Syne:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:       #15140e;
          --bg2:      #111009;
          --bg3:      #1e1d14;
          --border:   #302e1f;
          --border2:  #3d3b27;
          --text:     #ccc9ae;
          --text-dim: #7a7860;
          --text-mid: #a8a48c;
          --bright:   #eae6ce;
          --orange:   #c87941;
          --orange-d: #9a5a2e;
        }

        html, body {
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          font-family: 'Syne', sans-serif;
          overflow-x: hidden;
        }

        /* grain */
        body::after {
          content: '';
          position: fixed; inset: -100px;
          width: calc(100% + 200px); height: calc(100% + 200px);
          pointer-events: none; z-index: 9999;
          background: url("data:image/svg+xml,%3Csvg xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%3E%3Cfilter id%3D'n'%3E%3CfeTurbulence type%3D'fractalNoise' baseFrequency%3D'0.85' numOctaves%3D'4' stitchTiles%3D'stitch'%2F%3E%3C%2Ffilter%3E%3Crect width%3D'100%25' height%3D'100%25' filter%3D'url(%23n)' opacity%3D'0.065'%2F%3E%3C%2Fsvg%3E") repeat;
          background-size: 180px; mix-blend-mode: overlay;
          animation: grain .65s steps(1) infinite;
        }
        @keyframes grain {
          0%  { transform: translate(0,0); } 20% { transform: translate(-4%,-5%); }
          40% { transform: translate(5%,3%); }  60% { transform: translate(-3%,6%); }
          80% { transform: translate(6%,-3%); }
        }

        /* ── Layout ── */
        .shell { display: flex; min-height: 100vh; position: relative; z-index: 1; }

        /* ── Sidebar ── */
        .side {
          width: 240px; flex-shrink: 0;
          background: var(--bg2);
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column;
          position: sticky; top: 0; height: 100vh;
        }

        .side-head {
          padding: 24px 20px 20px;
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between;
        }

        .brand {
          font-family: 'Syne', sans-serif;
          font-weight: 700; font-size: 13px;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--bright); text-decoration: none;
        }

        .side-nav { padding: 20px 12px; flex: 1; }

        .side-link {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 10px; border-radius: 5px; margin-bottom: 1px;
          font-size: 12px; letter-spacing: 0.05em;
          color: var(--text-dim); text-decoration: none;
          transition: all 0.15s; cursor: pointer; border: none; background: none;
          width: 100%; text-align: left;
        }
        .side-link:hover { background: rgba(204,201,174,0.05); color: var(--text); }
        .side-link.active { background: rgba(204,201,174,0.07); color: var(--bright); }
        .side-link .cnt {
          font-family: 'Cormorant Garamond', serif;
          font-size: 12px; font-style: italic; opacity: 0.6;
        }

        .side-divider {
          height: 1px; background: var(--border);
          margin: 12px 0;
        }

        .side-foot {
          padding: 16px 20px;
          border-top: 1px solid var(--border);
          display: flex; align-items: center; gap: 10px;
        }
        .s-av {
          width: 26px; height: 26px; border-radius: 50%;
          background: linear-gradient(135deg, var(--orange), var(--orange-d));
          display: grid; place-items: center;
          font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0;
        }
        .s-name { font-size: 11px; font-weight: 500; color: var(--text); }
        .s-plan { font-size: 9px; color: var(--text-dim); letter-spacing: 0.04em; }

        /* ── Main ── */
        .main { flex: 1; min-width: 0; }

        /* ── Page header ── */
        .page-head {
          padding: 48px 60px 0;
          border-bottom: 1px solid var(--border);
          display: flex; flex-direction: column;
        }

        .page-eyebrow {
          font-size: 10px; letter-spacing: 0.2em;
          text-transform: uppercase; color: var(--text-dim);
          margin-bottom: 10px;
        }

        .page-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(52px, 6vw, 80px);
          line-height: 0.9; letter-spacing: 0.04em;
          background: linear-gradient(180deg, var(--bright) 0%, rgba(204,201,174,0.35) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 32px;
        }

        .page-tabs {
          display: flex; gap: 0;
          margin-bottom: -1px;
        }

        .tab-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 10px 16px; background: none; border: none;
          border-bottom: 2px solid transparent;
          font-family: 'Syne', sans-serif;
          font-size: 11px; font-weight: 500; letter-spacing: 0.07em;
          text-transform: uppercase; color: var(--text-dim);
          cursor: pointer; transition: all 0.2s;
          white-space: nowrap;
        }
        .tab-btn:hover { color: var(--text); }
        .tab-btn.on { color: var(--bright); border-bottom-color: var(--orange); }
        .tab-cnt {
          font-family: 'Cormorant Garamond', serif;
          font-size: 11px; font-style: italic;
          opacity: 0.55; font-weight: 400; letter-spacing: 0;
        }

        /* ── Stats ── */
        .stats-row {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 1px; background: var(--border);
          border-bottom: 1px solid var(--border);
        }

        .stat-cell {
          background: var(--bg);
          padding: 28px 40px;
          display: flex; flex-direction: column; gap: 4px;
        }

        .stat-num {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 52px; line-height: 1;
          letter-spacing: 0.02em;
        }

        .stat-label {
          font-size: 10px; letter-spacing: 0.16em;
          text-transform: uppercase; color: var(--text-dim);
        }

        /* ── Controls bar ── */
        .controls {
          padding: 20px 60px;
          display: flex; align-items: center; gap: 12px;
          border-bottom: 1px solid var(--border);
        }

        .search-wrap { flex: 1; position: relative; }
        .search-icon {
          position: absolute; left: 14px; top: 50%;
          transform: translateY(-50%);
          font-size: 13px; color: var(--text-dim); pointer-events: none;
        }
        .search-in {
          width: 100%; padding: 10px 14px 10px 38px;
          background: var(--bg3);
          border: 1px solid var(--border2);
          border-radius: 7px;
          font-family: 'Cormorant Garamond', serif;
          font-size: 16px; font-weight: 300;
          color: var(--bright); outline: none;
          transition: border-color 0.2s;
        }
        .search-in::placeholder { color: var(--text-dim); }
        .search-in:focus { border-color: rgba(200,121,65,0.45); }

        .ctrl-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px;
          font-family: 'Syne', sans-serif;
          font-size: 11px; font-weight: 600; letter-spacing: 0.07em;
          text-transform: uppercase;
          background: transparent;
          border: 1px solid var(--border2);
          border-radius: 6px;
          color: var(--text-mid);
          cursor: pointer; white-space: nowrap;
          transition: all 0.2s;
        }
        .ctrl-btn:hover { border-color: var(--orange); color: var(--orange); }
        .ctrl-btn.primary {
          background: var(--orange); border-color: var(--orange); color: #fff;
        }
        .ctrl-btn.primary:hover { background: var(--orange-d); border-color: var(--orange-d); }

        /* ── Memory list ── */
        .list-area { padding: 0 60px 80px; }

        .list-header {
          display: grid;
          grid-template-columns: 24px 1fr 120px 80px 90px;
          gap: 0 20px; align-items: center;
          padding: 14px 0 10px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 0;
        }
        .col-label {
          font-size: 9px; letter-spacing: 0.18em;
          text-transform: uppercase; color: var(--text-dim);
        }

        .mem-row {
          display: grid;
          grid-template-columns: 24px 1fr 120px 80px 90px;
          gap: 0 20px; align-items: start;
          padding: 20px 0;
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
        }
        .mem-row:hover { background: rgba(204,201,174,0.02); margin: 0 -60px; padding: 20px 60px; }

        .pip {
          width: 7px; height: 7px; border-radius: 50%;
          flex-shrink: 0; margin-top: 6px;
        }

        .mem-content {
          font-family: 'Cormorant Garamond', serif;
          font-size: 17px; font-weight: 300;
          line-height: 1.6; color: var(--bright);
        }

        .mem-edit-ta {
          width: 100%;
          background: var(--bg3);
          border: 1px solid var(--border2);
          border-radius: 6px;
          padding: 8px 12px;
          font-family: 'Cormorant Garamond', serif;
          font-size: 16px; font-weight: 300;
          color: var(--bright); outline: none;
          resize: none; line-height: 1.6;
        }
        .mem-edit-ta:focus { border-color: rgba(200,121,65,0.5); }

        .edit-actions { display: flex; gap: 6px; margin-top: 8px; }
        .edit-save, .edit-cancel {
          font-family: 'Syne', sans-serif;
          font-size: 10px; font-weight: 600; letter-spacing: 0.07em;
          text-transform: uppercase;
          padding: 5px 12px; border-radius: 5px;
          border: none; cursor: pointer; transition: all 0.2s;
        }
        .edit-save { background: var(--orange); color: #fff; }
        .edit-save:hover { background: var(--orange-d); }
        .edit-cancel { background: rgba(204,201,174,0.06); color: var(--text-mid); }
        .edit-cancel:hover { background: rgba(204,201,174,0.1); }

        .topic-tag {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 10px; letter-spacing: 0.1em;
          text-transform: uppercase; font-weight: 600;
        }

        .mem-time {
          font-family: 'Cormorant Garamond', serif;
          font-size: 13px; font-style: italic;
          color: var(--text-dim);
        }

        .row-actions { display: flex; align-items: center; gap: 4px; }

        .icon-btn {
          width: 28px; height: 28px;
          display: grid; place-items: center;
          background: none; border: 1px solid transparent;
          border-radius: 5px; cursor: pointer;
          font-size: 13px; color: var(--text-dim);
          transition: all 0.18s;
        }
        .icon-btn:hover { border-color: var(--border2); color: var(--text-mid); }
        .icon-btn.pin-on { color: var(--orange); }
        .icon-btn.del:hover { border-color: rgba(229,115,115,0.3); color: #e57373; }

        .pinned-flag {
          font-size: 10px; letter-spacing: 0.06em;
          color: var(--orange); opacity: 0.7;
        }
        .contra-flag {
          font-size: 10px; letter-spacing: 0.06em;
          color: #e57373; opacity: 0.8;
        }

        /* Empty / loading */
        .empty-area {
          padding: 80px 60px;
          text-align: center;
        }
        .empty-brand {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(60px, 10vw, 120px);
          letter-spacing: 0.1em; line-height: 1;
          background: linear-gradient(180deg, rgba(204,201,174,0.2) 0%, rgba(204,201,174,0.03) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 20px; user-select: none;
        }
        .empty-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 20px; font-weight: 300; font-style: italic;
          color: var(--text); margin-bottom: 8px;
        }
        .empty-sub {
          font-family: 'Cormorant Garamond', serif;
          font-size: 15px; font-weight: 300;
          color: var(--text-dim); line-height: 1.7;
        }

        /* ── Modal ── */
        .backdrop {
          position: fixed; inset: 0;
          background: rgba(8,8,5,0.85);
          backdrop-filter: blur(10px) saturate(0.4);
          z-index: 400;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          animation: bd-in 0.25s ease both;
        }
        @keyframes bd-in { from { opacity:0 } to { opacity:1 } }

        .modal {
          position: relative;
          background: var(--bg2);
          border: 1px solid var(--border2);
          border-radius: 14px;
          padding: 44px 40px 40px;
          width: 100%; max-width: 520px;
          animation: mod-in 0.38s cubic-bezier(.16,1,.3,1) both;
        }
        @keyframes mod-in {
          from { opacity:0; transform: translateY(20px) scale(0.97); }
          to   { opacity:1; transform: none; }
        }

        .modal-x {
          position: absolute; top: 16px; right: 16px;
          background: none; border: none;
          color: var(--text-dim); font-size: 20px;
          cursor: pointer; padding: 6px 10px;
          transition: color 0.2s;
        }
        .modal-x:hover { color: var(--text); }

        .modal-eyebrow {
          font-size: 9px; letter-spacing: 0.2em;
          text-transform: uppercase; color: var(--text-dim);
          margin-bottom: 6px;
        }

        .modal-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 28px; font-weight: 300; font-style: italic;
          color: var(--bright); margin-bottom: 8px;
        }

        .modal-sub {
          font-family: 'Cormorant Garamond', serif;
          font-size: 15px; font-weight: 300;
          color: var(--text-dim); line-height: 1.7; margin-bottom: 24px;
        }

        .modal-ta {
          width: 100%; min-height: 140px;
          background: var(--bg);
          border: 1px solid var(--border2);
          border-radius: 8px;
          padding: 14px 16px;
          font-family: 'Cormorant Garamond', serif;
          font-size: 16px; font-weight: 300;
          color: var(--bright); outline: none;
          resize: none; line-height: 1.65;
          margin-bottom: 14px;
        }
        .modal-ta::placeholder { color: var(--text-dim); }
        .modal-ta:focus { border-color: rgba(200,121,65,0.45); }

        .modal-actions { display: flex; gap: 8px; }

        .userId-notice {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 18px;
          background: rgba(200,121,65,0.06);
          border: 1px solid rgba(200,121,65,0.2);
          border-radius: 8px; margin-bottom: 24px;
        }
        .userId-label {
          font-size: 11px; letter-spacing: 0.06em;
          color: var(--orange); text-transform: uppercase; font-weight: 600;
        }
        .userId-input {
          flex: 1; background: transparent; border: none; outline: none;
          font-family: 'Syne', monospace; font-size: 12px;
          color: var(--text); letter-spacing: 0.03em;
        }
        .userId-btn {
          font-family: 'Syne', sans-serif;
          font-size: 10px; font-weight: 600; letter-spacing: 0.08em;
          background: var(--orange); color: #fff;
          border: none; border-radius: 5px;
          padding: 5px 12px; cursor: pointer; white-space: nowrap;
          transition: background 0.2s;
        }
        .userId-btn:hover { background: var(--orange-d); }

        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }
      `}</style>

      <div className="shell">
        {/* ── Sidebar ── */}
        <aside className="side">
          <div className="side-head">
            <Link href="/" className="brand">Imprint</Link>
          </div>
          <nav className="side-nav">
            <button
              className={`side-link ${activeTopic === "all" ? "active" : ""}`}
              onClick={() => setActiveTopic("all")}
            >
              <span>All memories</span>
              <span className="cnt">{stats.total}</span>
            </button>
            <div className="side-divider" />
            {TOPICS.map(t => (
              <button
                key={t}
                className={`side-link ${activeTopic === t ? "active" : ""}`}
                onClick={() => setActiveTopic(t)}
                style={activeTopic === t ? { color: TOPIC_COLOR[t] } : {}}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: TOPIC_COLOR[t], display: "inline-block", flexShrink: 0 }} />
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </span>
                <span className="cnt">{topicCounts[t] || 0}</span>
              </button>
            ))}
          </nav>
          <div className="side-foot">
            <div className="s-av">Y</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="s-name">You</span>
              <span className="s-plan">Memory Dashboard</span>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="main">
          {/* Page header */}
          <div className="page-head">
            <div className="page-eyebrow">Imprint · Memory Dashboard</div>
            <div className="page-title">MEMORIES</div>
            <div className="page-tabs">
              {(["all", ...TOPICS] as const).map(t => (
                <button
                  key={t}
                  className={`tab-btn ${activeTopic === t ? "on" : ""}`}
                  onClick={() => setActiveTopic(t)}
                >
                  {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
                  <span className="tab-cnt">{t === "all" ? stats.total : topicCounts[t] || 0}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="stats-row">
            {[
              { label: "Total Memories", value: stats.total, color: "var(--bright)" },
              { label: "Pinned",          value: stats.pinned, color: "var(--orange)" },
              { label: "Contradictions",  value: stats.contradictions, color: "#e57373" },
            ].map(s => (
              <div key={s.label} className="stat-cell">
                <div className="stat-num" style={{ color: s.color }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* User ID notice if not set */}
          {!userId && (
            <div style={{ padding: "20px 60px 0" }}>
              <div className="userId-notice">
                <span className="userId-label">User ID</span>
                <input
                  className="userId-input"
                  placeholder="Paste your user ID from the extension…"
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      const v = (e.target as HTMLInputElement).value.trim();
                      if (v) { setUserId(v); localStorage.setItem("imprint_user_id", v); }
                    }
                  }}
                />
                <button
                  className="userId-btn"
                  onClick={(e) => {
                    const inp = (e.currentTarget.previousSibling as HTMLInputElement);
                    if (inp.value) { setUserId(inp.value); localStorage.setItem("imprint_user_id", inp.value); }
                  }}
                >Load →</button>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="controls">
            <div className="search-wrap">
              <span className="search-icon">⌕</span>
              <input
                className="search-in"
                placeholder="Search memories…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="ctrl-btn" onClick={load}>↺ Refresh</button>
            <button className="ctrl-btn primary" onClick={() => setImportOpen(true)}>+ Import</button>
          </div>

          {/* List */}
          <div className="list-area">
            {loading ? (
              <div className="empty-area">
                <div className="empty-brand">MEM</div>
                <div className="empty-title">Loading memories…</div>
              </div>
            ) : memories.length === 0 ? (
              <div className="empty-area">
                <div className="empty-brand">IMPRINT</div>
                <div className="empty-title">No memories yet</div>
                <div className="empty-sub">
                  Start a conversation on Claude.ai with the extension installed,<br />
                  or import existing memories using the button above.
                </div>
              </div>
            ) : (
              <>
                <div className="list-header">
                  <span />
                  <span className="col-label">Memory</span>
                  <span className="col-label">Topic</span>
                  <span className="col-label">When</span>
                  <span className="col-label">Actions</span>
                </div>

                {memories.map((mem, i) => (
                  <div key={mem.memoryId} className="mem-row" style={{ animationDelay: `${i * 40}ms` }}>
                    {/* pip */}
                    <div className="pip" style={{ background: TOPIC_COLOR[mem.topic] || "#6b7280" }} />

                    {/* content */}
                    <div>
                      {editingId === mem.memoryId ? (
                        <>
                          <textarea
                            className="mem-edit-ta"
                            rows={3}
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                          />
                          <div className="edit-actions">
                            <button className="edit-save" onClick={() => saveEdit(mem)}>Save</button>
                            <button className="edit-cancel" onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        </>
                      ) : (
                        <div className="mem-content">{mem.content}</div>
                      )}
                      {mem.pinned && <div className="pinned-flag">◈ Pinned</div>}
                      {mem.contradicts?.length > 0 && <div className="contra-flag">↯ Flagged</div>}
                    </div>

                    {/* topic */}
                    <div className="topic-tag" style={{ color: TOPIC_COLOR[mem.topic] || "#6b7280" }}>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                      {mem.topic}
                    </div>

                    {/* time */}
                    <div className="mem-time">{timeAgo(mem.createdAt)}</div>

                    {/* actions */}
                    <div className="row-actions">
                      <button
                        className={`icon-btn ${mem.pinned ? "pin-on" : ""}`}
                        title={mem.pinned ? "Unpin" : "Pin"}
                        onClick={() => pin(mem)}
                      >◈</button>
                      <button
                        className="icon-btn"
                        title="Edit"
                        onClick={() => { setEditingId(mem.memoryId); setEditContent(mem.content); }}
                      >✎</button>
                      <button className="icon-btn del" title="Delete" onClick={() => del(mem)}>✕</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Import modal */}
      {importOpen && (
        <div className="backdrop" onClick={e => e.target === e.currentTarget && setImportOpen(false)}>
          <div className="modal">
            <button className="modal-x" onClick={() => setImportOpen(false)}>×</button>
            <div className="modal-eyebrow">Import · Imprint</div>
            <div className="modal-title">Seed your memory</div>
            <div className="modal-sub">
              Paste any text — a past conversation, notes, a bio — and Claude will extract the key facts automatically.
            </div>
            <textarea
              className="modal-ta"
              rows={7}
              placeholder="Paste any text with facts about yourself…"
              value={importText}
              onChange={e => setImportText(e.target.value)}
            />
            <div className="modal-actions">
              <button
                className="ctrl-btn primary"
                style={{ flex: 1 }}
                onClick={runImport}
                disabled={importing || !importText.trim()}
              >
                {importing ? "Extracting…" : "Extract & Import →"}
              </button>
              <button className="ctrl-btn" onClick={() => setImportOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
