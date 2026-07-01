// ─────────────────────────────────────────────────────────────────────────────
// lib/dynamodb.ts — storage facade.
//
// cognee-imprint replaces the DynamoDB + Jina + Groq memory stack with:
//   • Cognee Cloud  — the memory engine (graph + semantic retrieval)  [memory-store.ts]
//   • a local JSON store — durable persistence the dashboard reads     [local-store.ts]
//
// This file keeps its old name and exports so the ~19 routes that import from
// "@/lib/dynamodb" keep working unchanged. Memory CRUD is re-exported from the
// Cognee-backed store. User / rules / projects / org records use the local store
// when AWS credentials are absent (LOCAL_MODE — always true for this isolated
// build); the original DynamoDB code paths remain for a real AWS deployment.
// ─────────────────────────────────────────────────────────────────────────────

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

import {
  LOCAL_MODE,
  lsKvGet,
  lsKvSet,
} from "./local-store";
import type {
  Topic,
  Memory,
  User,
  MemoryRule,
  MemoryPreferences,
  Org,
  CustomProject,
} from "./memory-types";

// Re-export types so existing `import { Memory, Topic } from "@/lib/dynamodb"` works.
export type { Topic, Memory, User, MemoryRule, MemoryPreferences, Org, CustomProject };

// Re-export the Cognee-backed memory functions (drop-in for the old DynamoDB ones).
import {
  saveMemory,
  getMemories,
} from "./memory-store";
export {
  saveMemory,
  getMemories,
  searchMemories,
  updateMemory,
  deleteMemory,
  incrementAccessCount,
} from "./memory-store";

// DynamoDB client — only ever used by the non-LOCAL (real AWS) code paths and by
// a few non-core routes (keys, webhooks, v1). With no AWS creds it is never sent
// a command, so it cannot reach the original production data.
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const realDdb = DynamoDBDocumentClient.from(client);

// Hard isolation guard: in local mode, ANY DynamoDB send fails loudly. Several
// routes (digest, keys, webhooks/clerk, v1/memories) import this client directly
// and do NOT check LOCAL_MODE — this Proxy guarantees they can never reach a real
// table, regardless of any AWS_* the OS/shell may export.
export const ddb: DynamoDBDocumentClient = LOCAL_MODE
  ? (new Proxy(realDdb, {
      get(target, prop, receiver) {
        if (prop === "send") {
          return async () => {
            throw new Error(
              "DynamoDB is disabled in local mode (set STORAGE_BACKEND=dynamodb to enable). " +
                "This isolated cognee-imprint build never touches production data."
            );
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as DynamoDBDocumentClient)
  : realDdb;

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || "claude-memory-users";
const ORGS_TABLE = process.env.DYNAMODB_ORGS_TABLE || "imprint-orgs";

// Local-store key builders (mirror the DynamoDB PK/SK layout).
const userKey = (userId: string) => `users::USER#${userId}::PROFILE`;
const rulesKey = (userId: string) => `users::USER#${userId}::MEMORY_RULES`;
const projectsKey = (userId: string) => `users::USER#${userId}::CUSTOM_PROJECTS`;
const orgKey = (orgId: string) => `orgs::ORG#${orgId}::PROFILE`;

// ── Users ────────────────────────────────────────────────

export async function getOrCreateUser(userId: string): Promise<User> {
  if (LOCAL_MODE) {
    const existing = await lsKvGet<User>(userKey(userId));
    if (existing) return existing;
    const today = new Date().toISOString().split("T")[0];
    const newUser: User = { userId, tier: "free", messageCount: 0, resetDate: today };
    await lsKvSet(userKey(userId), newUser);
    return newUser;
  }

  const result = await ddb.send(
    new GetCommand({ TableName: USERS_TABLE, Key: { PK: `USER#${userId}`, SK: "PROFILE" } })
  );
  if (result.Item) return result.Item as User;

  const today = new Date().toISOString().split("T")[0];
  const newUser: User = { userId, tier: "free", messageCount: 0, resetDate: today };
  await ddb.send(
    new PutCommand({ TableName: USERS_TABLE, Item: { PK: `USER#${userId}`, SK: "PROFILE", ...newUser } })
  );
  return newUser;
}

export async function updateUserApiKey(userId: string, encryptedKey: string): Promise<void> {
  if (LOCAL_MODE) {
    const u = (await lsKvGet<User>(userKey(userId))) || (await getOrCreateUser(userId));
    await lsKvSet(userKey(userId), { ...u, encryptedApiKey: encryptedKey, tier: "byok" });
    return;
  }
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

export async function updateUserProfile(
  userId: string,
  profile: { name?: string; image?: string; age?: string; role?: string }
): Promise<void> {
  if (LOCAL_MODE) {
    const u = (await lsKvGet<User>(userKey(userId))) || (await getOrCreateUser(userId));
    const next = { ...u };
    for (const key of ["name", "image", "age", "role"] as const) {
      if (profile[key] !== undefined) next[key] = profile[key];
    }
    await lsKvSet(userKey(userId), next);
    return;
  }

  const sets: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  for (const key of ["name", "image", "age", "role"] as const) {
    const v = profile[key];
    if (v === undefined) continue;
    sets.push(`#${key} = :${key}`);
    names[`#${key}`] = key;
    values[`:${key}`] = v;
  }
  if (sets.length === 0) return;
  await ddb.send(
    new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { PK: `USER#${userId}`, SK: "PROFILE" },
      UpdateExpression: "SET " + sets.join(", "),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
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
  { label: "Personal & location",      topic: "personal", enabled: true, keywords: ["from", "live in", "based in", "my name"] },
  { label: "Health & wellbeing",       topic: "health", enabled: true, keywords: ["health", "sleep", "diet", "workout", "feeling", "diabetes", "condition", "diagnosed", "medication", "allergy"] },
  { label: "Relationships",            topic: "relationships", enabled: true, keywords: ["friend", "partner", "family", "colleague", "team"] },
];

export async function getMemoryRules(userId: string): Promise<MemoryPreferences> {
  if (LOCAL_MODE) {
    const stored = await lsKvGet<MemoryPreferences>(rulesKey(userId));
    if (stored) return stored;
  } else {
    const result = await ddb.send(
      new GetCommand({ TableName: USERS_TABLE, Key: { PK: `USER#${userId}`, SK: "MEMORY_RULES" } })
    );
    if (result.Item) return result.Item as MemoryPreferences;
  }

  const now = new Date().toISOString();
  return {
    userId,
    rules: DEFAULT_RULES.map((r, i) => ({ ...r, ruleId: `default-${i}`, createdAt: now })),
    updatedAt: now,
  };
}

export async function saveMemoryRules(userId: string, rules: MemoryRule[]): Promise<void> {
  const now = new Date().toISOString();
  if (LOCAL_MODE) {
    await lsKvSet(rulesKey(userId), { userId, rules, updatedAt: now });
    return;
  }
  await ddb.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: { PK: `USER#${userId}`, SK: "MEMORY_RULES", userId, rules, updatedAt: now },
    })
  );
}

export async function addMemoryRule(
  userId: string,
  rule: Omit<MemoryRule, "ruleId" | "createdAt">
): Promise<MemoryRule> {
  const now = new Date().toISOString();
  const newRule: MemoryRule = { ...rule, ruleId: uuidv4(), createdAt: now };
  const prefs = await getMemoryRules(userId);
  prefs.rules.push(newRule);
  await saveMemoryRules(userId, prefs.rules);
  return newRule;
}

export async function updateMemoryRule(
  userId: string,
  ruleId: string,
  updates: Partial<MemoryRule>
): Promise<void> {
  const prefs = await getMemoryRules(userId);
  const idx = prefs.rules.findIndex((r) => r.ruleId === ruleId);
  if (idx === -1) throw new Error("Rule not found");
  prefs.rules[idx] = { ...prefs.rules[idx], ...updates };
  await saveMemoryRules(userId, prefs.rules);
}

export async function deleteMemoryRule(userId: string, ruleId: string): Promise<void> {
  const prefs = await getMemoryRules(userId);
  prefs.rules = prefs.rules.filter((r) => r.ruleId !== ruleId);
  await saveMemoryRules(userId, prefs.rules);
}

// ── Custom Projects ──────────────────────────────────────

export async function getCustomProjects(userId: string): Promise<CustomProject[]> {
  if (LOCAL_MODE) {
    const stored = await lsKvGet<{ projects: CustomProject[] }>(projectsKey(userId));
    return stored?.projects || [];
  }
  const result = await ddb.send(
    new GetCommand({ TableName: USERS_TABLE, Key: { PK: `USER#${userId}`, SK: "CUSTOM_PROJECTS" } })
  );
  return (result.Item?.projects as CustomProject[]) || [];
}

export async function saveCustomProjects(userId: string, projects: CustomProject[]): Promise<void> {
  const updatedAt = new Date().toISOString();
  if (LOCAL_MODE) {
    await lsKvSet(projectsKey(userId), { userId, projects, updatedAt });
    return;
  }
  await ddb.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: { PK: `USER#${userId}`, SK: "CUSTOM_PROJECTS", userId, projects, updatedAt },
    })
  );
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

  if (LOCAL_MODE) {
    await lsKvSet(orgKey(orgId), org);
    const admin = (await lsKvGet<User>(userKey(adminUserId))) || (await getOrCreateUser(adminUserId));
    await lsKvSet(userKey(adminUserId), { ...admin, tier: "enterprise", orgId, orgRole: "admin" });
    return org;
  }

  await ddb.send(new PutCommand({ TableName: ORGS_TABLE, Item: { PK: `ORG#${orgId}`, SK: "PROFILE", ...org } }));
  await ddb.send(
    new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { PK: `USER#${adminUserId}`, SK: "PROFILE" },
      UpdateExpression: "SET #tier = :tier, orgId = :orgId, orgRole = :role",
      ExpressionAttributeValues: { ":tier": "enterprise", ":orgId": orgId, ":role": "admin" },
      ExpressionAttributeNames: { "#tier": "tier" },
    })
  );
  return org;
}

export async function getOrg(orgId: string): Promise<Org | null> {
  if (LOCAL_MODE) {
    return (await lsKvGet<Org>(orgKey(orgId))) || null;
  }
  const result = await ddb.send(
    new GetCommand({ TableName: ORGS_TABLE, Key: { PK: `ORG#${orgId}`, SK: "PROFILE" } })
  );
  return result.Item ? (result.Item as Org) : null;
}

export async function addOrgMember(orgId: string, userId: string): Promise<void> {
  if (LOCAL_MODE) {
    const org = await lsKvGet<Org>(orgKey(orgId));
    if (org) {
      const memberIds = Array.from(new Set([...(org.memberIds || []), userId]));
      await lsKvSet(orgKey(orgId), { ...org, memberIds });
    }
    const u = (await lsKvGet<User>(userKey(userId))) || (await getOrCreateUser(userId));
    await lsKvSet(userKey(userId), { ...u, tier: "enterprise", orgId, orgRole: "member" });
    return;
  }

  await ddb.send(
    new UpdateCommand({
      TableName: ORGS_TABLE,
      Key: { PK: `ORG#${orgId}`, SK: "PROFILE" },
      UpdateExpression: "SET memberIds = list_append(if_not_exists(memberIds, :empty), :uid)",
      ExpressionAttributeValues: { ":uid": [userId], ":empty": [] },
    })
  );
  await ddb.send(
    new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { PK: `USER#${userId}`, SK: "PROFILE" },
      UpdateExpression: "SET #tier = :tier, orgId = :orgId, orgRole = :role",
      ExpressionAttributeValues: { ":tier": "enterprise", ":orgId": orgId, ":role": "member" },
      ExpressionAttributeNames: { "#tier": "tier" },
    })
  );
}

// Shared org memory: save under an org_ prefixed userId so all members can read it.
export async function saveOrgMemory(
  orgId: string,
  memory: Omit<Memory, "memoryId" | "createdAt" | "accessedAt" | "ttl" | "userId">
): Promise<Memory> {
  return saveMemory({ ...memory, userId: `org_${orgId}` });
}

export async function getOrgMemories(orgId: string, limit = 100): Promise<Memory[]> {
  return getMemories(`org_${orgId}`, undefined, limit);
}

// Returns both personal + org memories merged for a user.
export async function getMergedMemories(userId: string, orgId?: string, limit = 100): Promise<Memory[]> {
  const personal = await getMemories(userId, undefined, limit);
  if (!orgId) return personal;
  const org = await getOrgMemories(orgId, limit);
  const pinnedOrg = org.filter((m) => m.pinned);
  const unpinnedOrg = org.filter((m) => !m.pinned);
  return [...pinnedOrg, ...personal, ...unpinnedOrg].slice(0, limit);
}

export async function incrementMessageCount(userId: string): Promise<boolean> {
  const user = await getOrCreateUser(userId);
  const today = new Date().toISOString().split("T")[0];
  const FREE_LIMIT = 20;

  if (LOCAL_MODE) {
    if (user.resetDate !== today) {
      await lsKvSet(userKey(userId), { ...user, messageCount: 1, resetDate: today });
      return true;
    }
    if (user.tier === "byok") return true;
    if (user.messageCount >= FREE_LIMIT) return false;
    await lsKvSet(userKey(userId), { ...user, messageCount: user.messageCount + 1 });
    return true;
  }

  if (user.resetDate !== today) {
    await ddb.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { PK: `USER#${userId}`, SK: "PROFILE" },
        UpdateExpression: "SET messageCount = :count, resetDate = :date",
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
