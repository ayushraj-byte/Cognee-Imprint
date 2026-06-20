"use client";

import { useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";

const TIERS = [
  {
    number: "01",
    tag: "Unified Memory",
    title: "One store, every tool",
    description:
      "Imprint sits beneath every coding agent and browser AI you use. Claude Code, Cursor, Codex, and Antigravity all draw from the same memory — your projects, preferences, and context travel with you, no matter which IDE you open.",
    cta: "See how it connects →",
    href: "#install",
    accent: "#4eecd8",
    detail: "One DynamoDB store · all tools share it",
    steps: [
      { n: "✦", label: "Claude Code remembers", code: "get_memories → injects context at session start" },
      { n: "✦", label: "Cursor picks up where you left off", code: "Same memory store, different editor" },
      { n: "✦", label: "Codex & Antigravity too", code: "Every MCP agent reads and writes the same store" },
      { n: "✦", label: "All writes go to one place", code: "save_memory → DynamoDB → available everywhere" },
    ],
  },
  {
    number: "02",
    tag: "MCP · All IDEs",
    title: "Every coding agent",
    description:
      "Install the MCP server once. Register it with Claude Code, Cursor, Codex, Antigravity — or any IDE that speaks MCP. Set IMPRINT_PLATFORM and every agent silently recalls your full context at session start.",
    cta: "Install MCP →",
    href: "https://github.com/YashasviThakur/imprint#mcp-server-setup",
    accent: "#cf8f6d",
    detail: "Claude Code · Cursor · Codex · Antigravity · Custom",
    steps: [
      { n: "1", label: "Clone & install once", code: "cd mcp && npm install" },
      { n: "2", label: "Register with your IDE", code: "claude mcp add imprint -- node /path/to/server.js\n# or add to .cursor/mcp.json, codex.json, etc." },
      { n: "3", label: "Tag the platform", code: "IMPRINT_PLATFORM=cursor   # or claude-code, codex…\nIMPRINT_USER_ID=your-id" },
      { n: "4", label: "Switch IDEs freely", code: "All agents share the same memory store —\nswitch editors without losing context" },
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
            <em className="italic text-white/40 font-light">every coding agent.</em>
          </motion.h2>
          <span className="hidden md:block text-white/30 text-sm">One store, all tools</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
