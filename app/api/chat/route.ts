import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser, getMemories, incrementMessageCount } from "@/lib/dynamodb";
import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from "@aws-sdk/client-bedrock-runtime";
import crypto from "crypto";

const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || "5fe23b3f49a558bdb887a3ee4845b0d0";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

function decryptApiKey(encrypted: string): string {
  const [ivHex, encHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const key = Buffer.from(ENCRYPTION_SECRET.slice(0, 32), "utf8");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return decipher.update(encHex, "hex", "utf8") + decipher.final("utf8");
}

function buildSystemPrompt(memories: { topic: string; content: string; pinned: boolean }[]): string {
  if (!memories.length) {
    return "You are a helpful AI assistant. Be concise and clear.";
  }

  const pinned = memories.filter(m => m.pinned);
  const rest = memories.filter(m => !m.pinned);

  let ctx = "You are a helpful AI assistant with persistent memory about this user.\n\n";
  ctx += "=== What you know about this user (from past conversations) ===\n";

  if (pinned.length) {
    ctx += "\n[ALWAYS REMEMBER]\n";
    ctx += pinned.map(m => `• ${m.content}`).join("\n");
  }

  const byTopic = rest.reduce((acc: Record<string, string[]>, m) => {
    (acc[m.topic] = acc[m.topic] || []).push(m.content);
    return acc;
  }, {});

  for (const [topic, items] of Object.entries(byTopic)) {
    ctx += `\n[${topic.toUpperCase()}]\n`;
    ctx += items.map(i => `• ${i}`).join("\n");
  }

  ctx += "\n\nUse this knowledge naturally — don't explicitly say 'I remember that you...', just know it.";
  return ctx;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const user = await getOrCreateUser(userId);
    const memories = await getMemories(userId, undefined, 40);
    const systemPrompt = buildSystemPrompt(memories);

    // Check message limit and increment counter
    const allowed = await incrementMessageCount(userId);
    if (!allowed) {
      return NextResponse.json(
        { error: "Daily limit reached (20 messages). Add your Anthropic API key in Settings for unlimited access." },
        { status: 429 }
      );
    }

    // BYOK: use user's own Anthropic API key
    if (user.tier === "byok" && user.encryptedApiKey) {
      const apiKey = decryptApiKey(user.encryptedApiKey);

      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: systemPrompt,
          messages,
          stream: true,
        }),
      });

      if (!anthropicRes.ok) {
        const err = await anthropicRes.json();
        return NextResponse.json({ error: err?.error?.message || "Anthropic API error" }, { status: anthropicRes.status });
      }

      return new NextResponse(anthropicRes.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Free tier: use AWS Bedrock with Claude Haiku 3.5
    const bedrockMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: [{ type: "text", text: m.content }],
    }));

    const bedrockRes = await bedrock.send(
      new InvokeModelWithResponseStreamCommand({
        modelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 1024,
          system: systemPrompt,
          messages: bedrockMessages,
        }),
      })
    );

    // Convert Bedrock stream to SSE format
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of bedrockRes.body!) {
            if (event.chunk?.bytes) {
              const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
              if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
                const sseData = JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: chunk.delta.text } });
                controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
              } else if (chunk.type === "message_stop") {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "message_stop" })}\n\n`));
              }
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
