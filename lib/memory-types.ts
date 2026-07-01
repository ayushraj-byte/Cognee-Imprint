// ─────────────────────────────────────────────────────────────────────────────
// lib/memory-types.ts — shared data types for the memory layer.
//
// Extracted out of lib/dynamodb.ts so both the storage facade (dynamodb.ts) and
// the Cognee-backed store (memory-store.ts) can import them without a circular
// dependency. dynamodb.ts re-exports everything here, so existing imports like
//   import { Memory, Topic } from "@/lib/dynamodb"
// keep working unchanged.
// ─────────────────────────────────────────────────────────────────────────────

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
  // Human-readable "why" for each conflict, keyed by the partner memory's id.
  conflictReasons?: Record<string, string>;
  confidence: number;
  accessCount?: number;
  embedding?: number[];
  source?: string;
  tags?: string[];
  // Cognee Cloud data-item id (returned by /api/v1/add) — lets us delete the
  // ingested document from the knowledge graph when the memory is deleted.
  cogneeDataId?: string;
}

export interface User {
  userId: string;
  tier: "free" | "byok" | "enterprise";
  encryptedApiKey?: string;
  messageCount: number;
  resetDate: string;
  orgId?: string;
  orgRole?: "admin" | "member";
  name?: string;
  image?: string;
  age?: string;
  role?: string;
}

export interface MemoryRule {
  ruleId: string;
  label: string;
  topic: Topic;
  enabled: boolean;
  keywords?: string[];
  pattern?: string;
  createdAt: string;
}

export interface MemoryPreferences {
  userId: string;
  rules: MemoryRule[];
  updatedAt: string;
}

export interface CustomProject {
  id: string;
  name: string;
  color: string;
}

export interface Org {
  orgId: string;
  name: string;
  adminUserId: string;
  memberIds: string[];
  sharedMemoryEnabled: boolean;
  createdAt: string;
  encryptedApiKey?: string;
}
