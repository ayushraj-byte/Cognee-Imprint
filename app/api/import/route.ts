import { NextRequest, NextResponse } from "next/server";
import { saveMemory } from "@/lib/dynamodb";
import { importMemoriesFromText } from "@/lib/bedrock";

// POST /api/import — import memories from raw text or JSON
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, text, memories: rawMemories } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    let toSave: Array<{
      content: string;
      topic: string;
      keywords: string[];
      confidence: number;
    }> = [];

    if (rawMemories && Array.isArray(rawMemories)) {
      // Direct JSON import — array of {content, topic}
      toSave = rawMemories.map((m: { content: string; topic?: string }) => ({
        content: m.content,
        topic: m.topic || "general",
        keywords: m.content.toLowerCase().split(/\s+/).slice(0, 5),
        confidence: 1.0,
      }));
    } else if (text) {
      // Extract from raw text
      toSave = await importMemoriesFromText(text);
    } else {
      return NextResponse.json(
        { error: "Provide text or memories array" },
        { status: 400 }
      );
    }

    const saved = await Promise.all(
      toSave.map((m) =>
        saveMemory({
          userId,
          content: m.content,
          topic: m.topic as "general",
          keywords: m.keywords,
          pinned: false,
          contradicts: [],
          confidence: m.confidence,
          source: "import",
        })
      )
    );

    return NextResponse.json({ imported: saved.length, memories: saved });
  } catch (err) {
    console.error("POST /api/import error:", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
