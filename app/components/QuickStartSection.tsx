"use client";

import { ArrowRight } from "lucide-react";

const STEPS = [
  {
    num: "01",
    time: "30 sec",
    title: "Sign in",
    desc: "Create your free Imprint account. No credit card, no install yet.",
    color: "#cf8f6d",
  },
  {
    num: "02",
    time: "60 sec",
    title: "Connect your IDE",
    desc: "Paste one config block into Claude Code, Cursor, or Codex. MCP activates instantly.",
    color: "#4EECD8",
  },
  {
    num: "03",
    time: "Forever",
    title: "AI remembers you",
    desc: "Switch IDEs, start a new chat — your full context is always there, automatically.",
    color: "#a78bfa",
  },
];

export default function QuickStartSection() {
  return (
    <section className="py-16 px-6 relative">
      <div className="max-w-5xl mx-auto">
        <div className="liquid-glass rounded-3xl p-8 md:p-12 relative overflow-hidden">
          {/* Background accent */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,_rgba(207,143,109,0.06)_0%,_transparent_60%)] pointer-events-none"/>

          {/* Header row */}
          <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-white/30 text-xs tracking-widest uppercase mb-2 font-medium">
                Quick start
              </p>
              <h2
                className="text-3xl md:text-4xl text-white tracking-tight leading-tight"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                Up and running<br/>
                <em className="italic font-light" style={{ color: "#cf8f6d" }}>in under 2 minutes.</em>
              </h2>
            </div>
            <a
              href="/login"
              className="flex items-center gap-3 rounded-full px-6 py-3 text-sm font-medium self-start md:self-auto group transition-all"
              style={{
                background: "rgba(207,143,109,0.12)",
                border: "1px solid rgba(207,143,109,0.25)",
                color: "rgba(207,143,109,0.9)",
              }}
            >
              Get started free
              <span
                className="flex items-center justify-center w-7 h-7 rounded-full transition-colors"
                style={{ background: "rgba(207,143,109,0.18)" }}
              >
                <ArrowRight size={14}/>
              </span>
            </a>
          </div>

          {/* Steps */}
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Connector line */}
            <div
              className="hidden md:block absolute top-[38px] left-[33%] right-[33%] h-px pointer-events-none"
              style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)" }}
            />
            {STEPS.map((step) => (
              <div
                key={step.num}
                className="rounded-2xl p-5 flex flex-col gap-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-2xl font-bold leading-none"
                    style={{ fontFamily: "'Instrument Serif', serif", color: step.color, opacity: 0.4 }}
                  >
                    {step.num}
                  </span>
                  <span
                    className="text-xs rounded-full px-2 py-0.5"
                    style={{ color: step.color, background: `${step.color}15`, border: `1px solid ${step.color}25` }}
                  >
                    {step.time}
                  </span>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm mb-1">{step.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-white/15 text-xs text-center mt-6 tracking-wide">
            Claude Code · Cursor · Codex · Antigravity · VS Code · Windsurf
          </p>
        </div>
      </div>
    </section>
  );
}
