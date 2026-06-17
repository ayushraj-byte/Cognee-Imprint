"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Pin, ExternalLink } from "lucide-react";
import ImprintLogo from "@/app/components/ImprintLogo";

const TOPIC_META: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
  projects:      { color: "#7c3aed", bg: "#7c3aed18", label: "Projects",      emoji: "🚀" },
  work:          { color: "#0070f3", bg: "#0070f318", label: "Work",           emoji: "💼" },
  preferences:   { color: "#d97706", bg: "#d9770618", label: "Preferences",   emoji: "⭐" },
  personal:      { color: "#059669", bg: "#05966918", label: "Personal",      emoji: "👤" },
  health:        { color: "#e11d48", bg: "#e11d4818", label: "Health",        emoji: "❤️" },
  relationships: { color: "#8b5cf6", bg: "#8b5cf618", label: "Relationships", emoji: "🤝" },
  general:       { color: "#6b7280", bg: "#6b728018", label: "General",       emoji: "📌" },
};

export default function SharePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token  = params?.token as string;
  const userId = searchParams?.get("uid") || "";

  const [memories, setMemories] = useState<any[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  useEffect(() => {
    if (!token || !userId) { setError("Invalid share link."); setLoading(false); return; }
    fetch(`/api/share?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); } else { setMemories(d.memories || []); setTotal(d.total || 0); }
      })
      .catch(() => setError("Failed to load."))
      .finally(() => setLoading(false));
  }, [token, userId]);

  const byTopic = memories.reduce((acc: Record<string, any[]>, m) => {
    (acc[m.topic] = acc[m.topic] || []).push(m);
    return acc;
  }, {});

  return (
    <div style={{ minHeight: "100vh", background: "#111110", color: "white", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <style>{`@keyframes fade-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 48px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <ImprintLogo size={28} />
          <span style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>Imprint</span>
        </Link>
        <Link href="/sign-up"
          style={{ padding: "8px 18px", borderRadius: 10, background: "linear-gradient(135deg,#cf8f6d,#c47a4a)", color: "white", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>
          Get Imprint free →
        </Link>
      </nav>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "56px 24px", animation: "fade-in 0.4s ease both" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(255,255,255,0.2)" }}>Loading memory profile…</div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <p style={{ color: "rgba(239,68,68,0.7)", marginBottom: 12 }}>{error}</p>
            <Link href="/" style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>← Back to Imprint</Link>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ marginBottom: 36 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(207,143,109,0.08)", border: "1px solid rgba(207,143,109,0.2)", borderRadius: 100, padding: "5px 14px", marginBottom: 20 }}>
                <Pin size={11} style={{ color: "rgba(207,143,109,0.7)" }} />
                <span style={{ fontSize: 11.5, color: "rgba(207,143,109,0.7)", fontWeight: 500 }}>Shared memory profile</span>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,0.9)", margin: "0 0 8px", letterSpacing: "-0.02em", fontFamily: "'Instrument Serif', serif" }}>
                What AI knows about this person
              </h1>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", margin: 0 }}>
                {memories.length} pinned memories shared · {total} total in their profile
              </p>
            </div>

            {/* Memories by topic */}
            {Object.entries(byTopic).map(([topic, mems]) => {
              const meta = TOPIC_META[topic] || { color: "#6b7280", bg: "#6b728018", label: topic, emoji: "📌" };
              return (
                <div key={topic} style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 14 }}>{meta.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{meta.label}</span>
                  </div>
                  {(mems as any[]).map((m: any) => (
                    <div key={m.memoryId} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, marginBottom: 6 }}>
                      <Pin size={11} style={{ color: "rgba(207,143,109,0.5)", marginTop: 3, flexShrink: 0 }} />
                      <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{m.content}</span>
                    </div>
                  ))}
                </div>
              );
            })}

            {memories.length === 0 && (
              <p style={{ color: "rgba(255,255,255,0.2)", textAlign: "center", padding: "40px 0" }}>No pinned memories shared.</p>
            )}

            {/* CTA */}
            <div style={{ marginTop: 40, padding: "24px", background: "rgba(207,143,109,0.05)", border: "1px solid rgba(207,143,109,0.15)", borderRadius: 16, textAlign: "center" }}>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>Want Claude to remember everything about you too?</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 18 }}>Imprint gives any AI persistent memory — across every tool you use.</p>
              <Link href="/sign-up"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 24px", borderRadius: 10, background: "linear-gradient(135deg,#cf8f6d,#c47a4a)", color: "white", textDecoration: "none", fontSize: 14, fontWeight: 500 }}>
                <ExternalLink size={13} /> Get Imprint free
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
