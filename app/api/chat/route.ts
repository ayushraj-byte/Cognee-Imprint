import { NextRequest, NextResponse } from "next/server";
import { getMemories, incrementMessageCount } from "@/lib/dynamodb";
import { chatWithMemory } from "@/lib/bedrock";

export const runtime = "nodejs";

// POST /api/chat — streaming Claude response with memory injection
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, messages } = body;

  if (!userId || !messages?.length) {
    return NextResponse.json(
      { error: "userId and messages are required" },
      { status: 400 }
    );
  }

  try {
    // 1. Enforce free-tier limit
    const allowed = await incrementMessageCount(userId);
    if (!allowed) {
      return NextResponse.json(
        { error: "Daily message limit reached. Connect your Claude API key to continue." },
        { status: 429 }
      );
    }

    // 2. Fetch the top 20 most recent memories for this user
    const memories = await getMemories(userId, undefined, 20);

    // 3. Stream the response back chunk by chunk
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of chatWithMemory(messages, memories)) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (err) {
          console.error("chatWithMemory stream error:", err);
          // Send a graceful error message as the last chunk
          controller.enqueue(
            encoder.encode("\n\n[Imprint: Could not reach Claude — check AWS credentials]")
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("POST /api/chat error:", err);
    return NextResponse.json(
      { error: "Chat request failed" },
      { status: 500 }
    );
  }
}
