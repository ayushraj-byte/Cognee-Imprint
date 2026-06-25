"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Zap, Key, Package, CheckCircle,
  ArrowRight, ArrowLeft, Code2, GraduationCap, Briefcase,
  Shield, Sparkles, Copy
} from "lucide-react";
import ImprintLogo from "@/app/components/ImprintLogo";

/* ─── Types ─── */
type StarterPack = "developer" | "student" | "professional" | null;
type IdeChoice = "claude-code" | "cursor" | "codex" | "other";

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

/* ─── IDE configs ─── */
const IDE_OPTIONS: { id: IdeChoice; label: string; glyph: string; color: string; configNote: string; verifyCmd: string }[] = [
  { id: "claude-code", label: "Claude Code", glyph: "⬡", color: "#cf8f6d", configNote: "~/.claude/settings.json → mcpServers", verifyCmd: "claude mcp list" },
  { id: "cursor",      label: "Cursor",      glyph: "◈", color: "#4eecd8", configNote: "~/.cursor/mcp.json",                   verifyCmd: "Restart Cursor → open a chat" },
  { id: "codex",       label: "Codex CLI",   glyph: "▲", color: "#10a37f", configNote: "~/.codex/config.json",                 verifyCmd: "codex → ask about yourself" },
  { id: "other",       label: "Other IDE",   glyph: "+", color: "#6b7280", configNote: "See your IDE's MCP docs",              verifyCmd: "Ask your AI: \"What do you know about me?\"" },
];

function mcpBlock(userId: string, ide: IdeChoice) {
  return `{
  "mcpServers": {
    "imprint": {
      "command": "node",
      "args": ["/path/to/imprint/mcp/server.js"],
      "env": {
        "IMPRINT_USER_ID": "${userId}",
        "IMPRINT_PLATFORM": "${ide}"
      }
    }
  }
}`;
}

/* ─── Step: Welcome ─── */
function StepWelcome() {
  return (
    <div style={{ textAlign: "center", padding: "0 8px" }}>
      <div style={{ margin: "0 auto 20px", width: 64, height: 64 }}>
        <ImprintLogo size={64} />
      </div>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 10 }}>Welcome to Imprint</h2>
      <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, lineHeight: 1.7, maxWidth: 380, margin: "0 auto 28px" }}>
        Imprint gives every AI tool you use a persistent memory — across Claude Code, Cursor, Codex, and Antigravity. Your projects, preferences, and context follow you everywhere.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        {[
          { icon: "🔁", label: "Persistent across all IDEs" },
          { icon: "🔒", label: "Your data, your keys" },
          { icon: "⚡", label: "Works on Claude, Cursor, Codex" },
        ].map(f => (
          <div key={f.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 7 }}>
            <span>{f.icon}</span>{f.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Step: Connect IDE ─── */
function StepConnectIde({ userId, ide, setIde }: { userId: string; ide: IdeChoice; setIde: (id: IdeChoice) => void }) {
  const [copied, setCopied] = useState(false);
  const selected = IDE_OPTIONS.find(o => o.id === ide)!;
  const config = mcpBlock(userId || "your-user-id", ide);

  function copy() {
    navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Connect your IDE</h2>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 18, lineHeight: 1.6 }}>
        One MCP config block — Imprint injects your memories into every AI session automatically.
      </p>

      {/* IDE tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" as const }}>
        {IDE_OPTIONS.map(o => (
          <button key={o.id} onClick={() => setIde(o.id)}
            style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: ide === o.id ? 600 : 400, cursor: "pointer",
              border: `1px solid ${ide === o.id ? o.color + "55" : "rgba(255,255,255,0.1)"}`,
              background: ide === o.id ? `${o.color}12` : "transparent",
              color: ide === o.id ? o.color : "rgba(255,255,255,0.4)" }}>
            {o.glyph} {o.label}
          </button>
        ))}
      </div>

      {/* Step 1: Clone */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 8 }}>1 — Clone & install</p>
        <pre style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)", margin: 0, fontFamily: "monospace", whiteSpace: "pre-wrap" as const }}>
          {`git clone https://github.com/YashasviThakur/imprint.git\ncd imprint/mcp && npm install`}
        </pre>
      </div>

      {/* Step 2: Config */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${selected.color}22`, borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.1em", margin: 0 }}>
            2 — Add to <code style={{ fontSize: 10, color: selected.color }}>{selected.configNote}</code>
          </p>
          <button onClick={copy}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer",
              background: copied ? `${selected.color}15` : "rgba(255,255,255,0.05)", border: `1px solid ${copied ? selected.color + "40" : "rgba(255,255,255,0.08)"}`,
              color: copied ? selected.color : "rgba(255,255,255,0.4)" }}>
            <Copy size={10}/>{copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre style={{ fontSize: 10.5, color: "rgba(255,255,255,0.38)", margin: 0, fontFamily: "monospace", whiteSpace: "pre-wrap" as const, maxHeight: 140, overflow: "auto" }}>
          {config}
        </pre>
      </div>

      {/* Step 3: Verify */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 14px" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.25)", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 4 }}>3 — Verify</p>
        <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.4)", margin: 0 }}>
          {selected.verifyCmd} — then ask: <em style={{ color: "rgba(255,255,255,0.55)" }}>"What do you know about me?"</em>
        </p>
      </div>
    </div>
  );
}

/* ─── Step: API Key ─── */
function StepApiKey({ userId }: { userId: string }) {
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!key.startsWith("sk-ant-")) return;
    try {
      await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, apiKey: key }),
      });
    } catch {}
    setSaved(true);
  }

  if (saved) return (
    <div style={{ textAlign: "center", padding: "24px 0" }}>
      <CheckCircle size={40} color="#4eecd8" style={{ margin: "0 auto 12px", display: "block" }} />
      <h3 style={{ color: "#fff", fontSize: 16, marginBottom: 6 }}>BYOK activated!</h3>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Unlimited memories + Chat assistant unlocked.</p>
    </div>
  );

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
        Bring Your Own Key <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>(optional)</span>
      </h2>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
        Free tier: 20 extractions/day. Add your Anthropic API key to unlock unlimited memories and the in-dashboard chat assistant.
      </p>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input type="password" placeholder="sk-ant-api03-…" value={key} onChange={e => setKey(e.target.value)}
            style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" as const }}/>
          <button onClick={handleSave} disabled={!key.startsWith("sk-ant-")}
            style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: key.startsWith("sk-ant-") ? "#4eecd8" : "rgba(255,255,255,0.08)", color: key.startsWith("sk-ant-") ? "#000" : "rgba(255,255,255,0.3)", fontWeight: 600, fontSize: 13, cursor: key.startsWith("sk-ant-") ? "pointer" : "not-allowed", flexShrink: 0 }}>
            Save
          </button>
        </div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", margin: 0 }}>
          Get your key at console.anthropic.com → API Keys. Stored encrypted, never shared.
        </p>
      </div>
    </div>
  );
}

/* ─── Step: Starter Pack ─── */
function StepStarterPack({ selected, onSelect }: { selected: StarterPack; onSelect: (id: StarterPack) => void }) {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Choose a starter pack</h2>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 18, lineHeight: 1.6 }}>
        Pre-load sensible defaults so AI tools start knowing your style. Editable anytime.
      </p>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
        {STARTER_PACKS.map(pack => {
          const isSelected = selected === pack.id;
          return (
            <div key={pack.id} onClick={() => onSelect(isSelected ? null : pack.id)}
              style={{ background: isSelected ? `${pack.color}0d` : "rgba(255,255,255,0.03)", border: `1px solid ${isSelected ? pack.color + "40" : "rgba(255,255,255,0.07)"}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", transition: "all 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ color: pack.color }}>{pack.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#fff", flex: 1 }}>{pack.label}</span>
                {isSelected && <CheckCircle size={16} color={pack.color} />}
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "0 0 8px" }}>{pack.description}</p>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 3 }}>
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
      <button onClick={() => onSelect(null)}
        style={{ marginTop: 10, width: "100%", padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, color: "rgba(255,255,255,0.3)", fontSize: 13, cursor: "pointer" }}>
        Skip — start with no defaults
      </button>
    </div>
  );
}

/* ─── Step: Done ─── */
function StepDone({ pack, ide }: { pack: StarterPack; ide: IdeChoice }) {
  const packDef = STARTER_PACKS.find(p => p.id === pack);
  const ideDef = IDE_OPTIONS.find(o => o.id === ide);
  return (
    <div style={{ textAlign: "center", padding: "8px 0" }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8 }}>You're all set!</h2>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1.7, maxWidth: 360, margin: "0 auto 24px" }}>
        {packDef
          ? `${packDef.label} starter pack loaded. `
          : ""}
        {ideDef && ideDef.id !== "other"
          ? `Open ${ideDef.label} and Imprint will inject your memories automatically.`
          : "Start any connected IDE and Imprint will be active immediately."}
      </p>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, maxWidth: 300, margin: "0 auto" }}>
        {[
          { icon: "🧠", text: "Memories saved automatically after every session" },
          { icon: "📊", text: "View and edit everything in the dashboard" },
          { icon: "🔌", text: "Connect more IDEs anytime from Dashboard → Connect" },
        ].map(i => (
          <div key={i.text} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 12px" }}>
            <span>{i.icon}</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "left" as const }}>{i.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main wizard ─── */
const STEPS = [
  { id: "welcome",  label: "Welcome",  icon: <ImprintLogo size={14} /> },
  { id: "ide",      label: "IDE",      icon: <Zap size={14} /> },
  { id: "apikey",   label: "API Key",  icon: <Key size={14} /> },
  { id: "starter",  label: "Starter",  icon: <Package size={14} /> },
  { id: "done",     label: "Done",     icon: <CheckCircle size={14} /> },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isLoaded = status !== "loading";
  const userId = (session?.user as { id?: string })?.id ?? "";
  const [step, setStep]   = useState(0);
  const [pack, setPack]   = useState<StarterPack>(null);
  const [ide, setIde]     = useState<IdeChoice>("claude-code");
  const isFirst = step === 0;
  const isLast  = step === STEPS.length - 1;

  async function handleNext() {
    if (isLast) { router.push("/dashboard"); return; }

    if (STEPS[step].id === "starter" && pack) {
      const packDef = STARTER_PACKS.find(p => p.id === pack);
      if (packDef && userId) {
        await Promise.all(packDef.memories.map(content =>
          fetch("/api/memories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, content, topic: "preferences", pinned: false, source: "onboarding" }),
          })
        ));
      }
    }
    setStep(s => s + 1);
  }

  const progress = (step / (STEPS.length - 1)) * 100;

  if (!isLoaded) return (
    <div style={{ minHeight: "100vh", background: "#070a13", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 24, height: 24, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#4eecd8", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#070a13", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 520 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 32 }}>
          <ImprintLogo size={32} />
          <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'Instrument Serif', serif" }}>Imprint</span>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            {STEPS.map((s, i) => (
              <div key={s.id} style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 5 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: i < step ? "#4eecd8" : i === step ? "rgba(78,236,216,0.15)" : "rgba(255,255,255,0.05)",
                  border: i === step ? "1.5px solid #4eecd8" : "1.5px solid transparent",
                  color: i < step ? "#000" : i === step ? "#4eecd8" : "rgba(255,255,255,0.2)", transition: "all 0.3s" }}>
                  {i < step ? <CheckCircle size={13} /> : s.icon}
                </div>
                <span style={{ fontSize: 9, color: i <= step ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{s.label}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "#4eecd8", borderRadius: 2, transition: "width 0.4s ease" }}/>
          </div>
        </div>

        {/* Card */}
        <div style={{ background: "#0d1220", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "28px 28px 24px" }}>
          <div style={{ minHeight: 300 }}>
            {step === 0 && <StepWelcome />}
            {step === 1 && <StepConnectIde userId={userId} ide={ide} setIde={setIde} />}
            {step === 2 && <StepApiKey userId={userId} />}
            {step === 3 && <StepStarterPack selected={pack} onSelect={setPack} />}
            {step === 4 && <StepDone pack={pack} ide={ide} />}
          </div>

          {/* Nav */}
          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            {!isFirst && (
              <button onClick={() => setStep(s => s - 1)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer" }}>
                <ArrowLeft size={14}/> Back
              </button>
            )}
            <button onClick={handleNext}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 20px", borderRadius: 10, border: "none", background: "#4eecd8", color: "#000", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              {isLast ? "Go to Dashboard" : STEPS[step].id === "starter" && !pack ? "Skip & Continue" : "Continue"}
              {!isLast && <ArrowRight size={14}/>}
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
