"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

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
  },
  {
    number: "02",
    tag: "Web App + BYOK",
    title: "Enterprise",
    description:
      "Connect your Anthropic API key and invite your team. Shared DynamoDB org pool means every team member's Claude session draws from the same memory — client context, project docs, institutional knowledge.",
    cta: "Start free →",
    href: "/chat",
    accent: "#7c3aed",
    detail: "Shared org memory · no install required",
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
  },
];

export default function TiersSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

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
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.number}
              initial={{ opacity: 0, y: 50 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
              transition={{ duration: 0.7, delay: i * 0.12 }}
              className="liquid-glass rounded-3xl p-7 md:p-8 flex flex-col gap-6 group hover:border-white/10 transition-colors duration-300"
              style={{ borderTop: `1px solid ${tier.accent}22` }}
            >
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

              <div className="mt-auto pt-4 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-white/30 text-xs">{tier.detail}</span>
                <a
                  href={tier.href}
                  className="text-sm font-medium transition-opacity hover:opacity-70"
                  style={{ color: tier.accent }}
                >
                  {tier.cta}
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
