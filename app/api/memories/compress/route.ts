import { NextRequest, NextResponse } from "next/server";
import { getMemories, saveMemory, deleteMemory, Topic } from "@/lib/dynamodb";
import { compressMemories } from "@/lib/compress";

// POST /api/memories/compress
// Body: { userId, topic, groqApiKey? }
// Fetches all unpinned memories for the topic, compresses them into one sentence,
// deletes the originals, and saves the compressed memory.
export async function POST(req: NextRequest) {
  const { userId, topic, groqApiKey } = await req.json();
  if (!userId || !topic) {
    return NextResponse.json({ error: "userId and topic required" }, { status: 400 });
  }

  const key = groqApiKey || process.env.GROQ_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Groq API key required" }, { status: 400 });
  }

  try {
    const all = await getMemories(userId, topic as Topic, 100);
    const compressible = all.filter((m) => !m.pinned);

    if (compressible.length < 3) {
      return NextResponse.json(
        { error: "Need at least 3 unpinned memories to compress" },
        { status: 400 }
      );
    }

    const compressed = await compressMemories(compressible, key);

    // Delete originals, then save the single compressed memory
    await Promise.all(
      compressible.map((m) => deleteMemory(userId, m.memoryId, m.createdAt))
    );

    const saved = await saveMemory({
      userId,
      content: compressed,
      topic: topic as Topic,
      keywords: compressed
        .toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 3)
        .slice(0, 8),
      pinned: false,
      contradicts: [],
      confidence: 0.9,
      source: "compressed",
    });

    return NextResponse.json({
      memory: saved,
      compressed,
      deletedCount: compressible.length,
    });
  } catch (err) {
    console.error("POST /api/memories/compress error:", err);
    return NextResponse.json({ error: "Compression failed" }, { status: 500 });
  }
}
