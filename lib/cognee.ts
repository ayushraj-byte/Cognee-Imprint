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
