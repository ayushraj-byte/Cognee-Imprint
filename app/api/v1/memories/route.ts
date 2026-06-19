import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromApiKey } from "@/app/api/keys/route";
import { ddb } from "@/lib/dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.DYNAMODB_MEMORIES_TABLE || "imprint-memories";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function extractKey(req: NextRequest): string {
  return (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// GET /api/v1/memories — list memories for the authenticated user
export async function GET(req: NextRequest) {
  const key = extractKey(req);
  if (!key) return NextResponse.json({ error: "Missing Authorization header. Use: Authorization: Bearer imp_live_..." }, { status: 401, headers: CORS });

  const userId = await getUserIdFromApiKey(key);
  if (!userId) return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 403, headers: CORS });

  const topic  = req.nextUrl.searchParams.get("topic") ?? undefined;
  const limit  = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "60"), 200);

  const res = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": `USER#${userId}` },
    Limit: limit,
    ScanIndexForward: false,
  }));

  let items = res.Items ?? [];
  if (topic) items = items.filter(m => m.topic === topic);

  return NextResponse.json({
    userId,
    count: items.length,
    memories: items.map(m => ({
      id:        m.memoryId,
      content:   m.content,
      topic:     m.topic,
      source:    m.source,
      pinned:    m.pinned ?? false,
      createdAt: m.createdAt,
    })),
  }, { headers: CORS });
}

// POST /api/v1/memories — create a memory
export async function POST(req: NextRequest) {
  const key = extractKey(req);
  if (!key) return NextResponse.json({ error: "Missing Authorization header" }, { status: 401, headers: CORS });

  const userId = await getUserIdFromApiKey(key);
  if (!userId) return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 403, headers: CORS });

  const { content, topic = "general", pinned = false } = await req.json();
  if (!content) return NextResponse.json({ error: "content is required" }, { status: 400, headers: CORS });

  const internal = await fetch(`${req.nextUrl.origin}/api/memories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, content, topic, pinned, source: "mcp" }),
  });
  const data = await internal.json();
  return NextResponse.json(data, { status: internal.status, headers: CORS });
}
