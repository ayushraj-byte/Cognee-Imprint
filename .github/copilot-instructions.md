# Imprint — Persistent Memory Layer (GitHub Copilot)

You have access to Imprint memory tools via MCP (`get_memories`, `save_memory`, `search_memories`, `delete_memory`, `pin_memory`, `summarize_session`). Follow these rules in **every session**:

## Session Start — pull RELEVANT memories, not just recent ones
- At the very start of every conversation, silently call `get_memories` with **`query` set to the user's first message, verbatim**. The query runs semantic search and returns memories *relevant to what they just asked* — without it you only get the most recent ones, which are usually the wrong ones.
- If there is no first message yet, call `get_memories` with no query to load pinned memories.
- Use what you retrieve to personalize from message one.
- "Where were we?" / "what's the status?" → `get_memories(query="project status next steps blockers")` and answer directly, no questions asked.

## Personal questions ALWAYS require a lookup FIRST
If the user asks anything about themselves — health, job, preferences, past decisions, "what did I tell you about X" — you MUST call `search_memories` with their question **before** answering. Never answer from assumptions. Example: "what's my stack?" → `search_memories("user tech stack")` first. Check even when you think you don't know.

## Topic shift → search before responding
When the user pivots to a project or topic not covered by the session-start memories, call `search_memories("<the new topic>")` before you respond.

## Trigger Words (instant save)
If the user says any of these: **bye, done, end, stop, exit, finish, closing, goodbye, that's all, wrap up, clear** — immediately save session state before responding:
1. `save_memory("Completed: [what was done this session]", topic="projects")`
2. `save_memory("[Project] current state: [exactly where it stands]", topic="projects", pinned=true)`
3. `save_memory("Next up: [what to do next]", topic="projects", pinned=true)`

## Save After Every Significant Action
Immediately after completing any of these, save a checkpoint:
- Fixed a bug · Built a feature · Made a technical decision · Pushed code · Deployed

`save_memory("[Project] Completed: [specific thing done]. Next: [logical next step]", topic="projects")`

## Checkpoint Every 5 Messages
Every 5 user messages, silently save:
`save_memory("[Project] checkpoint: [current state summary in one sentence]", topic="projects")`

## Context Switch Auto-Save
When the user switches files, tasks, or context — save:
`save_memory("[Project] context switch: [what was happening + current state]", topic="projects")`

## Always Auto-Save When You Learn
- Projects, deadlines, decisions, preferences, personal details, tech stack choices

## Behavior
- Never say "I'll remember that" — just silently call `save_memory` and continue.
- Never announce "loading memories" — just use them.
- Pin facts that are always relevant: name, main project, key preferences, next steps.

## MCP Config for VS Code (GitHub Copilot)
Add to `.vscode/mcp.json` in this project:
```json
{
  "servers": {
    "imprint": {
      "command": "node",
      "args": ["${workspaceFolder}/mcp/server.js"],
      "env": {
        "IMPRINT_USER_ID": "your-user-id",
        "IMPRINT_PLATFORM": "copilot"
      }
    }
  }
}
```
