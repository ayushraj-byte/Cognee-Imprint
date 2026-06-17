import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromApiKey } from "@/app/api/keys/route";

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || "https://imprint-ebon.vercel.app";

// POST /api/webhook — save a memory via webhook
// Auth: X-Imprint-Key: imp_live_... OR Authorization: Bearer imp_live_...
// Body: { content, topic?, source?, pinned? }
//
// Example (curl):
//   curl -X POST https://imprint-ebon.vercel.app/api/webhook \
//     -H "X-Imprint-Key: imp_live_..." \
//     -H "Content-Type: application/json" \
//     -d '{"content":"Shipped v2.0 today","topic":"projects"}'
//
// Example (GitHub Actions):
//   - run: |
//       curl -X POST ${{ secrets.IMPRINT_WEBHOOK_URL }} \
//         -H "X-Imprint-Key: ${{ secrets.IMPRINT_KEY }}" \
//         -H "Content-Type: application/json" \
//         -d "{\"content\":\"Deployed to prod: $GITHUB_SHA\",\"topic\":\"projects\",\"source\":\"github-actions\"}"

export async function POST(req: NextRequest) {
  // Resolve API key from header
  const keyHeader =
    req.headers.get("X-Imprint-Key") ??
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim() ??
    "";

  if (!keyHeader) {
    return NextResponse.json(
      {
        error: "Missing API key. Set X-Imprint-Key or Authorization: Bearer <key>.",
        docs: "https://imprint-ebon.vercel.app/dashboard → API Keys",
      },
      { status: 401 }
    );
  }

  const userId = await getUserIdFromApiKey(keyHeader);
  if (!userId) {
    return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { content, topic = "general", source = "webhook", pinned = false } = body as {
    content?: string;
    topic?: string;
    source?: string;
    pinned?: boolean;
  };

  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "content (string) is required" }, { status: 400 });
  }

  // Proxy to the internal memories endpoint (handles extraction, embedding, dedup)
  const res = await fetch(`${API_BASE}/api/memories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      content: content.trim(),
      topic,
      source,
      pinned: Boolean(pinned),
    }),
  });

  const data = await res.json();
  return NextResponse.json(
    { ok: res.ok, memory: data.memory ?? null, error: data.error ?? null },
    {
      status: res.ok ? 200 : res.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "X-Imprint-Key, Authorization, Content-Type",
      },
    }
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "X-Imprint-Key, Authorization, Content-Type",
    },
  });
}
