import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser, updateUserApiKey } from "@/lib/dynamodb";
import { encryptApiKey } from "@/lib/crypto";

// GET /api/user?userId=
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    const user = await getOrCreateUser(userId);
    // Never return the encrypted key
    return NextResponse.json({
      userId: user.userId,
      tier: user.tier,
      messageCount: user.messageCount,
      resetDate: user.resetDate,
      hasApiKey: !!user.encryptedApiKey,
    });
  } catch (err) {
    console.error("GET /api/user error:", err);
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
}

// POST /api/user — save BYOK API key
export async function POST(req: NextRequest) {
  const { userId, apiKey } = await req.json();

  if (!userId || !apiKey) {
    return NextResponse.json(
      { error: "userId and apiKey required" },
      { status: 400 }
    );
  }

  if (!apiKey.startsWith("sk-ant-")) {
    return NextResponse.json(
      { error: "Invalid Claude API key format" },
      { status: 400 }
    );
  }

  try {
    const encrypted = encryptApiKey(apiKey);
    await updateUserApiKey(userId, encrypted);
    return NextResponse.json({ success: true, tier: "byok" });
  } catch (err) {
    console.error("POST /api/user error:", err);
    return NextResponse.json({ error: "Failed to save API key" }, { status: 500 });
  }
}
