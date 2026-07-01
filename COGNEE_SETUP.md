# cognee-imprint — Cognee Cloud memory layer

This is a **local-only** fork of Imprint where **Cognee Cloud powers the memory**, built for
the [WeMakeDevs Cognee hackathon](https://www.wemakedevs.org/hackathons/cognee)
("Best Use of Cognee Cloud" track).

It does **not** touch the original `imprint-ebon.vercel.app` site or its data. See
[Isolation](#isolation) below.

---

## What changed vs. the original Imprint

The original stored memories in **AWS DynamoDB** and did retrieval with **Jina embeddings +
Groq** (in-app cosine similarity). This build replaces that stack:

| Concern | Original | cognee-imprint |
|---|---|---|
| Memory intelligence (semantic + graph retrieval) | Jina embeddings + in-app cosine + Groq | **Cognee Cloud** (`add` → `cognify` → `search`) |
| Durable persistence (the rows the dashboard lists/edits/pins) | AWS DynamoDB | **Local JSON store** (`.data/sidecar.json`, gitignored) |
| Auth for local use | Google OAuth required | OAuth optional — `?userId=` works locally |

**Why a local store too?** Cognee is an *ingest → knowledge-graph → query* engine: it can
`add`/`cognify`/`search` and delete items by id, but it does **not** return the memory text or
per-item flags (pinned/topic) on a plain *list* call — and the dashboard lists the full memory
set continuously. So the local store keeps the full rows (the role DynamoDB played), while
**Cognee is the retrieval brain** that the hackathon judges actually exercise.

### New / changed files
- `lib/cognee.ts` — Cognee Cloud REST client (`add`, `cognify`, `search`, datasets, delete).
- `lib/memory-store.ts` — the memory store: persists locally **and** ingests into Cognee;
  `cogneeSemanticSearch()` / `cogneeGraphAnswer()` power retrieval.
- `lib/local-store.ts` — file-backed persistence (no AWS).
- `lib/memory-types.ts` — shared types (extracted from `lib/dynamodb.ts`).
- `lib/dynamodb.ts` — now a facade: memory ops delegate to `memory-store`; user/rules/projects/org
  use the local store in isolated mode (original DynamoDB paths kept for a real AWS deploy).
- `app/api/memories/route.ts` — semantic search now runs through Cognee.
- `lib/authz.ts` — ownership checks are bypassed **only** in local mode (no AWS creds).

---

## How the memory maps onto Cognee

- Each user → a Cognee **dataset** named `imprint_<userId>`.
- **Save** → `POST /api/v1/add` (the fact as a text doc) → `POST /api/v1/cognify` (build the graph).
  Topic / pinned / source are attached as `node_set` tags.
- **Semantic search / `get_memories(query)`** → `POST /api/v1/search` (`CHUNKS`), mapped back to
  local rows. **Ask** → `search` with `GRAPH_COMPLETION`.
- **Delete** → `DELETE /api/v1/datasets/{id}/data/{dataId}` (best-effort, by the stored `cogneeDataId`).

---

## Run it locally

```bash
cd /path/to/cognee-imprint
npm install
npm run dev            # http://localhost:3000  (this repo's dev script)
```

Open the dashboard with a local user id (no Google sign-in needed):

```
http://localhost:3000/dashboard?userId=local-dev
```

### Add your Cognee Cloud key (to actually power retrieval with Cognee)

1. Sign up at **https://platform.cognee.ai** and create an **API key**.
2. Put it in `.env.local`:
   ```env
   COGNEE_API_KEY=<your-key>
   COGNEE_API_BASE=https://api.cognee.ai
   COGNEE_SEARCH_TYPE=GRAPH_COMPLETION
   ```
3. Restart `npm run dev`.

**Without a key**, the app still runs: memories persist locally and semantic search falls back to
keyword ranking. **With a key**, saves ingest into your Cognee dataset and search is graph-powered.

### Verify

```bash
# save a memory
curl -s localhost:3000/api/memories -H 'content-type: application/json' \
  -d '{"userId":"local-dev","content":"I am building cognee-imprint for the Cognee hackathon.","topic":"projects"}'

# list
curl -s 'localhost:3000/api/memories?userId=local-dev'

# Cognee-powered semantic search
curl -s 'localhost:3000/api/memories?userId=local-dev&semantic=what%20am%20I%20building'
```

---

## Isolation

This build cannot affect the original Imprint site or its production data:

1. **Local-by-default (positive opt-in).** `lib/local-store.ts` `LOCAL_MODE` is
   `STORAGE_BACKEND !== "dynamodb"` — it does **not** key off the absence of AWS creds. So even if
   your shell exports a production `AWS_ACCESS_KEY_ID` (this machine does), the app still uses the
   local store. DynamoDB is reached **only** if you explicitly set `STORAGE_BACKEND=dynamodb`.
2. **Hard guard on the DB client.** In local mode the shared `ddb` client (`lib/dynamodb.ts`) throws
   on *any* `send()`, so routes that import it directly (`keys`, `digest`, `webhooks/clerk`,
   `v1/memories`) physically cannot reach a real table. `sessions` (its own client) is guarded too.
3. **No secrets, no deploy.** `.env*` is gitignored (the live deployment's keys were never cloned);
   `.env.local` adds `STORAGE_BACKEND=local` and blanks `AWS_*`. All work is on branch
   `cognee-cloud` — nothing pushed; the live site only changes on `git push` + Vercel redeploy.
4. **Local persistence only.** Memory + user/rules/projects/org records live in `.data/sidecar.json`
   (gitignored). Memory *content* additionally goes to **your** Cognee Cloud account — never the
   original's.

### Known local-mode limitations (by design for the full Cognee replacement)
- **API-key (BYOK) auth is DynamoDB-only** — `/api/v1/memories` (the MCP *API-key* startup path) and
  `/api/keys` return errors locally. Configure the MCP/hook with `IMPRINT_USER_ID` (not an API key)
  to use this local server.
- **Embedding-based features degrade** — duplicate detection and semantic *dedup-on-save* used Jina
  vectors; with no `JINA_API_KEY` they no-op (exact-prefix dedup still works). Cognee powers the
  primary semantic/graph retrieval instead.
