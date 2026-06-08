"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#070a13",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 24,
    }}>
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(78,236,216,0.07) 0%, transparent 70%)",
      }} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 36, height: 36,
          background: "linear-gradient(135deg, #4eecd8, #7c3aed)",
          borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18,
        }}>🧠</div>
        <span style={{ color: "#fff", fontSize: 20, fontWeight: 600, fontFamily: "'Instrument Serif', serif" }}>
          Imprint
        </span>
      </div>

      <SignUp
        appearance={{
          variables: {
            colorPrimary: "#4eecd8",
            colorBackground: "#0d1220",
            colorText: "#e5e5e5",
            colorTextSecondary: "rgba(255,255,255,0.4)",
            colorInputBackground: "rgba(255,255,255,0.04)",
            colorInputText: "#e5e5e5",
            borderRadius: "12px",
          },
          elements: {
            card: { boxShadow: "0 0 60px rgba(78,236,216,0.05)", border: "1px solid rgba(255,255,255,0.06)" },
            headerTitle: { color: "#fff" },
            formButtonPrimary: { background: "#4eecd8", color: "#000", fontWeight: 600 },
            footerActionLink: { color: "#4eecd8" },
          },
        }}
      />
    </div>
  );
}
