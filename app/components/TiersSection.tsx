"use client";

import { useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";

const TIERS = [
  {
    number: "01",
    tag: "Local Install",
    title: "Developer",
    description:
      "Install the Imprint MCP server once. Claude Code and Claude Desktop gain persistent memory — facts, projects, preferences — recalled silently at the start of every session.",
    cta: "Install MCP →",
    href: "https://github.com/YashasviThakur/imprint#mcp-server-setup",
    accent: "#4eecd8",
    detail: "Works on any machine with Claude Code / Desktop",
    steps: [
      { n: "1", label: "Clone & install", code: "cd mcp && npm install" },
      { n: "2", label: "Register with Claude Code", code: "claude mcp add imprint --scope user \\\n  -- node /path/to/mcp/server.js" },
      { n: "3", label: "Add your AWS + Groq keys", code: "# in ~/.claude.json → mcpServers.imprint.env\nAWS_ACCESS_KEY_ID=...\nGROQ_API_KEY=gsk_..." },
      { n: "4", label: "Create CLAUDE.md", code: "# ~/.claude/CLAUDE.md\nCall get_memories at session start.\nCall save_memory when you learn something." },
    ],
  },
  {
    number: "02",
    tag: "Web App + BYOK",
    title: "Enterprise",
    description:
      "Connect your Anthropic API key and invite your team. Shared DynamoDB org pool means every team member's Claude session draws from the same memory — client context, project docs, institutional knowledge.",
    cta: "Start free →",
    href: "/sign-up",
    accent: "#7c3aed",
    detail: "Shared org memory · no install required",
    steps: [
      { n: "1", label: "Sign up", code: "Visit imprint.app → Sign up with Google or email" },
      { n: "2", label: "Paste your Anthropic key", code: "Dashboard → Settings → Paste sk-ant-... key\n(stored AES-256 encrypted)" },
      { n: "3", label: "Create an org & invite team", code: "POST /api/org\n{ \"name\": \"Acme Corp\", \"adminUserId\": \"...\" }" },
      { n: "4", label: "Every session is informed", code: "Team's Claude sessions automatically\nreceive shared org memory — zero config" },
    ],
  },
  {
    number: "03",
    tag: "Chrome Extension",
    title: "Browser User",
    description:
      "Install the extension, open claude.ai. That's it. Imprint silently injects your memory into every claude.ai conversation. No server, no setup, no friction.",
    cta: "Add to Chrome →",
    href: "#",
    accent: "#f97316",
    detail: "Works on claude.ai · zero configuration",
    steps: [
      { n: "1", label: "Install extension", code: "Chrome Web Store → Search \"Imprint\"\n→ Add to Chrome" },
      { n: "2", label: "Open claude.ai", code: "Extension activates automatically\non every claude.ai tab" },
      { n: "3", label: "Chat naturally", code: "Imprint injects your memories into\nevery message before it reaches Claude" },
      { n: "4", label: "View & manage memories", code: "Click the Imprint icon → see memories,\nopen dashboard, configure rules" },
    ],
  },
];

function StepBlock({ step, accent }: { step: typeof TIERS[0]["steps"][0]; accent: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
        background: `${accent}18`, border: `1px solid ${accent}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 700, color: accent, marginTop: 2,
      }}>
        {step.n}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 4, fontWeight: 500 }}>
          {step.label}
        </div>
        <pre style={{
          fontSize: 10, lineHeight: 1.6,
          color: "rgba(255,255,255,0.35)",
          background: "rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 8, padding: "8px 10px",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
          margin: 0, fontFamily: "monospace",
        }}>
          {step.code}
        </pre>
      </div>
    </div>
  );
}

export default function TiersSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <section className="py-28 md:py-40 px-6 overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(78,236,216,0.03)_0%,_transparent_60%)] pointer-events-none" />
      <div className="max-w-6xl mx-auto relative z-10" ref={ref}>

        <div className="flex justify-between items-baseline mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8 }}
            className="text-3xl md:text-5xl text-white tracking-tight"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            One memory layer,{" "}
            <em className="italic text-white/40 font-light">three surfaces.</em>
          </motion.h2>
          <span className="hidden md:block text-white/30 text-sm">Choose your surface</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TIERS.map((tier, i) => {
            const isOpen = expanded === i;
            return (
              <motion.div
                key={tier.number}
                initial={{ opacity: 0, y: 50 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
                transition={{ duration: 0.7, delay: i * 0.12 }}
                className="liquid-glass rounded-3xl flex flex-col group hover:border-white/10 transition-colors duration-300"
                style={{ borderTop: `1px solid ${tier.accent}22` }}
              >
                {/* Main card content */}
                <div className="p-7 md:p-8 flex flex-col gap-6">
                  <div className="flex items-start justify-between">
                    <span
                      className="text-4xl font-light tracking-tighter"
                      style={{ color: tier.accent, opacity: 0.35, fontFamily: "'Instrument Serif', serif" }}
                    >
                      {tier.number}
                    </span>
                    <span
                      className="text-xs tracking-widest uppercase px-3 py-1 rounded-full border"
                      style={{ color: tier.accent, borderColor: `${tier.accent}33`, background: `${tier.accent}0d` }}
                    >
                      {tier.tag}
                    </span>
                  </div>

                  <div>
                    <h3
                      className="text-white text-2xl md:text-3xl mb-3 tracking-tight"
                      style={{ fontFamily: "'Instrument Serif', serif" }}
                    >
                      {tier.title}
                    </h3>
                    <p className="text-white/50 text-sm leading-relaxed">{tier.description}</p>
                  </div>

                  <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-white/30 text-xs">{tier.detail}</span>
                    <a
                      href={tier.href}
                      className="text-sm font-medium transition-opacity hover:opacity-70"
                      style={{ color: tier.accent }}
                    >
                      {tier.cta}
                    </a>
                  </div>
                </div>

                {/* How it works toggle */}
                <div style={{ borderTop: `1px solid rgba(255,255,255,0.05)` }}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : i)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 28px", background: "transparent", border: "none", cursor: "pointer",
                      color: isOpen ? tier.accent : "rgba(255,255,255,0.3)",
                      fontSize: 12, fontWeight: 500, transition: "color 0.2s",
                    }}
                  >
                    <span>How it works</span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ display: "inline-block", fontSize: 14 }}
                    >
                      ↓
                    </motion.span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="steps"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        style={{ overflow: "hidden" }}
                      >
                        <div style={{
                          padding: "4px 28px 24px",
                          display: "flex", flexDirection: "column", gap: 14,
                        }}>
                          {tier.steps.map(step => (
                            <StepBlock key={step.n} step={step} accent={tier.accent} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
