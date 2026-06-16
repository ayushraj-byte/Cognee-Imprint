import { NextRequest, NextResponse } from "next/server";
import { getMemories, getOrCreateUser } from "@/lib/dynamodb";
import crypto from "crypto";

const SHARE_SECRET = process.env.SHARE_SECRET || process.env.ENCRYPTION_SECRET || "imprint-share-secret-2026";

function makeToken(userId: string): string {
  return crypto.createHmac("sha256", SHARE_SECRET).update(userId).digest("hex").slice(0, 24);
}

function verifyToken(token: string, userId: string): boolean {
  return makeToken(userId) === token;
}

// GET /api/share?token=xxx  →  resolve token → return pinned memories
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const userId = req.nextUrl.searchParams.get("userId");

  // If userId provided directly (for generating the token)
  if (userId && !token) {
    const t = makeToken(userId);
    return NextResponse.json({ token: t, shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://imprint-ebon.vercel.app"}/share/${t}?uid=${encodeURIComponent(userId)}` });
  }

  // If resolving a shared link
  if (token && userId) {
    if (!verifyToken(token, userId)) {
      return NextResponse.json({ error: "Invalid share link" }, { status: 403 });
    }
    const memories = await getMemories(userId, undefined, 100);
    const pinned   = memories.filter(m => m.pinned);
    const user     = await getOrCreateUser(userId);
    return NextResponse.json({ memories: pinned, total: memories.length, tier: user?.tier || "free" });
  }

  return NextResponse.json({ error: "token and userId required" }, { status: 400 });
}
