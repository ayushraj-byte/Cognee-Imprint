import { NextRequest, NextResponse } from "next/server";
import { getMemories, saveMemory, searchMemories, deleteMemory, updateMemory, Topic } from "@/lib/dynamodb";
import { extractMemories, ExtractedMemory } from "@/lib/extract";
import { detectSemanticContradictions } from "@/lib/contradiction";
import { rankMemories } from "@/lib/rank";

// GET /api/memories?userId=&topic=&search=
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const topic = req.nextUrl.searchParams.get("topic") as Topic | null;
  const search = req.nextUrl.searchParams.get("search");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  try {
    const raw = search
      ? await searchMemories(userId, search)
      : await getMemories(userId, topic || undefined);

    // Rank by: pinned=2.0, else confidence × e^(-λ×daysOld) × (1 + access_boost)
    const memories = rankMemories(raw);
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
      const memory = await saveMemory({
        userId,
        content,
        topic: topic || "general",
        keywords: content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3).slice(0, 6),
        pinned: pinned || false,
        contradicts: [],
        confidence: 1.0,
        source: source || "mcp",
      });
      return NextResponse.json({ memory });
    }

    // Extraction from conversation (from Chrome extension)
    if (!messages) return NextResponse.json({ error: "content or messages required" }, { status: 400 });

    const key = groqApiKey || process.env.GROQ_API_KEY;
    const extracted = await extractMemories(messages, key);
    if (!extracted.length) return NextResponse.json({ memories: [], contradictions: [] });

    const existing = await getMemories(userId, undefined, 100);

    // Semantic contradiction detection: compare new vs same-topic existing memories via Groq
    const contradictions = key
      ? await detectSemanticContradictions(extracted, existing, key)
      : [];

    const existingSet = new Set(existing.map((e: any) => e.content?.toLowerCase().slice(0, 40)));
    const toSave = extracted.filter(m => !existingSet.has(m.content.toLowerCase().slice(0, 40)));

    const saved = await Promise.all(
      toSave.map(m => saveMemory({
        userId, content: m.content, topic: m.topic,
        keywords: m.keywords, pinned: false,
        // Mark memories that contradict existing ones
        contradicts: contradictions
          .filter(c => c.newMemoryContent === m.content)
          .map(c => c.existingMemoryId),
        confidence: m.confidence, source: source || "claude.ai",
      }))
    );

    return NextResponse.json({ memories: saved, contradictions });
  } catch (err) {
    console.error("POST /api/memories error:", err);
    return NextResponse.json({ error: "Failed to save memories" }, { status: 500 });
  }
}

// PATCH /api/memories — pin/unpin
// Body: { userId, memoryId, createdAt, pinned }
export async function PATCH(req: NextRequest) {
  const { userId, memoryId, createdAt, pinned } = await req.json();
  if (!userId || !memoryId || !createdAt) {
    return NextResponse.json({ error: "userId, memoryId, createdAt required" }, { status: 400 });
  }
  try {
    await updateMemory(userId, memoryId, createdAt, { pinned });
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
