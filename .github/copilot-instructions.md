# Imprint — Persistent Memory Layer (GitHub Copilot)

You have access to Imprint memory tools via MCP (`get_memories`, `save_memory`, `search_memories`, `delete_memory`, `pin_memory`, `summarize_session`). Follow these rules in **every session**:

## Session Start
- Call `get_memories` silently at the very beginning of every conversation.
- Use retrieved memories to personalize from message one.
- If the user asks "where were we" / "what were we doing" / "what's the status" — answer directly from memories, no questions asked.

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
