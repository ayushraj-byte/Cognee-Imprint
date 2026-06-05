"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const FEATURES = [
  {
    number: "01",
    title: "Persistent Memory",
    desc: "Claude remembers your name, job, city, preferences, ongoing projects — across every single session. No more re-introducing yourself.",
  },
  {
    number: "02",
    title: "Contradiction Detection",
    desc: "The only tool that catches when you say something that conflicts with what you told Claude before. Flagged in real time.",
  },
  {
    number: "03",
    title: "Topic Namespaces",
    desc: "Every memory is automatically classified — work, personal, health, projects, relationships. Find anything instantly.",
  },
  {
    number: "04",
    title: "Memory Dashboard",
    desc: "Full visibility into what Claude knows about you. View, edit, pin, or delete any memory from a clean Vercel-hosted interface.",
  },
  {
    number: "05",
    title: "Memory Decay",
    desc: "Old memories fade over 30 days via DynamoDB TTL — like a real mind. Pin the ones that matter to preserve them forever.",
  },
  {
    number: "06",
    title: "Memory Import",
    desc: "Paste any conversation, notes, or text. Claude extracts the key facts and seeds your memory instantly.",
  },
];

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => {
      observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Syne:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:          #15140e;
          --surface:     #1b1a13;
          --border:      #26241a;
          --text:        #c2be9f;
          --text-dim:    #575440;
          --text-bright: #e4dfc4;
          --accent:      #ccc89e;
        }

        html { scroll-behavior: smooth; }

        body {
          background: var(--bg);
          color: var(--text);
          font-family: 'Syne', sans-serif;
          overflow-x: hidden;
        }

        /* ─── Grain ──────────────────────────────── */
        .grain {
          position: fixed;
          inset: -100px;
          width: calc(100% + 200px);
          height: calc(100% + 200px);
          pointer-events: none;
          z-index: 9999;
          background-image: url("data:image/svg+xml,%3Csvg xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%3E%3Cfilter id%3D'n'%3E%3CfeTurbulence type%3D'fractalNoise' baseFrequency%3D'0.85' numOctaves%3D'4' stitchTiles%3D'stitch'%2F%3E%3C%2Ffilter%3E%3Crect width%3D'100%25' height%3D'100%25' filter%3D'url(%23n)' opacity%3D'0.07'%2F%3E%3C%2Fsvg%3E");
          background-size: 180px 180px;
          mix-blend-mode: overlay;
          animation: grain-anim 0.6s steps(1) infinite;
        }

        @keyframes grain-anim {
          0%   { transform: translate(0,   0); }
          14%  { transform: translate(-3%, -5%); }
          28%  { transform: translate(5%,  3%); }
          42%  { transform: translate(-4%,  6%); }
          57%  { transform: translate(7%,  -2%); }
          71%  { transform: translate(-6%,  4%); }
          85%  { transform: translate(3%,  -6%); }
        }

        /* ─── Vignette ───────────────────────────── */
        .vignette {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          background: radial-gradient(ellipse 70% 55% at 50% 38%, transparent 0%, rgba(8,8,5,0.65) 100%);
        }

        /* ─── Nav ────────────────────────────────── */
        nav {
          position: fixed;
          inset: 0 0 auto 0;
          z-index: 200;
          padding: 26px 44px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          animation: fade-down 0.9s cubic-bezier(.16,1,.3,1) both;
          animation-delay: 0.1s;
        }

        @keyframes fade-down {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .nav-logo {
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--text-bright);
          text-decoration: none;
        }

        .nav-links {
          list-style: none;
          display: flex;
          gap: 44px;
        }

        .nav-links a {
          font-size: 13px;
          letter-spacing: 0.04em;
          color: var(--text-dim);
          text-decoration: none;
          transition: color 0.2s;
        }

        .nav-links a:hover { color: var(--text); }

        .nav-cta {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-family: 'Syne', sans-serif;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
          color: var(--text-bright);
          background: transparent;
          border: 1px solid rgba(194,190,159,0.28);
          border-radius: 999px;
          padding: 10px 20px 10px 24px;
          cursor: pointer;
          transition: background 0.25s, border-color 0.25s, gap 0.2s;
        }

        .nav-cta:hover {
          background: rgba(194,190,159,0.07);
          border-color: rgba(194,190,159,0.55);
          gap: 14px;
        }

        .nav-cta-icon {
          width: 22px;
          height: 22px;
          border: 1px solid rgba(194,190,159,0.35);
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 10px;
          transition: transform 0.22s;
          flex-shrink: 0;
        }

        .nav-cta:hover .nav-cta-icon { transform: rotate(45deg); }

        /* ─── Hero ───────────────────────────────── */
        .hero {
          position: relative;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          z-index: 2;
        }

        .hero-inner {
          text-align: center;
          position: relative;
          z-index: 3;
          animation: fade-up 1.1s cubic-bezier(.16,1,.3,1) both;
          animation-delay: 0.45s;
        }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .hero-globe {
          margin-bottom: 36px;
          opacity: 0.45;
        }

        .hero-copy {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300;
          font-size: clamp(17px, 1.9vw, 22px);
          line-height: 1.75;
          color: var(--text);
          max-width: 460px;
          margin: 0 auto;
        }

        .hero-copy p + p {
          margin-top: 22px;
          font-style: italic;
          color: var(--text-dim);
        }

        /* ─── Big IMPRINT ────────────────────────── */
        .hero-brand {
          position: absolute;
          bottom: -0.08em;
          left: 0;
          right: 0;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 22.5vw;
          line-height: 0.82;
          color: rgba(194, 190, 159, 0.07);
          text-align: center;
          pointer-events: none;
          user-select: none;
          letter-spacing: 0.015em;
          animation: brand-rise 2.2s cubic-bezier(.16,1,.3,1) both;
          animation-delay: 0.7s;
        }

        @keyframes brand-rise {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ─── Scroll nudge ───────────────────────── */
        .scroll-nudge {
          position: absolute;
          bottom: 36px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--text-dim);
          z-index: 3;
          animation: fade-up 1s cubic-bezier(.16,1,.3,1) both, nudge-float 2.2s 1.8s ease-in-out infinite;
        }

        @keyframes nudge-float {
          0%,100% { transform: translateX(-50%) translateY(0); }
          50%      { transform: translateX(-50%) translateY(-7px); }
        }

        .scroll-line {
          width: 1px;
          height: 28px;
          background: linear-gradient(to bottom, transparent, var(--text-dim));
        }

        /* ─── Features ───────────────────────────── */
        .features {
          position: relative;
          z-index: 2;
          max-width: 1080px;
          margin: 0 auto;
          padding: 140px 60px;
        }

        .features-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          padding-bottom: 40px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 0;
        }

        .features-label {
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--text-dim);
        }

        .features-idx {
          font-family: 'Cormorant Garamond', serif;
          font-style: italic;
          font-size: 13px;
          color: var(--text-dim);
        }

        .feature-row {
          display: grid;
          grid-template-columns: 64px 1fr 1.2fr;
          gap: 0 48px;
          align-items: start;
          padding: 44px 0;
          border-bottom: 1px solid var(--border);
          transition: background 0.2s;
        }

        .feature-row:hover { background: rgba(194,190,159,0.015); }

        .feature-num {
          font-family: 'Cormorant Garamond', serif;
          font-style: italic;
          font-size: 13px;
          color: var(--text-dim);
          padding-top: 3px;
        }

        .feature-name {
          font-family: 'Syne', sans-serif;
          font-size: clamp(17px, 1.7vw, 22px);
          font-weight: 500;
          color: var(--text-bright);
          line-height: 1.3;
          letter-spacing: -0.01em;
        }

        .feature-desc {
          font-family: 'Cormorant Garamond', serif;
          font-size: 17px;
          font-weight: 300;
          line-height: 1.75;
          color: var(--text-dim);
        }

        /* ─── Reveal ─────────────────────────────── */
        .reveal {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.7s cubic-bezier(.16,1,.3,1),
                      transform 0.7s cubic-bezier(.16,1,.3,1);
        }

        .reveal.is-visible {
          opacity: 1;
          transform: none;
        }

        /* ─── Pitch CTA section ───────────────────── */
        .pitch {
          position: relative;
          z-index: 2;
          max-width: 1080px;
          margin: 0 auto;
          padding: 100px 60px 160px;
          text-align: center;
          border-top: 1px solid var(--border);
        }

        .pitch-heading {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(32px, 4.5vw, 62px);
          font-weight: 300;
          font-style: italic;
          color: var(--text-bright);
          line-height: 1.22;
          margin-bottom: 52px;
        }

        .pitch-btn {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          font-family: 'Syne', sans-serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.05em;
          color: var(--text-bright);
          background: transparent;
          border: 1px solid rgba(194,190,159,0.32);
          border-radius: 999px;
          padding: 16px 36px;
          cursor: pointer;
          transition: background 0.25s, border-color 0.25s, gap 0.2s;
        }

        .pitch-btn:hover {
          background: rgba(194,190,159,0.07);
          border-color: rgba(194,190,159,0.6);
          gap: 20px;
        }

        /* ─── Footer ─────────────────────────────── */
        footer {
          position: relative;
          z-index: 2;
          border-top: 1px solid var(--border);
          padding: 32px 60px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          letter-spacing: 0.06em;
          color: var(--text-dim);
          max-width: 1080px;
          margin: 0 auto;
        }

        /* ─── Modal ──────────────────────────────── */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(8,8,5,0.82);
          backdrop-filter: blur(10px) saturate(0.5);
          z-index: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: backdrop-in 0.28s ease both;
        }

        @keyframes backdrop-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .modal-box {
          position: relative;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 52px 48px 48px;
          width: 100%;
          max-width: 520px;
          animation: modal-in 0.42s cubic-bezier(.16,1,.3,1) both;
        }

        @keyframes modal-in {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: none; }
        }

        .modal-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 34px;
          font-weight: 300;
          font-style: italic;
          color: var(--text-bright);
          margin-bottom: 10px;
        }

        .modal-sub {
          font-size: 13px;
          color: var(--text-dim);
          line-height: 1.65;
          margin-bottom: 36px;
          font-family: 'Cormorant Garamond', serif;
        }

        .modal-options { display: flex; flex-direction: column; gap: 10px; }

        .modal-opt {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 22px;
          border-radius: 10px;
          text-decoration: none;
          transition: background 0.2s, border-color 0.2s;
          cursor: pointer;
        }

        .modal-opt-left { display: flex; flex-direction: column; gap: 3px; }

        .modal-opt-title {
          font-family: 'Syne', sans-serif;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.01em;
        }

        .modal-opt-sub {
          font-family: 'Cormorant Garamond', serif;
          font-size: 13px;
          font-style: italic;
          opacity: 0.55;
        }

        .modal-opt-arrow {
          font-size: 16px;
          opacity: 0.45;
          transition: transform 0.2s, opacity 0.2s;
        }

        .modal-opt:hover .modal-opt-arrow { transform: translateX(5px); opacity: 1; }

        .opt-primary {
          background: rgba(194,190,159,0.06);
          border: 1px solid rgba(194,190,159,0.22);
          color: var(--text-bright);
        }

        .opt-primary:hover {
          background: rgba(194,190,159,0.11);
          border-color: rgba(194,190,159,0.45);
        }

        .opt-secondary {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-dim);
        }

        .opt-secondary:hover {
          border-color: rgba(194,190,159,0.18);
          color: var(--text);
        }

        .modal-x {
          position: absolute;
          top: 18px;
          right: 18px;
          background: none;
          border: none;
          color: var(--text-dim);
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
          padding: 6px 10px;
          transition: color 0.2s;
        }

        .modal-x:hover { color: var(--text); }
      `}</style>

      {/* Grain + vignette */}
      <div className="grain" aria-hidden />
      <div className="vignette" aria-hidden />

      {/* Nav */}
      <nav>
        <a href="/" className="nav-logo">Imprint</a>
        <ul className="nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#about">About</a></li>
          <li><a href="#pricing">Pricing</a></li>
        </ul>
        <button className="nav-cta" onClick={() => setModalOpen(true)}>
          Start with better memory
          <span className="nav-cta-icon">↗</span>
        </button>
      </nav>

      {/* Hero */}
      <section className="hero" id="home">
        <div className="hero-inner">
          {/* Globe SVG */}
          <div className="hero-globe">
            <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
              <circle cx="25" cy="25" r="22.5" stroke="#c2be9f" strokeWidth="0.7"/>
              <ellipse cx="25" cy="25" rx="13" ry="22.5" stroke="#c2be9f" strokeWidth="0.7"/>
              <ellipse cx="25" cy="25" rx="5.5" ry="22.5" stroke="#c2be9f" strokeWidth="0.7"/>
              <ellipse cx="25" cy="14" rx="22.5" ry="8" stroke="#c2be9f" strokeWidth="0.7"/>
              <ellipse cx="25" cy="25" rx="22.5" ry="4.5" stroke="#c2be9f" strokeWidth="0.7"/>
              <ellipse cx="25" cy="36" rx="22.5" ry="8" stroke="#c2be9f" strokeWidth="0.7"/>
            </svg>
          </div>

          <div className="hero-copy">
            <p>We give Claude a permanent memory<br />and catch when you contradict yourself.</p>
            <p>For anyone who talks to Claude daily<br />and wants it to actually know them.</p>
          </div>
        </div>

        {/* IMPRINT giant text */}
        <div className="hero-brand" aria-hidden>IMPRINT</div>

        {/* Scroll nudge */}
        <div className="scroll-nudge">
          <div className="scroll-line" />
          Scroll
        </div>
      </section>

      {/* Features */}
      <section className="features" id="features">
        <div className="features-header reveal">
          <span className="features-label">What Imprint does</span>
          <span className="features-idx">6 capabilities</span>
        </div>
        {FEATURES.map((f, i) => (
          <div
            key={f.number}
            className="feature-row reveal"
            style={{ transitionDelay: `${i * 70}ms` }}
          >
            <span className="feature-num">{f.number}</span>
            <span className="feature-name">{f.title}</span>
            <p className="feature-desc">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Pitch */}
      <section className="pitch" id="pricing">
        <p className="pitch-heading reveal">
          "The only tool that<br />catches when you<br />contradict yourself."
        </p>
        <button className="pitch-btn reveal" onClick={() => setModalOpen(true)}>
          Start with better memory →
        </button>
      </section>

      {/* Footer */}
      <footer>
        <span>© 2026 Imprint</span>
        <span>H0: Hack the Zero Stack · AWS + Vercel</span>
      </footer>

      {/* Modal */}
      {modalOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
        >
          <div className="modal-box">
            <button className="modal-x" onClick={() => setModalOpen(false)}>×</button>
            <h2 className="modal-title">Start with Imprint</h2>
            <p className="modal-sub">
              Connect your Claude account for unlimited memory, or try it free — no account needed.
            </p>
            <div className="modal-options">
              <Link href="/chat?mode=connect" className="modal-opt opt-primary">
                <div className="modal-opt-left">
                  <span className="modal-opt-title">Connect with Claude</span>
                  <span className="modal-opt-sub">Unlimited · bring your own API key</span>
                </div>
                <span className="modal-opt-arrow">→</span>
              </Link>
              <Link href="/chat?mode=guest" className="modal-opt opt-secondary">
                <div className="modal-opt-left">
                  <span className="modal-opt-title">Try 20 messages as guest</span>
                  <span className="modal-opt-sub">No account needed · free tier</span>
                </div>
                <span className="modal-opt-arrow">→</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
