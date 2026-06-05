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
  existingMemoryContent: string;
}

const GUEST_LIMIT = 20;

const STARTER_PROMPTS = [
  "Tell me about yourself and what you're working on",
  "What's your name and what do you do?",
  "What are your preferences when it comes to how I help you?",
];

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
  const [userId] = useState(() => {
    if (typeof window === "undefined") return crypto.randomUUID();
    const stored = localStorage.getItem("imprint_user_id");
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem("imprint_user_id", id);
    return id;
  });
  const [showKeyInput, setShowKeyInput] = useState(mode === "connect");
  const [keyConnected, setKeyConnected] = useState(false);
  const [memoryPanelOpen, setMemoryPanelOpen] = useState(true);
  const [conversations] = useState([
    { id: "1", title: "Current conversation", active: true },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const remaining = GUEST_LIMIT - msgCount;
  const isLimitReached = mode === "guest" && !keyConnected && remaining <= 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!sending) inputRef.current?.focus();
  }, [sending]);

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
    } catch {
      // continue as guest
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || sending || isLimitReached) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      // 1. Check contradiction in parallel with sending
      const checkRes = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, message: text }),
      });
      const checkData = await checkRes.json();
      if (checkData.hasContradiction) {
        setContradictions((prev) => [...prev, ...checkData.contradictions]);
      }

      // 2. Mock assistant response (real Bedrock call needs AWS creds)
      //    For the demo, return a memory-aware response
      const assistantContent = generateResponse(text, memories);
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: assistantContent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setMsgCount((c) => c + 1);

      // 3. Save memories from this exchange
      const saveRes = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          messages: [
            { role: "user", content: text },
            { role: "assistant", content: assistantContent },
          ],
          source: "imprint-chat",
        }),
      });
      const saveData = await saveRes.json();
      if (saveData.memories?.length) {
        setMemories((prev) => [
          ...prev,
          ...saveData.memories.map((m: { content: string; topic: string }) => ({
            content: m.content,
            topic: m.topic,
          })),
        ]);
      }
      if (saveData.contradictions?.length) {
        setContradictions((prev) => [...prev, ...saveData.contradictions]);
      }
    } catch {
      // fallback
      const fallback: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I'm having trouble connecting right now. Please check your setup.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, fallback]);
    } finally {
      setSending(false);
    }
  }

  function generateResponse(userText: string, knownMemories: CapturedMemory[]): string {
    const lower = userText.toLowerCase();
    if (knownMemories.length > 0 && (lower.includes("remember") || lower.includes("know about me"))) {
      const listed = knownMemories.slice(0, 3).map((m) => `• ${m.content}`).join("\n");
      return `Based on our conversations, here's what I know about you:\n\n${listed}\n\nIs there anything else you'd like me to know?`;
    }
    if (lower.includes("name")) {
      return "Thanks for sharing! I'll remember that. What else would you like me to know about you?";
    }
    if (lower.includes("work") || lower.includes("job") || lower.includes("do for")) {
      return "Got it — I've noted that down. Having context about your work helps me give you much more relevant answers. What are you working on right now?";
    }
    if (lower.includes("prefer") || lower.includes("like") || lower.includes("love")) {
      return "Noted your preference! I'll keep that in mind for future conversations. Imprint is capturing these details so I'll remember them next time too.";
    }
    return `I've received your message and Imprint is capturing any key facts from our conversation. Your memories are being stored securely in DynamoDB — next time we chat, I'll remember everything you've told me.\n\nAnything specific you'd like me to know about you?`;
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const topicColor: Record<string, string> = {
    work: "#3b82f6",
    personal: "#8b5cf6",
    preferences: "#f59e0b",
    health: "#22c55e",
    projects: "#06b6d4",
    relationships: "#ec4899",
    general: "#94a3b8",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600&family=Inter:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --sidebar-bg: #1a1915;
          --sidebar-border: #242319;
          --sidebar-text: #6b6755;
          --sidebar-text-active: #c2be9f;
          --main-bg: #faf9f7;
          --main-border: #e8e5df;
          --text: #1a1915;
          --text-sub: #8b8778;
          --user-bg: #1a1915;
          --user-text: #f0ede4;
          --panel-bg: #f4f2ed;
          --accent-orange: #d97706;
        }

        body {
          font-family: 'Inter', sans-serif;
          background: var(--main-bg);
          color: var(--text);
          overflow: hidden;
          height: 100vh;
        }

        .layout {
          display: flex;
          height: 100vh;
          overflow: hidden;
        }

        /* ── Sidebar ─────────────────────────────── */
        .sidebar {
          width: 260px;
          flex-shrink: 0;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--sidebar-border);
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }

        .sidebar-top {
          padding: 20px 16px 16px;
          border-bottom: 1px solid var(--sidebar-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sidebar-logo {
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--sidebar-text-active);
          text-decoration: none;
        }

        .sidebar-new {
          width: 28px;
          height: 28px;
          background: rgba(194,190,159,0.08);
          border: 1px solid rgba(194,190,159,0.15);
          border-radius: 6px;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: var(--sidebar-text);
          font-size: 16px;
          line-height: 1;
          transition: background 0.2s, color 0.2s;
        }

        .sidebar-new:hover {
          background: rgba(194,190,159,0.14);
          color: var(--sidebar-text-active);
        }

        .sidebar-section-label {
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #3a3828;
          padding: 16px 16px 8px;
        }

        .conv-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 14px;
          border-radius: 6px;
          margin: 0 8px 2px;
          cursor: pointer;
          transition: background 0.15s;
          text-decoration: none;
        }

        .conv-item:hover { background: rgba(194,190,159,0.06); }
        .conv-item.active { background: rgba(194,190,159,0.1); }

        .conv-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent-orange);
          flex-shrink: 0;
        }

        .conv-title {
          font-size: 13px;
          color: var(--sidebar-text-active);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sidebar-bottom {
          margin-top: auto;
          padding: 16px;
          border-top: 1px solid var(--sidebar-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .sidebar-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, #d97706, #b45309);
          display: grid;
          place-items: center;
          font-size: 12px;
          font-weight: 600;
          color: white;
          flex-shrink: 0;
        }

        .sidebar-user-info {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .sidebar-user-name {
          font-size: 12px;
          font-weight: 500;
          color: var(--sidebar-text-active);
        }

        .sidebar-user-plan {
          font-size: 10px;
          color: var(--sidebar-text);
          letter-spacing: 0.03em;
        }

        .sidebar-dashboard-link {
          font-size: 10px;
          color: var(--sidebar-text);
          text-decoration: none;
          letter-spacing: 0.04em;
          transition: color 0.2s;
        }

        .sidebar-dashboard-link:hover { color: var(--sidebar-text-active); }

        /* ── Main chat ───────────────────────────── */
        .main {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
          background: var(--main-bg);
        }

        /* Top bar */
        .chat-topbar {
          height: 56px;
          flex-shrink: 0;
          border-bottom: 1px solid var(--main-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          background: var(--main-bg);
        }

        .chat-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--text);
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .msg-counter {
          font-size: 11px;
          color: var(--text-sub);
          background: var(--panel-bg);
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid var(--main-border);
        }

        .msg-counter.warning { color: #dc2626; border-color: #fca5a5; background: #fef2f2; }

        .panel-toggle {
          font-size: 11px;
          color: var(--text-sub);
          background: transparent;
          border: 1px solid var(--main-border);
          border-radius: 6px;
          padding: 5px 10px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .panel-toggle:hover { background: var(--panel-bg); }

        /* Messages */
        .messages-area {
          flex: 1;
          overflow-y: auto;
          padding: 32px 0;
          scroll-behavior: smooth;
        }

        .messages-inner {
          max-width: 700px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* Empty state */
        .empty-state {
          text-align: center;
          padding: 60px 24px;
          color: var(--text-sub);
        }

        .empty-icon {
          font-size: 36px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-title {
          font-size: 17px;
          font-weight: 500;
          color: var(--text);
          margin-bottom: 8px;
          font-family: 'Syne', sans-serif;
        }

        .empty-sub {
          font-size: 14px;
          line-height: 1.6;
          max-width: 360px;
          margin: 0 auto 28px;
        }

        .starter-prompts {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 400px;
          margin: 0 auto;
        }

        .starter-btn {
          text-align: left;
          padding: 12px 16px;
          background: white;
          border: 1px solid var(--main-border);
          border-radius: 10px;
          cursor: pointer;
          font-size: 13px;
          color: var(--text);
          transition: border-color 0.2s, background 0.2s;
          line-height: 1.45;
        }

        .starter-btn:hover {
          border-color: #d97706;
          background: #fffbf5;
        }

        /* Message bubbles */
        .msg-wrap {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          animation: msg-in 0.3s cubic-bezier(.16,1,.3,1) both;
        }

        @keyframes msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: none; }
        }

        .msg-wrap.user { flex-direction: row-reverse; }

        .msg-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          font-size: 13px;
          font-weight: 600;
          margin-top: 2px;
        }

        .avatar-claude {
          background: linear-gradient(135deg, #d97706, #b45309);
          color: white;
          font-size: 14px;
        }

        .avatar-user {
          background: #1a1915;
          color: #c2be9f;
          font-size: 12px;
          letter-spacing: 0.05em;
        }

        .msg-bubble {
          max-width: 520px;
          padding: 14px 18px;
          border-radius: 14px;
          font-size: 14px;
          line-height: 1.7;
        }

        .bubble-claude {
          background: white;
          border: 1px solid var(--main-border);
          color: var(--text);
          border-radius: 4px 14px 14px 14px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }

        .bubble-user {
          background: var(--user-bg);
          color: var(--user-text);
          border-radius: 14px 4px 14px 14px;
        }

        .msg-time {
          font-size: 10px;
          color: var(--text-sub);
          margin-top: 6px;
          opacity: 0.6;
        }

        .msg-wrap.user .msg-time { text-align: right; }

        /* Typing indicator */
        .typing {
          display: flex;
          gap: 4px;
          padding: 16px 18px;
          background: white;
          border: 1px solid var(--main-border);
          border-radius: 4px 14px 14px 14px;
          width: fit-content;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }

        .typing-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #d4d0c8;
          animation: typing-bounce 1.4s ease-in-out infinite;
        }

        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%            { transform: translateY(-6px); opacity: 1; }
        }

        /* Limit reached */
        .limit-banner {
          max-width: 700px;
          margin: 0 auto;
          padding: 0 24px 24px;
        }

        .limit-card {
          background: #fffbf5;
          border: 1px solid #fde68a;
          border-radius: 12px;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .limit-text {
          font-size: 13px;
          color: #92400e;
          line-height: 1.5;
        }

        .limit-cta {
          flex-shrink: 0;
          font-family: 'Syne', sans-serif;
          font-size: 12px;
          font-weight: 600;
          background: #d97706;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          cursor: pointer;
          white-space: nowrap;
          text-decoration: none;
          transition: background 0.2s;
        }

        .limit-cta:hover { background: #b45309; }

        /* Input bar */
        .input-area {
          flex-shrink: 0;
          padding: 16px 24px 20px;
          background: var(--main-bg);
          border-top: 1px solid var(--main-border);
        }

        .input-wrap {
          max-width: 700px;
          margin: 0 auto;
          position: relative;
          background: white;
          border: 1px solid var(--main-border);
          border-radius: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          transition: border-color 0.2s, box-shadow 0.2s;
          display: flex;
          flex-direction: column;
        }

        .input-wrap:focus-within {
          border-color: #d97706;
          box-shadow: 0 0 0 3px rgba(217,119,6,0.1);
        }

        .input-textarea {
          width: 100%;
          padding: 16px 56px 16px 18px;
          background: transparent;
          border: none;
          outline: none;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          line-height: 1.6;
          color: var(--text);
          resize: none;
          min-height: 56px;
          max-height: 160px;
          overflow-y: auto;
        }

        .input-textarea::placeholder { color: #c0bca8; }

        .input-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px 10px;
        }

        .input-hint {
          font-size: 11px;
          color: #c0bca8;
        }

        .send-btn {
          width: 34px;
          height: 34px;
          background: var(--user-bg);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          display: grid;
          place-items: center;
          color: #c2be9f;
          font-size: 15px;
          transition: background 0.2s, opacity 0.2s;
        }

        .send-btn:hover:not(:disabled) { background: #2a2820; }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Memory panel ────────────────────────── */
        .memory-panel {
          width: 280px;
          flex-shrink: 0;
          background: var(--panel-bg);
          border-left: 1px solid var(--main-border);
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
          transition: width 0.3s cubic-bezier(.16,1,.3,1);
        }

        .memory-panel.closed { width: 0; overflow: hidden; }

        .panel-header {
          padding: 18px 16px 14px;
          border-bottom: 1px solid var(--main-border);
          flex-shrink: 0;
        }

        .panel-title {
          font-family: 'Syne', sans-serif;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-sub);
          margin-bottom: 2px;
        }

        .panel-sub {
          font-size: 11px;
          color: #b0ac98;
        }

        .panel-body {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        /* Contradiction alert */
        .contradiction-card {
          background: #fef2f2;
          border: 1px solid #fca5a5;
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 8px;
          animation: msg-in 0.3s cubic-bezier(.16,1,.3,1) both;
        }

        .contradiction-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #dc2626;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .contradiction-text {
          font-size: 12px;
          color: #991b1b;
          line-height: 1.5;
        }

        /* Memory items */
        .panel-section-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #a8a490;
          padding: 8px 4px 6px;
        }

        .memory-card {
          background: white;
          border: 1px solid var(--main-border);
          border-radius: 8px;
          padding: 10px 12px;
          margin-bottom: 6px;
          animation: msg-in 0.35s cubic-bezier(.16,1,.3,1) both;
        }

        .memory-tag {
          display: inline-block;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 4px;
          margin-bottom: 5px;
          background: rgba(0,0,0,0.04);
        }

        .memory-text {
          font-size: 12px;
          color: var(--text);
          line-height: 1.5;
        }

        .panel-empty {
          text-align: center;
          padding: 32px 16px;
          color: #b0ac98;
        }

        .panel-empty-icon { font-size: 24px; margin-bottom: 8px; opacity: 0.5; }
        .panel-empty-text { font-size: 12px; line-height: 1.5; }

        /* Connect key section */
        .key-connect {
          background: white;
          border: 1px solid var(--main-border);
          border-radius: 12px;
          padding: 24px;
          max-width: 420px;
          margin: 40px auto;
          text-align: center;
        }

        .key-connect-title {
          font-family: 'Syne', sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: var(--text);
          margin-bottom: 8px;
        }

        .key-connect-sub {
          font-size: 13px;
          color: var(--text-sub);
          margin-bottom: 20px;
          line-height: 1.5;
        }

        .key-input {
          width: 100%;
          padding: 10px 14px;
          background: var(--panel-bg);
          border: 1px solid var(--main-border);
          border-radius: 8px;
          font-size: 13px;
          color: var(--text);
          outline: none;
          margin-bottom: 10px;
          font-family: monospace;
        }

        .key-input:focus { border-color: #d97706; }

        .key-connect-btn {
          width: 100%;
          padding: 10px;
          background: #1a1915;
          color: #c2be9f;
          border: none;
          border-radius: 8px;
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.04em;
          transition: background 0.2s;
          margin-bottom: 10px;
        }

        .key-connect-btn:hover { background: #2a2820; }

        .key-skip {
          font-size: 12px;
          color: var(--text-sub);
          cursor: pointer;
          text-decoration: underline;
          background: none;
          border: none;
        }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d4d0c8; border-radius: 2px; }
      `}</style>

      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-top">
            <Link href="/" className="sidebar-logo">Imprint</Link>
            <button className="sidebar-new" title="New conversation">+</button>
          </div>

          <div className="sidebar-section-label">Conversations</div>
          {conversations.map((c) => (
            <div key={c.id} className={`conv-item ${c.active ? "active" : ""}`}>
              <div className="conv-dot" />
              <span className="conv-title">{c.title}</span>
            </div>
          ))}

          <div className="sidebar-bottom">
            <div className="sidebar-user">
              <div className="sidebar-avatar">U</div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">You</span>
                <span className="sidebar-user-plan">
                  {keyConnected ? "BYOK · Unlimited" : `Free · ${remaining} left`}
                </span>
              </div>
            </div>
            <Link href="/dashboard" className="sidebar-dashboard-link">
              Dashboard →
            </Link>
          </div>
        </aside>

        {/* Main chat */}
        <main className="main">
          {/* Top bar */}
          <div className="chat-topbar">
            <span className="chat-title">
              {messages.length === 0 ? "New conversation" : "Current conversation"}
            </span>
            <div className="topbar-right">
              {mode === "guest" && !keyConnected && (
                <span className={`msg-counter ${remaining <= 5 ? "warning" : ""}`}>
                  {remaining} messages left
                </span>
              )}
              <button
                className="panel-toggle"
                onClick={() => setMemoryPanelOpen((p) => !p)}
              >
                🧠 {memoryPanelOpen ? "Hide" : "Show"} memories
              </button>
            </div>
          </div>

          {/* Connect key prompt */}
          {showKeyInput && (
            <div className="messages-area" style={{ display: "flex", alignItems: "center" }}>
              <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px", width: "100%" }}>
                <div className="key-connect">
                  <div className="key-connect-title">Connect your Claude API key</div>
                  <div className="key-connect-sub">
                    Bring your own key for unlimited memory and full Bedrock-powered responses.
                    Your key is encrypted with AES-256.
                  </div>
                  <input
                    type="password"
                    className="key-input"
                    placeholder="sk-ant-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <button className="key-connect-btn" onClick={connectKey}>
                    Connect API Key →
                  </button>
                  <button className="key-skip" onClick={() => setShowKeyInput(false)}>
                    Skip — use free tier (20 messages)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {!showKeyInput && (
            <div className="messages-area">
              <div className="messages-inner">
                {messages.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🧠</div>
                    <div className="empty-title">Start a conversation</div>
                    <div className="empty-sub">
                      Tell me about yourself — Imprint will capture what matters and
                      remember it next time.
                    </div>
                    <div className="starter-prompts">
                      {STARTER_PROMPTS.map((p) => (
                        <button
                          key={p}
                          className="starter-btn"
                          onClick={() => { setInput(p); inputRef.current?.focus(); }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`msg-wrap ${msg.role}`}>
                      <div className={`msg-avatar ${msg.role === "assistant" ? "avatar-claude" : "avatar-user"}`}>
                        {msg.role === "assistant" ? "✦" : "U"}
                      </div>
                      <div>
                        <div className={`msg-bubble ${msg.role === "assistant" ? "bubble-claude" : "bubble-user"}`}>
                          {msg.content.split("\n").map((line, i) => (
                            <span key={i}>{line}{i < msg.content.split("\n").length - 1 && <br />}</span>
                          ))}
                        </div>
                        <div className="msg-time">
                          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {sending && (
                  <div className="msg-wrap">
                    <div className="msg-avatar avatar-claude">✦</div>
                    <div className="typing">
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {/* Limit banner */}
          {isLimitReached && (
            <div className="limit-banner">
              <div className="limit-card">
                <div className="limit-text">
                  <strong>You've used all 20 free messages.</strong><br />
                  Connect your Claude API key for unlimited memory.
                </div>
                <Link href="/?connect=1" className="limit-cta">
                  Connect Claude →
                </Link>
              </div>
            </div>
          )}

          {/* Input */}
          {!showKeyInput && (
            <div className="input-area">
              <div className="input-wrap">
                <textarea
                  ref={inputRef}
                  className="input-textarea"
                  placeholder={isLimitReached ? "Upgrade to continue..." : "Message Imprint..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending || isLimitReached}
                  rows={1}
                  onInput={(e) => {
                    const t = e.currentTarget;
                    t.style.height = "auto";
                    t.style.height = Math.min(t.scrollHeight, 160) + "px";
                  }}
                />
                <div className="input-actions">
                  <span className="input-hint">
                    {isLimitReached ? "Free limit reached" : "Enter to send · Shift+Enter for new line"}
                  </span>
                  <button
                    className="send-btn"
                    onClick={send}
                    disabled={!input.trim() || sending || isLimitReached}
                  >
                    ↑
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Memory panel */}
        <aside className={`memory-panel ${memoryPanelOpen ? "" : "closed"}`}>
          <div className="panel-header">
            <div className="panel-title">Memory Panel</div>
            <div className="panel-sub">What Imprint is capturing</div>
          </div>
          <div className="panel-body">
            {contradictions.length > 0 && (
              <>
                <div className="panel-section-label">⚠ Contradictions</div>
                {contradictions.map((c, i) => (
                  <div key={i} className="contradiction-card">
                    <div className="contradiction-label">⚠ Conflict detected</div>
                    <div className="contradiction-text">{c.explanation}</div>
                  </div>
                ))}
              </>
            )}

            {memories.length > 0 ? (
              <>
                <div className="panel-section-label">This session</div>
                {memories.map((m, i) => (
                  <div key={i} className="memory-card">
                    <span
                      className="memory-tag"
                      style={{
                        color: topicColor[m.topic] || "#94a3b8",
                        background: `${topicColor[m.topic]}18` || "rgba(0,0,0,0.04)",
                      }}
                    >
                      {m.topic}
                    </span>
                    <div className="memory-text">{m.content}</div>
                  </div>
                ))}
              </>
            ) : (
              <div className="panel-empty">
                <div className="panel-empty-icon">💭</div>
                <div className="panel-empty-text">
                  Memories will appear here as you chat. Imprint captures facts automatically.
                </div>
              </div>
            )}

            {memories.length > 0 && (
              <Link
                href="/dashboard"
                style={{
                  display: "block",
                  textAlign: "center",
                  fontSize: 12,
                  color: "#a8a490",
                  textDecoration: "none",
                  marginTop: 12,
                  padding: "10px",
                  borderRadius: 8,
                  border: "1px solid var(--main-border)",
                  background: "white",
                  transition: "background 0.2s",
                }}
              >
                View all memories in Dashboard →
              </Link>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatApp />
    </Suspense>
  );
}
