"use client";

import { motion } from "framer-motion";
import { Brain, Sparkles, Cloud } from "lucide-react";
import Link from "next/link";
import BackgroundVideo from "../components/BackgroundVideo";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      <BackgroundVideo overlayOpacity={0.65} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.03)_0%,_transparent_50%)]" style={{ zIndex: 1 }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="max-w-md w-full mx-auto px-6 py-12 flex flex-col items-center justify-center relative z-[2]"
      >
        {/* Icon */}
        <motion.div
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="mb-4"
        >
          <Brain size={32} color="white" />
        </motion.div>

        <p
          className="text-xl font-semibold tracking-tight text-white mb-2"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Imprint
        </p>

        <h1
          className="text-4xl text-white tracking-tight text-center mb-8 leading-tight"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Initialize your{" "}
          <em className="italic font-light">state</em>.
        </h1>

        <div className="flex flex-col gap-4 w-full">
          {/* Option A: Sandbox */}
          <Link
            href="/chat?mode=guest"
            className="liquid-glass rounded-2xl p-6 cursor-pointer border border-transparent hover:border-white/10 group transition-all block"
          >
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex-shrink-0 text-white/50 group-hover:text-white transition-colors">
                <Sparkles size={20} />
              </div>
              <div>
                <h3
                  className="text-white text-base font-semibold mb-2"
                  style={{ fontFamily: "'Instrument Serif', serif" }}
                >
                  Sign in as Guest
                </h3>
                <p className="text-white/40 text-sm leading-relaxed">
                  Test Imprint&apos;s volatile context layer immediately inside our
                  sandboxed environment. No cloud provisioning required.
                </p>
              </div>
            </div>
          </Link>

          {/* Option B: Production */}
          <Link
            href="/chat?mode=connect"
            className="liquid-glass rounded-2xl p-6 cursor-pointer border border-white/20 hover:border-white/40 group relative shadow-[0_0_30px_rgba(255,255,255,0.02)] transition-all block"
          >
            <span className="absolute top-6 right-6 text-black bg-white uppercase text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide">
              Recommended
            </span>
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex-shrink-0 text-white/50 group-hover:text-white transition-colors">
                <Cloud size={20} />
              </div>
              <div className="pr-24">
                <h3
                  className="text-white text-base font-semibold mb-2"
                  style={{ fontFamily: "'Instrument Serif', serif" }}
                >
                  Connect your Claude
                </h3>
                <p className="text-white/40 text-sm leading-relaxed">
                  Link your Anthropic API layer to your personal or enterprise AWS
                  stack. Deploy permanent, end-to-end encrypted vector synchronization.
                </p>
              </div>
            </div>
          </Link>
        </div>

        <Link
          href="/"
          className="mt-8 text-white/20 hover:text-white/40 text-xs transition-colors tracking-wide"
        >
          ← Back to Imprint
        </Link>
      </motion.div>
    </div>
  );
}
