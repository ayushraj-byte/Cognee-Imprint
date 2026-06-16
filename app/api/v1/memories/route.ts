import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromApiKey } from "@/app/api/keys/route";
import { ddb } from "@/lib/dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.DYNAMODB_TABLE || "imprint-memories";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const key = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!key) {
    return NextResponse.json(
      { error: "Missing Authorization header. Use: Authorization: Bearer imp_live_..." },
      { status: 401 }
    );
  }

  const userId = await getUserIdFromApiKey(key);
  if (!userId) {
    return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 403 });
  }

  const topic = req.nextUrl.searchParams.get("topic") ?? undefined;
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "50"), 200);

  const res = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "userId = :u",
    ExpressionAttributeValues: { ":u": userId },
    Limit: limit,
    ScanIndexForward: false,
  }));

  let items = res.Items ?? [];
  if (topic) items = items.filter(m => m.topic === topic);

  return NextResponse.json({
    userId,
    count: items.length,
    memories: items.map(m => ({
      id: m.memoryId,
      content: m.content,
      topic: m.topic,
      source: m.source,
      pinned: m.pinned ?? false,
      createdAt: m.createdAt,
    })),
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

// POST /api/v1/memories — create a memory via API key
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const key = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!key) return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });

  const userId = await getUserIdFromApiKey(key);
  if (!userId) return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 403 });

  const body = await req.json();
  const { content, topic = "general" } = body;
  if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });

  // Proxy to internal memories endpoint
  const internal = await fetch(`${req.nextUrl.origin}/api/memories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, content, topic, source: "api" }),
  });
  const data = await internal.json();
  return NextResponse.json(data, { status: internal.status });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}
