"use client";

import { ArrowRight, Layers } from "lucide-react";
import ImprintLogo from "./ImprintLogo";

function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}


export default function HeroSection() {
  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col justify-between">

      {/* Navbar */}
      <nav className="relative z-20 px-6 py-6">
        <div className="liquid-glass rounded-full max-w-5xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <ImprintLogo size={28} />
            <span
              className="text-white font-semibold text-lg tracking-tight"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Imprint
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a
              href="#stack"
              className="flex items-center gap-1.5 text-white/65 hover:text-white text-sm font-medium transition-colors"
            >
              <Layers size={14} />
              Built With
            </a>
            <a
              href="https://github.com/YashasviThakur/Imprint"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-white/65 hover:text-white text-sm font-medium transition-colors"
            >
              <GithubIcon size={15} />
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 text-center -translate-y-[10%]">
        <h1
          className="text-7xl md:text-8xl lg:text-9xl text-white tracking-tight leading-none"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Leave an{" "}
          <em
            className="italic font-light text-transparent bg-clip-text"
            style={{ backgroundImage: "linear-gradient(135deg, #d4a85a 0%, #b8864a 50%, #9e6e3a 100%)" }}
          >imprint</em>
          {" "}on your{" "}
          <span
            className="text-transparent bg-clip-text"
            style={{ backgroundImage: "linear-gradient(135deg, #5bbfb0 0%, #3d9e90 50%, #2a7a6e 100%)" }}
          >
            IDEs.
          </span>
        </h1>

        <p className="max-w-2xl text-white/70 text-sm md:text-base leading-relaxed my-8 px-4">
          One persistent memory layer for Claude Code, Cursor, Codex, Antigravity — and every MCP-capable IDE.
          Automatic capture. Semantic recall. Real-time contradiction detection. Your full context, everywhere you build.
        </p>

        {/* Primary CTA */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
          <a
            href="/login"
            className="liquid-glass rounded-full pl-6 pr-2 py-2 flex items-center gap-4 hover:bg-white/5 transition-colors group"
          >
            <span className="text-white text-sm font-medium">
              Connect your IDE to its brain
            </span>
            <span className="bg-white rounded-full p-3 text-black group-hover:bg-white/90 transition-colors flex-shrink-0">
              <ArrowRight size={18} />
            </span>
          </a>
        </div>

      </div>

      {/* Social footer */}
      <div className="relative z-10 flex flex-wrap justify-center gap-4 md:gap-6 pb-12 text-xs text-white/40 px-6">
        <span>Vercel AI SDK Integration</span>
        <span>•</span>
        <span>AWS Serverless Infrastructure</span>
        <span>•</span>
        <span>Sub-100ms Hydration</span>
      </div>
    </div>
  );
}
