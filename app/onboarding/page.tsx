"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Brain, Globe, Zap, Key, Package, CheckCircle,
  ArrowRight, ArrowLeft, Code2, GraduationCap, Briefcase,
  MessageSquare, Shield, Sparkles, ChevronRight
} from "lucide-react";

/* ─── Types ─── */
type StarterPack = "developer" | "student" | "professional" | null;

interface StarterPackDef {
  id: StarterPack;
  icon: React.ReactNode;
  label: string;
  description: string;
  memories: string[];
  color: string;
}

/* ─── Starter packs ─── */
const STARTER_PACKS: StarterPackDef[] = [
  {
    id: "developer",
    icon: <Code2 size={20} />,
    label: "Developer",
    description: "Tech stack, projects, coding preferences",
    color: "#4eecd8",
    memories: [
      "Prefers concise code examples over long explanations",
      "Follows clean code principles — no unnecessary comments",
      "Prefers TypeScript over JavaScript for new projects",
      "Testing mindset: unit tests for logic, integration for APIs",
    ],
  },
  {
    id: "student",
    icon: <GraduationCap size={20} />,
    label: "Student",
    description: "Study habits, subjects, learning style",
    color: "#a78bfa",
    memories: [
      "Prefers learning with practical examples, not theory-first",
      "Likes step-by-step breakdowns for complex topics",
      "Wants AI to quiz them occasionally to check understanding",
      "Prefers bullet-point summaries over dense paragraphs",
    ],
  },
  {
    id: "professional",
    icon: <Briefcase size={20} />,
    label: "Professional",
    description: "Work context, communication style, goals",
    color: "#f59e0b",
    memories: [
      "Prefers executive-summary style: key points first",
      "Communicate in professional, business-appropriate tone",
      "Context matters: always consider business impact",
      "Prefers structured outputs (tables, lists) for decisions",
    ],
  },
];

/* ─── Step components ─── */

function StepWelcome() {
  return (
    <div style={{ textAlign: "center", padding: "0 8px" }}>
      <div style={{ width: 64, height: 64, background: "linear-gradient(135deg,#cf8f6d,#c47a4a)", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 30 }}>
        🧠
      </div>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 10 }}>Welcome to Imprint</h2>
      <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, lineHeight: 1.7, maxWidth: 380, margin: "0 auto 28px" }}>
        Imprint gives every AI tool you use a persistent memory. Claude, ChatGPT, Gemini — they'll all remember who you are, what you're working on, and how you like to communicate.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        {[
          { icon: "🔁", label: "Persistent across chats" },
          { icon: "🔒", label: "Your data, your keys" },
          { icon: "⚡", label: "Works on Claude, GPT, Gemini" },
        ].map(f => (
          <div key={f.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 7 }}>
            <span>{f.icon}</span>{f.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepExtension() {
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Install the Chrome Extension</h2>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
        The extension intercepts your messages and injects your memories — nothing is sent to third parties.
      </p>

      <div style={{ background: "rgba(78,236,216,0.06)", border: "1px solid rgba(78,236,216,0.15)", borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Globe size={20} color="#4eecd8" />
          <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Chrome / Brave / Edge</span>
        </div>
        <ol style={{ paddingLeft: 18, margin: 0, color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 2 }}>
          <li>Download the <code style={{ background: "rgba(255,255,255,0.07)", padding: "1px 6px", borderRadius: 4, color: "#4eecd8" }}>extension/</code> folder from the repo</li>
          <li>Open <strong style={{ color: "rgba(255,255,255,0.7)" }}>chrome://extensions</strong> in a new tab</li>
          <li>Enable <strong style={{ color: "rgba(255,255,255,0.7)" }}>Developer mode</strong> (top-right toggle)</li>
          <li>Click <strong style={{ color: "rgba(255,255,255,0.7)" }}>Load unpacked</strong> → select the folder</li>
          <li>Pin the 🧠 Imprint icon to your toolbar</li>
        </ol>
      </div>

      <a
        href="https://github.com/YashasviThakur/Imprint"
        target="_blank"
        rel="noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 8, color: "#4eecd8", fontSize: 13, textDecoration: "none", justifyContent: "center", padding: "10px", borderRadius: 8, background: "rgba(78,236,216,0.06)", border: "1px solid rgba(78,236,216,0.12)" }}
      >
        <span>Open GitHub repo</span>
        <ChevronRight size={14} />
      </a>
    </div>
  );
}

function StepConnect() {
  const platforms = [
    { id: "claude",  name: "Claude",  url: "claude.ai",        color: "#cf8f6d", emoji: "🟠" },
    { id: "chatgpt", name: "ChatGPT", url: "chatgpt.com",       color: "#10a37f", emoji: "🟢" },
    { id: "gemini",  name: "Gemini",  url: "gemini.google.com", color: "#4285f4", emoji: "🔵" },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Connect your AI tools</h2>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
        Once the extension is installed, just visit any supported AI — Imprint activates automatically.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {platforms.map(p => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px" }}>
            <span style={{ fontSize: 22 }}>{p.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{p.name}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{p.url}</div>
            </div>
            <div style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, background: `${p.color}18`, color: p.color, fontWeight: 600 }}>AUTO</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "12px 14px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <Shield size={14} color="rgba(255,255,255,0.3)" style={{ marginTop: 2, flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0, lineHeight: 1.6 }}>
            Memory injection happens locally in your browser. Your raw messages are never sent to Imprint servers.
          </p>
        </div>
      </div>
    </div>
  );
}

function StepApiKey({ userId }: { userId: string }) {
  const [key, setKey]       = useState("");
  const [saved, setSaved]   = useState(false);
  const [skip, setSkip]     = useState(false);

  async function handleSave() {
    if (!key.startsWith("sk-ant-")) return;
    try {
      await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, apiKey: key }),
      });
      setSaved(true);
    } catch { setSaved(true); }
  }

  if (saved) return (
    <div style={{ textAlign: "center", padding: "24px 0" }}>
      <CheckCircle size={40} color="#4eecd8" style={{ margin: "0 auto 12px", display: "block" }} />
      <h3 style={{ color: "#fff", fontSize: 16, marginBottom: 6 }}>BYOK activated!</h3>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Unlimited memories — no daily cap.</p>
    </div>
  );

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Bring Your Own Key <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>(optional)</span></h2>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
        Free tier: 20 memories/day. Add your Anthropic API key for unlimited extraction and the AI chat assistant.
      </p>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <input
              type="password"
              placeholder="sk-ant-api03-…"
              value={key}
              onChange={e => setKey(e.target.value)}
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={!key.startsWith("sk-ant-")}
            style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: key.startsWith("sk-ant-") ? "#4eecd8" : "rgba(255,255,255,0.08)", color: key.startsWith("sk-ant-") ? "#000" : "rgba(255,255,255,0.3)", fontWeight: 600, fontSize: 13, cursor: key.startsWith("sk-ant-") ? "pointer" : "not-allowed", flexShrink: 0 }}
          >
            Save
          </button>
        </div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", margin: 0 }}>
          Get your key at console.anthropic.com → API Keys. Your key is stored encrypted server-side and never shared.
        </p>
      </div>
      <button
        onClick={() => setSkip(true)}
        style={{ marginTop: 12, width: "100%", padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, color: "rgba(255,255,255,0.3)", fontSize: 13, cursor: "pointer" }}
      >
        Skip for now — use free tier
      </button>
    </div>
  );
}

function StepStarterPack({ selected, onSelect }: { selected: StarterPack; onSelect: (id: StarterPack) => void }) {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Choose a starter pack</h2>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 18, lineHeight: 1.6 }}>
        Pre-load some sensible defaults so AI tools start off knowing your style. You can edit or delete these anytime.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {STARTER_PACKS.map(pack => {
          const isSelected = selected === pack.id;
          return (
            <div
              key={pack.id}
              onClick={() => onSelect(isSelected ? null : pack.id)}
              style={{ background: isSelected ? `${pack.color}0d` : "rgba(255,255,255,0.03)", border: `1px solid ${isSelected ? pack.color + "40" : "rgba(255,255,255,0.07)"}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", transition: "all 0.15s" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ color: pack.color }}>{pack.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#fff", flex: 1 }}>{pack.label}</span>
                {isSelected && <CheckCircle size={16} color={pack.color} />}
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "0 0 8px" }}>{pack.description}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {pack.memories.slice(0, 2).map((m, i) => (
                  <div key={i} style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", display: "flex", gap: 5 }}>
                    <span style={{ color: pack.color, flexShrink: 0 }}>·</span>{m}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <button
        onClick={() => onSelect(null)}
        style={{ marginTop: 10, width: "100%", padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, color: "rgba(255,255,255,0.3)", fontSize: 13, cursor: "pointer" }}
      >
        Skip — start with no memories
      </button>
    </div>
  );
}

function StepDone({ pack }: { pack: StarterPack }) {
  const packDef = STARTER_PACKS.find(p => p.id === pack);
  return (
    <div style={{ textAlign: "center", padding: "8px 0" }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8 }}>You're all set!</h2>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1.7, maxWidth: 360, margin: "0 auto 24px" }}>
        {packDef
          ? `Your ${packDef.label} starter pack has been loaded. Open Claude, ChatGPT, or Gemini and Imprint will be active.`
          : "Open Claude, ChatGPT, or Gemini and Imprint will be active immediately."}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 300, margin: "0 auto" }}>
        {[
          { icon: "🧠", text: "Your memories are being saved automatically" },
          { icon: "📊", text: "View & edit them in the dashboard" },
          { icon: "🔒", text: "Toggle privacy mode from the extension popup" },
        ].map(i => (
          <div key={i.text} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 12px" }}>
            <span>{i.icon}</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{i.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main onboarding wizard ─── */

const STEPS = [
  { id: "welcome",  label: "Welcome",   icon: <Brain size={14} /> },
  { id: "extension",label: "Extension", icon: <Globe size={14} /> },
  { id: "connect",  label: "Connect",   icon: <Zap size={14} /> },
  { id: "apikey",   label: "API Key",   icon: <Key size={14} /> },
  { id: "starter",  label: "Starter",   icon: <Package size={14} /> },
  { id: "done",     label: "Done",      icon: <CheckCircle size={14} /> },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step,    setStep]    = useState(0);
  const [pack,    setPack]    = useState<StarterPack>(null);
  const [userId,  setUserId]  = useState("guest");

  const isFirst = step === 0;
  const isLast  = step === STEPS.length - 1;

  async function handleNext() {
    if (isLast) { router.push("/dashboard"); return; }

    // On starter step, save the pack
    if (STEPS[step].id === "starter" && pack) {
      const packDef = STARTER_PACKS.find(p => p.id === pack);
      if (packDef) {
        await Promise.all(packDef.memories.map(content =>
          fetch("/api/memories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, content, topic: pack, pinned: false }),
          })
        ));
      }
    }
    setStep(s => s + 1);
  }

  const progress = ((step) / (STEPS.length - 1)) * 100;

  return (
    <div style={{ minHeight: "100vh", background: "#070a13", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 500 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 32 }}>
          <div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#cf8f6d,#c47a4a)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🧠</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Imprint</span>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            {STEPS.map((s, i) => (
              <div key={s.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: i < step ? "#4eecd8" : i === step ? "rgba(78,236,216,0.15)" : "rgba(255,255,255,0.05)",
                  border: i === step ? "1.5px solid #4eecd8" : "1.5px solid transparent",
                  color: i < step ? "#000" : i === step ? "#4eecd8" : "rgba(255,255,255,0.2)",
                  transition: "all 0.3s",
                }}>
                  {i < step ? <CheckCircle size={13} /> : s.icon}
                </div>
                <span style={{ fontSize: 9, color: i <= step ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "#4eecd8", borderRadius: 2, transition: "width 0.4s ease" }} />
          </div>
        </div>

        {/* Card */}
        <div style={{ background: "#0d1220", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "28px 28px 24px" }}>
          <div style={{ minHeight: 280 }}>
            {step === 0 && <StepWelcome />}
            {step === 1 && <StepExtension />}
            {step === 2 && <StepConnect />}
            {step === 3 && <StepApiKey userId={userId} />}
            {step === 4 && <StepStarterPack selected={pack} onSelect={setPack} />}
            {step === 5 && <StepDone pack={pack} />}
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            {!isFirst && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer" }}
              >
                <ArrowLeft size={14} /> Back
              </button>
            )}
            <button
              onClick={handleNext}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 20px", borderRadius: 10, border: "none", background: "#4eecd8", color: "#000", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              {isLast ? "Go to Dashboard" : STEPS[step].id === "starter" && !pack ? "Skip & Continue" : "Continue"}
              {!isLast && <ArrowRight size={14} />}
            </button>
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.15)" }}>
          Already set up? <a href="/dashboard" style={{ color: "rgba(78,236,216,0.6)", textDecoration: "none" }}>Go to dashboard →</a>
        </p>
      </div>
    </div>
  );
}
