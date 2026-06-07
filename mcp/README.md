# Imprint MCP Server

Gives **Claude Desktop** persistent memory backed by AWS DynamoDB.

## Setup

```bash
cd mcp && npm install
```

Add to `claude_desktop_config.json`:
- Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "imprint": {
      "command": "node",
      "args": ["C:/path/to/imprint/mcp/server.js"],
      "env": {
        "AWS_REGION": "us-east-1",
        "AWS_ACCESS_KEY_ID": "your-key",
        "AWS_SECRET_ACCESS_KEY": "your-secret",
        "DYNAMODB_MEMORIES_TABLE": "imprint-memories",
        "IMPRINT_USER_ID": "your-unique-user-id"
      }
    }
  }
}
```

Restart Claude Desktop. Done — Claude now has persistent memory.

## Tools

| Tool | Description |
|---|---|
| `get_memories` | Fetch all memories (call at session start) |
| `save_memory` | Save a new fact about the user |
| `search_memories` | Find specific memories by keyword |
| `delete_memory` | Forget something |
| `pin_memory` | Always inject into every session |

## Sync

Memories sync to your Imprint Dashboard at `https://imprint.vercel.app/dashboard`
