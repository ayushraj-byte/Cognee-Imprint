import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser, updateUserApiKey, updateUserProfile } from "@/lib/dynamodb";
import { encryptApiKey } from "@/lib/crypto";
import { requireOwner } from "@/lib/authz";

// GET /api/user?userId=
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  const denied = await requireOwner(userId);
  if (denied) return denied;

  try {
    const user = await getOrCreateUser(userId);
    // Never return the encrypted key
    return NextResponse.json({
      userId: user.userId,
      tier: user.tier,
      messageCount: user.messageCount,
      resetDate: user.resetDate,
      hasApiKey: !!user.encryptedApiKey,
      name: user.name ?? null,
      image: user.image ?? null,
      age: user.age ?? null,
      role: user.role ?? null,
    });
  } catch (err) {
    console.error("GET /api/user error:", err);
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
}

// PATCH /api/user — update editable profile fields (name / image / age / role)
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { userId, name, image, age, role } = body as {
    userId?: string; name?: string; image?: string; age?: string; role?: string;
  };

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  const denied = await requireOwner(userId);
  if (denied) return denied;

  // Guardrails so a giant image data: URL can't blow past the DynamoDB item limit.
  if (typeof image === "string" && image.length > 350_000) {
    return NextResponse.json(
      { error: "Image too large. Please use a smaller image." },
      { status: 413 }
    );
  }
  if (typeof name === "string" && name.length > 120) {
    return NextResponse.json({ error: "Name too long" }, { status: 400 });
  }
  if (typeof age === "string" && age.length > 10) {
    return NextResponse.json({ error: "Age too long" }, { status: 400 });
  }
  if (typeof role === "string" && role.length > 120) {
    return NextResponse.json({ error: "Role too long" }, { status: 400 });
  }

  try {
    await getOrCreateUser(userId); // ensure the profile item exists first
    await updateUserProfile(userId, {
      ...(name !== undefined ? { name } : {}),
      ...(image !== undefined ? { image } : {}),
      ...(age !== undefined ? { age } : {}),
      ...(role !== undefined ? { role } : {}),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/user error:", err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
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
  const denied = await requireOwner(userId);
  if (denied) return denied;

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
