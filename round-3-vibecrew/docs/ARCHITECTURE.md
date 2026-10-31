# Architecture

## Components and data flow

```text
Static browser client (HTML / CSS / JavaScript)
  ├─ Supabase Auth email OTP session
  ├─ Supabase REST reads/writes with publishable key + RLS
  └─ Scoped Postgres RPCs for workspace setup, invite join, task status,
     decision acceptance, and context refresh
             ↓ HTTPS
Supabase Auth + Postgres (project kmlzmgmpyajdtbrsxtoq, ap-south-1)
             ↑ per-user read-only MCP tools
Supabase Edge Function (vibecrew-mcp) — hashes/validates personal bearer token,
checks live workspace membership, and scopes each query to that workspace
             ↑ HTTPS Streamable HTTP
Codex remote MCP or local stdio bridge for Cursor and similar IDE clients

GitHub = code, branches, PRs, CI and merge source of truth
Developer machine = local repository, editor, tests and local coding agent
```

The browser is a view/cache, not the source of truth. The client can be hosted as static files; Supabase holds coordination data. A local synthetic preview remains available if the CDN/backend is unavailable. It is labeled and never written to the shared database.

## IDE context boundary

`vibecrew-mcp` offers only `get_project_context(projectId)` and `get_my_tasks()`. Tokens contain 256 bits of random material; only their SHA-256 hashes are stored. Each request checks token expiry/revocation and the token owner's current workspace membership. The service-role credential is server-side only. Queries explicitly constrain workspace and project; assigned-task reads constrain owner to the token user. Tokens are revocable and capped at 90 days.

The local stdio bridge sends the token over HTTPS and mirrors the two read tools into IDEs that use local MCP processes. It does not read local code, edit files, write to VibeCrew, or execute agents. Task status and code review metadata stay in VibeCrew UI/GitHub. A valid HTTP health response does not prove a real user's token or workspace data path; that needs authenticated testing.

## Route and role inventory

This is a single-page app with seven navigation areas. Auth/workspace setup is a separate state before the shared app shell; roles receive the same navigation, with allowed operations enforced by database policies/functions.

| Area | Owner/lead | Member | Reviewer |
|---|---|---|---|
| Overview | Read | Read | Read |
| Discovery/decisions | Propose/accept | Read | Read |
| Work queue | Create/assign/update | Claim unassigned/update own | Update task status |
| Agent context | Read/export/refresh | Read/export; refresh owned task | Read/export/refresh |
| Team/activity | Invite if manager; read members/events | Read | Read |
| Integration/release | Update release status | Read | Read |

`owner`, `lead`, `member`, and `reviewer` are database roles. Owners can invite member/reviewer roles; lead assignment, role promotion/removal, and project switching are not in the UI. Reviewers can update task status per the database function. UI visibility is not an access-control boundary.

## Data and invariants

Entities are `workspaces`, `workspace_members`, `projects`, `tasks`, `architecture_decisions`, `activity_events`, `release_checks`, and `workspace_invites`. Every exposed table has RLS enabled. Workspace-scoped reads require membership. Task status RPCs lock the task, check membership/role/owner and expected version, then increment version; claiming an unassigned task atomically assigns it to the signed-in user. Accepting a proposed decision checks manager role/version and increments the project context revision in the same transaction. Invite rows store only SHA-256 token hashes, with a seven-day expiry and ten-use cap; raw tokens exist only in the generated share link and client memory.

Client inputs are bounded before sending and database constraints repeat important limits. Workspace and project IDs from the client are untrusted; access is derived from `auth.uid()` and RLS. Security-definer RPCs have fixed search paths, membership/role checks, version checks, and no anonymous execute grants. Private RLS helper/trigger functions were moved into an unexposed schema. The Supabase advisor reports six signed-in `SECURITY DEFINER` RPCs as warnings by design; they are the scoped operations listed above.

## Operational behavior and failures

- Auth state controls the protected shell. Sign-out hides shared data and stops polling.
- Poll runs every five seconds only while visible; overlapping poll requests are suppressed. On sync failure, last data remains visible with a warning.
- Stale task/version mutations fail and show an error after reloading current data; the client does not queue privileged writes.
- Invalid, expired, revoked, or full invitations fail with a generic database error; membership is not disclosed to unauthenticated users.
- The Supabase CDN or service may be unreachable. The local preview remains available but does not share data.
- The UI can show a release check as verified without evidence; the check detail reminds users to attach proof in submission notes. Evidence editing is deferred.

## Trade-offs and deployment

- Kept the existing native static client; adding a framework/component package would add build/dependency work without improving the short demo slice.
- Used Supabase for managed Auth/Postgres/RLS rather than introducing a separate API service.
- Used five-second polling instead of Realtime; predictable and quick to implement for five teams.
- Preview hosting is expected to be static Netlify/Vercel, but no deployment is configured yet. Add the deployed origin to Supabase Auth Redirect URLs before testing email OTP there. AWS remains a later-round deployment target.
- The Supabase CLI was unavailable, so `supabase/migrations/` mirrors the exact migration versions reported by the hosted project. Verify with the CLI when it is installed.
