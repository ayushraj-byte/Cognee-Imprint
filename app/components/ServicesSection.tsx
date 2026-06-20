"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const VIDEO_CARDS = [
  {
    videoUrl:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4",
    tag: "Memory Storage",
    title: "AWS DynamoDB + Groq Extraction",
    description:
      "Memories are extracted by Groq's llama-3.3-70b in real-time and stored in serverless DynamoDB — pinned facts, topic filters, and contradiction detection built in.",
  },
  {
    videoUrl:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260324_151826_c7218672-6e92-402c-9e45-f1e0f454bdc4.mp4",
    tag: "Session Management",
    title: "Amazon DynamoDB Isolation",
    description:
      "State storage utilizing low-latency serverless Amazon DynamoDB tables for instant execution. Complete user control over encryption keys and memory pruning.",
  },
];

const ICON_CARDS = [
  {
    glyph: "◈",
    color: "#4EECD8",
    tag: "Real-time Sync",
    title: "Cross-IDE Memory Graph",
    description:
      "Every memory saved — whether from Claude Code, Cursor, Codex, or Antigravity — lands in the same DynamoDB table. A live dashboard polls every 3 seconds, animating new memories as they arrive.",
  },
  {
    glyph: "◎",
    color: "#4285F4",
    tag: "Semantic Retrieval",
    title: "Jina Embeddings + Relevance Ranking",
    description:
      "Jina AI embeds every memory at 1024 dimensions, so each session pulls the memories relevant to what you're asking — not just the most recent. Pinned facts are always injected, and duplicate saves are merged automatically.",
  },
];

export default function ServicesSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-28 md:py-40 px-6 overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.02)_0%,_transparent_60%)]" />
      <div className="max-w-6xl mx-auto relative z-10" ref={ref}>
        <div className="flex justify-between items-baseline mb-12">
          <h2
            className="text-3xl md:text-5xl text-white tracking-tight"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Core Pipeline
          </h2>
          <span className="hidden md:block text-white/40 text-sm">AWS Native · Jina AI · Groq</span>
        </div>

        {/* Video cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8">
          {VIDEO_CARDS.map((card, i) => (
            <motion.div
              key={card.tag}
              initial={{ opacity: 0, y: 50 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
              transition={{ duration: 0.7, delay: i * 0.15 }}
              className="liquid-glass rounded-3xl overflow-hidden group"
            >
              <div className="aspect-video overflow-hidden">
                <video
                  src={card.videoUrl}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  muted
                  autoPlay
                  loop
                  playsInline
                  preload="auto"
                />
              </div>
              <div className="p-6 md:p-8">
                <span className="text-white/40 text-xs tracking-widest uppercase mb-3 block">
                  {card.tag}
                </span>
                <h3
                  className="text-white text-xl md:text-2xl mb-3 tracking-tight"
                  style={{ fontFamily: "'Instrument Serif', serif" }}
                >
                  {card.title}
                </h3>
                <p className="text-white/50 text-sm leading-relaxed">{card.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Icon cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {ICON_CARDS.map((card, i) => (
            <motion.div
              key={card.tag}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
              transition={{ duration: 0.7, delay: (i + 2) * 0.15 }}
              className="liquid-glass rounded-3xl overflow-hidden group"
            >
              <div className="aspect-video overflow-hidden flex items-center justify-center relative"
                style={{ background: `radial-gradient(ellipse at 50% 60%, ${card.color}12 0%, transparent 70%)` }}>
                <span style={{ fontSize: 96, color: card.color, opacity: 0.18, lineHeight: 1, userSelect: "none",
                  transition: "opacity 0.5s", filter: "blur(0px)" }}
                  className="group-hover:opacity-30 transition-opacity"
                >
                  {card.glyph}
                </span>
                <span style={{ position: "absolute", bottom: 20, left: 24, fontSize: 10, letterSpacing: "0.18em",
                  textTransform: "uppercase", color: `${card.color}60`, fontWeight: 600 }}>
                  {card.tag}
                </span>
              </div>
              <div className="p-6 md:p-8">
                <span className="text-xs tracking-widest uppercase mb-3 block" style={{ color: `${card.color}60` }}>
                  {card.tag}
                </span>
                <h3
                  className="text-white text-xl md:text-2xl mb-3 tracking-tight"
                  style={{ fontFamily: "'Instrument Serif', serif" }}
                >
                  {card.title}
                </h3>
                <p className="text-white/50 text-sm leading-relaxed">{card.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
