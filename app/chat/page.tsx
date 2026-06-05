"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Brain, SquarePen, Paperclip, ArrowUp, Plus, MessageSquare,
  Database, X, PanelRight, Zap, Copy, Check, ChevronRight,
  MemoryStick
} from "lucide-react";
import BackgroundVideo from "../components/BackgroundVideo";

/* ─────────── types ─────────── */
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}
interface CapturedMemory {
  content: string;
  topic: string;
}
interface Contradiction {
  explanation: string;
}

/* ─────────── constants ─────────── */
const GUEST_LIMIT = 20;
const HISTORY_ITEMS = [
  "AWS Aurora pgvector Sync",
  "Claude Context Optimization",
  "DynamoDB Pipeline Redesign",
  "Memory Import Session",
];
const STARTER_PROMPTS = [
  { label: "Introduce yourself", text: "Tell me your name, what you do, and where you're based." },
  { label: "Your current projects", text: "What projects are you actively working on right now?" },
  { label: "Your preferences", text: "How do you like Claude to respond — tone, length, style?" },
  { label: "Something to remember", text: "Tell me one important thing you want Claude to always know." },
];

function generateResponse(userText: string, mem: CapturedMemory[]): string {
  const l = userText.toLowerCase();
  if (mem.length && (l.includes("remember") || l.includes("know about"))) {
    return `Here's what I've captured about you so far:\n\n${mem.slice(0, 4).map((m) => `— ${m.content}`).join("\n")}\n\nShall I add anything else?`;
  }
  if (l.includes("name")) return "Got it — I'll remember that. What else would you like me to know?";
  if (l.includes("work") || l.includes("job")) return "Noted. Context about your work helps me give sharper answers. What are you focused on right now?";
  if (l.includes("prefer") || l.includes("like") || l.includes("love")) return "Preference captured. Imprint is storing this so I'll carry it forward into every future session.";
  return `Message received. Imprint is extracting key facts from what you've shared and storing them securely.\n\nNext time we speak, I'll already know this about you. What else would you like me to remember?`;
}

/* ─────────── syntax colour helper ─────────── */
function colourLine(raw: string): string {
  // Escape HTML entities first
  let s = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // "key": → teal
  s = s.replace(/"([^"]+)":/g, '<span style="color:#4eecd8">"$1"</span>:');
  // : "value" → gold
  s = s.replace(/: "([^"]+)"/g, ': <span style="color:#f9d97a">"$1"</span>');
  // : true / false / null → purple
  s = s.replace(/: (true|false|null)/g, ': <span style="color:#c792ea">$1</span>');
  // : number → coral
  s = s.replace(/: (\d+\.?\d*)/g, ': <span style="color:#f78c6c">$1</span>');
  return s;
}

/* ─────────── Memory Panel (Claude Code right pane) ─────────── */
function MemoryPanel({
  memories,
  sessionId,
  onClose,
}: {
  memories: CapturedMemory[];
  sessionId: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const memObj = {
    session_id: sessionId.slice(0, 8),
    backend: "aurora-serverless",
    edge: "vercel-edge",
    memories: memories.map((m) => ({
      topic: m.topic,
      content: m.content,
      confidence: 0.97,
      vector_indexed: true,
    })),
  };

  const jsonStr = JSON.stringify(memObj, null, 2);
  const lines = jsonStr.split("\n");

  async function copy() {
    await navigator.clipboard.writeText(jsonStr).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <aside className="w-[340px] flex-shrink-0 h-full flex flex-col bg-[#0b0b0b] border-l border-white/[0.05] relative z-10">
      {/* ── Tab strip ── */}
      <div className="flex items-center border-b border-white/[0.05] text-[11px] font-mono h-9 flex-shrink-0">
        {/* Active tab */}
        <div className="flex items-center gap-2 px-4 h-full border-r border-white/[0.05] bg-white/[0.03] text-white/55 select-none">
          <Database size={10} className="text-teal-400/60 flex-shrink-0" />
          <span className="text-[10.5px]">memory.json</span>
          {memories.length > 0 && (
            <span className="text-[9px] bg-teal-400/15 text-teal-400/70 rounded-full px-1.5 py-0 leading-4">
              {memories.length}
            </span>
          )}
        </div>
        {/* Right actions */}
        <div className="flex items-center gap-2 ml-auto pr-3">
          <button onClick={copy} title="Copy JSON" className="text-white/20 hover:text-white/50 transition-colors p-1">
            {copied ? <Check size={10} /> : <Copy size={10} />}
          </button>
          <button onClick={onClose} title="Close panel" className="text-white/20 hover:text-white/50 transition-colors p-1">
            <X size={10} />
          </button>
        </div>
      </div>

      {/* ── Editor body ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {memories.length === 0 ? (
          <div className="p-5 font-mono text-[11px] select-none leading-5">
            <p className="text-white/20">// No memories captured yet.</p>
            <p className="text-white/12">// Start chatting to build your</p>
            <p className="text-white/12">// persistent memory layer.</p>
            <br />
            <p className="text-white/[0.08]">// Imprint indexes every message</p>
            <p className="text-white/[0.08]">// as pgvector embeddings into</p>
            <p className="text-white/[0.08]">// AWS Aurora Serverless.</p>
            <br />
            <p className="text-white/[0.08]">// Next session, Claude will</p>
            <p className="text-white/[0.08]">// remember this conversation.</p>
          </div>
        ) : (
          <div className="py-1.5">
            {lines.map((line, i) => (
              <div key={i} className="flex items-start hover:bg-white/[0.018] group min-h-[20px]">
                <span className="text-white/[0.14] select-none w-8 text-right pr-3 flex-shrink-0 font-mono text-[10px] leading-5 group-hover:text-white/25 pt-[2px]">
                  {i + 1}
                </span>
                <span
                  className="font-mono text-[11px] leading-5 text-white/40 flex-1 pr-4 whitespace-pre"
                  dangerouslySetInnerHTML={{ __html: colourLine(line) }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      <div className="border-t border-white/[0.04] px-4 py-1.5 flex items-center justify-between font-mono text-[9px] text-white/[0.15] flex-shrink-0 bg-[#090909]">
        <span className="flex items-center gap-1.5">
          <Zap size={8} className="text-teal-400/40" />
          <span>Aurora Serverless</span>
          <span className="text-white/[0.08] mx-1">·</span>
          <span className="text-white/[0.08]">Vercel Edge</span>
        </span>
        <span>{memories.length} memories · {jsonStr.length}B</span>
      </div>
    </aside>
  );
}

/* ─────────── Main chat app ─────────── */
function ChatApp() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "guest";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const [memories, setMemories] = useState<CapturedMemory[]>([]);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [keyConnected] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const [userId] = useState(() => {
    if (typeof window === "undefined") return "guest-" + Math.random().toString(36).slice(2);
    const stored = localStorage.getItem("imprint_user_id");
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem("imprint_user_id", id);
    return id;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const remaining = GUEST_LIMIT - msgCount;
  const isLimitReached = mode === "guest" && !keyConnected && remaining <= 0;
  const tokenCount = Math.floor(msgCount * 14 + memories.length * 6);
  const contextLoad = (tokenCount / 200000 * 100).toFixed(2);
  const shortSession = userId.slice(0, 7);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending || isLimitReached) return;

    const userMsg: Message = {
      id: crypto.randomUUID(), role: "user", content: text, timestamp: new Date(),
    };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setSending(true);
    if (inputRef.current) inputRef.current.style.height = "auto";

    try {
      const checkRes = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, message: text }),
      });
      const checkData = await checkRes.json();
      if (checkData.hasContradiction)
        setContradictions((p) => [...p, ...checkData.contradictions]);

      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));

      const reply = generateResponse(text, memories);
      const assistantMsg: Message = {
        id: crypto.randomUUID(), role: "assistant", content: reply, timestamp: new Date(),
      };
      setMessages((p) => [...p, assistantMsg]);
      setMsgCount((c) => c + 1);

      const saveRes = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          messages: [{ role: "user", content: text }, { role: "assistant", content: reply }],
          source: "imprint-chat",
        }),
      });
      const saveData = await saveRes.json();
      if (saveData.memories?.length) setMemories((p) => [...p, ...saveData.memories]);
      if (saveData.contradictions?.length)
        setContradictions((p) => [...p, ...saveData.contradictions]);
    } catch {
      setMessages((p) => [
        ...p,
        { id: crypto.randomUUID(), role: "assistant", content: "Connection error. Check your setup.", timestamp: new Date() },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div
      className="h-screen w-screen flex overflow-hidden relative"
      style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif", background: "#0a0a0a" }}
    >
      <BackgroundVideo overlayOpacity={0.88} />

      {/* ══ Sidebar ══ */}
      <aside className="w-[260px] h-full flex flex-col bg-[#0f0f0f]/90 backdrop-blur-md border-r border-white/[0.05] relative z-10 flex-shrink-0">
        {/* Logo row */}
        <div className="flex items-center justify-between px-4 pt-5 pb-2">
          <Link href="/" className="flex items-center gap-2 group">
            <Brain size={17} color="white" className="opacity-70 group-hover:opacity-100 transition-opacity" />
            <span className="text-white text-base font-semibold tracking-tight" style={{ fontFamily: "'Instrument Serif', serif" }}>
              Imprint
            </span>
          </Link>
          <button
            onClick={() => setMessages([])}
            title="New conversation"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <SquarePen size={15} />
          </button>
        </div>

        {/* New conversation */}
        <div className="px-3 pt-1 pb-2">
          <button
            onClick={() => setMessages([])}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all text-sm"
          >
            <Plus size={15} />
            <span>New conversation</span>
          </button>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto px-3 scrollbar-thin">
          <p className="text-white/20 text-[9px] font-semibold tracking-[0.18em] uppercase px-2 pt-3 pb-2">
            Recents
          </p>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.06] text-white text-sm cursor-default mb-0.5">
            <MessageSquare size={13} className="text-white/30 flex-shrink-0" />
            <span className="truncate text-white/80">Current conversation</span>
          </div>
          {HISTORY_ITEMS.map((item) => (
            <button
              key={item}
              className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/[0.03] transition-all text-sm mb-0.5"
            >
              <MessageSquare size={13} className="text-white/15 flex-shrink-0" />
              <span className="truncate">{item}</span>
            </button>
          ))}
        </div>

        {/* Project indicator — Claude Code style */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <span className="text-[9px] font-mono text-teal-400/50 flex-shrink-0">◆</span>
            <span className="text-[10px] font-mono text-white/25 truncate">imprint-core / {shortSession}</span>
          </div>
        </div>

        {/* User profile */}
        <div className="p-3 border-t border-white/[0.05]">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.03] transition-all cursor-pointer">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-white/15 to-white/5 border border-white/10 flex items-center justify-center text-[11px] font-semibold text-white/80 flex-shrink-0">
              Y
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/65 truncate leading-none mb-0.5">Yashasvi</p>
              <p className="text-[10px] text-white/22 leading-none">
                {keyConnected ? "Pro · Unlimited" : `Free · ${remaining} messages left`}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ══ Main column ══ */}
      <main className="flex-1 h-full flex flex-col relative z-10 overflow-hidden min-w-0">

        {/* ── Claude Code top bar ── */}
        <div className="flex items-center justify-between h-9 flex-shrink-0 border-b border-white/[0.05] bg-[#0c0c0c]/80 backdrop-blur-sm px-4 font-mono text-[10.5px] select-none">
          {/* Left: breadcrumb path */}
          <div className="flex items-center gap-1.5 text-white/30 min-w-0">
            <span className="text-white/20">imprint-core</span>
            <ChevronRight size={9} className="text-white/15 flex-shrink-0" />
            <span className="text-teal-400/60">memory.json</span>
            <ChevronRight size={9} className="text-white/15 flex-shrink-0" />
            <span className="text-white/20 truncate">{shortSession}</span>
          </div>

          {/* Right: badges */}
          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
            <span className="bg-white/[0.05] border border-white/[0.06] rounded-full px-2.5 py-0.5 text-white/35 text-[10px]">
              claude-sonnet-4-5
            </span>
            <span className="text-white/20 text-[10px] flex items-center gap-1">
              <span style={{ color: "#4eecd8", opacity: 0.5 }}>◆</span> main
            </span>
            <span className="text-white/15 text-[10px]">{tokenCount} tok</span>
            <span className="text-white/12 text-[10px]">{contextLoad}% ctx</span>

            {/* Panel toggle */}
            <button
              onClick={() => setPanelOpen((v) => !v)}
              title={panelOpen ? "Close memory panel" : "Open memory panel"}
              className={`flex items-center justify-center w-6 h-6 rounded transition-all ${panelOpen ? "text-teal-400/60 bg-teal-400/10" : "text-white/20 hover:text-white/45 hover:bg-white/[0.04]"}`}
            >
              <PanelRight size={12} />
            </button>
          </div>
        </div>

        {/* ── Messages scroll area ── */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-[700px] w-full mx-auto px-6 py-10">

            {/* Contradiction banners */}
            {contradictions.map((c, i) => (
              <div key={i} className="mb-4 rounded-xl px-4 py-3 border border-red-500/15 bg-red-500/[0.04]">
                <p className="text-[10px] text-red-400/70 uppercase tracking-widest mb-1 font-semibold font-mono">↯ Contradiction detected</p>
                <p className="text-sm text-red-300/50">{c.explanation}</p>
              </div>
            ))}

            {messages.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-6">
                  <Brain size={20} className="text-white/50" />
                </div>
                <h2
                  className="text-[2rem] text-white font-light tracking-tight mb-2 leading-snug"
                  style={{ fontFamily: "'Instrument Serif', serif" }}
                >
                  What shall we commit to{" "}
                  <em className="italic" style={{ color: "#4eecd8" }}>memory</em>?
                </h2>
                <p className="text-white/25 text-sm mb-10 max-w-sm leading-relaxed">
                  Every message teaches Imprint who you are. Context is synced to AWS Aurora instantly.
                </p>
                <div className="grid grid-cols-2 gap-3 w-full max-w-[540px]">
                  {STARTER_PROMPTS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => { setInput(p.text); inputRef.current?.focus(); }}
                      className="text-left p-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.14] transition-all group"
                    >
                      <p className="text-white/70 text-sm font-medium mb-1 group-hover:text-white/90 transition-colors">
                        {p.label}
                      </p>
                      <p className="text-white/25 text-xs leading-relaxed">{p.text}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Messages */
              <div className="space-y-7">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Brain size={13} className="text-white/50" />
                      </div>
                    )}
                    <div className={`flex flex-col gap-1.5 max-w-[78%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                      <div
                        className={`rounded-2xl px-4 py-3 text-[0.875rem] leading-relaxed ${
                          msg.role === "user"
                            ? "bg-white/[0.07] border border-white/[0.07] text-white/85"
                            : "text-white/75"
                        }`}
                      >
                        {msg.content.split("\n").map((l, i, a) => (
                          <span key={i}>{l}{i < a.length - 1 && <br />}</span>
                        ))}
                      </div>
                      {msg.role === "assistant" && (
                        <p className="text-[10px] text-white/12 font-mono px-1 tracking-wide flex items-center gap-1.5">
                          <Zap size={8} style={{ color: "#4eecd8", opacity: 0.4 }} />
                          Synced · Aurora · {Math.max(8, Math.floor(msg.content.length / 6))} tok · Vercel Edge
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {sending && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                      <Brain size={13} className="text-white/50" />
                    </div>
                    <div className="flex items-center gap-1.5 py-3 px-1">
                      {[0, 0.16, 0.32].map((d, i) => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce" style={{ animationDelay: `${d}s` }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Limit banner */}
                {isLimitReached && (
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4">
                    <p className="text-white/40 text-sm" style={{ fontFamily: "'Instrument Serif', serif" }}>
                      <em>Free tier limit reached.</em>
                    </p>
                    <Link href="/login" className="bg-white text-black text-xs font-semibold rounded-full px-4 py-2 hover:bg-white/90 transition-colors whitespace-nowrap flex-shrink-0">
                      Upgrade →
                    </Link>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ── Input zone ── */}
        <div className="px-6 pb-5 pt-2 max-w-[700px] w-full mx-auto">
          <div className="rounded-2xl border border-white/[0.09] bg-[#161616]/90 backdrop-blur-sm shadow-[0_4px_32px_rgba(0,0,0,0.4)] focus-within:border-white/[0.18] transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={sending || isLimitReached}
              rows={1}
              placeholder={isLimitReached ? "Upgrade to continue…" : "Message Imprint…"}
              className="w-full bg-transparent text-sm text-white/85 placeholder:text-white/22 border-none outline-none resize-none px-4 pt-[14px] pb-2 leading-relaxed scrollbar-thin"
              style={{ minHeight: "52px", maxHeight: "200px", overflowY: "auto" }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 200) + "px";
              }}
            />

            {/* Tool chips row */}
            <div className="flex items-center gap-1.5 px-4 pb-1.5">
              {[
                { label: "Memory", active: memories.length > 0, color: "#4eecd8" },
                { label: "RAG", active: false, color: "#f9d97a" },
                { label: "Sync", active: msgCount > 0, color: "#f78c6c" },
              ].map((t) => (
                <span
                  key={t.label}
                  className="inline-flex items-center gap-1 text-[9px] font-mono rounded-full px-2 py-0.5 border transition-all"
                  style={{
                    borderColor: t.active ? `${t.color}30` : "rgba(255,255,255,0.05)",
                    background: t.active ? `${t.color}0d` : "transparent",
                    color: t.active ? `${t.color}` : "rgba(255,255,255,0.18)",
                    opacity: t.active ? 1 : 0.7,
                  }}
                >
                  <span style={{ opacity: t.active ? 1 : 0.4 }}>{t.active ? "●" : "○"}</span>
                  {t.label}
                </span>
              ))}
            </div>

            {/* Bottom row */}
            <div className="flex items-center justify-between px-3 pb-3 pt-0.5">
              <div className="flex items-center gap-1.5">
                <button className="w-8 h-8 flex items-center justify-center rounded-lg text-white/25 hover:text-white/50 hover:bg-white/[0.05] transition-all">
                  <Paperclip size={15} />
                </button>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg text-white/25 hover:text-white/50 hover:bg-white/[0.05] transition-all"
                  onClick={() => setPanelOpen((v) => !v)} title="Toggle memory panel">
                  <MemoryStick size={14} />
                </button>
              </div>
              <button
                onClick={send}
                disabled={!input.trim() || sending || isLimitReached}
                className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-white/85 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <ArrowUp size={14} className="text-black" />
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] text-white/10 mt-2.5 tracking-wide font-mono">
            imprint · memory encrypted · vercel edge · {shortSession}
          </p>
        </div>
      </main>

      {/* ══ Memory Panel (Claude Code right pane) ══ */}
      {panelOpen && (
        <MemoryPanel
          memories={memories}
          sessionId={userId}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  );
}

export default function ChatPage() {
  return <Suspense><ChatApp /></Suspense>;
}
