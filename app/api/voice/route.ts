import { NextRequest, NextResponse } from "next/server";
import { saveMemory } from "@/lib/dynamodb";
import { extractMemories } from "@/lib/extract";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio    = formData.get("audio") as File | null;
    const userId   = formData.get("userId") as string;

    if (!audio || !userId) {
      return NextResponse.json({ error: "audio and userId required" }, { status: 400 });
    }

    if (!GROQ_API_KEY) {
      return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });
    }

    // 1. Transcribe with Groq Whisper
    const whisperForm = new FormData();
    whisperForm.append("file", audio, "recording.webm");
    whisperForm.append("model", "whisper-large-v3");
    whisperForm.append("response_format", "json");

    const whisperRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.text();
      return NextResponse.json({ error: `Whisper error: ${err}` }, { status: 500 });
    }

    const { text: transcript } = await whisperRes.json();

    if (!transcript?.trim()) {
      return NextResponse.json({ transcript: "", memories: [] });
    }

    // 2. Extract memories from transcript
    const extracted = await extractMemories(
      [{ role: "user", content: transcript }],
      GROQ_API_KEY
    );

    // 3. Save extracted memories
    const saved = await Promise.all(
      extracted.map(m =>
        saveMemory({ userId, content: m.content, topic: m.topic, keywords: m.keywords, confidence: m.confidence, pinned: false, source: "voice", contradicts: [] })
      )
    );

    return NextResponse.json({ transcript, memories: saved, count: saved.length });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
