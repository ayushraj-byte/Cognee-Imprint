"use client";

import { useSignUp } from "@clerk/nextjs";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brain } from "lucide-react";

export default function SignUpPage() {
  const { signUp } = useSignUp();
  const router = useRouter();

  const [stage, setStage] = useState<"form" | "verify">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignUp() {
    if (!signUp) return;
    await signUp.sso({
      strategy: "oauth_google",
      redirectUrl: `${window.location.origin}/sso-callback`,
      redirectCallbackUrl: `${window.location.origin}/dashboard`,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setError("");
    setLoading(true);
    try {
      const { error: createError } = await signUp.password({ emailAddress: email, password });
      if (createError) { setError(createError.message); return; }

      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) { setError(sendError.message); return; }

      setStage("verify");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setError("");
    setLoading(true);
    try {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code });
      if (verifyError) { setError(verifyError.message); return; }

      const { error: finalError } = await signUp.finalize();
      if (finalError) { setError(finalError.message); return; }

      router.push("/dashboard");
    } catch {
      setError("Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 32, justifyContent: "center" }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,#cf8f6d,#c47a4a)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Brain size={13} color="white" />
          </div>
          <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>
            Imprint
          </span>
        </div>

        {/* Card */}
        <div style={{
          background: "#111",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: "32px 28px",
        }}>
          {stage === "form" ? (
            <>
              <h1 style={{ color: "#ededed", fontSize: 20, fontWeight: 600, marginBottom: 4, letterSpacing: "-0.3px" }}>
                Create your account
              </h1>
              <p style={{ color: "#555", fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
                Your memory layer is waiting.
              </p>

              <button onClick={handleGoogleSignUp} style={googleBtnStyle}
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
                    placeholder="Create a strong password" required style={inputStyle}
                    onFocus={focusStyle} onBlur={blurStyle} />
                </Field>
                {error && <ErrorBox msg={error} />}
                <button type="submit" disabled={loading} style={submitStyle(loading)}>
                  {loading ? "Creating account…" : "Create account →"}
                </button>
              </form>

              <p style={{ textAlign: "center", marginTop: 20, color: "#444", fontSize: 13 }}>
                Already have an account?{" "}
                <Link href="/sign-in" style={{ color: "#4eecd8", textDecoration: "none" }}>Sign in</Link>
              </p>
            </>
          ) : (
            <>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
                <h1 style={{ color: "#ededed", fontSize: 20, fontWeight: 600, marginBottom: 8, letterSpacing: "-0.3px" }}>
                  Check your email
                </h1>
                <p style={{ color: "#555", fontSize: 13, lineHeight: 1.6 }}>
                  We sent a 6-digit code to<br />
                  <span style={{ color: "rgba(255,255,255,0.6)" }}>{email}</span>
                </p>
              </div>
              <form onSubmit={handleVerify}>
                <Field label="Verification code">
                  <input type="text" value={code} onChange={e => setCode(e.target.value)}
                    placeholder="000000" maxLength={6} required
                    style={{ ...inputStyle, textAlign: "center", fontSize: 22, letterSpacing: "0.25em" }}
                    onFocus={focusStyle} onBlur={blurStyle} />
                </Field>
                {error && <ErrorBox msg={error} />}
                <button type="submit" disabled={loading} style={submitStyle(loading)}>
                  {loading ? "Verifying…" : "Verify & continue →"}
                </button>
              </form>
              <button onClick={() => setStage("form")} style={{ background: "none", border: "none", color: "#444", fontSize: 13, cursor: "pointer", display: "block", margin: "16px auto 0", textDecoration: "underline" }}>
                ← Use a different email
              </button>
            </>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 20, color: "#2a2a2a", fontSize: 11 }}>
          By signing up you agree to our{" "}
          <Link href="/" style={{ color: "#333", textDecoration: "none" }}>Terms</Link>
          {" & "}
          <Link href="/" style={{ color: "#333", textDecoration: "none" }}>Privacy</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, children, mt }: { label: string; children: React.ReactNode; mt?: boolean }) {
  return (
    <div style={{ marginTop: mt ? 14 : 0 }}>
      <label style={{ display: "block", color: "#555", fontSize: 12, marginBottom: 6, letterSpacing: "0.01em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{ color: "#f87171", fontSize: 12, marginTop: 12, padding: "8px 12px", background: "rgba(248,113,113,0.06)", borderRadius: 6, border: "1px solid rgba(248,113,113,0.12)" }}>
      {msg}
    </div>
  );
}

function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
      <span style={{ color: "#333", fontSize: 12 }}>or</span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
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
  width: "100%", padding: "10px 14px",
  background: "#141414",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8, color: "rgba(255,255,255,0.75)", fontSize: 13.5, fontWeight: 500,
  cursor: "pointer", display: "flex", alignItems: "center",
  justifyContent: "center", gap: 10, marginBottom: 18, transition: "all 0.15s",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  background: "#0d0d0d",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8, color: "#e5e5e5", fontSize: 13.5,
  outline: "none", boxSizing: "border-box", transition: "border-color 0.15s, background 0.15s",
};

const focusStyle = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
  e.currentTarget.style.background = "#141414";
};

const blurStyle = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
  e.currentTarget.style.background = "#0d0d0d";
};

const submitStyle = (loading: boolean): React.CSSProperties => ({
  width: "100%", marginTop: 18, padding: "11px",
  background: loading ? "rgba(78,236,216,0.4)" : "#4eecd8",
  border: "none", borderRadius: 8, color: "#000",
  fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
  transition: "opacity 0.15s",
});
