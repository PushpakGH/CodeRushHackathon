# Connect a local coding agent to VibeCrew

VibeCrew shares project coordination context with IDE agents through MCP. Each contributor's editor, repository, code, and agent stay on that contributor's machine. GitHub remains the source of truth for code.

The remote endpoint is:

```text
https://kmlzmgmpyajdtbrsxtoq.supabase.co/functions/v1/vibecrew-mcp
```

It currently exposes two **read-only** tools:

- `get_project_context({ projectId })` — objective, accepted decisions, task plan and acceptance checks, team roles, release checks, revision, and recent activity for a project in the token's workspace.
- `get_my_tasks({})` — tasks assigned to the teammate who created the token.

Every IDE connection needs its own personal token. Tokens are workspace scoped, expire after 7, 30, or 90 days, are stored as SHA-256 hashes, and can be revoked from **Team & Activity → IDE Connection**. The raw token is shown once. Do not put it in Git, a shared project MCP file, screenshots, or chat.

## 1. Create a VibeCrew token

1. Open the deployed VibeCrew site or serve the static app locally as described in the project README.
2. Sign in with the email link, create or join the shared workspace, and open **Team & Activity → IDE Connection**.
3. Create one token for this IDE and copy it while the one-time dialog is open.
4. Copy the **MCP endpoint** and **Project ID** shown below the setup instructions.

Each teammate repeats these steps with their own VibeCrew account. Never reuse one teammate's token for the whole team.

## 2. Store the token as a Windows user environment variable

Create a user variable named `VIBECREW_MCP_TOKEN` in **Edit environment variables for your account** and paste the one-time token as its value. Do not commit this value or add it to a repository `.env` file. Restart the IDE after saving it so the MCP process inherits the new variable.

## 3A. Codex: use the remote endpoint directly

Add this to `%USERPROFILE%\.codex\config.toml` (or add the same server from Codex MCP settings):

```toml
[mcp_servers.vibecrew]
url = "https://kmlzmgmpyajdtbrsxtoq.supabase.co/functions/v1/vibecrew-mcp"
bearer_token_env_var = "VIBECREW_MCP_TOKEN"
```

Restart Codex. In a chat, ask it to call `get_project_context` with the copied project ID, or `get_my_tasks` for the current user's queue.

## 3B. Cursor or another local-stdio MCP client

The local bridge forwards only the two tools above to the authenticated remote VibeCrew endpoint. From the repository root, install its small Node dependencies:

```powershell
npm install --prefix round-3-vibecrew/agent-kit/mcp
```

Create a **user-level** `mcp.json` in Cursor's global MCP configuration location, or register the equivalent command in the IDE's MCP settings. Use the exact absolute path to `server.mjs` on your machine:

```json
{
  "mcpServers": {
    "vibecrew": {
      "command": "node",
      "args": ["E:/CODR/Hack/CodeRushHackathon/round-3-vibecrew/agent-kit/mcp/server.mjs"],
      "env": {
        "VIBECREW_MCP_URL": "https://kmlzmgmpyajdtbrsxtoq.supabase.co/functions/v1/vibecrew-mcp"
      }
    }
  }
}
```

The bridge inherits `VIBECREW_MCP_TOKEN` from the IDE process environment; the secret is intentionally absent from the JSON example. Restart the IDE, enable the VibeCrew server, then ask the agent to use `get_project_context` with the copied project ID or `get_my_tasks`.

## Limits

- This is context and task-plan sharing, not live file synchronization. Every contributor still edits and runs code locally; use branches and pull requests in GitHub to combine code.
- Tools do not write VibeCrew records, edit files, or start/stop agents. Update task status in the VibeCrew UI.
- Workspace membership and token expiry/revocation are checked on every remote request. Authenticated calls against a real user/workspace still need an end-to-end sign-in test.
- Do not send credentials or sensitive code in task descriptions; MCP returns the coordination text stored in that workspace.
