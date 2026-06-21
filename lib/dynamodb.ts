import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
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
const ORGS_TABLE = process.env.DYNAMODB_ORGS_TABLE || "imprint-orgs";

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
  accessCount?: number;
  embedding?: number[];
  source?: string;
  tags?: string[];
}

export interface User {
  userId: string;
  tier: "free" | "byok" | "enterprise";
  encryptedApiKey?: string;
  messageCount: number;
  resetDate: string;
  orgId?: string;       // set when user belongs to an org
  orgRole?: "admin" | "member";
}

// Memory Rules — user controls what gets auto-saved
export interface MemoryRule {
  ruleId: string;
  label: string;           // human-readable name e.g. "Deadlines"
  topic: Topic;
  enabled: boolean;
  keywords?: string[];     // trigger if any keyword found in message
  pattern?: string;        // custom regex pattern (optional)
  createdAt: string;
}

export interface MemoryPreferences {
  userId: string;
  rules: MemoryRule[];
  updatedAt: string;
}

export interface Org {
  orgId: string;
  name: string;
  adminUserId: string;
  memberIds: string[];
  sharedMemoryEnabled: boolean;
  createdAt: string;
  encryptedApiKey?: string; // org-level Anthropic key
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
  // Paginate so large stores (and topic-filtered queries) return up to `limit`
  // items — not just the first 1MB page. Without this, a topic filter applied
  // after a 50-row page can return 0 even when matching memories exist deeper.
  const rawItems: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  let pages = 0;
  do {
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
        Limit: Math.min(limit, 100),
        ExclusiveStartKey,
      })
    );
    rawItems.push(...((result.Items as Record<string, unknown>[]) || []));
    ExclusiveStartKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    pages++;
  } while (ExclusiveStartKey && rawItems.length < limit && pages < 15);

  return rawItems.slice(0, limit).map((item: any) => ({
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
    accessCount: item.accessCount ?? 0,
    embedding: item.embedding,
    source: item.source,
    tags: item.tags,
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
  updates: Partial<Pick<Memory, "content" | "pinned" | "topic" | "contradicts" | "tags">>
): Promise<void> {
  const sets: string[] = [];
  const removes: string[] = [];
  const values: Record<string, unknown> = {};
  const names: Record<string, string> = {};

  if (updates.content !== undefined) {
    sets.push("#content = :content");
    values[":content"] = updates.content;
    names["#content"] = "content";
  }
  if (updates.pinned !== undefined) {
    sets.push("pinned = :pinned");
    values[":pinned"] = updates.pinned;
    if (updates.pinned) {
      // Pinned = permanent: drop the TTL attribute so DynamoDB never expires it.
      removes.push("#ttl");
      names["#ttl"] = "ttl";
    } else {
      // Unpinned: restore a fresh TTL.
      sets.push("#ttl = :ttl");
      values[":ttl"] = Math.floor(Date.now() / 1000) + MEMORY_TTL_DAYS * 86400;
      names["#ttl"] = "ttl";
    }
  }
  if (updates.topic !== undefined) {
    sets.push("topic = :topic");
    values[":topic"] = updates.topic;
  }
  if (updates.contradicts !== undefined) {
    sets.push("contradicts = :contradicts");
    values[":contradicts"] = updates.contradicts;
  }
  if (updates.tags !== undefined) {
    sets.push("tags = :tags");
    values[":tags"] = updates.tags;
  }

  sets.push("accessedAt = :accessedAt");
  values[":accessedAt"] = new Date().toISOString();

  // Build a valid expression with both SET and REMOVE clauses (REMOVE must be
  // its own clause — it cannot live inside SET, and dropping it silently means
  // pinned memories keep their TTL and still expire).
  const updateExpression = [
    sets.length ? `SET ${sets.join(", ")}` : "",
    removes.length ? `REMOVE ${removes.join(", ")}` : "",
  ].filter(Boolean).join(" ");

  await ddb.send(
    new UpdateCommand({
      TableName: MEMORIES_TABLE,
      Key: {
        PK: `USER#${userId}`,
        SK: `MEMORY#${createdAt}#${memoryId}`,
      },
      UpdateExpression: updateExpression,
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

export async function incrementAccessCount(
  userId: string,
  memoryId: string,
  createdAt: string
): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: MEMORIES_TABLE,
      Key: {
        PK: `USER#${userId}`,
        SK: `MEMORY#${createdAt}#${memoryId}`,
      },
      UpdateExpression:
        "SET accessCount = if_not_exists(accessCount, :zero) + :inc, accessedAt = :now",
      ExpressionAttributeValues: {
        ":zero": 0,
        ":inc": 1,
        ":now": new Date().toISOString(),
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

// ── Memory Rules ─────────────────────────────────────────

const DEFAULT_RULES: Omit<MemoryRule, "ruleId" | "createdAt">[] = [
  { label: "Projects & side projects", topic: "projects", enabled: true, keywords: ["building", "working on", "project", "app", "startup"] },
  { label: "Hackathons & deadlines",   topic: "projects", enabled: true, keywords: ["hackathon", "deadline", "submission", "contest"] },
  { label: "Tech stack & tools",       topic: "preferences", enabled: true, keywords: ["using", "stack", "framework", "language", "tool"] },
  { label: "Preferences & dislikes",   topic: "preferences", enabled: true, keywords: ["prefer", "love", "hate", "like", "dislike", "always use"] },
  { label: "Work & job",               topic: "work", enabled: true, keywords: ["job", "company", "employer", "role", "position", "working at"] },
  { label: "Personal & location",      topic: "personal", enabled: false, keywords: ["from", "live in", "based in", "my name"] },
  { label: "Health & wellbeing",       topic: "health", enabled: true, keywords: ["health", "sleep", "diet", "workout", "feeling", "diabetes", "condition", "diagnosed", "medication", "allergy"] },
  { label: "Relationships",            topic: "relationships", enabled: false, keywords: ["friend", "partner", "family", "colleague", "team"] },
];

export async function getMemoryRules(userId: string): Promise<MemoryPreferences> {
  const result = await ddb.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { PK: `USER#${userId}`, SK: "MEMORY_RULES" },
  }));

  if (result.Item) return result.Item as MemoryPreferences;

  // Return defaults (not saved yet)
  const now = new Date().toISOString();
  return {
    userId,
    rules: DEFAULT_RULES.map((r, i) => ({
      ...r,
      ruleId: `default-${i}`,
      createdAt: now,
    })),
    updatedAt: now,
  };
}

export async function saveMemoryRules(userId: string, rules: MemoryRule[]): Promise<void> {
  const now = new Date().toISOString();
  await ddb.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: {
      PK: `USER#${userId}`,
      SK: "MEMORY_RULES",
      userId, rules, updatedAt: now,
    },
  }));
}

export async function addMemoryRule(userId: string, rule: Omit<MemoryRule, "ruleId" | "createdAt">): Promise<MemoryRule> {
  const now = new Date().toISOString();
  const newRule: MemoryRule = { ...rule, ruleId: uuidv4(), createdAt: now };
  const prefs = await getMemoryRules(userId);
  prefs.rules.push(newRule);
  await saveMemoryRules(userId, prefs.rules);
  return newRule;
}

export async function updateMemoryRule(userId: string, ruleId: string, updates: Partial<MemoryRule>): Promise<void> {
  const prefs = await getMemoryRules(userId);
  const idx = prefs.rules.findIndex(r => r.ruleId === ruleId);
  if (idx === -1) throw new Error("Rule not found");
  prefs.rules[idx] = { ...prefs.rules[idx], ...updates };
  await saveMemoryRules(userId, prefs.rules);
}

export async function deleteMemoryRule(userId: string, ruleId: string): Promise<void> {
  const prefs = await getMemoryRules(userId);
  prefs.rules = prefs.rules.filter(r => r.ruleId !== ruleId);
  await saveMemoryRules(userId, prefs.rules);
}

// ── Custom Projects ──────────────────────────────────────
// User-defined project groupings, stored per user (one item, like Memory Rules).

export interface CustomProject {
  id: string;
  name: string;
  color: string;
}

export async function getCustomProjects(userId: string): Promise<CustomProject[]> {
  const result = await ddb.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { PK: `USER#${userId}`, SK: "CUSTOM_PROJECTS" },
  }));
  return (result.Item?.projects as CustomProject[]) || [];
}

export async function saveCustomProjects(userId: string, projects: CustomProject[]): Promise<void> {
  await ddb.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: {
      PK: `USER#${userId}`,
      SK: "CUSTOM_PROJECTS",
      userId,
      projects,
      updatedAt: new Date().toISOString(),
    },
  }));
}

// ── Orgs (Enterprise) ────────────────────────────────────

export async function createOrg(
  orgId: string,
  name: string,
  adminUserId: string,
  encryptedApiKey?: string
): Promise<Org> {
  const now = new Date().toISOString();
  const org: Org = {
    orgId, name, adminUserId,
    memberIds: [adminUserId],
    sharedMemoryEnabled: true,
    createdAt: now,
    ...(encryptedApiKey ? { encryptedApiKey } : {}),
  };
  await ddb.send(new PutCommand({
    TableName: ORGS_TABLE,
    Item: { PK: `ORG#${orgId}`, SK: "PROFILE", ...org },
  }));
  // Upgrade admin user to enterprise
  await ddb.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { PK: `USER#${adminUserId}`, SK: "PROFILE" },
    UpdateExpression: "SET #tier = :tier, orgId = :orgId, orgRole = :role",
    ExpressionAttributeValues: { ":tier": "enterprise", ":orgId": orgId, ":role": "admin" },
    ExpressionAttributeNames: { "#tier": "tier" },
  }));
  return org;
}

export async function getOrg(orgId: string): Promise<Org | null> {
  const result = await ddb.send(new GetCommand({
    TableName: ORGS_TABLE,
    Key: { PK: `ORG#${orgId}`, SK: "PROFILE" },
  }));
  return result.Item ? (result.Item as Org) : null;
}

export async function addOrgMember(orgId: string, userId: string): Promise<void> {
  // Add userId to org's memberIds list
  await ddb.send(new UpdateCommand({
    TableName: ORGS_TABLE,
    Key: { PK: `ORG#${orgId}`, SK: "PROFILE" },
    UpdateExpression: "SET memberIds = list_append(if_not_exists(memberIds, :empty), :uid)",
    ExpressionAttributeValues: { ":uid": [userId], ":empty": [] },
  }));
  // Set orgId + enterprise tier on user
  await ddb.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { PK: `USER#${userId}`, SK: "PROFILE" },
    UpdateExpression: "SET #tier = :tier, orgId = :orgId, orgRole = :role",
    ExpressionAttributeValues: { ":tier": "enterprise", ":orgId": orgId, ":role": "member" },
    ExpressionAttributeNames: { "#tier": "tier" },
  }));
}

// Shared org memory: save under ORG# prefix so all members can read it
export async function saveOrgMemory(
  orgId: string,
  memory: Omit<Memory, "memoryId" | "createdAt" | "accessedAt" | "ttl" | "userId">
): Promise<Memory> {
  return saveMemory({ ...memory, userId: `org_${orgId}` });
}

export async function getOrgMemories(orgId: string, limit = 100): Promise<Memory[]> {
  return getMemories(`org_${orgId}`, undefined, limit);
}

// Returns both personal + org memories merged for a user
export async function getMergedMemories(userId: string, orgId?: string, limit = 100): Promise<Memory[]> {
  const personal = await getMemories(userId, undefined, limit);
  if (!orgId) return personal;
  const org = await getOrgMemories(orgId, limit);
  // Pinned org memories first, then personal, then rest of org
  const pinnedOrg = org.filter(m => m.pinned);
  const unpinnedOrg = org.filter(m => !m.pinned);
  return [...pinnedOrg, ...personal, ...unpinnedOrg].slice(0, limit);
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
