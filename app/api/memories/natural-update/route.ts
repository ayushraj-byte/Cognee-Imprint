import { NextRequest, NextResponse } from "next/server";
import { getMemories, updateMemory } from "@/lib/dynamodb";
import { embed, cosineSimilarity } from "@/lib/embeddings";

// POST /api/memories/natural-update
// Body: { userId, instruction, groqApiKey? }
// 1. Embed the instruction with Jina
// 2. Find top semantically similar memories
// 3. Ask Groq which ones to update and what the new content should be
// 4. Patch those memories in DynamoDB
export async function POST(req: NextRequest) {
  const { userId, instruction, groqApiKey } = await req.json();
  if (!userId || !instruction?.trim()) {
    return NextResponse.json({ error: "userId and instruction required" }, { status: 400 });
  }

  const groqKey = groqApiKey || process.env.GROQ_API_KEY;
  if (!groqKey) return NextResponse.json({ error: "Groq API key required" }, { status: 400 });

  try {
    const all = await getMemories(userId, undefined, 100);
    if (!all.length) return NextResponse.json({ updated: [], count: 0 });

    // Find the most relevant candidates via semantic similarity (or keyword fallback)
    let candidates = all;
    if (process.env.JINA_API_KEY) {
      try {
        const qEmb = await embed(instruction, process.env.JINA_API_KEY, "retrieval.query");
        candidates = all
          .map(m => ({ m, score: m.embedding ? cosineSimilarity(qEmb, m.embedding) : 0 }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)
          .map(x => x.m);
      } catch {
        candidates = all.slice(0, 10);
      }
    } else {
      candidates = all.slice(0, 10);
    }

    const list = candidates
      .map((m, i) => `${i + 1}. [${m.memoryId}] ${m.content}`)
      .join("\n");

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You update a personal memory store based on a natural language instruction.
Given existing memories and an instruction, return a JSON object: { "updates": [{"memoryId": "...", "newContent": "..."}] }
Rules:
- Only modify memories that the instruction directly affects
- Preserve all unrelated details in each memory
- If nothing needs changing, return { "updates": [] }
- Never invent new facts not implied by the instruction`,
          },
          { role: "user", content: `Instruction: "${instruction}"\n\nExisting memories:\n${list}` },
        ],
        temperature: 0,
        max_tokens: 600,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) return NextResponse.json({ error: "Groq API error" }, { status: 500 });

    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    const updates: { memoryId: string; newContent: string }[] = parsed.updates || [];

    const applied: { memoryId: string; old: string; new: string }[] = [];
    for (const u of updates) {
      const mem = all.find(m => m.memoryId === u.memoryId);
      if (mem && u.newContent?.trim()) {
        await updateMemory(userId, mem.memoryId, mem.createdAt, { content: u.newContent.trim() });
        applied.push({ memoryId: mem.memoryId, old: mem.content, new: u.newContent.trim() });
      }
    }

    return NextResponse.json({ updated: applied, count: applied.length });
  } catch (err) {
    console.error("POST /api/memories/natural-update error:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
