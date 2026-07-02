import { NextRequest, NextResponse } from "next/server";
import { getInsights } from "@/lib/memory-store";

// GET /api/insights?userId=  → recurring patterns across a user's memories.
// Prefers Cognee graph INSIGHTS; always returns computed stats as a fallback.
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  try {
    const insights = await getInsights(userId);
    return NextResponse.json(insights);
  } catch (err) {
    console.error("GET /api/insights error:", err);
    return NextResponse.json({ error: "Failed to compute insights" }, { status: 500 });
  }
}
