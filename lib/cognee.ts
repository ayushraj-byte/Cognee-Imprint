// ─────────────────────────────────────────────────────────────────────────────
// lib/cognee.ts — Cognee Cloud REST client
//
// This is the memory ENGINE for cognee-imprint. Every durable fact is ingested
// into a per-user Cognee dataset (add → cognify), and all retrieval (semantic /
// graph) goes through Cognee search. Cognee replaces the old DynamoDB + Jina +
// Groq retrieval stack.
//
// API contract (https://docs.cognee.ai, base https://api.cognee.ai):
//   Auth   : header  X-Api-Key: <COGNEE_API_KEY>
//   Add    : POST   /api/v1/add            (multipart/form-data: data, datasetName, node_set?)
//   Cognify: POST   /api/v1/cognify        (json: { datasets:[name], runInBackground? })
//   Search : POST   /api/v1/search         (json: { searchType, query, datasets, topK })
//   List   : GET    /api/v1/datasets
//   Items  : GET    /api/v1/datasets/{datasetId}/data
//   Delete : DELETE /api/v1/datasets/{datasetId}/data/{dataId}
//
// Nothing here touches AWS or the original Imprint production data.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = (process.env.COGNEE_API_BASE || "https://api.cognee.ai").replace(/\/+$/, "");
const API_KEY = process.env.COGNEE_API_KEY || "";

const REQUEST_TIMEOUT_MS = 30_000; // cognify can be slow; give it room
const MAX_ATTEMPTS = 3;

// SearchType values supported by Cognee Cloud (see /api-reference/search).
export type CogneeSearchType =
  | "GRAPH_COMPLETION"
  | "RAG_COMPLETION"
  | "GRAPH_SUMMARY_COMPLETION"
  | "CHUNKS"
  | "SUMMARIES"
  | "INSIGHTS"
  | "NATURAL_LANGUAGE"
  | "TEMPORAL";

export const DEFAULT_SEARCH_TYPE: CogneeSearchType =
  (process.env.COGNEE_SEARCH_TYPE as CogneeSearchType) || "GRAPH_COMPLETION";

// Cognee's API reference lists camelCase request fields (searchType, topK,
// runInBackground) while some doc examples show snake_case. Default to camelCase
// (the documented schema); set COGNEE_FIELD_CASE=snake if your tenant rejects it.
const SNAKE_CASE = (process.env.COGNEE_FIELD_CASE || "camel").toLowerCase() === "snake";

export interface CogneeDataset {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string | null;
  ownerId?: string;
}

export interface CogneeDataItem {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string | null;
  extension?: string;
  mimeType?: string;
  rawDataLocation?: string;
  datasetId?: string;
}

export class CogneeError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "CogneeError";
    this.status = status;
  }
}

/** True when a Cognee API key is configured. Callers can branch on this. */
export function cogneeEnabled(): boolean {
  return Boolean(API_KEY);
}

function requireKey() {
  if (!API_KEY) {
    throw new CogneeError(
      "COGNEE_API_KEY is not set. Add it to .env.local (get one at https://platform.cognee.ai)."
    );
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Cognee dataset names must be stable + safe. Map a userId → a deterministic name.
export function datasetForUser(userId: string): string {
  const safe = String(userId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "anon";
  return `imprint_${safe}`;
}

// Core fetch with timeout + bounded retry on network / 5xx. `multipart` lets the
// browser/runtime set the FormData boundary (we must NOT set Content-Type then).
async function cogneeFetch<T>(
  path: string,
  options: { method?: string; json?: unknown; form?: FormData; accept404AsNull?: boolean } = {}
): Promise<T> {
  requireKey();
  const headers: Record<string, string> = { "X-Api-Key": API_KEY };
  let body: BodyInit | undefined;
  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.json);
  } else if (options.form) {
    body = options.form; // Content-Type set automatically with boundary
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: options.method || "GET",
        headers,
        body,
        signal: controller.signal,
      });
      if (res.ok) {
        // Some endpoints (DELETE) return an empty body; a few may return plain
        // text. Parse JSON when possible, otherwise hand back the raw text so a
        // non-JSON 2xx never throws an opaque SyntaxError at the call site.
        const text = await res.text();
        if (!text) return null as T;
        try {
          return JSON.parse(text) as T;
        } catch {
          return text as unknown as T;
        }
      }
      if (res.status === 404 && options.accept404AsNull) return null as T;
      const errText = await res.text().catch(() => "");
      if (res.status >= 500 && attempt < MAX_ATTEMPTS) {
        lastErr = new CogneeError(`Cognee ${res.status}: ${errText}`, res.status);
        await sleep(400 * attempt);
        continue;
      }
      throw new CogneeError(`Cognee ${res.status}: ${errText}`, res.status);
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string; code?: string };
      const timedOut = err.name === "AbortError";
      const network =
        timedOut ||
        /fetch failed|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(
          `${err.message} ${err.code || ""}`
        );
      if (network && attempt < MAX_ATTEMPTS) {
        lastErr = timedOut ? new CogneeError(`Cognee request timed out`) : e;
        await sleep(400 * attempt);
        continue;
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new CogneeError("Cognee request failed after retries");
}

// ── Ingest ────────────────────────────────────────────────────────────────

/**
 * Add raw text to a dataset. Cognee auto-creates the dataset by name.
 * `nodeSet` tags the resulting graph nodes (we use it to carry topic/pinned),
 * which lets search scope by tag later.
 */
export async function cogneeAddText(
  datasetName: string,
  text: string,
  nodeSet?: string[]
): Promise<unknown> {
  const form = new FormData();
  // Send the text as a small .txt file part under the `data` field.
  const blob = new Blob([text], { type: "text/plain" });
  form.append("data", blob, `memory-${Date.now()}.txt`);
  form.append("datasetName", datasetName);
  if (nodeSet && nodeSet.length) {
    for (const n of nodeSet) form.append("node_set", n);
  }
  return cogneeFetch("/api/v1/add", { method: "POST", form });
}

/** Build/refresh the knowledge graph for one or more datasets. */
export async function cogneeCognify(
  datasets: string[],
  opts: { runInBackground?: boolean } = {}
): Promise<unknown> {
  const bg = opts.runInBackground ?? false;
  const json = SNAKE_CASE
    ? { datasets, run_in_background: bg }
    : { datasets, runInBackground: bg };
  return cogneeFetch("/api/v1/cognify", { method: "POST", json });
}

// ── Retrieval ─────────────────────────────────────────────────────────────

export interface CogneeSearchResult {
  search_result?: unknown;
  dataset_id?: string;
  dataset_name?: string;
  [k: string]: unknown;
}

/**
 * Search the knowledge graph. Returns the raw Cognee result array. The shape
 * varies by searchType: GRAPH_COMPLETION/RAG_COMPLETION return synthesized text,
 * CHUNKS returns matched source chunks.
 */
export async function cogneeSearch(
  query: string,
  opts: {
    searchType?: CogneeSearchType;
    datasets?: string[];
    topK?: number;
    onlyContext?: boolean;
  } = {}
): Promise<CogneeSearchResult[]> {
  const st = opts.searchType || DEFAULT_SEARCH_TYPE;
  const tk = opts.topK ?? 10;
  const oc = opts.onlyContext ?? false;
  const ds = opts.datasets ? { datasets: opts.datasets } : {};
  const json = SNAKE_CASE
    ? { search_type: st, query, ...ds, top_k: tk, only_context: oc }
    : { searchType: st, query, ...ds, topK: tk, onlyContext: oc };
  const result = await cogneeFetch<CogneeSearchResult[] | CogneeSearchResult>("/api/v1/search", {
    method: "POST",
    json,
  });
  if (Array.isArray(result)) return result;
  return result ? [result] : [];
}

// ── Dataset / data-item management ──────────────────────────────────────────

export async function cogneeListDatasets(): Promise<CogneeDataset[]> {
  const res = await cogneeFetch<CogneeDataset[]>("/api/v1/datasets");
  return Array.isArray(res) ? res : [];
}

export async function cogneeGetDatasetByName(name: string): Promise<CogneeDataset | null> {
  const datasets = await cogneeListDatasets();
  return datasets.find((d) => d.name === name) || null;
}

export async function cogneeListData(datasetId: string): Promise<CogneeDataItem[]> {
  const res = await cogneeFetch<CogneeDataItem[]>(
    `/api/v1/datasets/${encodeURIComponent(datasetId)}/data`,
    { accept404AsNull: true }
  );
  return Array.isArray(res) ? res : [];
}

export async function cogneeDeleteData(datasetId: string, dataId: string): Promise<void> {
  await cogneeFetch(`/api/v1/datasets/${encodeURIComponent(datasetId)}/data/${encodeURIComponent(dataId)}`, {
    method: "DELETE",
    accept404AsNull: true,
  });
}

// ── v1.0 Memory lifecycle: remember · recall · improve · forget ──────────────
// These are Cognee's primary, product-level verbs (docs.cognee.ai). We call them
// first and transparently fall back to the lower-level building blocks
// (add → cognify / search / data-delete) when a tenant only exposes the legacy
// endpoints (404/405), so the integration works across Cognee Cloud tiers.

function isMissingEndpoint(e: unknown): boolean {
  return e instanceof CogneeError && (e.status === 404 || e.status === 405);
}

/**
 * remember — ingest text and permanently structure it into the knowledge graph
 * in one call (the lifecycle verb that wraps add → cognify). Falls back to the
 * building blocks if `/api/v1/remember` isn't available on this tenant.
 */
export async function cogneeRemember(
  datasetName: string,
  text: string,
  nodeSet?: string[]
): Promise<unknown> {
  const form = new FormData();
  form.append("data", new Blob([text], { type: "text/plain" }), `memory-${Date.now()}.txt`);
  form.append("datasetName", datasetName);
  form.append("run_in_background", "false");
  if (nodeSet && nodeSet.length) for (const n of nodeSet) form.append("node_set", n);
  try {
    return await cogneeFetch("/api/v1/remember", { method: "POST", form });
  } catch (e) {
    if (!isMissingEndpoint(e)) throw e;
    const res = await cogneeAddText(datasetName, text, nodeSet);
    cogneeCognify([datasetName], { runInBackground: true }).catch(() => {});
    return res;
  }
}

/**
 * recall — query memory; Cognee auto-routes between vector similarity and graph
 * traversal. Falls back to the legacy `search` endpoint if `/api/v1/recall` 404s.
 */
export async function cogneeRecall(
  query: string,
  opts: { searchType?: CogneeSearchType; datasets?: string[]; topK?: number } = {}
): Promise<CogneeSearchResult[]> {
  const st = opts.searchType || DEFAULT_SEARCH_TYPE;
  const tk = opts.topK ?? 10;
  const ds = opts.datasets ? { datasets: opts.datasets } : {};
  const json = SNAKE_CASE
    ? { query, ...ds, search_type: st, top_k: tk }
    : { query, ...ds, searchType: st, topK: tk };
  try {
    const result = await cogneeFetch<CogneeSearchResult[] | CogneeSearchResult>("/api/v1/recall", {
      method: "POST",
      json,
    });
    if (Array.isArray(result)) return result;
    return result ? [result] : [];
  } catch (e) {
    if (!isMissingEndpoint(e)) throw e;
    return cogneeSearch(query, { searchType: st, datasets: opts.datasets, topK: tk });
  }
}

/**
 * improve (memify) — enrich and adaptively re-weight an existing dataset's memory
 * after ingestion. Best-effort: no-ops if the endpoint isn't available.
 */
export async function cogneeImprove(datasetName: string): Promise<void> {
  const json = SNAKE_CASE
    ? { dataset_name: datasetName, run_in_background: true }
    : { datasetName, runInBackground: true };
  try {
    await cogneeFetch("/api/v1/improve", { method: "POST", json });
  } catch (e) {
    if (!isMissingEndpoint(e)) throw e; // no legacy equivalent — treat as no-op
  }
}

/**
 * forget (item scope) — remove a single ingested item from the graph. The v1
 * `/api/v1/forget` verb is dataset/user-scoped; per-item removal uses the
 * data-item delete, which is the item-scope form of forget.
 */
export async function cogneeForgetItem(datasetId: string, dataId: string): Promise<void> {
  await cogneeDeleteData(datasetId, dataId);
}

// ── Health / diagnostics ────────────────────────────────────────────────────

/** The configured Cognee base URL (tenant data-plane host). */
export function cogneeBase(): string {
  return API_BASE;
}

export interface CogneeHealth {
  ok: boolean;
  base: string;
  keyConfigured: boolean;
  latencyMs: number;
  /** Raw payload from the tenant's GET /health (status + component DB checks). */
  health: { status?: string; version?: string; components?: unknown } | null;
  /** Dataset listing summary — proves the API key + tenant routing work. */
  datasets: { count: number; names: string[] } | null;
  /** Optional probe search (only when requested); confirms retrieval end-to-end. */
  search: { ok: boolean; sample?: unknown } | null;
  error?: string;
}

/**
 * Connectivity + liveness check for the configured Cognee tenant host.
 * Hits GET /health and lists datasets (both cheap). Pass { probeSearch: true }
 * to also run a tiny GRAPH_COMPLETION search — that costs credits, so it's off
 * by default. Never throws: failures come back as { ok:false, error }.
 */
export async function cogneeHealthCheck(
  opts: { probeSearch?: boolean } = {}
): Promise<CogneeHealth> {
  const started = Date.now();
  const base = API_BASE;
  const keyConfigured = cogneeEnabled();
  const out: CogneeHealth = {
    ok: false,
    base,
    keyConfigured,
    latencyMs: 0,
    health: null,
    datasets: null,
    search: null,
  };

  if (!keyConfigured) {
    out.error = "COGNEE_API_KEY is not set";
    out.latencyMs = Date.now() - started;
    return out;
  }

  try {
    // 1) Tenant /health lives at the host root (no /api/v1 prefix).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let healthStatus = 0;
    try {
      const res = await fetch(`${base}/health`, {
        headers: { "X-Api-Key": API_KEY },
        signal: controller.signal,
      });
      healthStatus = res.status;
      const text = await res.text();
      if (res.ok && text) {
        try {
          out.health = JSON.parse(text);
        } catch {
          out.health = { status: text.slice(0, 120) };
        }
      }
    } finally {
      clearTimeout(timer);
    }

    // 2) Dataset listing exercises auth + tenant routing on the /api/v1 surface.
    const datasets = await cogneeListDatasets();
    out.datasets = { count: datasets.length, names: datasets.map((d) => d.name) };

    // 3) Optional retrieval probe.
    if (opts.probeSearch) {
      try {
        const r = await cogneeSearch("healthcheck ping", { topK: 1 });
        out.search = { ok: true, sample: r[0]?.search_result ?? null };
      } catch (e) {
        out.search = { ok: false, sample: (e as Error).message };
      }
    }

    out.ok = healthStatus === 200 && out.datasets != null;
  } catch (e) {
    const err = e as CogneeError;
    out.error = err.status ? `Cognee ${err.status}: ${err.message}` : err.message || String(e);
  }

  out.latencyMs = Date.now() - started;
  return out;
}

/** forget (dataset scope) — prune an entire dataset when it's no longer needed. */
export async function cogneeForgetDataset(
  datasetName: string,
  opts: { memoryOnly?: boolean } = {}
): Promise<void> {
  const json = SNAKE_CASE
    ? { dataset: datasetName, memory_only: opts.memoryOnly ?? true }
    : { dataset: datasetName, memoryOnly: opts.memoryOnly ?? true };
  try {
    await cogneeFetch("/api/v1/forget", { method: "POST", json });
  } catch (e) {
    if (!isMissingEndpoint(e)) throw e;
  }
}
