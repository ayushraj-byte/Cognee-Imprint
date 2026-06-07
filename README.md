# Imprint — Persistent Memory Layer for Claude AI

> Claude remembers you, now.

Imprint gives Claude AI a persistent memory that survives across every conversation. Chat naturally — Imprint silently extracts facts, stores them in the cloud, and injects them back into every future session. Claude just knows you.

---

## One Memory Layer, Three Surfaces

Imprint serves three distinct audiences with the same DynamoDB backend:

| | Tier 1 — Developer | Tier 2 — Enterprise | Tier 3 — Browser User |
|---|---|---|---|
| **How** | Install MCP server locally | Web app + Anthropic BYOK | Chrome Extension only |
| **Surface** | Claude Code / Desktop | claude.imprint.app | claude.ai |
| **Memory scope** | Personal | Shared org pool | Personal |
| **Setup** | One CLI command | Invite link | Add to Chrome |
| **Target** | Devs, researchers | MNCs, agencies, teams | Casual users |

**The insight:** most memory tools serve one audience. Imprint scales from a solo developer to an enterprise team — same backend, zero migration.

---

## How It Works

```
You chat with Claude
       ↓
Imprint silently calls save_memory (no prompting needed)
       ↓
Personal:   USER#userId    → MEMORY#timestamp  (your private memories)
Enterprise: USER#org_orgId → MEMORY#timestamp  (shared with entire team)
       ↓
Next session: getMergedMemories() → pinned org facts + personal + rest
Claude already knows you — and your team's context
```

---

## Stack

| Layer | Tech |
|---|---|
| Frontend / Dashboard | Next.js 16 (App Router), Vercel |
| Database | AWS DynamoDB (single-table design) |
| AI | Amazon Bedrock (Claude 3.5 Haiku) + Anthropic API BYOK |
| Memory MCP Server | Node.js, @modelcontextprotocol/sdk |
| Chrome Extension | MV3, vanilla JS |
| Contradiction Detection | AWS Lambda (Node.js 22) |

---

## Memory Access — Where It Works

| Surface | Status | Method |
|---|---|---|
| Claude Code / Desktop | ✅ Live | MCP server |
| Claude.ai (browser) | ✅ Extension | Chrome Extension injects memories |
| Any other machine | ✅ Portable | Install MCP + same AWS creds |

---

## MCP Server Setup (Claude Code / Desktop)

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
  "IMPRINT_USER_ID": "your-unique-user-id"
}
```

Add `~/.claude/CLAUDE.md` to make Claude auto-save in every session:
```markdown
Call get_memories at the start of every session.
Call save_memory silently whenever you learn something worth keeping.
Never announce you're doing this — just know the user.
```

---

## MCP Tools

| Tool | Description |
|---|---|
| `get_memories` | Fetch all memories — call at session start |
| `save_memory` | Save a new fact about the user |
| `search_memories` | Find specific memories by keyword |
| `delete_memory` | Forget something |
| `pin_memory` | Pin to always inject into every session |

---

## DynamoDB Schema

Three tables, single-table design each:

**`imprint-memories`** — personal + org memories
- PK: `USER#userId` (personal) or `USER#org_orgId` (shared org pool)
- SK: `MEMORY#createdAt#memoryId`
- TTL: 30 days for unpinned · pinned = no TTL

**`imprint-users`** — user profiles + tiers
- PK: `USER#userId`, SK: `PROFILE`
- `tier`: `free` | `byok` | `enterprise`
- `orgId`: set when user belongs to an enterprise org

**`imprint-orgs`** — enterprise org profiles
- PK: `ORG#orgId`, SK: `PROFILE`
- `memberIds[]`: all users in the org
- `sharedMemoryEnabled`: true = all members share memory pool
- `encryptedApiKey`: org-level Anthropic key (optional)

---

## Enterprise API

```bash
# Create an org
POST /api/org
{ "name": "Acme Corp", "adminUserId": "alice", "encryptedApiKey": "..." }

# Add a team member
PATCH /api/org
{ "orgId": "abc-123", "userId": "bob" }

# Get org + merged memories for a user (personal + shared pool)
GET /api/org?orgId=abc-123&userId=alice
```

Every member's Claude session automatically receives both their personal memories **and** the shared org memory pool — no configuration needed.

## Dashboard

Visit `/dashboard?userId=your-id` to view, edit, pin, and delete memories visually.

---

## Project Structure

```
imprint/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Landing page
│   ├── dashboard/          # Memory dashboard
│   ├── chat/               # BYOK chat with memory injection
│   └── api/                # REST API (memories CRUD, import, chat)
├── mcp/                    # MCP server for Claude Code/Desktop
│   ├── server.js           # 5 tools backed by DynamoDB
│   └── package.json
├── extension/              # Chrome Extension MV3
│   ├── background.js       # Fetches + injects memories into Claude.ai
│   ├── popup.html/js       # Extension UI
│   └── manifest.json
├── lib/
│   ├── dynamodb.ts         # DynamoDB client + CRUD helpers
│   └── bedrock.ts          # Bedrock client, memory extraction, chat
├── lambda/                 # Contradiction detection Lambda
└── .claude/
    └── CLAUDE.md           # Auto-memory instructions for every session
```

---

## Built For

- **H0 Hackathon 2026** — $80K prize, deadline June 29
- **USAII Qualifier** — June 10–14

---

*Built by Yashasvi Thakur*
