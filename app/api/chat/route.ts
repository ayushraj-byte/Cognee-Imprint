import { NextRequest, NextResponse } from "next/server";
import { getMemories, incrementMessageCount } from "@/lib/dynamodb";
import { chatWithMemory } from "@/lib/bedrock";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

// POST /api/chat — streaming Claude response with memory injection
// Accepts optional `claudeKey` — if provided, uses Anthropic SDK directly (unlimited)
// Falls back to Bedrock when no key supplied
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, messages, claudeKey } = body;

  if (!userId || !messages?.length) {
    return NextResponse.json(
      { error: "userId and messages are required" },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  try {
    // Fetch memories for context injection
    const memories = await getMemories(userId, undefined, 20);

    // ── PATH A: User's own Anthropic API key ──────────────────────────────
    if (claudeKey && claudeKey.startsWith("sk-ant-")) {
      const anthropic = new Anthropic({ apiKey: claudeKey });

      const memoryContext = memories.length > 0
        ? `You remember these facts about the user from past conversations:\n${memories.map(m => `- [${m.topic}] ${m.content}`).join("\n")}\n\nUse these memories naturally.`
        : "";

      const systemPrompt = `You are Claude, a helpful AI assistant with persistent memory powered by Imprint.${memoryContext ? "\n\n" + memoryContext : ""}`;

      const stream = new ReadableStream({
        async start(controller) {
          try {
            const stream = await anthropic.messages.stream({
              model: "claude-3-5-haiku-20241022",
              max_tokens: 2048,
              system: systemPrompt,
              messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
            });

            for await (const chunk of stream) {
              if (
                chunk.type === "content_block_delta" &&
                chunk.delta.type === "text_delta"
              ) {
                controller.enqueue(encoder.encode(chunk.delta.text));
              }
            }
          } catch (err: any) {
            controller.enqueue(encoder.encode(`\n\n[Error: ${err.message}]`));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          "Transfer-Encoding": "chunked",
        },
      });
    }

    // ── PATH B: Bedrock fallback (AWS credits / free tier) ────────────────
    // Enforce free-tier limit only when no API key provided
    const allowed = await incrementMessageCount(userId);
    if (!allowed) {
      return NextResponse.json(
        { error: "Daily message limit reached. Connect your Claude API key for unlimited messages." },
        { status: 429 }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of chatWithMemory(messages, memories)) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode("\n\n[Imprint: Could not reach Claude — connect your API key to continue]")
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });

  } catch (err) {
    console.error("POST /api/chat error:", err);
    return NextResponse.json({ error: "Chat request failed" }, { status: 500 });
  }
}
