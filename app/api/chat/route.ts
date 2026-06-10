import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser, getMemories } from "@/lib/dynamodb";
import crypto from "crypto";

const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || "5fe23b3f49a558bdb887a3ee4845b0d0";

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

    if (!user?.encryptedApiKey) {
      return NextResponse.json(
        { error: "No API key found. Go to Settings and add your Anthropic API key to use chat." },
        { status: 403 }
      );
    }

    const apiKey = decryptApiKey(user.encryptedApiKey);
    const memories = await getMemories(userId, undefined, 40);
    const systemPrompt = buildSystemPrompt(memories);

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
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
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
