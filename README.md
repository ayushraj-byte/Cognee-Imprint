# Imprint — Persistent Memory Layer for Claude AI

> Claude remembers you, now.

Imprint gives Claude AI a persistent memory that survives across every conversation. Chat naturally — Imprint silently extracts facts, stores them in the cloud, and injects them back into every future session. Claude just knows you.

🔗 **Live:** [imprint-ebon.vercel.app](https://imprint-ebon.vercel.app)

---

## The Problem

Every Claude conversation starts from zero. Your name, your stack, your projects, your preferences — forgotten. You repeat yourself every single session. Claude is brilliant but amnesiac.

Imprint fixes that permanently.

---

## One Memory Layer, Two Surfaces

| | Tier 1 — Developer | Tier 2 — Enterprise |
|---|---|---|
| **How** | MCP server (local) | Web app + BYOK |
| **Surface** | Claude Code · Cursor · Codex · Antigravity | Any MCP IDE, org-wide |
| **Memory scope** | Personal | Shared org pool |
| **Setup** | One CLI command | Invite link |
| **Target** | Developers, researchers | Teams, agencies |
| **Cost** | Free | Bring your own API key |

**The insight:** most memory tools serve one audience. Imprint scales from a solo developer to an enterprise team — same DynamoDB backend, zero migration.

---

## How It Works

```
You chat with Claude
       ↓
Imprint silently extracts facts (Groq LLM + regex fallback — zero cost)
       ↓
Facts stored in DynamoDB:
  Personal:   USER#userId    → MEMORY#timestamp
  Enterprise: USER#org_orgId → MEMORY#timestamp  (shared with the whole team)
       ↓
Next session: get_memories() fires automatically
Claude already knows you — and your team's context
```

---

## Features

### 🧠 Smart Memory Extraction
- **Groq-powered** (llama-3.3-70b, free tier) — understands implicit and contextual facts, not just "my name is X"
- Catches things like *"my app keeps crashing"* → saves that you have an app
- Regex fallback if Groq is unavailable — always works, zero cost

### 🔄 Auto-Save — Two Layers
- **CLAUDE.md instructions** — Claude calls `save_memory` naturally mid-conversation
- **Stop Hook** — fires after every single Claude response, guaranteed. Extracts facts even if Claude forgets to
- **AFK Session Summary** — if you return after 30+ minutes away, Imprint automatically saves a summary of the previous session so nothing is lost

### 🎛️ Memory Rules
- User controls exactly what gets auto-saved by topic: projects, work, preferences, personal, health, relationships
- Add custom rules with keywords or regex patterns
- Toggle per topic — privacy-first by default (personal/health/relationships OFF)

### ⚡ Contradiction Detection
- When a new fact conflicts with a saved memory, Imprint flags it
- Visible in the dashboard

### 🏢 Enterprise Org Pool
- Teams share a memory pool — onboarding context, client names, tech decisions
- Every member's Claude session gets both personal + org memories injected automatically
- Org-level BYOK (bring your own Anthropic key)

### 🔐 Auth + Security
- Clerk authentication — Google OAuth, email/password
- AES-256 encryption for stored API keys
- Memory Rules default to privacy-first

---

## Stack

| Layer | Tech |
|---|---|
| Frontend + Dashboard | Next.js 16 (App Router), Vercel |
| Auth | Clerk |
| Database | AWS DynamoDB (single-table design) |
| Memory Extraction | Groq API (llama-3.3-70b) + regex fallback |
| MCP Server | Node.js, @modelcontextprotocol/sdk |
| Embeddings | Jina AI (1024-dim) — semantic retrieval |
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

For **Claude Code** and **Claude Desktop** users. One-time setup, works on any machine.

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

**Step 5 — Create CLAUDE.md** (tells Claude to use Imprint automatically)

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

**Done.** Start a new Claude Code session — memories load automatically.

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

**Step 1 — Sign up**

Go to [imprint-ebon.vercel.app](https://imprint-ebon.vercel.app) → click **Start for free** → sign up with Google or email.  
No install required — the dashboard is fully cloud-hosted.

**Step 2 — Connect your Anthropic API key**

Dashboard → Settings → paste your `sk-ant-...` key → Save.
> Your key is stored AES-256 encrypted. Used only for your org's memory extraction.

**Step 3 — Create an organisation**
```bash
POST https://imprint-ebon.vercel.app/api/org
Content-Type: application/json

{
  "name": "Your Company",
  "adminUserId": "your-clerk-user-id"
}
```

**Step 4 — Invite team members**
```bash
PATCH https://imprint-ebon.vercel.app/api/org
Content-Type: application/json

{
  "orgId": "your-org-id",
  "userId": "teammate-clerk-user-id"
}
```

**Step 5 — Every session is now informed**

All team members' Claude sessions automatically receive both their personal memories **and** the shared org pool — client names, project context, team decisions. Zero configuration per member.

---

## MCP Tools

| Tool | Description |
|---|---|
| `get_memories` | Fires at session start. Pass `query` = the user's first message for relevance-ranked results (semantic search) instead of just the most recent memories |
| `save_memory` | Save a new fact (content, topic, keywords) |
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
Fields: content, topic, pinned, keywords, confidence, source, contradicts[]
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
│   ├── sign-in / sign-up/    # Clerk auth pages
│   └── api/
│       ├── memories/         # CRUD + smart extraction
│       ├── sessions/         # Session history
│       ├── rules/            # Memory rules CRUD
│       └── org/              # Enterprise org management
├── mcp/
│   ├── server.js             # 5 MCP tools backed by DynamoDB
│   └── extract-and-save.js   # Stop hook — auto-extracts after every response
├── lib/
│   ├── dynamodb.ts           # DynamoDB client + all CRUD helpers
│   ├── embeddings.ts         # Jina embeddings + cosine similarity
│   └── extract.ts            # Groq + regex extraction engine
└── middleware.ts             # Clerk route protection
```

---

*Built by Yashasvi Thakur*
