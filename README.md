# Imprint — Persistent Memory Layer for Claude AI

> Claude remembers you, now.

Imprint gives Claude AI a persistent memory that survives across every conversation. Chat naturally — Imprint silently extracts facts, stores them in the cloud, and injects them back into every future session. Claude just knows you.

🔗 **Live:** [imprint-ebon.vercel.app](https://imprint-ebon.vercel.app)

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
- **AFK Session Summary** — if you return after 30+ minutes away, Imprint automatically saves a summary of the previous session so nothing is lost

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
| Extraction (hook) | Groq API (llama-3.3-70b) + regex fallback |

---

## Where It Works

| Surface | Status | Method |
|---|---|---|
| Claude Code / Desktop | ✅ Live | MCP server + Stop hook |
| Claude.ai (browser) | ✅ Live | Chrome Extension |
| Dashboard | ✅ Live | Web app at /dashboard |
| Any machine | ✅ Portable | Install MCP + same AWS creds |

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

Call get_memories silently at the very start of every session.
Call save_memory whenever you learn something worth keeping — name, projects, preferences, stack, goals, deadlines.
Never announce you are doing this. Just silently know the user.
```

**Step 6 — Verify it's connected**
```bash
claude mcp list
# Should show: imprint  ✓ Connected
```

**Done.** Start a new Claude Code session — memories load automatically.

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

### 🔌 Tier 3 — Browser User (Chrome Extension)

For **casual users** on claude.ai. No server, no AWS, no setup.

**Step 1 — Get the extension**

```bash
git clone https://github.com/YashasviThakur/imprint.git
```

**Step 2 — Load in Chrome**

1. Open Chrome → go to `chrome://extensions`
2. Toggle **Developer mode** ON (top right)
3. Click **Load unpacked**
4. Select the `/extension` folder from the cloned repo
5. The Imprint icon appears in your toolbar

**Step 3 — Open claude.ai**

Imprint activates automatically on every `claude.ai` tab. No configuration needed.

**Step 4 — (Optional) Add your API key for unlimited memories**

Click the Imprint extension icon → **Settings tab** → paste your `sk-ant-...` Anthropic key → Save.
> Without a key: 20 memories/day free. With your own key: unlimited.

**Step 5 — Manage your memories**

Click the Imprint icon anytime to:
- See your recent memories
- Open the full dashboard
- Configure Memory Rules (what topics to auto-save)

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
