"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const CARDS = [
  {
    videoUrl:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4",
    tag: "Vector Ingestion",
    title: "Amazon Aurora pgvector Mesh",
    description:
      "Leverages high-performance Amazon Aurora Serverless PostgreSQL clusters with pgvector to auto-index codebases and multi-session chats on the fly.",
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
          <span className="hidden md:block text-white/40 text-sm">AWS Native</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {CARDS.map((card, i) => (
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
      </div>
    </section>
  );
}
