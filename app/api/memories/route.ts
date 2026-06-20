import { NextRequest, NextResponse } from "next/server";
import { getMemories, saveMemory, searchMemories, deleteMemory, updateMemory, Topic } from "@/lib/dynamodb";
import { extractMemories, ExtractedMemory } from "@/lib/extract";
import { detectSemanticContradictions } from "@/lib/contradiction";
import { rankMemories } from "@/lib/rank";
import { embed, cosineSimilarity } from "@/lib/embeddings";
import { optimizeContext } from "@/lib/context-optimizer";

// GET /api/memories?userId=&topic=&search=&semantic=
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const topic = req.nextUrl.searchParams.get("topic") as Topic | null;
  const search   = req.nextUrl.searchParams.get("search");
  const semantic = req.nextUrl.searchParams.get("semantic");
  const optimize = req.nextUrl.searchParams.get("optimize") === "true";
  const budget   = parseInt(req.nextUrl.searchParams.get("budget") || "2000");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  try {
    // Semantic search: embed the query, rank by cosine similarity
    if (semantic && process.env.JINA_API_KEY) {
      const all = await getMemories(userId, undefined, 200);
      let queryEmbedding: number[];
      try {
        queryEmbedding = await embed(semantic, process.env.JINA_API_KEY, "retrieval.query");
      } catch {
        // Embedding failed — fall through to keyword search
        const kw = all.filter(m =>
          semantic.toLowerCase().split(/\s+/).some(w =>
            m.content.toLowerCase().includes(w) || m.keywords.some(k => k.toLowerCase().includes(w))
          )
        );
        return NextResponse.json({ memories: rankMemories(kw).slice(0, 20) });
      }

      const scored = all
        .map(m => ({
          m,
          score: m.embedding ? cosineSimilarity(queryEmbedding, m.embedding) : 0,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
        .map(x => x.m);

      return NextResponse.json({ memories: rankMemories(scored) });
    }

    // Keyword search
    if (search) {
      const raw = await searchMemories(userId, search);
      return NextResponse.json({ memories: rankMemories(raw) });
    }

    // Standard fetch — ranked, optionally trimmed to token budget
    const raw = await getMemories(userId, topic || undefined);
    const ranked = rankMemories(raw);
    const memories = optimize ? optimizeContext(ranked, budget) : ranked;
    return NextResponse.json({ memories });
  } catch (err) {
    console.error("GET /api/memories error:", err);
    return NextResponse.json({ error: "Failed to fetch memories" }, { status: 500 });
  }
}

// POST /api/memories
// Direct save (MCP): { userId, content, topic, pinned, source }
// Extraction (extension): { userId, messages, source, groqApiKey }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, content, topic, pinned, messages, source, groqApiKey } = body;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  try {
    // Direct single-memory save (from MCP)
    if (content) {
      let embedding: number[] | undefined;
      if (process.env.JINA_API_KEY) {
        try { embedding = await embed(content, process.env.JINA_API_KEY, "retrieval.passage"); } catch {}
      }
      const memory = await saveMemory({
        userId,
        content,
        topic: topic || "general",
        keywords: content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3).slice(0, 6),
        pinned: pinned || false,
        contradicts: [],
        confidence: 1.0,
        source: source || "mcp",
        embedding,
      });
      return NextResponse.json({ memory });
    }

    // Extraction from conversation (from Chrome extension)
    if (!messages) return NextResponse.json({ error: "content or messages required" }, { status: 400 });

    const key = groqApiKey || process.env.GROQ_API_KEY;
    const extracted = await extractMemories(messages, key);
    if (!extracted.length) return NextResponse.json({ memories: [], contradictions: [] });

    const existing = await getMemories(userId, undefined, 100);

    // Semantic contradiction detection via Groq
    const contradictions = key
      ? await detectSemanticContradictions(extracted, existing, key)
      : [];

    const existingSet = new Set(existing.map((e: any) => e.content?.toLowerCase().slice(0, 40)));
    const toSave = extracted.filter(m => !existingSet.has(m.content.toLowerCase().slice(0, 40)));

    const saved = await Promise.all(
      toSave.map(async m => {
        let embedding: number[] | undefined;
        if (process.env.JINA_API_KEY) {
          try { embedding = await embed(m.content, process.env.JINA_API_KEY, "retrieval.passage"); } catch {}
        }
        return saveMemory({
          userId, content: m.content, topic: m.topic,
          keywords: m.keywords, pinned: false,
          contradicts: contradictions
            .filter(c => c.newMemoryContent === m.content)
            .map(c => c.existingMemoryId),
          confidence: m.confidence,
          source: source || "claude.ai",
          embedding,
        });
      })
    );

    return NextResponse.json({ memories: saved, contradictions });
  } catch (err) {
    console.error("POST /api/memories error:", err);
    return NextResponse.json({ error: "Failed to save memories" }, { status: 500 });
  }
}

// PATCH /api/memories — update pinned/content/topic/tags
export async function PATCH(req: NextRequest) {
  const { userId, memoryId, createdAt, pinned, content, topic, tags } = await req.json();
  if (!userId || !memoryId || !createdAt) {
    return NextResponse.json({ error: "userId, memoryId, createdAt required" }, { status: 400 });
  }
  try {
    const updates: any = {};
    if (pinned !== undefined) updates.pinned = pinned;
    if (content !== undefined) updates.content = content;
    if (topic !== undefined) updates.topic = topic;
    if (tags !== undefined) updates.tags = tags;
    await updateMemory(userId, memoryId, createdAt, updates);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/memories error:", err);
    return NextResponse.json({ error: "Failed to update memory" }, { status: 500 });
  }
}

// DELETE /api/memories?userId=&memoryId=&createdAt=
export async function DELETE(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const memoryId = req.nextUrl.searchParams.get("memoryId");
  const createdAt = req.nextUrl.searchParams.get("createdAt");
  if (!userId || !memoryId || !createdAt) {
    return NextResponse.json({ error: "userId, memoryId, createdAt required" }, { status: 400 });
  }
  try {
    await deleteMemory(userId, memoryId, createdAt);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/memories error:", err);
    return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
  }
}
