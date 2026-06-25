import { NextResponse } from "next/server";

// TEMP diagnostic: checks each LLM provider independently (key present? does a
// trivial call succeed?). Reveals only status/error text, never the keys.
// Remove after verifying the fallback chain.

export const maxDuration = 20;

async function testOpenAI(url: string, key: string | undefined, model: string) {
  if (!key) return { keyPresent: false };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Say OK" }], max_tokens: 5 }),
    });
    const body = await res.text();
    return { keyPresent: true, model, status: res.status, ok: res.ok, body: res.ok ? "ok" : body.slice(0, 240) };
  } catch (e) {
    return { keyPresent: true, model, error: String(e) };
  }
}

async function testGemini(key: string | undefined, model: string) {
  if (!key) return { keyPresent: false };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Say OK" }] }] }),
    });
    const body = await res.text();
    return { keyPresent: true, model, status: res.status, ok: res.ok, body: res.ok ? "ok" : body.slice(0, 240) };
  } catch (e) {
    return { keyPresent: true, model, error: String(e) };
  }
}

export async function GET() {
  const [groq, cerebras, gemini] = await Promise.all([
    testOpenAI("https://api.groq.com/openai/v1/chat/completions", process.env.GROQ_API_KEY, "llama-3.1-8b-instant"),
    testOpenAI("https://api.cerebras.ai/v1/chat/completions", process.env.CEREBRAS_API_KEY, "llama-3.3-70b"),
    testGemini(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY, "gemini-2.0-flash"),
  ]);
  return NextResponse.json({ groq, cerebras, gemini });
}
