import { NextRequest, NextResponse } from "next/server";
import { cogneeHealthCheck } from "@/lib/cognee";

// GET /api/health/cognee — liveness of the configured Cognee tenant host.
//   ?search=1  also runs a tiny probe search (costs credits; off by default).
// Returns 200 when reachable, 503 when the memory engine is down/misconfigured.
export async function GET(req: NextRequest) {
  const probeSearch = req.nextUrl.searchParams.get("search") === "1";

  try {
    const result = await cogneeHealthCheck({ probeSearch });
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (err) {
    // cogneeHealthCheck is designed not to throw, but never let the route 500.
    console.error("GET /api/health/cognee error:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message || "health check failed" },
      { status: 503 }
    );
  }
}
