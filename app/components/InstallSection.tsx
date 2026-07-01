"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

const MCP_CONFIG = (platform: string, userId = "your-user-id") =>
  JSON.stringify(
    {
      mcpServers: {
        imprint: {
          command: "node",
          args: ["/path/to/Cognee-Imprint/mcp/server.js"],
          env: {
            IMPRINT_USER_ID: userId,
            IMPRINT_API_BASE: "http://localhost:3000",
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
        code: `git clone https://github.com/ayushraj-byte/Cognee-Imprint.git\ncd Cognee-Imprint/mcp && npm install`,
      },
      {
        title: "Register with Claude Code",
        code: `claude mcp add imprint --scope user \\\n  -- node /path/to/Cognee-Imprint/mcp/server.js`,
      },
      {
        title: "Or add manually to ~/.claude.json",
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
        code: `git clone https://github.com/ayushraj-byte/Cognee-Imprint.git\ncd Cognee-Imprint/mcp && npm install`,
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
        code: `Cmd/Ctrl + Shift + P\n→ "Developer: Reload Window"\nImprint tools will appear in the MCP tools list.`,
      },
      {
        title: "Verify",
        code: `Open a chat in Cursor\nType: "What do you remember about me?"\nCursor will call get_memories automatically.`,
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
        code: `git clone https://github.com/ayushraj-byte/Cognee-Imprint.git\ncd Cognee-Imprint/mcp && npm install`,
      },
      {
        title: "Add to ~/.codex/config.toml (TOML, not JSON)",
        code: `[mcp_servers.imprint]\ncommand = "node"\nargs = ["/path/to/Cognee-Imprint/mcp/server.js"]\n\n[mcp_servers.imprint.env]\nIMPRINT_USER_ID = "your-user-id"\nIMPRINT_API_BASE = "http://localhost:3000"\nIMPRINT_PLATFORM = "codex"`,
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
        code: `git clone https://github.com/ayushraj-byte/Cognee-Imprint.git\ncd Cognee-Imprint/mcp && npm install`,
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
        code: `git clone https://github.com/ayushraj-byte/Cognee-Imprint.git\ncd Cognee-Imprint/mcp && npm install`,
      },
      {
        title: "Use this MCP config",
        code: MCP_CONFIG("custom"),
      },
      {
        title: "Add to your IDE's MCP config file",
        code: `Three config shapes cover almost every IDE:\n\n• "mcpServers" JSON (most): Cursor, Windsurf,\n  Claude Code/Desktop, Antigravity\n• "servers" JSON: VS Code → .vscode/mcp.json\n• TOML [mcp_servers.x]: Codex → ~/.codex/config.toml\n\nCommon paths:\n• VS Code:   .vscode/mcp.json  (key: "servers")\n• Windsurf:  ~/.codeium/windsurf/mcp_config.json\n• Zed:       ~/.config/zed/settings.json\n• JetBrains: Settings → Tools → AI Assistant → MCP`,
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
];

// All logos are inline SVGs — no CDN dependency, guaranteed to render.
function IDELogo({ id, accent, active = false, size = 16 }: {
  id: string; accent: string; active?: boolean; size?: number;
}) {
  const c = active ? accent : "rgba(255,255,255,0.68)";

  switch (id) {
    // Claude Code — official chip icon from lobehub.com/icons/claudecode
    case "claude-code":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={c} fillRule="evenodd" style={{ flexShrink: 0 }}>
          <path clipRule="evenodd" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z"/>
        </svg>
      );

    // Cursor — faceted crystal brand mark
    case "cursor":
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ flexShrink: 0 }}>
          <polygon points="50,5 86,27 86,73 50,95 14,73 14,27" fill="#0e0e0c" />
          <polygon points="50,5 86,27 50,50 14,27" fill={active ? "#d2d2ce" : "rgba(255,255,255,0.45)"} />
          <polygon points="86,27 86,73 50,50" fill={active ? "#666662" : "rgba(255,255,255,0.2)"} />
          <polygon points="14,27 50,50 14,73" fill={active ? "#3c3c3a" : "rgba(255,255,255,0.12)"} />
          <polygon points="50,50 86,73 50,95" fill="#1e1e1c" />
          <polygon points="14,73 50,95 50,50" fill="#161614" />
          <polygon points="50,15 76,34 50,40 24,34" fill={active ? "#ffffff" : "rgba(255,255,255,0.65)"} />
        </svg>
      );

    // OpenAI — official spinning-wheel path from simpleicons
    case "codex":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={c} style={{ flexShrink: 0 }}>
          <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855-5.843-3.371 2.015-1.168a.076.076 0 0 1 .072 0l4.83 2.786a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.408-.674zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
        </svg>
      );

    // Antigravity — official icon from antigravity.google/press
    case "antigravity":
      return (
        <img
          src="/antigravity-icon.svg"
          width={size}
          height={size}
          alt="Antigravity"
          style={{ flexShrink: 0, opacity: active ? 1 : 0.45 }}
        />
      );

    // Other IDE — 4-square grid
    case "custom":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
          stroke={c} strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <rect x="3" y="3" width="7" height="7" rx="1.5"/>
          <rect x="14" y="3" width="7" height="7" rx="1.5"/>
          <rect x="3" y="14" width="7" height="7" rx="1.5"/>
          <rect x="14" y="14" width="7" height="7" rx="1.5"/>
        </svg>
      );

    default: return null;
  }
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
          <div className="flex gap-3 mb-4 flex-wrap">
            {TIERS.filter(t => t.id !== "enterprise").map(t => (
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
                <IDELogo id={t.id} accent={t.accent} active={active === t.id} size={16} />
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
          <a
            href="https://github.com/ayushraj-byte/Cognee-Imprint/archive/refs/heads/main.zip"
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
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
            ~5 min setup
          </span>
        </motion.div>

        {/* "Your IDE not listed?" nudge */}
        {active !== "custom" && (
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
