// Unified LLM chat-completion with automatic provider fallback.
//
// Tries Groq first (fastest, but tight free-tier limits), then Cerebras, then
// Google Gemini (AI Studio free tier). A 429 / 5xx / error on one provider
// transparently falls through to the next, so the AI features stop dying when
// Groq is rate-limited. Each provider is skipped if its API key isn't set, so
// the chain works with whatever keys are configured.
//
// Set in Vercel env to enable the fallbacks:
//   GROQ_API_KEY       (already set)
//   CEREBRAS_API_KEY   (free: cloud.cerebras.ai)
//   GEMINI_API_KEY     (free: aistudio.google.com/apikey)  — GOOGLE_API_KEY also accepted
//
// Returns the assistant text, or null if every available provider failed.

export type LLMMessage = { role: "system" | "user" | "assistant"; content: string };
export type LLMOpts = { temperature?: number; maxTokens?: number; json?: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Fast models per provider (cheap, high-rate-limit — fine for the tasks here).
const GROQ_MODEL = "llama-3.1-8b-instant";
const CEREBRAS_MODEL = "gpt-oss-120b";    // verified available on this Cerebras account (llama/qwen ids 404'd)
const GEMINI_MODEL = "gemini-2.5-flash";  // 2.0-flash quota-exhausted; 2.5-flash has a separate quota

// Groq + Cerebras share the OpenAI chat-completions shape.
async function openaiCompatible(
  url: string, key: string, model: string, messages: LLMMessage[], opts: LLMOpts
): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          temperature: opts.temperature ?? 0.2,
          max_tokens: opts.maxTokens ?? 400,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (res.ok) {
        const d = await res.json();
        return (d.choices?.[0]?.message?.content ?? "").trim() || null;
      }
      // Retry transient failures once on this provider, else fall through.
      if ((res.status === 429 || res.status >= 500) && attempt < 2) { await sleep(500); continue; }
      return null;
    } catch {
      if (attempt < 2) { await sleep(400); continue; }
      return null;
    }
  }
  return null;
}

// Gemini (Google AI Studio) uses its own request/response shape.
async function gemini(key: string, model: string, messages: LLMMessage[], opts: LLMOpts): Promise<string | null> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          contents,
          generationConfig: {
            temperature: opts.temperature ?? 0.2,
            maxOutputTokens: opts.maxTokens ?? 400,
            ...(opts.json ? { responseMimeType: "application/json" } : {}),
          },
        }),
      }
    );
    if (!res.ok) return null;
    const d = await res.json();
    const text = (d.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    return text.trim() || null;
  } catch {
    return null;
  }
}

export async function llmComplete(messages: LLMMessage[], opts: LLMOpts = {}): Promise<string | null> {
  const groqKey = process.env.GROQ_API_KEY;
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (groqKey) {
    const r = await openaiCompatible("https://api.groq.com/openai/v1/chat/completions", groqKey, GROQ_MODEL, messages, opts);
    if (r) return r;
  }
  if (cerebrasKey) {
    const r = await openaiCompatible("https://api.cerebras.ai/v1/chat/completions", cerebrasKey, CEREBRAS_MODEL, messages, opts);
    if (r) return r;
  }
  if (geminiKey) {
    const r = await gemini(geminiKey, GEMINI_MODEL, messages, opts);
    if (r) return r;
  }
  return null;
}
