import { NextRequest, NextResponse } from "next/server";
import { getMemories, saveMemory } from "@/lib/dynamodb";
import { detectContradictions, extractMemories } from "@/lib/bedrock";

// POST /api/stream-handler
// Called by DynamoDB Streams Lambda when a new memory is written.
// Performs a deep contradiction scan across the full memory set.
export async function POST(req: NextRequest) {
  // Verify request is from our Lambda (shared secret)
  const authHeader = req.headers.get("x-stream-secret");
  if (authHeader !== process.env.STREAM_HANDLER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  // Lambda sends: { userId, newMemory: { content, topic, memoryId, createdAt } }
  const { userId, newMemory } = body;

  if (!userId || !newMemory) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const existing = await getMemories(userId, undefined, 200);
    // Exclude the newly saved memory itself
    const others = existing.filter((m) => m.memoryId !== newMemory.memoryId);

    const result = await detectContradictions(
      [{ content: newMemory.content, topic: newMemory.topic, keywords: [], confidence: 1 }],
      others
    );

    if (result.hasContradiction) {
      // Store contradiction metadata — will be picked up by extension polling
      // In production you'd push via WebSocket or SNS; for hackathon we store in DDB
      console.log("Contradiction detected via stream:", result.contradictions);
      // Could save a "contradiction alert" record here for the extension to poll
    }

    return NextResponse.json({ processed: true, result });
  } catch (err) {
    console.error("stream-handler error:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
