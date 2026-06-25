import { NextRequest, NextResponse } from "next/server";
import { getMemories } from "@/lib/dynamodb";
import { embed, cosineSimilarity } from "@/lib/embeddings";

// "Ask your memory" — natural-language Q&A grounded in the user's own memories.
// Semantically retrieves the most relevant memories, then has Groq answer using
// ONLY those (plus pinned). Uses the server Groq key, so no BYOK is required.
//
// POST { userId, query } → { answer, sources: [{ content, topic, id }] }

export const maxDuration = 30;

// Answer with Groq, retrying on rate limits. Uses the fast, high-rate-limit 8b
// model — answering from supplied facts is an easy task, and 70b's free-tier
// limits are easily exhausted. Returns null if it genuinely can't answer.
async function groqAnswer(groqKey: string, system: string, question: string): Promise<string | null> {
  const body = JSON.stringify({
    model: "llama-3.1-8b-instant",
    messages: [{ role: "system", content: system }, { role: "user", content: question }],
    temperature: 0.2,
    max_tokens: 400,
  });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body,
      });
      if (res.ok) { const d = await res.json(); return (d.choices?.[0]?.message?.content || "").trim() || null; }
      if ((res.status === 429 || res.status >= 500) && attempt < 3) { await new Promise(s => setTimeout(s, 600 * attempt)); continue; }
      return null;
    } catch { if (attempt < 3) { await new Promise(s => setTimeout(s, 500 * attempt)); continue; } return null; }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { userId, query } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (!query || !String(query).trim()) return NextResponse.json({ error: "query required" }, { status: 400 });

  const groqKey = process.env.GROQ_API_KEY;
  const q = String(query).trim();

  try {
    const all = await getMemories(userId, undefined, 1000);
    if (!all.length) {
      return NextResponse.json({ answer: "You don't have any memories saved yet.", sources: [] });
    }

    // Rank by semantic similarity to the question (fall back to keyword overlap).
    let ranked = all;
    let embedded = false;
    if (process.env.JINA_API_KEY) {
      try {
        const qv = await embed(q, process.env.JINA_API_KEY, "retrieval.query");
        ranked = [...all].sort((a, b) =>
          (b.embedding ? cosineSimilarity(qv, b.embedding) : 0) -
          (a.embedding ? cosineSimilarity(qv, a.embedding) : 0)
        );
        embedded = true;
      } catch { /* fall through to keyword */ }
    }
    if (!embedded) {
      const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      ranked = [...all].sort((a, b) => {
        const score = (m: typeof a) => words.filter(w => m.content.toLowerCase().includes(w)).length;
        return score(b) - score(a);
      });
    }

    // Query-relevant memories drive the citations; pinned are still given to the
    // model as always-true context, but shouldn't dominate the "based on" list
    // (otherwise the same pinned facts get cited for every question).
    const pinned = all.filter(m => m.pinned);
    const topRelevant = ranked.filter(m => !m.pinned).slice(0, 14);
    const seen = new Set<string>();
    const context = [...topRelevant, ...pinned]
      .filter(m => (seen.has(m.memoryId) ? false : (seen.add(m.memoryId), true)))
      .slice(0, 24);
    const sources = (topRelevant.length ? topRelevant : context)
      .slice(0, 6)
      .map(m => ({ content: m.content, topic: m.topic, id: m.memoryId }));

    const facts = context.map(m => `- [${m.topic}] ${m.content}`).join("\n");
    const system =
      "You answer questions about a user using ONLY the remembered facts provided. " +
      "If the answer isn't in them, say plainly that you don't have that in memory — do not guess. " +
      "Be concise and direct (1-3 sentences). Refer to the user as 'you'.\n\n" +
      "REMEMBERED FACTS:\n" + facts;

    const answer = groqKey ? await groqAnswer(groqKey, system, q) : null;
    if (answer) return NextResponse.json({ answer, sources });
    return NextResponse.json({
      answer: groqKey
        ? "Couldn't reach the AI right now — here are the memories most related to your question."
        : "AI answering isn't configured, but here are the memories most related to your question.",
      sources,
    });
  } catch (err) {
    console.error("POST /api/ask error:", err);
    return NextResponse.json({ error: "Failed to answer" }, { status: 500 });
  }
}
