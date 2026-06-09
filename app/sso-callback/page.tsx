"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallback() {
  return (
    <div style={{
      minHeight: "100vh", background: "#070a13",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🧠</div>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, fontFamily: "system-ui, sans-serif" }}>
          Connecting your account…
        </p>
      </div>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
