"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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
  existingMemoryContent?: string;
}

const GUEST_LIMIT = 20;

const STARTER_PROMPTS = [
  { label: "Introduce yourself", text: "Tell me about yourself and what you're working on" },
  { label: "Your name & role", text: "What's your name and what do you do?" },
  { label: "Your preferences", text: "What are your preferences when it comes to how I help you?" },
];

const TOPIC_DOT: Record<string, string> = {
  work: "#60a5fa",
  personal: "#a78bfa",
  preferences: "#fbbf24",
  health: "#34d399",
  projects: "#22d3ee",
  relationships: "#f472b6",
  general: "#6b7280",
};

function ChatApp() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "guest";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const [memories, setMemories] = useState<CapturedMemory[]>([]);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [keyConnected, setKeyConnected] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(mode === "connect");
  const [memoryPanelOpen, setMemoryPanelOpen] = useState(true);
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function connectKey() {
    if (!apiKey.startsWith("sk-ant-")) return;
    try {
      await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, apiKey }),
      });
      setKeyConnected(true);
      setShowKeyInput(false);
    } catch { setShowKeyInput(false); }
  }

  async function send() {
    const text = input.trim();
    if (!text || sending || isLimitReached) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text, timestamp: new Date() };
    setMessages(p => [...p, userMsg]);
    setInput("");
    setSending(true);

    try {
      const [checkRes] = await Promise.all([
        fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, message: text }),
        }),
      ]);
      const checkData = await checkRes.json();
      if (checkData.hasContradiction) setContradictions(p => [...p, ...checkData.contradictions]);

      await new Promise(r => setTimeout(r, 700 + Math.random() * 500));

      const reply = generateResponse(text, memories);
      const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: reply, timestamp: new Date() };
      setMessages(p => [...p, assistantMsg]);
      setMsgCount(c => c + 1);

      const saveRes = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, messages: [{ role: "user", content: text }, { role: "assistant", content: reply }], source: "imprint-chat" }),
      });
      const saveData = await saveRes.json();
      if (saveData.memories?.length) setMemories(p => [...p, ...saveData.memories]);
      if (saveData.contradictions?.length) setContradictions(p => [...p, ...saveData.contradictions]);
    } catch {
      setMessages(p => [...p, { id: crypto.randomUUID(), role: "assistant", content: "Connection error. Check your setup.", timestamp: new Date() }]);
    } finally {
      setSending(false);
    }
  }

  function generateResponse(userText: string, mem: CapturedMemory[]): string {
    const l = userText.toLowerCase();
    if (mem.length && (l.includes("remember") || l.includes("know about"))) {
      return `Here's what I've captured about you so far:\n\n${mem.slice(0, 4).map(m => `— ${m.content}`).join("\n")}\n\nShall I add anything else?`;
    }
    if (l.includes("name")) return "Got it — I'll remember that. What else would you like me to know?";
    if (l.includes("work") || l.includes("job")) return "Noted. Context about your work helps me give sharper answers. What are you focused on right now?";
    if (l.includes("prefer") || l.includes("like") || l.includes("love")) return "Preference captured. Imprint is storing this so I'll carry it forward into every future session.";
    return `Message received. Imprint is extracting any key facts from what you've shared and storing them securely.\n\nNext time we speak, I'll already know this about you. What else would you like me to remember?`;
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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

        html, body { height: 100%; overflow: hidden; background: var(--bg); }

        /* ── Grain ── */
        body::after {
          content: '';
          position: fixed;
          inset: -100px;
          width: calc(100% + 200px);
          height: calc(100% + 200px);
          pointer-events: none;
          z-index: 9999;
          background: url("data:image/svg+xml,%3Csvg xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%3E%3Cfilter id%3D'n'%3E%3CfeTurbulence type%3D'fractalNoise' baseFrequency%3D'0.85' numOctaves%3D'4' stitchTiles%3D'stitch'%2F%3E%3C%2Ffilter%3E%3Crect width%3D'100%25' height%3D'100%25' filter%3D'url(%23n)' opacity%3D'0.065'%2F%3E%3C%2Fsvg%3E") repeat;
          background-size: 180px;
          mix-blend-mode: overlay;
          animation: grain 0.65s steps(1) infinite;
        }
        @keyframes grain {
          0%  { transform: translate(0,0); }
          20% { transform: translate(-4%,-5%); }
          40% { transform: translate(5%,3%); }
          60% { transform: translate(-3%,6%); }
          80% { transform: translate(6%,-3%); }
        }

        .layout {
          display: flex;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          font-family: 'Syne', sans-serif;
          position: relative;
          z-index: 1;
        }

        /* ══ SIDEBAR ══════════════════════════════════ */
        .sidebar {
          width: 240px;
          flex-shrink: 0;
          background: var(--bg2);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          height: 100vh;
        }

        .sidebar-head {
          padding: 22px 18px 18px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sidebar-brand {
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--bright);
          text-decoration: none;
        }

        .new-btn {
          width: 26px; height: 26px;
          display: grid; place-items: center;
          background: rgba(194,190,159,0.05);
          border: 1px solid var(--border2);
          border-radius: 5px;
          color: var(--text-dim);
          font-size: 17px; line-height: 1;
          cursor: pointer;
          transition: all 0.2s;
        }
        .new-btn:hover { background: rgba(194,190,159,0.1); color: var(--text); }

        .sidebar-label {
          font-size: 9px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--text-mid);
          padding: 16px 18px 8px;
        }

        .conv-row {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 14px;
          margin: 0 6px 1px;
          border-radius: 5px;
          cursor: pointer;
          transition: background 0.15s;
          text-decoration: none;
        }
        .conv-row.active, .conv-row:hover { background: rgba(194,190,159,0.06); }

        .conv-pip {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: var(--orange);
          flex-shrink: 0;
          box-shadow: 0 0 5px var(--orange-d);
        }

        .conv-name {
          font-size: 12px;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 400;
        }

        .sidebar-foot {
          margin-top: auto;
          padding: 16px 18px;
          border-top: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .foot-user { display: flex; align-items: center; gap: 9px; }

        .foot-avatar {
          width: 26px; height: 26px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--orange), var(--orange-d));
          display: grid; place-items: center;
          font-size: 11px; font-weight: 700;
          color: #fff; flex-shrink: 0;
        }

        .foot-info { display: flex; flex-direction: column; gap: 1px; }
        .foot-name { font-size: 11px; font-weight: 500; color: var(--text); }
        .foot-plan { font-size: 9px; color: var(--text-dim); letter-spacing: 0.04em; }

        .foot-link {
          font-size: 10px;
          color: var(--text-dim);
          text-decoration: none;
          letter-spacing: 0.05em;
          transition: color 0.2s;
        }
        .foot-link:hover { color: var(--text-mid); }

        /* ══ MAIN ════════════════════════════════════ */
        .main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--bg);
          min-width: 0;
        }

        /* Top bar */
        .topbar {
          height: 52px; flex-shrink: 0;
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 0 28px;
        }

        .topbar-title {
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.06em;
          color: var(--text);
          text-transform: uppercase;
        }

        .topbar-right { display: flex; align-items: center; gap: 10px; }

        .pill {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.06em;
          color: var(--text-mid);
          background: rgba(194,190,159,0.05);
          border: 1px solid var(--border2);
          border-radius: 999px;
          padding: 4px 12px;
        }
        .pill.warn { color: #e57373; border-color: rgba(229,115,115,0.3); background: rgba(229,115,115,0.06); }

        .toggle-btn {
          display: flex; align-items: center; gap: 6px;
          font-size: 10px; letter-spacing: 0.06em;
          color: var(--text-dim);
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 5px;
          padding: 5px 10px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .toggle-btn:hover { border-color: var(--border2); color: var(--text-mid); }

        /* Messages */
        .msgs {
          flex: 1;
          overflow-y: auto;
          padding: 40px 0 24px;
        }
        .msgs-inner {
          max-width: 680px;
          margin: 0 auto;
          padding: 0 32px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        /* Empty */
        .empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 80px 24px 40px;
        }

        .empty-mark {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(64px, 10vw, 110px);
          line-height: 1;
          letter-spacing: 0.12em;
          margin-bottom: 28px;
          user-select: none;
          background: linear-gradient(
            180deg,
            rgba(212, 207, 172, 0.55) 0%,
            rgba(212, 207, 172, 0.18) 60%,
            rgba(212, 207, 172, 0.04) 100%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: brand-reveal 1.2s cubic-bezier(.16,1,.3,1) both,
                     brand-breathe 5s 1.5s ease-in-out infinite;
        }

        @keyframes brand-reveal {
          0%   { opacity: 0; transform: translateY(28px) scale(0.96); filter: blur(8px); }
          60%  { filter: blur(0); }
          100% { opacity: 1; transform: none; filter: blur(0); }
        }

        @keyframes brand-breathe {
          0%, 100% { opacity: 0.85; }
          50%       { opacity: 1; }
        }

        .empty-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 24px;
          font-weight: 300;
          font-style: italic;
          color: var(--bright);
          margin-bottom: 10px;
          animation: fade-up 0.8s 0.4s cubic-bezier(.16,1,.3,1) both;
        }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: none; }
        }

        .empty-sub {
          font-family: 'Cormorant Garamond', serif;
          font-size: 16px;
          font-weight: 300;
          color: var(--text-mid);
          line-height: 1.75;
          max-width: 360px;
          margin-bottom: 40px;
          animation: fade-up 0.8s 0.55s cubic-bezier(.16,1,.3,1) both;
        }

        .starters {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
          max-width: 380px;
        }

        .starter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 18px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 7px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
          gap: 12px;
        }
        .starter:hover {
          border-color: var(--border2);
          background: rgba(194,190,159,0.03);
        }
        .starter-label {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--text);
        }
        .starter-arr {
          font-size: 14px;
          color: var(--text-dim);
          opacity: 0;
          transition: opacity 0.2s, transform 0.2s;
          flex-shrink: 0;
        }
        .starter:hover .starter-arr { opacity: 1; transform: translateX(3px); }

        /* Messages */
        .msg-row {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          animation: msg-rise 0.35s cubic-bezier(.16,1,.3,1) both;
        }
        @keyframes msg-rise {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: none; }
        }
        .msg-row.user { flex-direction: row-reverse; }

        .av {
          width: 30px; height: 30px;
          border-radius: 50%;
          flex-shrink: 0;
          display: grid; place-items: center;
          margin-top: 2px;
          font-size: 12px;
          font-weight: 700;
        }
        .av-ai {
          background: linear-gradient(135deg, var(--orange), var(--orange-d));
          color: #fff;
          font-size: 14px;
        }
        .av-user {
          background: rgba(194,190,159,0.08);
          border: 1px solid var(--border2);
          color: var(--text-mid);
          font-size: 10px;
          letter-spacing: 0.08em;
        }

        .bubble-wrap { display: flex; flex-direction: column; gap: 4px; max-width: 520px; }
        .msg-row.user .bubble-wrap { align-items: flex-end; }

        .bubble {
          padding: 14px 18px;
          border-radius: 12px;
          font-family: 'Cormorant Garamond', serif;
          font-size: 17px;
          font-weight: 300;
          line-height: 1.7;
        }

        .bubble-ai {
          background: var(--bg3);
          border: 1px solid var(--border2);
          color: var(--text);
          border-radius: 4px 12px 12px 12px;
        }

        .bubble-user {
          background: rgba(212,207,172,0.1);
          border: 1px solid rgba(212,207,172,0.2);
          color: var(--bright);
          border-radius: 12px 4px 12px 12px;
        }

        .msg-time {
          font-size: 10px;
          color: var(--text-dim);
          letter-spacing: 0.04em;
        }

        /* Typing */
        .typing-wrap {
          display: flex; align-items: center;
          gap: 14px;
        }
        .typing-bubble {
          display: flex; gap: 5px; align-items: center;
          padding: 14px 18px;
          background: var(--bg3);
          border: 1px solid var(--border);
          border-radius: 4px 12px 12px 12px;
        }
        .dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: var(--text-dim);
          animation: dot-pulse 1.4s ease-in-out infinite;
        }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dot-pulse {
          0%,60%,100% { opacity: 0.3; transform: scale(1); }
          30%          { opacity: 1; transform: scale(1.3); }
        }

        /* Limit */
        .limit-wrap {
          max-width: 680px;
          margin: 0 auto;
          padding: 0 32px 20px;
        }
        .limit-bar {
          display: flex; align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 20px;
          border: 1px solid rgba(200, 121, 65, 0.25);
          border-radius: 8px;
          background: rgba(200,121,65,0.04);
        }
        .limit-text {
          font-family: 'Cormorant Garamond', serif;
          font-size: 15px;
          font-weight: 300;
          color: var(--orange);
          line-height: 1.5;
        }
        .limit-cta {
          flex-shrink: 0;
          font-family: 'Syne', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.07em;
          background: var(--orange);
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 8px 14px;
          cursor: pointer;
          text-decoration: none;
          white-space: nowrap;
          transition: background 0.2s;
        }
        .limit-cta:hover { background: var(--orange-d); }

        /* Input */
        .input-zone {
          flex-shrink: 0;
          padding: 16px 32px 24px;
          border-top: 1px solid var(--border);
        }

        .input-box {
          max-width: 680px;
          margin: 0 auto;
          background: var(--bg3);
          border: 1px solid var(--border2);
          border-radius: 10px;
          transition: border-color 0.2s, box-shadow 0.2s;
          display: flex;
          flex-direction: column;
        }
        .input-box:focus-within {
          border-color: rgba(200,121,65,0.45);
          box-shadow: 0 0 0 3px rgba(200,121,65,0.07);
        }

        .input-ta {
          width: 100%;
          padding: 16px 18px 8px;
          background: transparent;
          border: none; outline: none;
          font-family: 'Cormorant Garamond', serif;
          font-size: 17px;
          font-weight: 300;
          line-height: 1.6;
          color: var(--bright);
          resize: none;
          min-height: 54px;
          max-height: 140px;
          overflow-y: auto;
        }
        .input-ta::placeholder { color: var(--text-mid); }

        .input-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px 10px;
        }

        .input-hint {
          font-size: 10px;
          letter-spacing: 0.05em;
          color: var(--text-dim);
        }

        .send {
          width: 32px; height: 32px;
          background: var(--orange);
          border: none; border-radius: 6px;
          display: grid; place-items: center;
          cursor: pointer;
          transition: background 0.2s, opacity 0.2s;
        }
        .send:hover:not(:disabled) { background: var(--orange-d); }
        .send:disabled { opacity: 0.3; cursor: not-allowed; }
        .send svg { display: block; }

        /* ══ MEMORY PANEL ════════════════════════════ */
        .panel {
          width: 260px;
          flex-shrink: 0;
          background: var(--bg2);
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
          transition: width 0.3s cubic-bezier(.16,1,.3,1);
        }
        .panel.shut { width: 0; }

        .panel-head {
          padding: 20px 16px 14px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .panel-title {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--text-dim);
          margin-bottom: 3px;
        }
        .panel-sub {
          font-family: 'Cormorant Garamond', serif;
          font-size: 13px;
          font-style: italic;
          color: var(--text-dim);
        }

        .panel-body {
          flex: 1;
          overflow-y: auto;
          padding: 14px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .section-tag {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--text-dim);
          padding: 6px 2px 4px;
        }

        .mem-card {
          background: rgba(194,190,159,0.03);
          border: 1px solid var(--border);
          border-radius: 7px;
          padding: 10px 12px;
          animation: msg-rise 0.3s cubic-bezier(.16,1,.3,1) both;
        }

        .mem-row {
          display: flex; align-items: center; gap: 6px;
          margin-bottom: 5px;
        }

        .mem-pip {
          width: 5px; height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .mem-topic {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .mem-text {
          font-family: 'Cormorant Garamond', serif;
          font-size: 13px;
          font-weight: 300;
          line-height: 1.55;
          color: var(--text-mid);
        }

        .contra-card {
          background: rgba(229,115,115,0.04);
          border: 1px solid rgba(229,115,115,0.2);
          border-radius: 7px;
          padding: 10px 12px;
          animation: msg-rise 0.3s cubic-bezier(.16,1,.3,1) both;
        }
        .contra-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #e57373;
          margin-bottom: 5px;
          display: flex; align-items: center; gap: 5px;
        }
        .contra-text {
          font-family: 'Cormorant Garamond', serif;
          font-size: 13px;
          font-weight: 300;
          line-height: 1.5;
          color: #e57373;
          opacity: 0.8;
        }

        .panel-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 24px;
          gap: 10px;
        }
        .panel-empty-mark {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 36px;
          letter-spacing: 0.06em;
          color: rgba(194,190,159,0.05);
          line-height: 1;
        }
        .panel-empty-text {
          font-family: 'Cormorant Garamond', serif;
          font-size: 13px;
          font-style: italic;
          font-weight: 300;
          color: var(--text-dim);
          line-height: 1.6;
        }

        .dash-link {
          display: block;
          text-align: center;
          font-size: 10px;
          letter-spacing: 0.07em;
          color: var(--text-dim);
          text-decoration: none;
          padding: 10px;
          border: 1px solid var(--border);
          border-radius: 6px;
          margin-top: 4px;
          transition: all 0.2s;
        }
        .dash-link:hover { border-color: var(--border2); color: var(--text-mid); }

        /* Key connect */
        .key-screen {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px;
        }
        .key-card {
          background: var(--bg3);
          border: 1px solid var(--border2);
          border-radius: 14px;
          padding: 40px 36px;
          width: 100%;
          max-width: 400px;
          text-align: center;
        }
        .key-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 26px;
          font-style: italic;
          font-weight: 300;
          color: var(--bright);
          margin-bottom: 10px;
        }
        .key-sub {
          font-family: 'Cormorant Garamond', serif;
          font-size: 14px;
          font-weight: 300;
          color: var(--text-dim);
          line-height: 1.7;
          margin-bottom: 24px;
        }
        .key-in {
          width: 100%;
          padding: 11px 14px;
          background: var(--bg);
          border: 1px solid var(--border2);
          border-radius: 7px;
          font-family: 'Syne', monospace;
          font-size: 12px;
          color: var(--text);
          outline: none;
          margin-bottom: 10px;
          letter-spacing: 0.02em;
        }
        .key-in:focus { border-color: rgba(200,121,65,0.5); }
        .key-in::placeholder { color: var(--text-dim); }
        .key-go {
          width: 100%;
          padding: 11px;
          background: var(--orange);
          color: #fff;
          border: none;
          border-radius: 7px;
          font-family: 'Syne', sans-serif;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.07em;
          cursor: pointer;
          margin-bottom: 10px;
          transition: background 0.2s;
        }
        .key-go:hover { background: var(--orange-d); }
        .key-skip {
          font-family: 'Cormorant Garamond', serif;
          font-size: 13px;
          font-style: italic;
          color: var(--text-dim);
          background: none;
          border: none;
          cursor: pointer;
          transition: color 0.2s;
        }
        .key-skip:hover { color: var(--text-mid); }

        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }
      `}</style>

      <div className="layout">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-head">
            <Link href="/" className="sidebar-brand">Imprint</Link>
            <button className="new-btn" title="New conversation">+</button>
          </div>

          <div className="sidebar-label">Conversations</div>
          <div className="conv-row active">
            <div className="conv-pip" />
            <span className="conv-name">Current conversation</span>
          </div>

          <div className="sidebar-foot">
            <div className="foot-user">
              <div className="foot-avatar">Y</div>
              <div className="foot-info">
                <span className="foot-name">You</span>
                <span className="foot-plan">
                  {keyConnected ? "BYOK · Unlimited" : `Free · ${remaining} left`}
                </span>
              </div>
            </div>
            <Link href="/dashboard" className="foot-link">Dashboard →</Link>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="main">
          {/* Topbar */}
          <div className="topbar">
            <span className="topbar-title">
              {messages.length === 0 ? "New conversation" : "Current session"}
            </span>
            <div className="topbar-right">
              {mode === "guest" && !keyConnected && (
                <span className={`pill ${remaining <= 5 ? "warn" : ""}`}>
                  {remaining} messages remaining
                </span>
              )}
              <button className="toggle-btn" onClick={() => setMemoryPanelOpen(p => !p)}>
                ◈ {memoryPanelOpen ? "Hide" : "Show"} memory
              </button>
            </div>
          </div>

          {/* Key connect screen */}
          {showKeyInput && (
            <div className="key-screen">
              <div className="key-card">
                <div className="key-title">Connect your key</div>
                <div className="key-sub">
                  Bring your own Claude API key for unlimited memory.<br />
                  Encrypted with AES-256. Never exposed.
                </div>
                <input
                  type="password"
                  className="key-in"
                  placeholder="sk-ant-..."
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                />
                <button className="key-go" onClick={connectKey}>Connect →</button>
                <button className="key-skip" onClick={() => setShowKeyInput(false)}>
                  Skip — use free tier
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          {!showKeyInput && (
            <div className="msgs">
              <div className="msgs-inner">
                {messages.length === 0 ? (
                  <div className="empty">
                    <div className="empty-mark">IMPRINT</div>
                    <div className="empty-title">Begin a conversation</div>
                    <div className="empty-sub">
                      Tell me about yourself. Imprint will capture what matters and carry it forward — forever.
                    </div>
                    <div className="starters">
                      {STARTER_PROMPTS.map(p => (
                        <button key={p.label} className="starter" onClick={() => { setInput(p.text); inputRef.current?.focus(); }}>
                          <span className="starter-label">{p.label}</span>
                          <span className="starter-arr">→</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={`msg-row ${msg.role}`}>
                      <div className={`av ${msg.role === "assistant" ? "av-ai" : "av-user"}`}>
                        {msg.role === "assistant" ? "✦" : "Y"}
                      </div>
                      <div className="bubble-wrap">
                        <div className={`bubble ${msg.role === "assistant" ? "bubble-ai" : "bubble-user"}`}>
                          {msg.content.split("\n").map((l, i, a) => (
                            <span key={i}>{l}{i < a.length - 1 && <br />}</span>
                          ))}
                        </div>
                        <span className="msg-time">{fmt(msg.timestamp)}</span>
                      </div>
                    </div>
                  ))
                )}

                {sending && (
                  <div className="typing-wrap">
                    <div className="av av-ai">✦</div>
                    <div className="typing-bubble">
                      <div className="dot" /><div className="dot" /><div className="dot" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {/* Limit banner */}
          {isLimitReached && (
            <div className="limit-wrap">
              <div className="limit-bar">
                <div className="limit-text">Free tier limit reached — connect your key for unlimited memory.</div>
                <Link href="/?connect=1" className="limit-cta">Connect Claude →</Link>
              </div>
            </div>
          )}

          {/* Input */}
          {!showKeyInput && (
            <div className="input-zone">
              <div className="input-box">
                <textarea
                  ref={inputRef}
                  className="input-ta"
                  placeholder={isLimitReached ? "Upgrade to continue…" : "Say something worth remembering…"}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={sending || isLimitReached}
                  rows={1}
                  onInput={e => {
                    const t = e.currentTarget;
                    t.style.height = "auto";
                    t.style.height = Math.min(t.scrollHeight, 140) + "px";
                  }}
                />
                <div className="input-foot">
                  <span className="input-hint">Enter to send · Shift+Enter for newline</span>
                  <button className="send" onClick={send} disabled={!input.trim() || sending || isLimitReached}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 12V2M7 2L3 6M7 2L11 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ── Memory panel ── */}
        <aside className={`panel ${memoryPanelOpen ? "" : "shut"}`}>
          <div className="panel-head">
            <div className="panel-title">Memory Panel</div>
            <div className="panel-sub">What Imprint is capturing</div>
          </div>
          <div className="panel-body">
            {contradictions.length > 0 && (
              <>
                <div className="section-tag">⚠ Contradictions</div>
                {contradictions.map((c, i) => (
                  <div key={i} className="contra-card">
                    <div className="contra-label">↯ Conflict detected</div>
                    <div className="contra-text">{c.explanation}</div>
                  </div>
                ))}
              </>
            )}

            {memories.length > 0 ? (
              <>
                <div className="section-tag">This session</div>
                {memories.map((m, i) => (
                  <div key={i} className="mem-card">
                    <div className="mem-row">
                      <div className="mem-pip" style={{ background: TOPIC_DOT[m.topic] || "#6b7280" }} />
                      <span className="mem-topic" style={{ color: TOPIC_DOT[m.topic] || "#6b7280" }}>{m.topic}</span>
                    </div>
                    <div className="mem-text">{m.content}</div>
                  </div>
                ))}
                <Link href="/dashboard" className="dash-link">View all in Dashboard →</Link>
              </>
            ) : (
              <div className="panel-empty">
                <div className="panel-empty-mark">MEM</div>
                <div className="panel-empty-text">
                  Memories appear here as you chat. Facts are captured automatically.
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

export default function ChatPage() {
  return <Suspense><ChatApp /></Suspense>;
}
