# VibeCrew

**One engineering plan. One shared context. Many agents. One team.**

VibeCrew helps a distributed engineering team coordinate tasks, decisions, and coding-agent context across different local IDEs. The web app and database share coordination data. Each developer's code and coding agent stay on that developer's machine; GitHub remains the source of truth for code.

## Start here

**Live demo:** <https://glittery-trifle-03e3fd.netlify.app/>

There are two ways to enter the app:

- **Sign in** to use a persistent, shared Supabase workspace. Every teammate must sign in to the *same* workspace using an invitation link.
- **Explore the local sample preview** to click through synthetic example content. This preview is local to that browser, resets on reload, and does not sync with teammates.

For a real team demo, use sign-in and invitation links. Do not ask teammates to create separate workspaces; that gives each person a private workspace instead of a shared one.

## Join your team's shared workspace

### Organizer: create and invite

1. Open the live demo and enter your display name and email under **Sign in**.
2. Select **Email me a sign-in link**. Open the message and follow its one-time link back to VibeCrew. Check spam and allow a minute for delivery.
3. If this is the first account, complete **Create a workspace** with your team name and project name. The objective is optional. This creates the shared workspace, first project, and initial release checklist.
4. In the workspace, choose **Invite teammate**. Select **Member**, then **Create invitation link** and copy it immediately. The full link is shown only once, expires after seven days, and permits up to ten joins.
5. Send that link privately to the intended teammate. Anyone who has the link can use it until it expires or reaches its use limit.

### Teammate: join (do not create another workspace)

1. Open the organizer's invitation link. VibeCrew preserves the invite while the sign-in link completes.
2. Enter your own display name and email, request the one-time email link, then open it from the same browser/device.
3. On the workspace screen, enter your display name and choose **Join workspace**. If the invite did not remain in the form, paste the complete invite URL (or its 64-character code) into **Invitation code**.
4. Confirm that the organizer's workspace and project name appear. Both teammates should now see the same shared tasks, decisions, activity, and release checks.

Each person needs their own account. A teammate who signs in without an invitation and creates a workspace will be working in a separate team space; use **Sign out**, reopen the organizer's invitation URL, and join the intended workspace instead.

## Using the workspace

- **Overview:** See the project's objective, latest context revision, and coordination state.
- **Work queue:** Read task scope, priority, owner, dependencies, and acceptance/test checks. Claim or update work from the task controls. Avoid duplicate work by checking the shared owner/status first.
- **Decisions:** Owners/leads can propose and accept decisions. Accepted decisions advance the shared context revision so agents can see that their snapshots may be stale.
- **Agent context:** Select a task and copy/download a Markdown context pack for your local coding agent. Refresh it after decisions or task changes.
- **Release readiness:** Update shared release-check status and review evidence before the final handoff.
- **Team & Activity:** Review members and shared events. Owners/leads can create teammate invitations and personal IDE tokens.

The app reads current workspace data from Supabase. In a signed-in shared workspace it refreshes data about every five seconds while the page is visible, and refreshes immediately when the tab returns to the foreground or the browser reconnects. This is polling, not an instant push channel. Updates are stored remotely, but offline edits are not queued; wait for the connection to return, check the **Sync needs attention** notice, and retry any action that did not confirm success.

## What “sync” means (and does not mean)

**Shared and persistent:** workspace membership, projects, tasks, decisions, activity, and release-check status/evidence are stored in Supabase. Access is checked against workspace membership. A signed-in teammate in the same workspace can load those shared records on another device.

**Not shared by VibeCrew:** source files, terminals, IDE state, local agents, and Git branches. VibeCrew does not copy code between computers, edit files through MCP, or start/stop agents. Use a separate local clone of the GitHub repository and normal Git branches/pull requests to share code.

The local sample preview is deliberately separate: its sample names and tasks are synthetic and its edits are temporary. Seeing the sample board on two devices is not evidence of cross-device sync.

## Which MCP should a teammate add?

To read VibeCrew project context from an IDE, add the **VibeCrew MCP** endpoint shown below. Teammates do **not** need the Supabase MCP server to use the VibeCrew app or its IDE tools. The Supabase MCP is for project maintainers who need database administration, not ordinary team members.

The VibeCrew MCP currently provides two workspace-scoped, **read-only** tools:

- `get_project_context({ projectId })` — current objective, accepted decisions, task plan, team roles, release checks, revision, and recent activity.
- `get_my_tasks({})` — tasks assigned to the signed-in teammate who created the token.

Every teammate creates their own token. In VibeCrew, open **Team & Activity → IDE Connection**, create a token, and copy the raw value while its one-time dialog is open. Choose an expiry; tokens are workspace-scoped, stored as hashes, and can be revoked from that screen. Never share a token or commit it. Then add the server to the IDE.

### Codex (remote HTTP MCP)

1. In Windows, open **Edit environment variables for your account** and add a user variable named `VIBECREW_MCP_TOKEN` with your personal token as its value. Do not put the token in a project file or screenshot.
2. Add this to `%USERPROFILE%\.codex\config.toml` (create the file if it does not exist):

   ```toml
   [mcp_servers.vibecrew]
   url = "https://kmlzmgmpyajdtbrsxtoq.supabase.co/functions/v1/vibecrew-mcp"
   bearer_token_env_var = "VIBECREW_MCP_TOKEN"
   ```

3. Restart Codex. From the IDE Connection screen, copy the project ID. Ask Codex to call `get_project_context` with that ID, or `get_my_tasks` for your own queue.

### Cursor (local stdio bridge)

The local bridge runs on Node.js 20 or later and forwards to the same authenticated VibeCrew MCP endpoint.

1. Install Node.js 20+ if it is not already installed. In a terminal opened at the repository root, run:

   ```powershell
   npm install --prefix round-3-vibecrew/agent-kit/mcp
   ```

2. Add the same personal `VIBECREW_MCP_TOKEN` Windows user environment variable described above, then restart Cursor so it inherits the variable.
3. Create or update the global Cursor MCP file at `%USERPROFILE%\.cursor\mcp.json`. Replace the example path with the actual absolute path to `server.mjs` on your computer:

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

4. Restart Cursor and enable VibeCrew under **Settings → MCP**. Ask the agent to call `get_project_context` using the project ID shown in VibeCrew.

The bridge inherits the token from the IDE process environment; do not add the token to `mcp.json`. Other IDEs can connect directly if they support authenticated Streamable HTTP MCP, or use the local bridge if they require stdio. See [`agent-kit/mcp/README.md`](agent-kit/mcp/README.md) for additional notes.

## Run the frontend locally

From this folder, start a static server:

```powershell
python -m http.server 4178 --bind 127.0.0.1
```

Open <http://localhost:4178/> and keep the server terminal open. Stop it with `Ctrl+C`. No frontend build or package install is required. The Supabase browser SDK loads from jsDelivr, so hosted sign-in also needs internet access. For local email sign-in, add `http://localhost:4178/**` (and, if needed, `http://127.0.0.1:4178/**`) to the Supabase project's Auth redirect URL allowlist. The deployed Netlify origin is already allowlisted.

The static deployment must include these four files together: `index.html`, `styles.css`, `app.js`, and `supabase-config.js`. The ready-to-publish copy is in `dist/`. To refresh the existing Netlify site manually, publish the contents of that folder; do not publish only `app.js` because the page also needs its stylesheet and Supabase browser config. `supabase-config.js` contains only a public publishable key; never place a service-role/secret key in browser code.

## Common problems

- **A teammate sees a workspace-creation form:** they likely opened the public site without the invitation. Ask them to open the organizer's invite URL, sign in, and choose **Join workspace**. Do not create another workspace for them.
- **Sign-in link does not arrive:** check spam and wait briefly. Supabase's default email delivery can be rate-limited; the project owner may need to configure a verified mail sender. The redirect URL must match the site's origin.
- **“Could not load this workspace: column release_checks.created_at does not exist”:** this was caused by the UI ordering release checks by a column absent from the schema. The live table has `updated_at`; the loader has been corrected to order by that field. After the corrected static build is deployed, hard-refresh the page and sign in again. The MCP project-context query is corrected to use the same field.
- **MCP server is missing:** verify the personal token and endpoint, restart the IDE after changing the environment variable, and check that Codex has the TOML section or Cursor has valid JSON at the global `mcp.json` path. Revoke and re-create an expired or exposed token.
- **A change is not visible immediately:** confirm both people joined the same workspace and project, keep both pages online/visible, and allow up to five seconds for refresh. The MCP tools read fresh data on each call. Retry actions that did not show a success message.

## Current implementation and limits

- Static responsive HTML/CSS/JavaScript app with persistent light/dark preference.
- Supabase email one-time-link auth, workspace/project creation, invitation join, member-scoped data, and database role checks.
- Shared tasks, task status transitions with version checks, architecture decisions, activity, and release-check status updates.
- Client-generated task context pack, copy/download, stale-context indicators, and advisory path-overlap warnings.
- Supabase Edge Function MCP endpoint and Cursor/local-stdio bridge with personal expiring tokens.
- Not implemented: true realtime subscriptions, offline write queue, full task edit/delete, dependency editing/validation, PR metadata writes, GitHub OAuth/App writes, IDE writeback, or remote agent execution.

Authentication email delivery and two-person end-to-end sync still require testing by signing in with two real accounts and joining the same invitation. The database currently contains existing workspace/project records, but those counts do not prove that a given teammate can authenticate or share a workspace. See [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) for the current verification evidence and [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) for a presentation flow.

## Project map

- `index.html`, `styles.css`, `app.js` — frontend.
- `supabase-config.js` — public project URL and publishable key only.
- `supabase/migrations/` — local mirrors of migrations applied to the hosted Supabase project.
- `supabase/functions/vibecrew-mcp/` — remote MCP Edge Function.
- `agent-kit/mcp/` — local MCP bridge and tests.
- `docs/` — product, architecture, data, API, SDLC, demo, and test notes.
- `agent-kit/skills/vibecrew-team/SKILL.md` — portable contributor skill draft.

The parent Git repository is `E:\CODR\Hack\CodeRushHackathon`. Keep VibeCrew changes in `round-3-vibecrew/`; do not initialize a nested repository or edit earlier rounds as part of this project.
