# Imprint — Persistent Memory Layer for Claude AI

> Claude remembers you, now.

Imprint gives Claude AI a persistent memory that survives across every conversation. Chat naturally — Imprint silently extracts facts, stores them in the cloud, and injects them back into every future session. Claude just knows you.

🔗 **Live demo:** [claude-memory-enhancer.vercel.app](https://claude-memory-enhancer.vercel.app)

---

## The Problem

Every Claude conversation starts from zero. Your name, your stack, your projects, your preferences — forgotten. You repeat yourself every single session. Claude is brilliant but amnesiac.

Imprint fixes that permanently.

---

## One Memory Layer, Three Surfaces

| | Tier 1 — Developer | Tier 2 — Enterprise | Tier 3 — Browser User |
|---|---|---|---|
| **How** | MCP server (local) | Web app + BYOK | Chrome Extension |
| **Surface** | Claude Code / Desktop | Any browser | claude.ai |
| **Memory scope** | Personal | Shared org pool | Personal |
| **Setup** | One CLI command | Invite link | Add to Chrome |
| **Target** | Developers, researchers | Teams, agencies | Casual users |
| **Cost** | Free | Bring your own API key | Free |

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

### 🎛️ Memory Rules
- User controls exactly what gets auto-saved by topic: projects, work, preferences, personal, health, relationships
- Add custom rules with keywords or regex patterns
- Toggle per topic — privacy-first by default (personal/health/relationships OFF)

### ⚡ Contradiction Detection
- When a new fact conflicts with a saved memory, Imprint flags it
- Visible in the Chrome extension popup and dashboard

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
| Chrome Extension | Manifest V3, vanilla JS |
| AI (web chat) | Amazon Bedrock (Claude 3.5 Haiku) |

---

## Memory Access — Where It Works

| Surface | Status | Method |
|---|---|---|
| Claude Code / Desktop | ✅ Live | MCP server + Stop hook |
| Claude.ai (browser) | ✅ Live | Chrome Extension |
| Dashboard | ✅ Live | Web app at /dashboard |
| Any machine | ✅ Portable | Install MCP + same AWS creds |

---

## Quick Start

### Developer — MCP Server

```bash
cd mcp && npm install
```

Register with Claude Code:
```bash
claude mcp add imprint --scope user -- node /path/to/imprint/mcp/server.js
```

Add env vars to `~/.claude.json` under `mcpServers.imprint.env`:
```json
{
  "AWS_REGION": "us-east-1",
  "AWS_ACCESS_KEY_ID": "your-key",
  "AWS_SECRET_ACCESS_KEY": "your-secret",
  "DYNAMODB_MEMORIES_TABLE": "imprint-memories",
  "IMPRINT_USER_ID": "your-unique-user-id",
  "GROQ_API_KEY": "gsk_..."
}
```

Create `~/.claude/CLAUDE.md`:
```markdown
You have access to Imprint memory tools (get_memories, save_memory, search_memories, delete_memory, pin_memory).
Call get_memories silently at the start of every session.
Call save_memory whenever you learn something worth keeping — name, projects, preferences, stack, goals.
Never announce you're doing this.
```

### Browser User — Chrome Extension

1. Clone the repo
2. Go to `chrome://extensions` → Enable Developer Mode → Load Unpacked → select `/extension`
3. Open claude.ai — Imprint activates automatically

### Enterprise — Web App

Visit the live URL → Sign up → create an org → invite your team.

---

## MCP Tools

| Tool | Description |
|---|---|
| `get_memories` | Fetch all memories — fires at session start |
| `save_memory` | Save a new fact (content, topic, keywords) |
| `search_memories` | Find specific memories by keyword |
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
│   ├── chat/                 # BYOK web chat with memory injection
│   └── api/
│       ├── memories/         # CRUD + smart extraction
│       ├── sessions/         # Session history
│       ├── rules/            # Memory rules CRUD
│       └── org/              # Enterprise org management
├── mcp/
│   ├── server.js             # 5 MCP tools backed by DynamoDB
│   └── extract-and-save.js   # Stop hook — auto-extracts after every response
├── extension/
│   ├── manifest.json         # MV3
│   ├── background.js         # Memory fetch + inject
│   ├── content.js            # Intercepts claude.ai requests
│   └── popup.html/js         # Extension UI
├── lib/
│   ├── dynamodb.ts           # DynamoDB client + all CRUD helpers
│   └── extract.ts            # Groq + regex extraction engine
└── middleware.ts             # Clerk route protection
```

---

*Built by Yashasvi Thakur*
