"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

const WHY_ITEMS = [
  {
    label: "The Problem",
    text: "AI coding assistants forget everything the moment the context window resets. Every new session starts blind — no memory of who you are, what you're building, or how you think.",
  },
  {
    label: "The Fix",
    text: "Imprint captures lasting facts from every session, across every IDE, and stores them in a serverless AWS database. Next session, your assistant already knows you.",
  },
  {
    label: "The Edge",
    text: "Real-time contradiction detection flags when you say something that conflicts with your own memory — no other memory tool does this.",
  },
];

const STACK = [
  {
    name: "Next.js 16",
    role: "App + API layer",
    bg: "rgba(255,255,255,0.03)",
    accent: "#ffffff",
    icon: "▲",
  },
  {
    name: "Vercel Edge",
    role: "Global deployment",
    bg: "rgba(255,255,255,0.03)",
    accent: "#ffffff",
    icon: "⬡",
  },
  {
    name: "AWS DynamoDB",
    role: "Memory storage",
    bg: "rgba(255,153,0,0.05)",
    accent: "#ff9900",
    icon: "◈",
  },
  {
    name: "Groq API",
    role: "llama-3.3-70b · fast extraction",
    bg: "rgba(249,115,22,0.05)",
    accent: "#f97316",
    icon: "⚡",
  },
  {
    name: "Jina Embeddings",
    role: "1024-dim semantic retrieval",
    bg: "rgba(78,236,216,0.05)",
    accent: "#4eecd8",
    icon: "◎",
  },
  {
    name: "AES-256 BYOK",
    role: "End-to-end key encryption",
    bg: "rgba(249,217,122,0.04)",
    accent: "#f9d97a",
    icon: "⬡",
  },
];

export default function BuiltWithSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="stack" ref={ref} className="py-24 md:py-36 px-6 relative overflow-hidden">
      {/* subtle radial */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(78,236,216,0.05)_0%,_transparent_65%)] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">

        {/* ─── Why we built this ─── */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-white/35 text-xs tracking-[0.2em] uppercase mb-4"
        >
          Why we built this
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 36 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.08 }}
          className="text-4xl md:text-5xl lg:text-6xl text-white leading-[1.1] tracking-tight mb-14"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Your AI is brilliant.<br />
          <em className="italic text-white/45 font-light">It just forgets you exist.</em>
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-5 mb-24">
          {WHY_ITEMS.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.65, delay: 0.15 + i * 0.1 }}
              className="liquid-glass rounded-2xl p-6"
            >
              <p className="text-[10px] font-mono tracking-[0.18em] uppercase text-white/25 mb-3">{item.label}</p>
              <p className="text-white/60 text-sm leading-relaxed">{item.text}</p>
            </motion.div>
          ))}
        </div>

        {/* ─── The Stack ─── */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-white/35 text-xs tracking-[0.2em] uppercase mb-4"
        >
          The Stack
        </motion.p>

        <motion.h3
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="text-3xl md:text-4xl text-white tracking-tight mb-10"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Production-grade infrastructure,{" "}
          <em className="italic text-white/40 font-light">zero ops.</em>
        </motion.h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-14">
          {STACK.map((tech, i) => (
            <motion.div
              key={tech.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.5 + i * 0.07 }}
              className="liquid-glass rounded-2xl p-4 flex flex-col gap-2 group hover:bg-white/[0.03] transition-colors"
            >
              <span
                className="text-xl font-mono leading-none"
                style={{ color: tech.accent, opacity: 0.65 }}
              >
                {tech.icon}
              </span>
              <p className="text-white/80 text-sm font-medium leading-tight mt-1">{tech.name}</p>
              <p className="text-white/25 text-[11px] leading-snug">{tech.role}</p>
            </motion.div>
          ))}
        </div>

        {/* ─── CTA row ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 1.1 }}
          className="flex flex-wrap items-center gap-4"
        >
          <a
            href="https://github.com/YashasviThakur/Imprint"
            target="_blank"
            rel="noopener noreferrer"
            className="liquid-glass rounded-full px-6 py-2.5 flex items-center gap-2.5 text-white/70 hover:text-white text-sm font-medium transition-all hover:bg-white/[0.04]"
          >
            <GithubIcon size={15} />
            View source on GitHub
          </a>
          <a
            href="/chat"
            className="text-white/35 hover:text-white/65 text-sm transition-colors"
          >
            Try chat →
          </a>
        </motion.div>
      </div>
    </section>
  );
}
