import { NextRequest, NextResponse } from "next/server";
import { ddb } from "@/lib/dynamodb";
import { GetCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || "claude-memory-users";

// GET  — fetch current key (masked)
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const res = await ddb.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } }));
  const key: string | undefined = res.Item?.imprintApiKey;
  if (!key) return NextResponse.json({ key: null });
  const masked = key.slice(0, 12) + "•".repeat(20) + key.slice(-6);
  return NextResponse.json({ key: masked, hasKey: true });
}

// POST — generate (or regenerate) API key
export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const raw = crypto.randomBytes(24).toString("hex");
  const key = `imp_live_${raw}`;
  await ddb.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId },
    UpdateExpression: "SET imprintApiKey = :k",
    ExpressionAttributeValues: { ":k": key },
  }));
  return NextResponse.json({ key });  // only time we return full key
}

// DELETE — revoke key
export async function DELETE(req: NextRequest) {
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  await ddb.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId },
    UpdateExpression: "REMOVE imprintApiKey",
  }));
  return NextResponse.json({ success: true });
}

// Exported helper — used by v1 route to authenticate
export async function getUserIdFromApiKey(key: string): Promise<string | null> {
  if (!key.startsWith("imp_live_")) return null;
  const res = await ddb.send(new ScanCommand({
    TableName: USERS_TABLE,
    FilterExpression: "imprintApiKey = :k",
    ExpressionAttributeValues: { ":k": key },
    Limit: 1,
  }));
  return (res.Items?.[0]?.userId as string) ?? null;
}
