import { NextRequest, NextResponse } from "next/server";
import { getMemories } from "@/lib/dynamodb";
import { embed, cosineSimilarity } from "@/lib/embeddings";

// "Ask your memory" — natural-language Q&A grounded in the user's own memories.
// Semantically retrieves the most relevant memories, then has Groq answer using
// ONLY those (plus pinned). Uses the server Groq key, so no BYOK is required.
//
// POST { userId, query } → { answer, sources: [{ content, topic, id }] }

export const maxDuration = 30;

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

    // Top matches + all pinned (always-relevant), de-duped, capped for the prompt.
    const pinned = all.filter(m => m.pinned);
    const seen = new Set<string>();
    const context = [...pinned, ...ranked]
      .filter(m => (seen.has(m.memoryId) ? false : (seen.add(m.memoryId), true)))
      .slice(0, 24);

    if (!groqKey) {
      // No LLM configured — return the most relevant memories as a fallback.
      return NextResponse.json({
        answer: "AI answering isn't configured, but here are the memories most related to your question.",
        sources: context.slice(0, 8).map(m => ({ content: m.content, topic: m.topic, id: m.memoryId })),
      });
    }

    const facts = context.map(m => `- [${m.topic}] ${m.content}`).join("\n");
    const system =
      "You answer questions about a user using ONLY the remembered facts provided. " +
      "If the answer isn't in them, say plainly that you don't have that in memory — do not guess. " +
      "Be concise and direct (1-3 sentences). Refer to the user as 'you'.\n\n" +
      "REMEMBERED FACTS:\n" + facts;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: system },
          { role: "user", content: q },
        ],
        temperature: 0.2,
        max_tokens: 400,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({
        answer: "Couldn't reach the AI right now — here are the most related memories.",
        sources: context.slice(0, 8).map(m => ({ content: m.content, topic: m.topic, id: m.memoryId })),
      });
    }

    const data = await res.json();
    const answer = (data.choices?.[0]?.message?.content || "").trim() || "I couldn't find an answer in your memories.";
    return NextResponse.json({
      answer,
      sources: context.slice(0, 6).map(m => ({ content: m.content, topic: m.topic, id: m.memoryId })),
    });
  } catch (err) {
    console.error("POST /api/ask error:", err);
    return NextResponse.json({ error: "Failed to answer" }, { status: 500 });
  }
}
