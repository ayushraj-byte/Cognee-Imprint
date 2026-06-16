"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

const MCP_CONFIG = (platform: string, userId = "your-user-id") =>
  JSON.stringify(
    {
      mcpServers: {
        imprint: {
          command: "node",
          args: ["/path/to/imprint/mcp/server.js"],
          env: {
            IMPRINT_USER_ID: userId,
            IMPRINT_PLATFORM: platform,
          },
        },
      },
    },
    null,
    2
  );

const TIERS = [
  {
    id: "claude-code",
    label: "Claude Code",
    tag: "MCP · CLI",
    accent: "#cf8f6d",
    icon: "◆",
    steps: [
      {
        title: "Clone & install",
        code: `git clone https://github.com/YashasviThakur/imprint.git\ncd imprint/mcp && npm install`,
      },
      {
        title: "Register with Claude Code",
        code: `claude mcp add imprint --scope user \\\n  -- node /path/to/imprint/mcp/server.js`,
      },
      {
        title: "Add to ~/.claude/settings.json",
        code: MCP_CONFIG("claude-code"),
      },
      {
        title: "Create ~/.claude/CLAUDE.md",
        code: `Call get_memories at session start.\nCall save_memory when you learn something.\nNever announce you're doing this.`,
      },
      {
        title: "Verify connection",
        code: `claude mcp list\n# imprint  ✓ Connected`,
      },
    ],
  },
  {
    id: "cursor",
    label: "Cursor",
    tag: "MCP · Editor",
    accent: "#4eecd8",
    icon: "⌥",
    steps: [
      {
        title: "Clone & install",
        code: `git clone https://github.com/YashasviThakur/imprint.git\ncd imprint/mcp && npm install`,
      },
      {
        title: "Open Cursor MCP settings",
        code: `Cursor → Settings → Features → MCP\n→ Add new MCP server`,
      },
      {
        title: "Add to .cursor/mcp.json",
        code: MCP_CONFIG("cursor"),
      },
      {
        title: "Restart Cursor",
        code: `Cmd/Ctrl + Shift + P\n→ "Developer: Reload Window"\nImprint tools will appear in Claude panel.`,
      },
      {
        title: "Verify",
        code: `Open a chat in Cursor\nType: "What do you remember about me?"\nClaude will call get_memories automatically.`,
      },
    ],
  },
  {
    id: "codex",
    label: "Codex",
    tag: "MCP · CLI",
    accent: "#10a37f",
    icon: "⊕",
    steps: [
      {
        title: "Clone & install",
        code: `git clone https://github.com/YashasviThakur/imprint.git\ncd imprint/mcp && npm install`,
      },
      {
        title: "Add to ~/.codex/config.json",
        code: MCP_CONFIG("codex"),
      },
      {
        title: "Set your user ID",
        code: `Replace "your-user-id" with your\nImprint user ID (found in Dashboard → Connect).`,
      },
      {
        title: "Run Codex with MCP",
        code: `codex\n# Imprint tools: get_memories, save_memory\n# search_memories, delete_memory, pin_memory`,
      },
      {
        title: "Verify",
        code: `Ask Codex: "What do you know about me?"\nIt will call get_memories and list your facts.`,
      },
    ],
  },
  {
    id: "antigravity",
    label: "Antigravity",
    tag: "MCP · Editor",
    accent: "#a855f7",
    icon: "⊗",
    steps: [
      {
        title: "Clone & install",
        code: `git clone https://github.com/YashasviThakur/imprint.git\ncd imprint/mcp && npm install`,
      },
      {
        title: "Open Antigravity MCP settings",
        code: `Antigravity → Preferences → AI Tools → MCP\n→ Add server`,
      },
      {
        title: "Paste MCP config",
        code: MCP_CONFIG("antigravity"),
      },
      {
        title: "Set your user ID",
        code: `Replace "your-user-id" with your\nImprint user ID (found in Dashboard → Connect).`,
      },
      {
        title: "Verify",
        code: `Start a new AI session.\nImprint will inject your memories automatically.`,
      },
    ],
  },
  {
    id: "custom",
    label: "Other IDE",
    tag: "MCP · Any",
    accent: "#6b7280",
    icon: "+",
    steps: [
      {
        title: "Clone & install",
        code: `git clone https://github.com/YashasviThakur/imprint.git\ncd imprint/mcp && npm install`,
      },
      {
        title: "Use this MCP config",
        code: MCP_CONFIG("custom"),
      },
      {
        title: "Add to your IDE's MCP config file",
        code: `Most MCP-compatible IDEs use a JSON file:\n• VS Code: .vscode/mcp.json\n• JetBrains: .idea/mcp.json\n• Zed: ~/.config/zed/settings.json\nCheck your IDE docs for the exact path.`,
      },
      {
        title: "Set IMPRINT_PLATFORM",
        code: `Change "custom" to your IDE name\ne.g. "vscode", "zed", "jetbrains"\nThis tags memories with the source IDE.`,
      },
      {
        title: "Verify",
        code: `Open an AI session in your IDE.\nAsk: "What do you know about me?"\nImprint will call get_memories.`,
      },
    ],
  },
  {
    id: "extension",
    label: "Extension",
    tag: "Chrome",
    accent: "#f97316",
    icon: "🔌",
    steps: [
      {
        title: "Clone the repo",
        code: `git clone https://github.com/YashasviThakur/imprint.git`,
      },
      {
        title: "Load in Chrome",
        code: `1. Open chrome://extensions\n2. Toggle Developer mode ON\n3. Click "Load unpacked"\n4. Select the /extension folder`,
      },
      {
        title: "Open any AI in your browser",
        code: `claude.ai · chatgpt.com · gemini.google.com\nImprint activates automatically on all three.`,
      },
      {
        title: "(Optional) Add your API key",
        code: `Click the Imprint icon\n→ Settings tab\n→ Paste sk-ant-... key\n→ Unlimited memories`,
      },
      {
        title: "Manage your memories",
        code: `Click the Imprint icon anytime\n→ View memories\n→ Open dashboard\n→ Configure Memory Rules`,
      },
    ],
  },
];

function IDELogo({ id, accent, size = 15 }: { id: string; accent: string; size?: number }) {
  const hex = accent.replace("#", "");
  if (id === "claude-code")
    return (
      <img
        src={`https://cdn.simpleicons.org/anthropic/${hex}`}
        width={size} height={size} alt=""
        style={{ objectFit: "contain", flexShrink: 0 }}
      />
    );
  if (id === "cursor")
    return (
      // Cursor logo — actual cursor/arrow shape matching their brand mark
      <svg width={size} height={size} viewBox="0 0 24 24" fill={accent} style={{ flexShrink: 0 }}>
        <path d="M4 2 18 10.5l-6.1 2.1 3.9 7.6-2.6 1.3-3.9-7.6L5.5 16 4 2z" />
      </svg>
    );
  if (id === "codex")
    return (
      <img
        src={`https://cdn.simpleicons.org/openai/${hex}`}
        width={size} height={size} alt=""
        style={{ objectFit: "contain", flexShrink: 0 }}
      />
    );
  if (id === "antigravity")
    return (
      // Orbit/gravity symbol for Antigravity
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(-45 12 12)" stroke={accent} strokeWidth="2" />
        <circle cx="12" cy="12" r="2.2" fill={accent} />
      </svg>
    );
  if (id === "custom")
    return (
      // 4-square grid for "Other IDE"
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  if (id === "extension")
    return (
      <img
        src={`https://cdn.simpleicons.org/googlechrome/${hex}`}
        width={size} height={size} alt=""
        style={{ objectFit: "contain", flexShrink: 0 }}
      />
    );
  return null;
}

function CopyButton({ text, accent }: { text: string; accent: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{
        background: "rgba(255,255,255,0.05)", color: copied ? accent : "rgba(255,255,255,0.5)",
        padding: "10px 20px", borderRadius: 10, border: `1px solid ${copied ? accent + "44" : "rgba(255,255,255,0.08)"}`,
        fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.2s",
      }}
    >
      {copied ? "✓ Copied!" : "Copy config"}
    </button>
  );
}

export default function InstallSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [active, setActive] = useState("claude-code");

  const tier = TIERS.find(t => t.id === active)!;
  const isMcpTier = active !== "extension";

  return (
    <section className="py-28 md:py-36 px-6 relative overflow-hidden" ref={ref}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 40% at 50% 60%, rgba(78,236,216,0.04) 0%, transparent 70%)" }} />

      <div className="max-w-5xl mx-auto relative z-10">

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="mb-14"
        >
          <p className="text-xs tracking-widest uppercase text-white/30 mb-4">Get started</p>
          <h2 className="text-3xl md:text-5xl text-white tracking-tight"
            style={{ fontFamily: "'Instrument Serif', serif" }}>
            Works in every{" "}
            <em className="italic text-white/40 font-light">AI coding tool.</em>
          </h2>
          <p style={{ marginTop: 16, fontSize: 14, color: "rgba(255,255,255,0.3)", maxWidth: 480 }}>
            One MCP server. Persistent memory across Claude Code, Cursor, Codex, Antigravity — or any IDE you use.
          </p>
        </motion.div>

        {/* Platform selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-10"
        >
          {/* MCP group label */}
          <p style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 8 }}>
            MCP — IDE / CLI
          </p>
          <div className="flex gap-3 mb-4 flex-wrap">
            {TIERS.filter(t => !["extension", "enterprise"].includes(t.id)).map(t => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                style={{
                  padding: "8px 18px", borderRadius: 100,
                  border: `1px solid ${active === t.id ? t.accent + "99" : "rgba(255,255,255,0.18)"}`,
                  background: active === t.id ? `${t.accent}28` : "rgba(255,255,255,0.07)",
                  color: active === t.id ? t.accent : "rgba(255,255,255,0.72)",
                  fontSize: 13, fontWeight: active === t.id ? 600 : 400,
                  cursor: "pointer", transition: "all 0.2s",
                  display: "flex", alignItems: "center", gap: 7,
                }}
              >
                <IDELogo id={t.id} accent={active === t.id ? t.accent : "rgba(255,255,255,0.72)"} size={14} />
                {t.label}
                <span style={{ fontSize: 10, opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {t.tag}
                </span>
              </button>
            ))}
          </div>

          {/* Other integrations */}
          <p style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 8, marginTop: 16 }}>
            Browser extension
          </p>
          <div className="flex gap-3 flex-wrap">
            {TIERS.filter(t => t.id === "extension").map(t => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                style={{
                  padding: "8px 18px", borderRadius: 100,
                  border: `1px solid ${active === t.id ? t.accent + "99" : "rgba(255,255,255,0.18)"}`,
                  background: active === t.id ? `${t.accent}28` : "rgba(255,255,255,0.07)",
                  color: active === t.id ? t.accent : "rgba(255,255,255,0.72)",
                  fontSize: 13, fontWeight: active === t.id ? 600 : 400,
                  cursor: "pointer", transition: "all 0.2s",
                  display: "flex", alignItems: "center", gap: 7,
                }}
              >
                <IDELogo id={t.id} accent={active === t.id ? t.accent : "rgba(255,255,255,0.72)"} size={14} />
                {t.label}
                <span style={{ fontSize: 10, opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {t.tag}
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Steps */}
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid grid-cols-1 md:grid-cols-5 gap-0 relative"
        >
          <div className="hidden md:block absolute top-6 left-[10%] right-[10%] h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${tier.accent}22, transparent)` }} />

          {tier.steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              className="flex flex-col gap-4 px-3"
            >
              <div className="flex md:justify-center">
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: `${tier.accent}15`,
                  border: `1px solid ${tier.accent}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: tier.accent,
                  flexShrink: 0, position: "relative", zIndex: 1,
                }}>
                  {i + 1}
                </div>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 8, lineHeight: 1.4 }}>
                  {step.title}
                </p>
                <pre style={{
                  fontSize: 10.5, lineHeight: 1.65,
                  color: "rgba(255,255,255,0.35)",
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10, padding: "10px 12px",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                  margin: 0, fontFamily: "'Geist Mono', monospace",
                  minHeight: 64,
                }}>
                  {step.code}
                </pre>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 flex items-center gap-4 flex-wrap"
        >
          {isMcpTier && (
            <>
              <a
                href="https://github.com/YashasviThakur/imprint/archive/refs/heads/main.zip"
                download
                style={{
                  background: tier.accent, color: "#000",
                  padding: "10px 24px", borderRadius: 10,
                  fontSize: 13, fontWeight: 600, textDecoration: "none",
                  transition: "opacity 0.2s", display: "inline-flex", alignItems: "center", gap: 6,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.opacity = "0.85"}
                onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.opacity = "1"}
              >
                ↓ Download ZIP
              </a>
              <CopyButton text={MCP_CONFIG(active)} accent={tier.accent} />
            </>
          )}
          {active === "extension" && (
            <a
              href="https://github.com/YashasviThakur/imprint/archive/refs/heads/main.zip"
              download
              style={{
                background: tier.accent, color: "#000",
                padding: "10px 24px", borderRadius: 10,
                fontSize: 13, fontWeight: 600, textDecoration: "none",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.opacity = "0.85"}
              onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.opacity = "1"}
            >
              ↓ Download Extension
            </a>
          )}
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
            {isMcpTier ? "~5 min setup" : "~2 min setup"}
          </span>
        </motion.div>

        {/* "Your IDE not listed?" nudge */}
        {active !== "custom" && active !== "extension" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.7 }}
            style={{ marginTop: 20, fontSize: 12, color: "rgba(255,255,255,0.18)" }}
          >
            Your IDE not listed?{" "}
            <button
              onClick={() => setActive("custom")}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: 12, textDecoration: "underline", padding: 0 }}
            >
              Any MCP-compatible tool works →
            </button>
          </motion.p>
        )}
      </div>
    </section>
  );
}
