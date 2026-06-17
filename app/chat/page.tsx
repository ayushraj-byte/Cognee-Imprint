"use client";

import { useSession } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ImprintLogo from "@/app/components/ImprintLogo";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const isLoaded = status !== "loading";
  const user = session?.user ?? null;
  const userId = (session?.user as { id?: string })?.id ?? null;
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isLoaded && !user) router.push("/sign-in");
  }, [isLoaded, user, router]);

  useEffect(() => {
    // Check if user has API key
    if (user) {
      fetch(`/api/user?userId=${userId}`)
        .then(r => r.json())
        .then(d => setHasKey(!!d.encryptedApiKey))
        .catch(() => setHasKey(false));
    }
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    if (!input.trim() || loading || !user) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError("");

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          userId: userId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      // Stream the response
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(l => l.startsWith("data: "));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed?.delta?.text || parsed?.choices?.[0]?.delta?.content || "";
            if (delta) {
              assistantText += delta;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantText };
                return updated;
              });
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }

  if (!isLoaded || !user) return null;

  return (
    <div style={{
      minHeight: "100vh", background: "#070a13",
      display: "flex", flexDirection: "column",
      fontFamily: "system-ui, sans-serif",
    }}>
      {/* Ambient glow */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(78,236,216,0.05) 0%, transparent 65%)",
      }} />

      {/* Header */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 10,
        background: "rgba(7,10,19,0.85)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
            <ImprintLogo size={28} />
            <span style={{ color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "'Instrument Serif', serif" }}>
              Imprint
            </span>
          </Link>
          <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 13 }}>/ Chat</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            {user?.name || user?.email}
          </span>
          <Link href="/dashboard" style={{
            fontSize: 12, color: "#4eecd8", textDecoration: "none",
            padding: "5px 12px", border: "1px solid rgba(78,236,216,0.25)",
            borderRadius: 8, transition: "all 0.2s",
          }}>
            Dashboard
          </Link>
        </div>
      </div>

      {/* No API key banner */}
      {hasKey === false && (
        <div style={{
          position: "fixed", top: 57, left: 0, right: 0, zIndex: 9,
          background: "rgba(124,58,237,0.12)", borderBottom: "1px solid rgba(124,58,237,0.2)",
          padding: "10px 20px", textAlign: "center", fontSize: 13,
          color: "rgba(255,255,255,0.6)",
        }}>
          No Anthropic API key found.{" "}
          <Link href="/dashboard" style={{ color: "#a78bfa", textDecoration: "none", fontWeight: 600 }}>
            Add your key in Dashboard → Settings →
          </Link>
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", paddingTop: hasKey === false ? 110 : 72,
        paddingBottom: 120, maxWidth: 760, width: "100%", margin: "0 auto",
        padding: `${hasKey === false ? 110 : 72}px 20px 140px`,
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <div style={{ marginBottom: 16 }}><ImprintLogo size={52} /></div>
            <h2 style={{
              color: "#fff", fontSize: 24, fontWeight: 600, marginBottom: 8,
              fontFamily: "'Instrument Serif', serif",
            }}>
              Claude remembers you
            </h2>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, lineHeight: 1.6, maxWidth: 400, margin: "0 auto" }}>
              Every message is enriched with your saved memories — your projects, preferences, and context — automatically.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            marginBottom: 16,
          }}>
            {msg.role === "assistant" && (
              <div style={{ flexShrink: 0, marginRight: 10, marginTop: 2 }}>
                <ImprintLogo size={28} />
              </div>
            )}
            <div style={{
              maxWidth: "75%",
              background: msg.role === "user"
                ? "rgba(78,236,216,0.1)"
                : "rgba(255,255,255,0.04)",
              border: `1px solid ${msg.role === "user" ? "rgba(78,236,216,0.2)" : "rgba(255,255,255,0.07)"}`,
              borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              padding: "12px 16px",
              fontSize: 14, lineHeight: 1.65,
              color: msg.role === "user" ? "#e5e5e5" : "rgba(255,255,255,0.85)",
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {msg.content || (
                <span style={{ opacity: 0.4 }}>
                  <span style={{ animation: "pulse 1s infinite" }}>●</span>{" "}
                  <span style={{ animationDelay: "0.2s", animation: "pulse 1s infinite" }}>●</span>{" "}
                  <span style={{ animationDelay: "0.4s", animation: "pulse 1s infinite" }}>●</span>
                </span>
              )}
            </div>
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div style={{ display: "flex", marginBottom: 16 }}>
            <div style={{ flexShrink: 0, marginRight: 10 }}>
              <ImprintLogo size={28} />
            </div>
            <div style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "16px 16px 16px 4px", padding: "14px 18px",
              color: "rgba(255,255,255,0.3)", fontSize: 18, letterSpacing: 4,
            }}>
              •••
            </div>
          </div>
        )}

        {error && (
          <div style={{
            background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
            borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 13, marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(7,10,19,0.9)", backdropFilter: "blur(16px)",
        borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 20px 20px",
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto", position: "relative" }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={autoResize}
            onKeyDown={handleKeyDown}
            placeholder="Message Claude… (memories injected automatically)"
            rows={1}
            style={{
              width: "100%", background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14,
              padding: "12px 52px 12px 16px", color: "#e5e5e5", fontSize: 14,
              outline: "none", resize: "none", lineHeight: 1.5, boxSizing: "border-box",
              fontFamily: "system-ui, sans-serif", transition: "border-color 0.2s",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(78,236,216,0.4)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim() || hasKey === false}
            style={{
              position: "absolute", right: 8, bottom: 8,
              width: 36, height: 36, borderRadius: 10, border: "none",
              background: loading || !input.trim() || hasKey === false
                ? "rgba(78,236,216,0.2)" : "#4eecd8",
              color: "#000", cursor: loading || !input.trim() || hasKey === false
                ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, transition: "all 0.2s",
            }}
          >
            ↑
          </button>
        </div>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.1)", fontSize: 11, marginTop: 8 }}>
          Memories injected · Powered by Claude via your Anthropic key
        </p>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}
