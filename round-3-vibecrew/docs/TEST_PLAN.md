# Verification status

Status vocabulary: **VERIFIED** means observed running or returned by a check; **NOT TESTED** means no evidence yet.

| Gate | Status | Evidence / remaining work |
|---|---|---|
| Deployed frontend | VERIFIED | https://glittery-trifle-03e3fd.netlify.app/ loads the VibeCrew sign-in page and app shell |
| Hosted CSS and UI script | VERIFIED | `styles.css` is loaded; the sample board and Agent Context route render and respond |
| Sample work queue/context pack | VERIFIED | Opened queue, reviewed overlap warnings, generated and refreshed a synthetic task context pack |
| Responsive overflow | VERIFIED | Prior local checks at 375, 768 and 1280 px had no horizontal overflow; deployed app also had none at observed width |
| Supabase schema | VERIFIED | Five remote migrations are applied through `20261031112816`; all 8 public tables have RLS enabled |
| Supabase MCP endpoint | VERIFIED | Health returns 200 and lists `get_project_context`, `get_my_tasks`; unauthenticated request returns 401 |
| Local stdio MCP bridge | VERIFIED | `npm test --prefix agent-kit/mcp`: 1 passed, 0 failed (loopback permission granted for this test) |
| Auth redirect for Netlify preview | VERIFIED | Exact `https://glittery-trifle-03e3fd.netlify.app/` origin is allowlisted |
| Syntax/diff hygiene | VERIFIED | `node --check` for app and bridge; `git diff --check` passed |
| Real email sign-in/shared workspace | NOT TESTED | User selected sample-only verification; no one-time email was sent |
| Real database records | NOT TESTED | At check time: 0 workspaces, projects, tasks and agent tokens |
| Authenticated MCP calls | NOT TESTED | Requires real account, workspace, personal token and project ID |
| Two-account sync and RLS isolation | NOT TESTED | Needs two real accounts and membership tests |
| Supabase security advisor | REVIEWED | Six warnings remain for authenticated SECURITY DEFINER workflow RPCs; review the underlying function scoping before production use |

## Demo path

1. Open the Netlify URL and choose **Explore the local sample preview**.
2. In **Work queue**, show task ownership, acceptance checks, and advisory path overlap. Explain that overlaps are hints, not Git conflict detection.
3. Open **Agent context**, select a task, and show the generated `VIBECREW_CONTEXT.md` with decisions, task scope, acceptance criteria and expected checks. Refresh it to clear the stale snapshot indicator; copy or download it.
4. State that sample edits are synthetic and local to that browser session. They do not show cross-device sharing or authenticated IDE access.

For a real team demo, sign in, create a workspace/project and tasks, invite a second account, create an individual MCP token, then configure Codex or Cursor using `agent-kit/mcp/README.md`. The IDE tools are read-only; code stays local and goes through GitHub.
