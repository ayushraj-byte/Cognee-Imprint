"use client";

import { useEffect, useState, useCallback } from "react";
import { Memory, Topic } from "@/lib/dynamodb";

const TOPICS: Topic[] = [
  "work",
  "personal",
  "preferences",
  "health",
  "projects",
  "relationships",
  "general",
];

const TOPIC_COLORS: Record<Topic, string> = {
  work: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  personal: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  preferences: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  health: "bg-green-500/20 text-green-400 border-green-500/30",
  projects: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  relationships: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  general: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Dashboard() {
  const [userId, setUserId] = useState("");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [filtered, setFiltered] = useState<Memory[]>([]);
  const [activeTopic, setActiveTopic] = useState<Topic | "all">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [stats, setStats] = useState({ total: 0, pinned: 0, contradictions: 0 });

  // Get userId from URL param or localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("userId") || localStorage.getItem("cme_user_id") || "";
    setUserId(id);
    if (id) localStorage.setItem("cme_user_id", id);
  }, []);

  const fetchMemories = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const url = search
        ? `/api/memories?userId=${userId}&search=${encodeURIComponent(search)}`
        : activeTopic !== "all"
        ? `/api/memories?userId=${userId}&topic=${activeTopic}`
        : `/api/memories?userId=${userId}`;

      const res = await fetch(url);
      const data = await res.json();
      const mems: Memory[] = data.memories || [];
      setMemories(mems);
      setFiltered(mems);
      setStats({
        total: mems.length,
        pinned: mems.filter((m) => m.pinned).length,
        contradictions: mems.filter((m) => m.contradicts?.length > 0).length,
      });
    } finally {
      setLoading(false);
    }
  }, [userId, activeTopic, search]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  async function deleteMemory(memory: Memory) {
    await fetch(`/api/memories/${memory.memoryId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, createdAt: memory.createdAt }),
    });
    fetchMemories();
  }

  async function togglePin(memory: Memory) {
    await fetch(`/api/memories/${memory.memoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        createdAt: memory.createdAt,
        pinned: !memory.pinned,
      }),
    });
    fetchMemories();
  }

  async function saveEdit(memory: Memory) {
    await fetch(`/api/memories/${memory.memoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        createdAt: memory.createdAt,
        content: editContent,
      }),
    });
    setEditingId(null);
    fetchMemories();
  }

  async function runImport() {
    if (!importText.trim() || !userId) return;
    setImporting(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, text: importText }),
      });
      const data = await res.json();
      alert(`Imported ${data.imported} memories!`);
      setImportText("");
      setImportOpen(false);
      fetchMemories();
    } finally {
      setImporting(false);
    }
  }

  const topicCounts = TOPICS.reduce(
    (acc, t) => ({ ...acc, [t]: memories.filter((m) => m.topic === t).length }),
    {} as Record<Topic, number>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0d0d0d]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-lg">
              🧠
            </div>
            <div>
              <h1 className="font-semibold text-white text-sm">
                Claude Memory Enhancer
              </h1>
              <p className="text-xs text-slate-500">Memory Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setImportOpen(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors border border-white/10"
            >
              + Import
            </button>
            <a
              href="https://claude.ai"
              target="_blank"
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              Open Claude.ai →
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* User ID input if not set */}
        {!userId && (
          <div className="mb-8 p-6 rounded-2xl border border-blue-500/20 bg-blue-500/5">
            <h2 className="text-sm font-semibold text-blue-400 mb-2">
              Enter your User ID
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Find your User ID in the Claude Memory Enhancer extension popup → Settings tab.
            </p>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                placeholder="Paste your user ID..."
                onChange={(e) => setUserId(e.target.value)}
              />
              <button
                onClick={() => {
                  localStorage.setItem("cme_user_id", userId);
                  fetchMemories();
                }}
                className="px-4 py-2 bg-blue-600 rounded-lg text-sm text-white hover:bg-blue-500 transition-colors"
              >
                Load
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Memories", value: stats.total, icon: "💭", color: "text-blue-400" },
            { label: "Pinned", value: stats.pinned, icon: "📌", color: "text-amber-400" },
            { label: "Contradictions", value: stats.contradictions, icon: "⚠️", color: "text-red-400" },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white/[0.03] border border-white/5 rounded-2xl p-5"
            >
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-6">
          {/* Sidebar — topic filters */}
          <div className="w-48 flex-shrink-0">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">
              Namespaces
            </div>
            <div className="space-y-1">
              <button
                onClick={() => setActiveTopic("all")}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                  activeTopic === "all"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <span>All</span>
                <span className="text-xs opacity-60">{stats.total}</span>
              </button>
              {TOPICS.map((topic) => (
                <button
                  key={topic}
                  onClick={() => setActiveTopic(topic)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between capitalize ${
                    activeTopic === topic
                      ? "bg-white/10 text-white"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span>{topic}</span>
                  <span className="text-xs opacity-60">{topicCounts[topic]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main memories list */}
          <div className="flex-1">
            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search memories..."
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 placeholder-slate-600"
              />
            </div>

            {loading ? (
              <div className="text-center py-16 text-slate-600">Loading memories...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">💭</div>
                <div className="text-slate-500 text-sm">No memories yet</div>
                <div className="text-slate-600 text-xs mt-1">
                  Start a conversation on Claude.ai with the extension installed
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((memory) => (
                  <div
                    key={memory.memoryId}
                    className={`bg-white/[0.03] border rounded-xl p-4 transition-all hover:border-white/10 ${
                      memory.contradicts?.length > 0
                        ? "border-red-500/20 bg-red-500/[0.02]"
                        : memory.pinned
                        ? "border-amber-500/20 bg-amber-500/[0.02]"
                        : "border-white/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${TOPIC_COLORS[memory.topic]}`}
                          >
                            {memory.topic}
                          </span>
                          {memory.pinned && (
                            <span className="text-[10px] text-amber-400">📌 Pinned</span>
                          )}
                          {memory.contradicts?.length > 0 && (
                            <span className="text-[10px] text-red-400">⚠️ Contradiction</span>
                          )}
                        </div>

                        {editingId === memory.memoryId ? (
                          <div className="space-y-2">
                            <textarea
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 resize-none"
                              rows={3}
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit(memory)}
                                className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-xs px-3 py-1 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-200 leading-relaxed">
                            {memory.content}
                          </p>
                        )}

                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-slate-600">
                            {timeAgo(memory.createdAt)}
                          </span>
                          {memory.source && (
                            <span className="text-xs text-slate-700">
                              via {memory.source.includes("claude.ai") ? "Claude.ai" : memory.source}
                            </span>
                          )}
                          <span className="text-xs text-slate-700">
                            {Math.round((memory.confidence || 1) * 100)}% confidence
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => togglePin(memory)}
                          title={memory.pinned ? "Unpin" : "Pin"}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-amber-400 transition-colors text-sm"
                        >
                          📌
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(memory.memoryId);
                            setEditContent(memory.content);
                          }}
                          title="Edit"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-blue-400 transition-colors text-sm"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteMemory(memory)}
                          title="Delete"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-red-400 transition-colors text-sm"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Import modal */}
      {importOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="font-semibold text-white mb-1">Import Memories</h2>
            <p className="text-xs text-slate-500 mb-4">
              Paste any text — Claude will extract the key facts and add them to your memory.
            </p>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500 resize-none"
              rows={8}
              placeholder="Paste a conversation, notes, or any text with facts about yourself..."
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={runImport}
                disabled={importing || !importText.trim()}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
              >
                {importing ? "Importing..." : "Extract & Import"}
              </button>
              <button
                onClick={() => setImportOpen(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
