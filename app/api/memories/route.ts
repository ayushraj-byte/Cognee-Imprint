import { NextRequest, NextResponse } from "next/server";
import { getMemories, saveMemory, searchMemories, Topic } from "@/lib/dynamodb";
import { extractMemories, ExtractedMemory } from "@/lib/extract";

// Simple contradiction check
function detectContradictions(newMems: ExtractedMemory[], existing: any[]) {
  const contradictions: any[] = [];
  for (const n of newMems) {
    for (const e of existing) {
      if (n.topic !== e.topic) continue;
      const nWords = n.content.toLowerCase().split(/\s+/).slice(0, 4).join(" ");
      const eWords = (e.content || "").toLowerCase().split(/\s+/).slice(0, 4).join(" ");
      if (nWords === eWords && n.content !== e.content) {
        contradictions.push({
          newMemoryContent: n.content,
          existingMemoryId: e.memoryId,
          existingMemoryContent: e.content,
          explanation: `Updated: "${e.content}" → "${n.content}"`,
        });
      }
    }
  }
  return contradictions;
}

// GET /api/memories?userId=&topic=&search=
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const topic = req.nextUrl.searchParams.get("topic") as Topic | null;
  const search = req.nextUrl.searchParams.get("search");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  try {
    const memories = search
      ? await searchMemories(userId, search)
      : await getMemories(userId, topic || undefined);
    return NextResponse.json({ memories });
  } catch (err) {
    console.error("GET /api/memories error:", err);
    return NextResponse.json({ error: "Failed to fetch memories" }, { status: 500 });
  }
}

// POST /api/memories — extract + save from conversation
// Body: { userId, messages: [{role, content}], source?, groqApiKey? }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, messages, source, groqApiKey } = body;
  if (!userId || !messages) {
    return NextResponse.json({ error: "userId and messages required" }, { status: 400 });
  }

  try {
    // Use Groq if caller passes their key, otherwise use server-side key, else regex
    const key = groqApiKey || process.env.GROQ_API_KEY;
    const extracted = await extractMemories(messages, key);

    if (!extracted.length) return NextResponse.json({ memories: [], contradictions: [] });

    const existing = await getMemories(userId, undefined, 100);
    const contradictions = detectContradictions(extracted, existing);

    // Deduplicate against existing
    const existingSet = new Set(existing.map((e: any) => e.content?.toLowerCase().slice(0, 40)));
    const toSave = extracted.filter(m => !existingSet.has(m.content.toLowerCase().slice(0, 40)));

    const saved = await Promise.all(
      toSave.map(m => saveMemory({
        userId,
        content: m.content,
        topic: m.topic,
        keywords: m.keywords,
        pinned: false,
        contradicts: [],
        confidence: m.confidence,
        source: source || "claude.ai",
      }))
    );

    return NextResponse.json({ memories: saved, contradictions });
  } catch (err) {
    console.error("POST /api/memories error:", err);
    return NextResponse.json({ error: "Failed to save memories" }, { status: 500 });
  }
}
