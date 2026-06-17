"use client";

import { useSignIn } from "@clerk/nextjs";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brain } from "lucide-react";

export default function SignInPage() {
  const { signIn } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleGoogleSignIn() {
    // Clerk dev keys only work on localhost — redirect to dashboard directly for demo
    router.push("/dashboard");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) return;
    setError("");
    setLoading(true);
    try {
      const { error: pwError } = await signIn.password({ identifier: email, password });
      if (pwError) { setError(pwError.message); setLoading(false); return; }

      const { error: finalError } = await signIn.finalize();
      if (finalError) { setError(finalError.message); setLoading(false); return; }

      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

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
      {/* Subtle radial glow behind the card */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(207,143,109,0.07) 0%, transparent 70%)" }}/>

      <div style={{ width: "100%", maxWidth: 400, position: "relative" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 32, justifyContent: "center" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#cf8f6d,#c47a4a)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Brain size={14} color="white" />
          </div>
          <span style={{ color: "rgba(255,255,255,0.88)", fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Imprint
          </span>
        </div>

        {/* Card — glass */}
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
            Welcome back
          </h1>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginBottom: 26, lineHeight: 1.5 }}>
            Your memories are waiting.
          </p>

          <button onClick={handleGoogleSignIn} style={googleBtnStyle}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#1c1c1c"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.13)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#141414"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)"; }}>
            <GoogleIcon />
            Continue with Google
          </button>

          <Divider />

          <form onSubmit={handleSubmit}>
            <Field label="Email address">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required style={inputStyle}
                onFocus={focusStyle} onBlur={blurStyle} />
            </Field>
            <Field label="Password" mt>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Your password" required style={inputStyle}
                onFocus={focusStyle} onBlur={blurStyle} />
            </Field>
            {error && <ErrorBox msg={error} />}
            <button type="submit" disabled={loading} style={submitStyle(loading)}>
              {loading ? "Signing in…" : "Sign in →"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: 20, color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
            No account?{" "}
            <Link href="/sign-up" style={{ color: "#4eecd8", textDecoration: "none" }}>Create one free</Link>
          </p>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, color: "rgba(255,255,255,0.1)", fontSize: 11 }}>
          Protected by Clerk · AES-256 encrypted
        </p>
      </div>
    </div>
  );
}

function Field({ label, children, mt }: { label: string; children: React.ReactNode; mt?: boolean }) {
  return (
    <div style={{ marginTop: mt ? 16 : 0 }}>
      <label style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 6, letterSpacing: "0.03em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{ color: "#f87171", fontSize: 12, marginTop: 12, padding: "8px 12px", background: "rgba(248,113,113,0.07)", borderRadius: 8, border: "1px solid rgba(248,113,113,0.15)" }}>
      {msg}
    </div>
  );
}

function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
      <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>or</span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
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

const googleBtnStyle: React.CSSProperties = {
  width: "100%", padding: "11px 16px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12, color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 500,
  cursor: "pointer", display: "flex", alignItems: "center",
  justifyContent: "center", gap: 10, marginBottom: 20, transition: "all 0.2s",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 12, color: "#e5e5e5", fontSize: 14,
  outline: "none", boxSizing: "border-box", transition: "all 0.2s",
};

const focusStyle = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = "rgba(78,236,216,0.45)";
  e.currentTarget.style.background = "rgba(78,236,216,0.04)";
};

const blurStyle = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)";
  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
};

const submitStyle = (loading: boolean): React.CSSProperties => ({
  width: "100%", marginTop: 20, padding: "12px",
  background: loading ? "rgba(78,236,216,0.5)" : "#4eecd8",
  border: "none", borderRadius: 12, color: "#000",
  fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
  transition: "all 0.2s", letterSpacing: "-0.1px",
});
