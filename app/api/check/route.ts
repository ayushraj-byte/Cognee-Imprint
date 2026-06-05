import { NextRequest, NextResponse } from "next/server";
import { getMemories } from "@/lib/dynamodb";
import { detectContradictions, extractMemories } from "@/lib/bedrock";

// POST /api/check — real-time contradiction check for extension
// Called after each user message before it's sent to Claude
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, message } = body;

  if (!userId || !message) {
    return NextResponse.json(
      { error: "userId and message required" },
      { status: 400 }
    );
  }

  try {
    // Extract potential facts from the current message
    const extracted = await extractMemories([
      { role: "user", content: message },
    ]);

    if (!extracted.length) {
      return NextResponse.json({ hasContradiction: false, contradictions: [] });
    }

    // Fetch existing memories
    const existing = await getMemories(userId, undefined, 100);
    if (!existing.length) {
      return NextResponse.json({ hasContradiction: false, contradictions: [] });
    }

    // Run contradiction detection
    const result = await detectContradictions(extracted, existing);

    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/check error:", err);
    // Fail silently — don't block the user's message
    return NextResponse.json({ hasContradiction: false, contradictions: [] });
  }
}
