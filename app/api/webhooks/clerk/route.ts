import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { ddb } from "@/lib/dynamodb";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || "imprint-users";

// ── Save / update user profile in DynamoDB ────────────────
async function upsertUser(clerkUser: any) {
  const userId = clerkUser.id;
  const email = clerkUser.email_addresses?.[0]?.email_address || "";
  const firstName = clerkUser.first_name || "";
  const lastName = clerkUser.last_name || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const imageUrl = clerkUser.image_url || clerkUser.profile_image_url || "";
  const provider = clerkUser.external_accounts?.[0]?.provider || "email";

  const now = new Date().toISOString();

  try {
    await ddb.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        PK: `USER#${userId}`,
        SK: "PROFILE",
        userId,
        email,
        fullName,
        firstName,
        lastName,
        imageUrl,
        provider,
        tier: "free",
        messageCount: 0,
        resetDate: now,
        createdAt: now,
        updatedAt: now,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    }));
  } catch {
    // User already exists — update profile fields only
    await ddb.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { PK: `USER#${userId}`, SK: "PROFILE" },
      UpdateExpression: "SET email = :email, fullName = :name, imageUrl = :img, updatedAt = :now",
      ExpressionAttributeValues: {
        ":email": email,
        ":name": fullName,
        ":img": imageUrl,
        ":now": now,
      },
    }));
  }

  return { userId, email, fullName, imageUrl, provider };
}

// ── Webhook handler ───────────────────────────────────────
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  // If no secret set, still process but skip verification (dev mode)
  const body = await req.text();

  if (webhookSecret) {
    const svix_id = req.headers.get("svix-id");
    const svix_timestamp = req.headers.get("svix-timestamp");
    const svix_signature = req.headers.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
    }

    try {
      const wh = new Webhook(webhookSecret);
      wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const event = JSON.parse(body);
  const eventType = event.type;

  try {
    if (eventType === "user.created" || eventType === "user.updated") {
      const user = await upsertUser(event.data);
      console.log(`[Imprint webhook] ${eventType}:`, user.email);
    }

    if (eventType === "user.deleted") {
      // Optionally mark user as deleted (don't purge memories immediately)
      console.log(`[Imprint webhook] user.deleted:`, event.data.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Imprint webhook] Error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
