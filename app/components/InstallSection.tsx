"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

const TIERS = [
  {
    id: "mcp",
    label: "Developer",
    tag: "MCP Server",
    accent: "#4eecd8",
    icon: "⌨️",
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
        title: "Add env vars to ~/.claude.json",
        code: `{\n  "AWS_ACCESS_KEY_ID": "your-key",\n  "AWS_SECRET_ACCESS_KEY": "your-secret",\n  "DYNAMODB_MEMORIES_TABLE": "imprint-memories",\n  "IMPRINT_USER_ID": "your-unique-id",\n  "GROQ_API_KEY": "gsk_..."\n}`,
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
    id: "enterprise",
    label: "Enterprise",
    tag: "Web App + BYOK",
    accent: "#7c3aed",
    icon: "🏢",
    steps: [
      {
        title: "Sign up",
        code: `Go to imprint-chi.vercel.app\n→ Click "Start for free"\n→ Sign up with Google or email`,
      },
      {
        title: "Paste your Anthropic API key",
        code: `Dashboard → Settings\n→ Paste sk-ant-... key\n→ Save (stored AES-256 encrypted)`,
      },
      {
        title: "Create your organisation",
        code: `POST /api/org\n{\n  "name": "Acme Corp",\n  "adminUserId": "your-user-id"\n}`,
      },
      {
        title: "Invite team members",
        code: `PATCH /api/org\n{\n  "orgId": "your-org-id",\n  "userId": "teammate-id"\n}`,
      },
      {
        title: "Every session is now informed",
        code: `All team members automatically receive\npersonal + shared org memories.\nZero configuration per member.`,
      },
    ],
  },
  {
    id: "extension",
    label: "Browser User",
    tag: "Chrome Extension",
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
        title: "Open claude.ai",
        code: `Imprint activates automatically.\nNo configuration needed.`,
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

export default function InstallSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [active, setActive] = useState("mcp");

  const tier = TIERS.find(t => t.id === active)!;

  return (
    <section className="py-28 md:py-36 px-6 relative overflow-hidden" ref={ref}>
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 40% at 50% 60%, rgba(78,236,216,0.04) 0%, transparent 70%)" }} />

      <div className="max-w-5xl mx-auto relative z-10">

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="mb-14"
        >
          <p className="text-xs tracking-widest uppercase text-white/30 mb-4">Get started</p>
          <h2 className="text-3xl md:text-5xl text-white tracking-tight"
            style={{ fontFamily: "'Instrument Serif', serif" }}>
            Up and running{" "}
            <em className="italic text-white/40 font-light">in minutes.</em>
          </h2>
        </motion.div>

        {/* Tier selector tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex gap-3 mb-10 flex-wrap"
        >
          {TIERS.map(t => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              style={{
                padding: "8px 20px",
                borderRadius: 100,
                border: `1px solid ${active === t.id ? t.accent + "66" : "rgba(255,255,255,0.08)"}`,
                background: active === t.id ? `${t.accent}12` : "transparent",
                color: active === t.id ? t.accent : "rgba(255,255,255,0.35)",
                fontSize: 13, fontWeight: active === t.id ? 600 : 400,
                cursor: "pointer", transition: "all 0.2s",
              }}
            >
              {t.icon} {t.label}
              <span style={{
                marginLeft: 8, fontSize: 10, opacity: 0.6,
                textTransform: "uppercase", letterSpacing: "0.05em",
              }}>
                {t.tag}
              </span>
            </button>
          ))}
        </motion.div>

        {/* Steps */}
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid grid-cols-1 md:grid-cols-5 gap-0 relative"
        >
          {/* Connecting line */}
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
              {/* Step number bubble */}
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

              {/* Step content */}
              <div>
                <p style={{
                  fontSize: 12, fontWeight: 600,
                  color: "rgba(255,255,255,0.7)",
                  marginBottom: 8, lineHeight: 1.4,
                }}>
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
          className="mt-12 flex items-center gap-6"
        >
          <a
            href={active === "extension" ? "https://github.com/YashasviThakur/imprint" : active === "enterprise" ? "/sign-up" : "https://github.com/YashasviThakur/imprint#mcp-server-setup-claude-code--desktop"}
            style={{
              background: tier.accent, color: "#000",
              padding: "10px 24px", borderRadius: 10,
              fontSize: 13, fontWeight: 600, textDecoration: "none",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.opacity = "0.85"}
            onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.opacity = "1"}
          >
            {active === "enterprise" ? "Start free →" : "View full guide →"}
          </a>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
            {active === "mcp" ? "~5 min setup" : active === "enterprise" ? "No install required" : "~2 min setup"}
          </span>
        </motion.div>
      </div>
    </section>
  );
}
