import { NextRequest, NextResponse } from "next/server";
import {
  getMemories,
  saveMemory,
  searchMemories,
  Topic,
} from "@/lib/dynamodb";
import { extractMemories, detectContradictions } from "@/lib/bedrock";

// GET /api/memories?userId=&topic=&search=
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const topic = req.nextUrl.searchParams.get("topic") as Topic | null;
  const search = req.nextUrl.searchParams.get("search");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

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

// POST /api/memories — extract + save memories from a conversation turn
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, messages, source } = body;

  if (!userId || !messages) {
    return NextResponse.json({ error: "userId and messages required" }, { status: 400 });
  }

  try {
    // 1. Extract memories from the conversation
    const extracted = await extractMemories(messages);
    if (!extracted.length) {
      return NextResponse.json({ memories: [], contradictions: [] });
    }

    // 2. Fetch existing memories to check contradictions
    const existing = await getMemories(userId, undefined, 100);

    // 3. Detect contradictions before saving
    const contradictionResult = await detectContradictions(extracted, existing);

    // 4. Save new memories
    const saved = await Promise.all(
      extracted.map((m) =>
        saveMemory({
          userId,
          content: m.content,
          topic: m.topic,
          keywords: m.keywords,
          pinned: false,
          contradicts: [],
          confidence: m.confidence,
          source: source || "claude.ai",
        })
      )
    );

    return NextResponse.json({
      memories: saved,
      contradictions: contradictionResult.contradictions,
    });
  } catch (err) {
    console.error("POST /api/memories error:", err);
    return NextResponse.json({ error: "Failed to save memories" }, { status: 500 });
  }
}
