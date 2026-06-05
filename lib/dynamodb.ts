import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const ddb = DynamoDBDocumentClient.from(client);

const MEMORIES_TABLE = process.env.DYNAMODB_MEMORIES_TABLE || "claude-memories";
const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || "claude-memory-users";

// TTL: 30 days for regular memories, no TTL for pinned
const MEMORY_TTL_DAYS = 30;

export type Topic =
  | "work"
  | "personal"
  | "preferences"
  | "health"
  | "projects"
  | "relationships"
  | "general";

export interface Memory {
  userId: string;
  memoryId: string;
  content: string;
  topic: Topic;
  keywords: string[];
  createdAt: string;
  accessedAt: string;
  ttl?: number;
  pinned: boolean;
  contradicts: string[];
  confidence: number;
  source?: string;
}

export interface User {
  userId: string;
  tier: "free" | "byok";
  encryptedApiKey?: string;
  messageCount: number;
  resetDate: string;
}

// ── Memories ────────────────────────────────────────────

export async function saveMemory(
  memory: Omit<Memory, "memoryId" | "createdAt" | "accessedAt" | "ttl">
): Promise<Memory> {
  const now = new Date().toISOString();
  const memoryId = uuidv4();
  const ttl = memory.pinned
    ? undefined
    : Math.floor(Date.now() / 1000) + MEMORY_TTL_DAYS * 86400;

  const item: Memory = {
    ...memory,
    memoryId,
    createdAt: now,
    accessedAt: now,
    ttl,
  };

  await ddb.send(
    new PutCommand({
      TableName: MEMORIES_TABLE,
      Item: {
        PK: `USER#${memory.userId}`,
        SK: `MEMORY#${now}#${memoryId}`,
        ...item,
      },
    })
  );

  return item;
}

export async function getMemories(
  userId: string,
  topic?: Topic,
  limit = 50
): Promise<Memory[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: MEMORIES_TABLE,
      KeyConditionExpression: "PK = :pk",
      FilterExpression: topic ? "topic = :topic" : undefined,
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ...(topic ? { ":topic": topic } : {}),
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  return (result.Items || []).map((item) => ({
    userId: item.userId,
    memoryId: item.memoryId,
    content: item.content,
    topic: item.topic,
    keywords: item.keywords,
    createdAt: item.createdAt,
    accessedAt: item.accessedAt,
    ttl: item.ttl,
    pinned: item.pinned,
    contradicts: item.contradicts,
    confidence: item.confidence,
    source: item.source,
  }));
}

export async function searchMemories(
  userId: string,
  query: string,
  limit = 10
): Promise<Memory[]> {
  // Keyword-based search — query against keywords array
  const result = await ddb.send(
    new QueryCommand({
      TableName: MEMORIES_TABLE,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": `USER#${userId}` },
      ScanIndexForward: false,
      Limit: 200,
    })
  );

  const words = query.toLowerCase().split(/\s+/);
  const memories = (result.Items || []) as Memory[];

  return memories
    .filter((m) =>
      words.some(
        (w) =>
          m.content.toLowerCase().includes(w) ||
          m.keywords.some((k) => k.toLowerCase().includes(w))
      )
    )
    .slice(0, limit);
}

export async function updateMemory(
  userId: string,
  memoryId: string,
  createdAt: string,
  updates: Partial<Pick<Memory, "content" | "pinned" | "topic" | "contradicts">>
): Promise<void> {
  const expressions: string[] = [];
  const values: Record<string, unknown> = {};
  const names: Record<string, string> = {};

  if (updates.content !== undefined) {
    expressions.push("#content = :content");
    values[":content"] = updates.content;
    names["#content"] = "content";
  }
  if (updates.pinned !== undefined) {
    expressions.push("pinned = :pinned");
    values[":pinned"] = updates.pinned;
    // Reset TTL when pinning/unpinning
    if (updates.pinned) {
      expressions.push("REMOVE #ttl");
      names["#ttl"] = "ttl";
    } else {
      expressions.push("#ttl = :ttl");
      values[":ttl"] = Math.floor(Date.now() / 1000) + MEMORY_TTL_DAYS * 86400;
      names["#ttl"] = "ttl";
    }
  }
  if (updates.topic !== undefined) {
    expressions.push("topic = :topic");
    values[":topic"] = updates.topic;
  }
  if (updates.contradicts !== undefined) {
    expressions.push("contradicts = :contradicts");
    values[":contradicts"] = updates.contradicts;
  }

  expressions.push("accessedAt = :accessedAt");
  values[":accessedAt"] = new Date().toISOString();

  await ddb.send(
    new UpdateCommand({
      TableName: MEMORIES_TABLE,
      Key: {
        PK: `USER#${userId}`,
        SK: `MEMORY#${createdAt}#${memoryId}`,
      },
      UpdateExpression: `SET ${expressions.filter((e) => !e.startsWith("REMOVE")).join(", ")}`,
      ExpressionAttributeValues: values,
      ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
    })
  );
}

export async function deleteMemory(
  userId: string,
  memoryId: string,
  createdAt: string
): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: MEMORIES_TABLE,
      Key: {
        PK: `USER#${userId}`,
        SK: `MEMORY#${createdAt}#${memoryId}`,
      },
    })
  );
}

// ── Users ────────────────────────────────────────────────

export async function getOrCreateUser(userId: string): Promise<User> {
  const result = await ddb.send(
    new GetCommand({
      TableName: USERS_TABLE,
      Key: { PK: `USER#${userId}`, SK: "PROFILE" },
    })
  );

  if (result.Item) {
    return result.Item as User;
  }

  const today = new Date().toISOString().split("T")[0];
  const newUser: User = {
    userId,
    tier: "free",
    messageCount: 0,
    resetDate: today,
  };

  await ddb.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: { PK: `USER#${userId}`, SK: "PROFILE", ...newUser },
    })
  );

  return newUser;
}

export async function updateUserApiKey(
  userId: string,
  encryptedKey: string
): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { PK: `USER#${userId}`, SK: "PROFILE" },
      UpdateExpression: "SET encryptedApiKey = :key, #tier = :tier",
      ExpressionAttributeValues: { ":key": encryptedKey, ":tier": "byok" },
      ExpressionAttributeNames: { "#tier": "tier" },
    })
  );
}

export async function incrementMessageCount(userId: string): Promise<boolean> {
  const user = await getOrCreateUser(userId);
  const today = new Date().toISOString().split("T")[0];
  const FREE_LIMIT = 20;

  // Reset count daily
  if (user.resetDate !== today) {
    await ddb.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { PK: `USER#${userId}`, SK: "PROFILE" },
        UpdateExpression:
          "SET messageCount = :count, resetDate = :date",
        ExpressionAttributeValues: { ":count": 1, ":date": today },
      })
    );
    return true;
  }

  if (user.tier === "byok") return true;
  if (user.messageCount >= FREE_LIMIT) return false;

  await ddb.send(
    new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { PK: `USER#${userId}`, SK: "PROFILE" },
      UpdateExpression: "SET messageCount = messageCount + :inc",
      ExpressionAttributeValues: { ":inc": 1 },
    })
  );

  return true;
}
