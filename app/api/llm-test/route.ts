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

const CEREBRAS_CANDIDATES = [
  "llama3.3-70b", "llama-4-scout-17b-16e-instruct", "qwen-3-32b", "gpt-oss-120b",
  "llama3.1-8b", "llama-3.1-8b", "deepseek-r1-distill-llama-70b",
];
const GEMINI_CANDIDATES = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];

export async function GET() {
  const groq = await testOpenAI("https://api.groq.com/openai/v1/chat/completions", process.env.GROQ_API_KEY, "llama-3.1-8b-instant");
  const cerebras: Record<string, unknown> = {};
  for (const m of CEREBRAS_CANDIDATES) {
    cerebras[m] = await testOpenAI("https://api.cerebras.ai/v1/chat/completions", process.env.CEREBRAS_API_KEY, m);
  }
  const gemini: Record<string, unknown> = {};
  for (const m of GEMINI_CANDIDATES) {
    gemini[m] = await testGemini(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY, m);
  }
  return NextResponse.json({ groq, cerebras, gemini });
}
