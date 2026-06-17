"use client";

import { motion } from "framer-motion";
import { Sparkles, Cloud } from "lucide-react";
import ImprintLogo from "@/app/components/ImprintLogo";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="max-w-md w-full mx-auto px-6 py-12 flex flex-col items-center justify-center relative"
      >
        {/* Icon */}
        <motion.div
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="mb-4"
        >
          <ImprintLogo size={48} />
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
          {/* Option A: Sign up */}
          <Link
            href="/sign-up"
            className="dark-panel rounded-2xl p-6 cursor-pointer hover:border-white/16 group transition-all block"
            style={{ borderColor: "rgba(255,255,255,0.08)", transition: "border-color 0.2s, background 0.2s" }}
          >
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex-shrink-0 text-white/40 group-hover:text-white/80 transition-colors">
                <Sparkles size={20} />
              </div>
              <div>
                <h3
                  className="text-white text-base font-semibold mb-2"
                  style={{ fontFamily: "'Instrument Serif', serif" }}
                >
                  Create free account
                </h3>
                <p className="text-white/35 text-sm leading-relaxed">
                  Sign up with Google or email to access your memory dashboard,
                  manage rules, and connect Imprint to your tools.
                </p>
              </div>
            </div>
          </Link>

          {/* Option B: Dashboard */}
          <Link
            href="/dashboard"
            className="dark-panel rounded-2xl p-6 cursor-pointer group relative transition-all block"
            style={{ borderColor: "rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.07)" }}
          >
            <span className="absolute top-6 right-6 text-black bg-white uppercase text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide">
              Returning
            </span>
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex-shrink-0 text-white/40 group-hover:text-white/80 transition-colors">
                <Cloud size={20} />
              </div>
              <div className="pr-24">
                <h3
                  className="text-white text-base font-semibold mb-2"
                  style={{ fontFamily: "'Instrument Serif', serif" }}
                >
                  Go to dashboard
                </h3>
                <p className="text-white/35 text-sm leading-relaxed">
                  View your memories, configure extraction rules, and manage your
                  team&apos;s shared memory pool.
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
