"use client";

// Landing showcase: renders the live Cognee knowledge graph with a curated set of
// demo memories so a first-time visitor (or judge) immediately *sees* Cognee turning
// facts into a connected graph — the core "Best Use of Cognee Cloud" story.

import MemoryGraphSection from "./MemoryGraphSection";

// Demo memories with overlapping keywords (→ teal connections) and one contradiction
// pair (→ red dashed edge), so the graph looks alive and connected out of the box.
const DEMO = [
  { id: "d1",  topic: "projects",    content: "Building Imprint — a persistent memory layer for AI coding IDEs.", pinned: true,  createdAt: "2026-06-30", keywords: ["imprint", "memory", "ai", "ide"],        _raw: { confidence: 1,   contradicts: [] } },
  { id: "d2",  topic: "projects",    content: "Imprint uses Cognee Cloud to store memories as a knowledge graph.", pinned: true, createdAt: "2026-06-30", keywords: ["imprint", "cognee", "memory", "graph"],  _raw: { confidence: 1,   contradicts: [] } },
  { id: "d3",  topic: "work",        content: "Works as a full-stack developer.",                                   pinned: false, createdAt: "2026-06-29", keywords: ["developer", "fullstack"],                _raw: { confidence: 0.9, contradicts: [] } },
  { id: "d4",  topic: "preferences", content: "Prefers TypeScript and Next.js for building web apps.",              pinned: false, createdAt: "2026-06-29", keywords: ["typescript", "nextjs", "developer"],     _raw: { confidence: 0.9, contradicts: [] } },
  { id: "d5",  topic: "preferences", content: "Uses Claude Code and Cursor every day.",                             pinned: false, createdAt: "2026-06-28", keywords: ["claude", "cursor", "ai", "ide"],         _raw: { confidence: 0.9, contradicts: [] } },
  { id: "d6",  topic: "projects",    content: "Competing in the Cognee hackathon on the Cloud track.",              pinned: false, createdAt: "2026-07-01", keywords: ["cognee", "hackathon"],                   _raw: { confidence: 1,   contradicts: [] } },
  { id: "d7",  topic: "work",        content: "Uses Groq for fast, low-cost LLM inference.",                        pinned: false, createdAt: "2026-06-27", keywords: ["groq", "llm", "ai"],                     _raw: { confidence: 0.8, contradicts: [] } },
  { id: "d8",  topic: "projects",    content: "Deploys the app on Vercel with Next.js.",                           pinned: false, createdAt: "2026-06-28", keywords: ["vercel", "deploy", "nextjs"],            _raw: { confidence: 0.85, contradicts: [] } },
  { id: "d9",  topic: "preferences", content: "Prefers React for building user interfaces.",                       pinned: false, createdAt: "2026-06-20", keywords: ["react", "frontend", "ui"],               _raw: { confidence: 0.7, contradicts: ["d10"] } },
  { id: "d10", topic: "preferences", content: "Recently migrated fully to Vue for the frontend.",                  pinned: false, createdAt: "2026-06-30", keywords: ["vue", "frontend", "ui"],                 _raw: { confidence: 0.9, contradicts: ["d9"] } },
  { id: "d11", topic: "general",     content: "Learning data structures & algorithms in C++.",                     pinned: false, createdAt: "2026-06-22", keywords: ["dsa", "cpp", "learning"],                _raw: { confidence: 0.8, contradicts: [] } },
  { id: "d12", topic: "personal",    content: "Based in India, building for a global audience.",                   pinned: false, createdAt: "2026-06-21", keywords: ["india"],                                 _raw: { confidence: 0.9, contradicts: [] } },
  { id: "d13", topic: "work",        content: "Ships fast — favours shipping a demo over perfect code.",           pinned: false, createdAt: "2026-06-25", keywords: ["shipping", "demo", "developer"],         _raw: { confidence: 0.75, contradicts: [] } },
  { id: "d14", topic: "projects",    content: "The memory graph is served from Cognee's hybrid vector + graph store.", pinned: false, createdAt: "2026-06-30", keywords: ["cognee", "graph", "vector", "memory"], _raw: { confidence: 1, contradicts: [] } },
];

export default function MemoryGraphShowcase() {
  return (
    <section className="py-16 px-6 relative" id="graph">
      <div className="max-w-5xl mx-auto">
        <div className="liquid-glass rounded-3xl p-8 md:p-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,_rgba(94,234,212,0.06)_0%,_transparent_60%)] pointer-events-none" />
          <div className="relative mb-8">
            <p className="text-white/30 text-xs tracking-widest uppercase mb-2 font-medium">Powered by Cognee Cloud</p>
            <h2
              className="text-3xl md:text-4xl text-white tracking-tight leading-tight"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Your memory isn&apos;t a list —<br />
              <em className="italic font-light" style={{ color: "#5EEAD4" }}>it&apos;s a graph.</em>
            </h2>
            <p className="text-white/40 text-sm md:text-base mt-3 max-w-2xl leading-relaxed">
              Every fact you teach Imprint is <code className="text-white/60">remember</code>ed into Cognee Cloud, which
              connects it to everything related — so <code className="text-white/60">recall</code> reasons over the
              whole graph, not one row at a time. Drag-free, live, and interactive:
            </p>
          </div>
          <div className="relative">
            <MemoryGraphSection memories={DEMO} />
          </div>
        </div>
      </div>
    </section>
  );
}
