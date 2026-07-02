// ─────────────────────────────────────────────────────────────────────────────
// lib/memory-persistence.ts — where the durable memory ROWS live.
//
// Dispatches persistence between two backends, chosen by STORAGE_BACKEND:
//   • local  (default)      → lib/local-store.ts   (.data/sidecar.json, dev)
//   • dynamodb              → AWS DynamoDB          (production, survives serverless)
//
// Cognee Cloud remains the retrieval brain in BOTH modes (see lib/memory-store.ts).
// This module only owns the row storage that the dashboard lists/edits/pins — the
// role DynamoDB played originally. Same 5-function surface as local-store so
// memory-store.ts is agnostic to the backend.
//
// DynamoDB layout (matches scripts/setup-dynamo.mjs `claude-memories` schema):
//   PK: USER#<userId>   SK: MEMORY#<createdAt>#<memoryId>
//   attrs: topic (GSI hash), createdAt (GSI range), ttl (TTL attribute), + Memory fields
// ─────────────────────────────────────────────────────────────────────────────

import {
  lsListMemories as fileList,
  lsPutMemory as filePut,
  lsUpdateMemory as fileUpdate,
  lsMutateMemory as fileMutate,
  lsDeleteMemory as fileDelete,
} from "./local-store";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

type Row = Record<string, unknown>;

const USE_DYNAMO = (process.env.STORAGE_BACKEND || "local").toLowerCase() === "dynamodb";
const MEMORIES_TABLE = process.env.DYNAMODB_MEMORIES_TABLE || "claude-memories";

// Lazily build the doc client so local mode never needs AWS creds. removeUndefinedValues
// lets us pass Memory objects (with optional/undefined fields) straight through.
let _doc: DynamoDBDocumentClient | null = null;
function doc(): DynamoDBDocumentClient {
  if (_doc) return _doc;
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
  _doc = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
  return _doc;
}

const pk = (userId: string) => `USER#${userId}`;
const skFor = (createdAt: string, memoryId: string) => `MEMORY#${createdAt}#${memoryId}`;

function stripKeys(r: Row): Row {
  const c: Row = { ...r };
  delete c.PK;
  delete c.SK;
  return c;
}

// Query all memory rows for a user (paginated). Returns raw items (incl. PK/SK).
async function queryUser(userId: string): Promise<Row[]> {
  const items: Row[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await doc().send(
      new QueryCommand({
        TableName: MEMORIES_TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": pk(userId), ":sk": "MEMORY#" },
        ExclusiveStartKey,
      })
    );
    for (const it of res.Items || []) items.push(it as Row);
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items;
}

// SK is derived from createdAt+memoryId, which lsUpdate/Mutate/Delete don't receive —
// so find the raw item (with its PK/SK) by memoryId.
async function findRaw(userId: string, memoryId: string): Promise<Row | null> {
  const rows = await queryUser(userId);
  return rows.find((r) => r.memoryId === memoryId) || null;
}

// ── Dispatched surface (identical signatures to local-store) ────────────────

export async function lsListMemories(userId: string): Promise<Row[]> {
  if (!USE_DYNAMO) return fileList(userId);
  const rows = await queryUser(userId);
  return rows.map(stripKeys);
}

export async function lsPutMemory(userId: string, mem: Row): Promise<void> {
  if (!USE_DYNAMO) return filePut(userId, mem);
  const createdAt = String(mem.createdAt);
  const memoryId = String(mem.memoryId);
  await doc().send(
    new PutCommand({
      TableName: MEMORIES_TABLE,
      Item: {
        ...mem,
        PK: pk(userId),
        SK: skFor(createdAt, memoryId),
        topic: (mem.topic as string) || "general",
      },
    })
  );
}

export async function lsUpdateMemory(userId: string, memoryId: string, patch: Row): Promise<void> {
  if (!USE_DYNAMO) return fileUpdate(userId, memoryId, patch);
  const row = await findRaw(userId, memoryId);
  if (!row) return;
  const merged: Row = { ...row };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete merged[k];
    else merged[k] = v;
  }
  await doc().send(new PutCommand({ TableName: MEMORIES_TABLE, Item: merged }));
}

// Read-modify-write (not lock-atomic like the file store). Fine for access-count
// bumps where exact counts under heavy concurrency aren't critical.
export async function lsMutateMemory(
  userId: string,
  memoryId: string,
  fn: (row: Row) => void
): Promise<void> {
  if (!USE_DYNAMO) return fileMutate(userId, memoryId, fn);
  const row = await findRaw(userId, memoryId);
  if (!row) return;
  fn(row);
  await doc().send(new PutCommand({ TableName: MEMORIES_TABLE, Item: row }));
}

export async function lsDeleteMemory(userId: string, memoryId: string): Promise<void> {
  if (!USE_DYNAMO) return fileDelete(userId, memoryId);
  const row = await findRaw(userId, memoryId);
  if (!row) return;
  await doc().send(
    new DeleteCommand({ TableName: MEMORIES_TABLE, Key: { PK: row.PK, SK: row.SK } })
  );
}
