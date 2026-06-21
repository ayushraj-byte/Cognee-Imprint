# Imprint — Persistent Memory for Every AI Coding IDE

> Your AI coding assistant finally remembers you — across every IDE you use.

Imprint gives AI coding assistants a persistent memory that survives across every session. Work naturally — Imprint silently extracts the durable facts, stores them in the cloud, and injects the relevant ones back into your next session. A fact you teach in one IDE is instantly available in the others.

🔗 **Live:** [imprint-ebon.vercel.app](https://imprint-ebon.vercel.app)

---

## The Problem

Every new AI session starts from zero. Your name, your stack, your projects, your preferences — forgotten. You repeat yourself every single session. The model is brilliant but amnesiac.

Imprint fixes that permanently — and across **every** IDE, not just one.

---

## One Memory Layer, Two Surfaces

| | Tier 1 — Developer | Tier 2 — Enterprise |
|---|---|---|
| **How** | MCP server (local) | Web app + BYOK |
| **Surface** | Claude Code · Cursor · Codex · Antigravity | Any MCP IDE, org-wide |
| **Memory scope** | Personal | Shared org pool |
| **Setup** | One CLI command | Invite link |
| **Target** | Developers, researchers | Teams, agencies |

**The insight:** most memory tools serve one audience and one tool. Imprint scales from a solo developer to an enterprise team — and spans every MCP-capable IDE — on the same DynamoDB backend, zero migration.

---

## How It Works

```
You work in your AI IDE
       ↓
Imprint silently extracts facts (Groq LLM + regex fallback)
       ↓
Facts stored in DynamoDB:
  Personal:   USER#userId    → MEMORY#timestamp
  Enterprise: USER#org_orgId → MEMORY#timestamp  (shared with the whole team)
       ↓
Next session: get_memories() fires automatically
Your assistant already knows you — and your team's context
```

---

## Architecture

```mermaid
flowchart TB
  subgraph SURF["Surfaces"]
    direction LR
    IDE["AI coding agents<br/>Claude Code · Cursor · Codex · Antigravity"]
    DASH["Dashboard<br/>memory graph · analytics · rules"]
    ORG["Enterprise<br/>shared org pool · BYOK"]
  end

  subgraph CAP["Capture"]
    direction LR
    MCP["MCP server<br/>tools · stdio"]
    HOOK["Stop + PreCompact hooks<br/>guaranteed Groq extraction"]
  end

  subgraph API["API — Next.js on Vercel"]
    direction LR
    MEM["/api/memories<br/>save · search · pin · dedup · contradiction-check"]
    SESS["/api/sessions · rules · org"]
    AUTH["NextAuth<br/>Google OAuth"]
  end

  subgraph INTEL["Intelligence"]
    direction LR
    GROQ["Groq LLM<br/>extract · rerank · contradiction"]
    JINA["Jina embeddings<br/>1024-dim vectors"]
    RANK["rank · dedup · pin<br/>relevance + durability"]
  end

  DB[("DynamoDB — single table<br/>USER#id · MEMORY#ts · TTL")]

  IDE --> MCP
  IDE --> HOOK
  DASH --> MEM
  ORG --> MEM
  MCP --> MEM
  HOOK --> MEM
  MEM --> AUTH
  MEM --> GROQ
  MEM --> JINA
  MEM --> RANK
  GROQ --> DB
  JINA --> DB
  RANK --> DB
  MEM --> DB
```

*Data flows **down** to save (write path) and **up** to retrieve (read path). Every surface reads and writes the same store.*

**The five layers**

1. **Surfaces** — Claude Code, Cursor, Codex, Antigravity (and any MCP-capable IDE), plus the web dashboard and an enterprise org pool.
2. **Capture** — the MCP server (stdio tools) *and* a guaranteed Stop/PreCompact hook that runs Groq extraction even when the model forgets to call `save_memory`.
3. **API** — Next.js on Vercel: `/api/memories` (save, search, pin, dedup, contradiction-check), `/api/sessions`, `/api/rules`, `/api/org`; NextAuth (Google OAuth).
4. **Intelligence** — Groq (`llama-3.3-70b`) for extraction, contradiction detection, and zero-score rerank; Jina embeddings (1024-dim); relevance ranking with dedup and always-injected pinned facts.
5. **Storage** — DynamoDB single-table; 30-day TTL on unpinned memories, no TTL on pinned.

> Full diagrams, data flows, and the data model: see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Features

### 🧠 Smart Memory Extraction
- **Groq-powered** (llama-3.3-70b, no-cost tier) — understands implicit and contextual facts, not just "my name is X"
- Catches things like *"my app keeps crashing"* → saves that you have an app
- Regex fallback if Groq is unavailable — always works

### 🔄 Auto-Save — Two Layers
- **Instruction files** — your assistant calls `save_memory` naturally mid-session
- **Stop Hook** — fires after every single assistant response, guaranteed. Extracts facts even if the model forgets to
- **AFK Session Summary** — if you return after 30+ minutes away, Imprint automatically saves a summary of the previous session so nothing is lost

### 🎛️ Memory Rules
- You control exactly what gets auto-saved by topic: projects, work, preferences, personal, health, relationships
- Add custom rules with keywords or regex patterns
- Toggle per topic — privacy-first by default (personal/health/relationships OFF)

### ⚡ Real-time Contradiction Detection
- When you save a fact that conflicts with an existing memory, Imprint detects it via semantic comparison (Groq) on **every** save path
- Surfaces a live warning right in your IDE (through the `save_memory` tool) **and** a ⚠ conflict badge on both memories in the dashboard
- Keeps your memory self-correcting instead of silently storing contradictory facts

### 🏢 Enterprise Org Pool
- Teams share a memory pool — onboarding context, client names, tech decisions
- Every member's session gets both personal + org memories injected automatically
- Org-level BYOK (bring your own model key)

### 🔐 Auth + Security
- NextAuth (Auth.js) — Google OAuth
- AES-256 encryption for stored API keys
- Memory Rules default to privacy-first

---

## Stack

| Layer | Tech |
|---|---|
| Frontend + Dashboard | Next.js 16 (App Router), Vercel |
| Auth | NextAuth (Auth.js) — Google OAuth |
| Database | AWS DynamoDB (single-table design) |
| Memory Extraction | Groq API (llama-3.3-70b) + regex fallback |
| Embeddings | Jina AI (1024-dim) — semantic retrieval |
| MCP Server | Node.js, @modelcontextprotocol/sdk |
| Extraction (hook) | Groq API (llama-3.3-70b) + regex fallback |

---

## Where It Works

| Surface | Status | Method |
|---|---|---|
| Claude Code / Desktop | ✅ Live | MCP server + Stop hook |
| Cursor · Codex · Antigravity | ✅ Live | MCP server |
| Dashboard | ✅ Live | Web app at /dashboard |
| Any machine | ✅ Portable | Install MCP + same user ID |

---

## Quick Start

---

### 🖥️ Tier 1 — Developer (MCP Server)

For **Claude Code** and any MCP-capable IDE. One-time setup, works on any machine.

> **No AWS account needed.** The MCP connects to Imprint's hosted API — your memories are stored securely in our DynamoDB backend. Just set your own user ID and you're done.

**Step 1 — Clone and install dependencies**
```bash
git clone https://github.com/YashasviThakur/imprint.git
cd imprint/mcp
npm install
```

**Step 2 — Register the MCP server with Claude Code**
```bash
claude mcp add imprint --scope user -- node /absolute/path/to/imprint/mcp/server.js
```
> Replace `/absolute/path/to/imprint` with your actual path, e.g. `C:/Users/you/Downloads/imprint`

**Step 3 — Set your user ID**

Open `~/.claude.json` and add under `mcpServers.imprint.env`:
```json
{
  "IMPRINT_USER_ID": "your-unique-id"
}
```
> Use anything unique — your name, email, or a random string. This namespaces your memories so they're private to you.

**Step 4 — Add the Stop Hook** (auto-saves after every response + AFK session summaries)

Open `~/.claude/settings.json` and add:
```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "node \"/absolute/path/to/imprint/mcp/extract-and-save.js\"",
        "timeout": 30,
        "async": true
      }]
    }]
  },
  "env": {
    "IMPRINT_USER_ID": "your-unique-id"
  }
}
```

**Step 5 — Create CLAUDE.md** (tells your assistant to use Imprint automatically)

Create the file at `~/.claude/CLAUDE.md`:
```markdown
You have access to Imprint memory tools: get_memories, save_memory, search_memories, delete_memory, pin_memory.

At the start of every session, silently call get_memories with query = the user's first message,
verbatim. The query runs semantic search and returns the memories relevant to what they asked —
without it you only get the most recent ones, which are usually wrong.

Before answering ANY personal question (health, job, preferences, "what am I working on", "what did
I tell you about X"), call search_memories with their question first. Never answer from assumptions.

Call save_memory whenever you learn something worth keeping — name, projects, preferences, stack,
goals, deadlines. Never announce you are doing this. Just silently know the user.
```
> The repo ships ready-made instruction files for every IDE — `CLAUDE.md`, `AGENTS.md` (Codex / agentic IDEs), `.cursorrules`, and `.github/copilot-instructions.md`. Copy the one for your IDE if you'd rather not write your own.

**Step 6 — Verify it's connected**
```bash
claude mcp list
# Should show: imprint  ✓ Connected
```

**Done.** Start a new session — memories load automatically.

---

### 🧩 Other IDEs — Cursor · Codex · Antigravity · VS Code · any MCP client

Same MCP server, different config file per IDE. After cloning (`git clone … "$HOME/imprint"`), point your IDE at `$HOME/imprint/mcp/server.js`. The dashboard's **Connect your IDE** modal generates a copy-paste auto-configure command for each of these.

| IDE | Config file | Format |
|---|---|---|
| Claude Code | `~/.claude.json` | JSON — `mcpServers` |
| Cursor | `~/.cursor/mcp.json` | JSON — `mcpServers` |
| Antigravity | `~/.gemini/config/mcp_config.json` | JSON — `mcpServers` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | JSON — `mcpServers` |
| VS Code (Copilot) | `.vscode/mcp.json` | JSON — **`servers`** |
| **Codex** | `~/.codex/config.toml` | **TOML** — `[mcp_servers.imprint]` |

**`mcpServers` JSON** (Cursor, Antigravity, Windsurf, Claude):
```json
{
  "mcpServers": {
    "imprint": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/imprint/mcp/server.js"],
      "env": { "IMPRINT_USER_ID": "your-user-id", "IMPRINT_PLATFORM": "cursor" }
    }
  }
}
```

**Codex** uses TOML, not JSON — add to `~/.codex/config.toml`:
```toml
[mcp_servers.imprint]
command = "node"
args = ["/ABSOLUTE/PATH/TO/imprint/mcp/server.js"]

[mcp_servers.imprint.env]
IMPRINT_USER_ID = "your-user-id"
IMPRINT_PLATFORM = "codex"
```

> Set `IMPRINT_PLATFORM` to your IDE name (`cursor`, `codex`, `antigravity`, …) so the dashboard can show which IDE saved each memory. On Windows, write paths with forward slashes — `C:/Users/you/imprint/mcp/server.js`.

---

### 🌐 Tier 2 — Enterprise (Web App + BYOK)

For **teams** who want shared memory across all members. No install required.

**Step 1 — Sign in**

Go to [imprint-ebon.vercel.app](https://imprint-ebon.vercel.app) → sign in with Google.
No install required — the dashboard is fully cloud-hosted.

**Step 2 — Connect your model API key**

Dashboard → Settings → paste your key → Save.
> Your key is stored AES-256 encrypted. Used only for your org's memory extraction.

**Step 3 — Create an organisation**
```bash
POST https://imprint-ebon.vercel.app/api/org
Content-Type: application/json

{
  "name": "Your Company",
  "adminUserId": "your-user-id"
}
```

**Step 4 — Invite team members**
```bash
PATCH https://imprint-ebon.vercel.app/api/org
Content-Type: application/json

{
  "orgId": "your-org-id",
  "userId": "teammate-user-id"
}
```

**Step 5 — Every session is now informed**

All team members' sessions automatically receive both their personal memories **and** the shared org pool — client names, project context, team decisions. Zero configuration per member.

---

## MCP Tools

| Tool | Description |
|---|---|
| `get_memories` | Fires at session start. Pass `query` = the user's first message for relevance-ranked results (semantic search) instead of just the most recent memories |
| `save_memory` | Save a new fact (content, topic, keywords) — runs contradiction detection and warns on conflicts |
| `search_memories` | Semantic search — call before answering any personal question, and on topic shifts |
| `delete_memory` | Forget something permanently |
| `pin_memory` | Mark as always-inject — never missed |

---

## DynamoDB Schema

Single-table design, three item types:

**Memory item** (`imprint-memories`)
```
PK: USER#userId
SK: MEMORY#createdAt#memoryId
Fields: content, topic, pinned, keywords, confidence, source, embedding, contradicts[]
TTL: 30 days (unpinned) · no TTL (pinned)
```

**Session item**
```
PK: USER#userId
SK: SESSION#createdAt#sessionId
Fields: title, messageCount, memoriesExtracted, pinned
```

**Memory Rules item**
```
PK: USER#userId
SK: MEMORY_RULES
Fields: rules[] → { ruleId, label, topic, enabled, keywords, pattern }
```

---

## Enterprise API

```bash
# Create an org
POST /api/org
{ "name": "Acme Corp", "adminUserId": "alice" }

# Add a team member
PATCH /api/org
{ "orgId": "abc-123", "userId": "bob" }

# Get merged memories (personal + org pool)
GET /api/org?orgId=abc-123&userId=alice

# Memory Rules
GET  /api/rules?userId=alice
POST /api/rules   { "userId", "label", "topic", "keywords" }
PATCH /api/rules  { "userId", "ruleId", "enabled": false }
```

---

## Project Structure

```
imprint/
├── app/
│   ├── page.tsx              # Landing page
│   ├── dashboard/            # Memory dashboard (memories, sessions, rules)
│   ├── sign-in / sign-up/    # auth pages (NextAuth)
│   └── api/
│       ├── memories/         # CRUD + smart extraction + contradiction check
│       ├── sessions/         # Session history
│       ├── rules/            # Memory rules CRUD
│       └── org/              # Enterprise org management
├── mcp/
│   ├── server.js             # MCP tools backed by DynamoDB
│   └── extract-and-save.js   # Stop hook — auto-extracts after every response
├── lib/
│   ├── dynamodb.ts           # DynamoDB client + all CRUD helpers
│   ├── embeddings.ts         # Jina embeddings + cosine similarity
│   ├── contradiction.ts      # Semantic contradiction detection
│   └── extract.ts            # Groq + regex extraction engine
├── ARCHITECTURE.md           # Full architecture, data flows, data model
└── middleware.ts             # NextAuth route protection
```

---

*Built by Yashasvi Thakur*
