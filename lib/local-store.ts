// ─────────────────────────────────────────────────────────────────────────────
// lib/local-store.ts — local, file-backed persistence (replaces DynamoDB).
//
// This is the system-of-record for cognee-imprint when running locally. It keeps
// the full memory rows + user/rules/projects/org records the dashboard needs,
// in a single JSON file under .data/ (gitignored). NO AWS, NO cloud, so nothing
// here can read or mutate the original Imprint production data.
//
//   • Memory intelligence (semantic / graph retrieval) lives in Cognee Cloud.
//   • Durable persistence lives here — the role DynamoDB used to play.
//
// LOCAL_MODE is true whenever AWS credentials are absent, which is always the
// case for this isolated build. Code branches on it so the original DynamoDB
// paths are never exercised without explicit AWS configuration.
// ─────────────────────────────────────────────────────────────────────────────

import { promises as fs } from "fs";
import path from "path";

// Isolation is a POSITIVE opt-in: this build uses the local file store UNLESS
// you explicitly set STORAGE_BACKEND=dynamodb. Critically it does NOT key off the
// *absence* of AWS credentials — a machine can export production AWS_* in its
// shell (and this one does), which must never silently route an isolated build at
// production data. Local-by-default means ambient creds are simply irrelevant.
export const LOCAL_MODE = (process.env.STORAGE_BACKEND || "local").toLowerCase() !== "dynamodb";

const SIDECAR_PATH = (() => {
  const p = process.env.MEMORY_SIDECAR_PATH || ".data/sidecar.json";
  return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
})();

interface DB {
  // memories keyed by userId → array of full memory rows
  memories: Record<string, Record<string, unknown>[]>;
  // generic key/value for users, rules, projects, orgs (keyed by composite string)
  kv: Record<string, unknown>;
}

let dbCache: DB | null = null;
let loading: Promise<DB> | null = null;
// Serialize writes so concurrent requests never corrupt the JSON file.
let writeChain: Promise<unknown> = Promise.resolve();

async function load(): Promise<DB> {
  if (dbCache) return dbCache;
  if (loading) return loading;
  loading = (async () => {
    try {
      const raw = await fs.readFile(SIDECAR_PATH, "utf8");
      try {
        const parsed = JSON.parse(raw) as Partial<DB>;
        dbCache = { memories: parsed.memories || {}, kv: parsed.kv || {} };
      } catch {
        // File exists but is corrupt JSON — preserve it before starting fresh so
        // the data is recoverable instead of being silently overwritten by persist().
        await fs.writeFile(`${SIDECAR_PATH}.corrupt`, raw, "utf8").catch(() => {});
        dbCache = { memories: {}, kv: {} };
      }
    } catch {
      // Missing file → start fresh.
      dbCache = { memories: {}, kv: {} };
    }
    return dbCache;
  })();
  return loading;
}

async function persist(): Promise<void> {
  const db = dbCache;
  if (!db) return;
  await fs.mkdir(path.dirname(SIDECAR_PATH), { recursive: true });
  const data = JSON.stringify(db, null, 2);
  const tmp = `${SIDECAR_PATH}.tmp`;
  await fs.writeFile(tmp, data, "utf8");
  try {
    await fs.rename(tmp, SIDECAR_PATH); // atomic replace
  } catch {
    // Windows can throw EPERM/EACCES if the destination is briefly held open by a
    // reader or AV scanner. Fall back to an in-place write so a save is never lost.
    await fs.writeFile(SIDECAR_PATH, data, "utf8");
    await fs.rm(tmp, { force: true }).catch(() => {});
  }
}

function mutate<T>(fn: (db: DB) => T): Promise<T> {
  const run = writeChain.then(async () => {
    const db = await load();
    const result = fn(db);
    await persist();
    return result;
  });
  // Keep the chain alive regardless of individual failures.
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

// ── Memory rows ───────────────────────────────────────────────────────────

export async function lsListMemories(userId: string): Promise<Record<string, unknown>[]> {
  const db = await load();
  return db.memories[userId] || [];
}

export async function lsPutMemory(userId: string, mem: Record<string, unknown>): Promise<void> {
  await mutate((db) => {
    (db.memories[userId] ||= []).push(mem);
  });
}

export async function lsUpdateMemory(
  userId: string,
  memoryId: string,
  patch: Record<string, unknown>
): Promise<void> {
  await mutate((db) => {
    const arr = db.memories[userId] || [];
    const m = arr.find((x) => x.memoryId === memoryId);
    if (m) {
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete m[k];
        else m[k] = v;
      }
    }
  });
}

// Atomic read-modify-write on a single memory row — the mutation happens INSIDE
// the write lock so concurrent updates (e.g. access-count bumps) can't lose data.
export async function lsMutateMemory(
  userId: string,
  memoryId: string,
  fn: (row: Record<string, unknown>) => void
): Promise<void> {
  await mutate((db) => {
    const arr = db.memories[userId] || [];
    const m = arr.find((x) => x.memoryId === memoryId);
    if (m) fn(m);
  });
}

export async function lsDeleteMemory(userId: string, memoryId: string): Promise<void> {
  await mutate((db) => {
    const arr = db.memories[userId];
    if (arr) db.memories[userId] = arr.filter((x) => x.memoryId !== memoryId);
  });
}

// ── Generic key/value (users, rules, projects, orgs) ──────────────────────

export async function lsKvGet<T>(key: string): Promise<T | undefined> {
  const db = await load();
  return db.kv[key] as T | undefined;
}

export async function lsKvSet(key: string, value: unknown): Promise<void> {
  await mutate((db) => {
    db.kv[key] = value;
  });
}

export async function lsKvDelete(key: string): Promise<void> {
  await mutate((db) => {
    delete db.kv[key];
  });
}
