import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { LOCAL_MODE } from "@/lib/local-store";

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
);

const TABLE = process.env.DYNAMODB_MEMORIES_TABLE || "imprint-memories";

// GET /api/sessions?userId=
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // Local mode: session history is a DynamoDB-only feature; return empty so the
  // isolated build never touches a real table.
  if (LOCAL_MODE) return NextResponse.json({ sessions: [] });

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":prefix": "SESSION#",
        },
        ScanIndexForward: false, // newest first
        Limit: 50,
      })
    );

    const sessions = (result.Items || []).map((item) => ({
      id: item.sessionId,
      title: item.title || "Untitled session",
      date: item.startedAt,
      messageCount: item.messageCount || 0,
      memoriesExtracted: item.memoriesExtracted || 0,
      pinned: !!item.pinned,
    }));

    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("GET /api/sessions error:", err);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

// POST /api/sessions — record a new session (called by the Stop hook)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, title, messageCount = 0, memoriesExtracted = 0 } = body;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const sessionId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  // Local mode: acknowledge without persisting to DynamoDB.
  if (LOCAL_MODE) {
    return NextResponse.json({ session: { id: sessionId, title, date: startedAt, messageCount, memoriesExtracted, pinned: false } });
  }

  try {
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `USER#${userId}`,
          SK: `SESSION#${startedAt}#${sessionId}`,
          sessionId,
          userId,
          title: title || "New session",
          startedAt,
          messageCount,
          memoriesExtracted,
          pinned: false,
        },
      })
    );

    return NextResponse.json({ session: { id: sessionId, title, date: startedAt, messageCount, memoriesExtracted, pinned: false } });
  } catch (err) {
    console.error("POST /api/sessions error:", err);
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
  }
}

// PATCH /api/sessions — update title or pin
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { userId, sessionId, startedAt, pinned, title } = body;
  if (!userId || !sessionId || !startedAt) return NextResponse.json({ error: "userId, sessionId, startedAt required" }, { status: 400 });

  const updateParts: string[] = [];
  const values: Record<string, boolean | string> = {};

  if (typeof pinned === "boolean") { updateParts.push("pinned = :pinned"); values[":pinned"] = pinned; }
  if (title) { updateParts.push("title = :title"); values[":title"] = title; }

  if (!updateParts.length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  // Local mode: no-op (no DynamoDB).
  if (LOCAL_MODE) return NextResponse.json({ ok: true });

  try {
    await client.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `USER#${userId}`, SK: `SESSION#${startedAt}#${sessionId}` },
        UpdateExpression: `SET ${updateParts.join(", ")}`,
        ExpressionAttributeValues: values,
      })
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/sessions error:", err);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}
