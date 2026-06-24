"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import ImprintLogo from "@/app/components/ImprintLogo";
import BackgroundVideo from "@/app/components/BackgroundVideo";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  // Already signed in? Skip the login screen entirely and go to the dashboard.
  // Without this, a user with a perfectly valid session still lands here and is
  // pushed through OAuth again — the "I always have to log in" symptom.
  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  // Don't flash the login UI while we resolve the session (or while redirecting).
  if (status === "loading" || status === "authenticated") return null;

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: "#050505" }}>

      {/* Background video — same as landing */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <BackgroundVideo overlayOpacity={0.52} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center text-center px-6"
      >
        {/* Logo pulse */}
        <motion.div
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="mb-6"
        >
          <ImprintLogo size={52} />
        </motion.div>

        <h1
          className="text-5xl text-white tracking-tight mb-3 leading-tight"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Leave an <em className="italic font-light text-transparent bg-clip-text"
            style={{ backgroundImage: "linear-gradient(135deg, #d4a85a 0%, #b8864a 100%)" }}>imprint</em>.
        </h1>

        <p className="text-white/40 text-sm mb-10 max-w-xs leading-relaxed">
          Persistent memory for Claude Code, Cursor, Codex — and every AI in your browser.
        </p>

        {/* Single CTA */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="flex items-center gap-3 px-6 py-3.5 rounded-full text-sm font-medium transition-all"
          style={{
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "#fff",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 24px rgba(0,0,0,0.3)",
            letterSpacing: "0.01em",
          }}
        >
          <GoogleIcon />
          Connect with Google
        </motion.button>

        <a
          href="/"
          className="mt-10 text-white/20 hover:text-white/40 text-xs transition-colors tracking-wide"
        >
          ← Back to Imprint
        </a>
      </motion.div>
    </div>
  );
}
