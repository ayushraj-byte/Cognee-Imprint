"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import ImprintLogo from "@/app/components/ImprintLogo";

export default function SignUpPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { status } = useSession();
  const router = useRouter();

  // Already signed in → skip straight to the dashboard.
  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  async function handleGoogleSignUp() {
    setError("");
    setLoading(true);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (status === "loading" || status === "authenticated") return null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060608",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif",
    }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(207,143,109,0.07) 0%, transparent 70%)" }}/>

      <div style={{ width: "100%", maxWidth: 400, position: "relative" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 32, justifyContent: "center" }}>
          <ImprintLogo size={28} />
          <span style={{ color: "rgba(255,255,255,0.88)", fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Imprint
          </span>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20,
          padding: "36px 32px",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.02) inset, 0 24px 48px rgba(0,0,0,0.5)",
        }}>
          <h1 style={{ color: "rgba(255,255,255,0.92)", fontSize: 22, fontWeight: 600, marginBottom: 5, letterSpacing: "-0.3px" }}>
            Create your account
          </h1>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginBottom: 28, lineHeight: 1.5 }}>
            Your memory layer is waiting.
          </p>

          <button
            onClick={handleGoogleSignUp}
            disabled={loading}
            style={{
              width: "100%", padding: "12px 16px",
              background: loading ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12, color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = loading ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)"; }}
          >
            {loading ? (
              <span style={{ opacity: 0.5 }}>Redirecting…</span>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>

          {error && (
            <div style={{ color: "#f87171", fontSize: 12, marginTop: 16, padding: "8px 12px", background: "rgba(248,113,113,0.07)", borderRadius: 8, border: "1px solid rgba(248,113,113,0.15)" }}>
              {error}
            </div>
          )}

          <p style={{ textAlign: "center", marginTop: 24, color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
            Already have an account?{" "}
            <Link href="/sign-in" style={{ color: "#4eecd8", textDecoration: "none" }}>Sign in</Link>
          </p>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, color: "rgba(255,255,255,0.1)", fontSize: 11 }}>
          By signing up you agree to our{" "}
          <Link href="/" style={{ color: "rgba(255,255,255,0.2)", textDecoration: "none" }}>Terms</Link>
          {" & "}
          <Link href="/" style={{ color: "rgba(255,255,255,0.2)", textDecoration: "none" }}>Privacy</Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
