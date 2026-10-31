# Implemented Supabase client contract

The browser uses `@supabase/supabase-js` with the project URL and publishable key from `supabase-config.js`. A valid Auth session is required for shared operations. RLS scopes direct table access; database functions check identity, membership, role, input, and expected versions. Supabase/Postgres errors are shown as short user-facing messages; the client does not use a service-role key.

| User operation | Supabase contract | Behavior |
|---|---|---|
| Email sign-in | `auth.signInWithOtp({ email, options: { emailRedirectTo, data } })` | Sends one-time link; delivery and redirect allowlist need user/dashboard verification |
| Find memberships | `workspace_members.select(...).eq('user_id', auth.uid())` | RLS returns only memberships accessible to current user |
| Create workspace/project | `rpc('create_workspace', { p_workspace_name, p_project_name, p_objective, p_display_name })` | Returns `workspace_id`, `project_id`; also creates owner and default release checks |
| Read shared project | Select `workspaces`, `projects`, `workspace_members`, `tasks`, `architecture_decisions`, `activity_events`, `release_checks` | RLS applies to each query; client requests current workspace/project only |
| Create invite | `rpc('create_workspace_invite', { p_workspace_id, p_token_hash, p_role })` | Returns expiry and max uses; raw 32-byte random token is never stored in database |
| Join invite | `rpc('join_workspace', { p_token_hash, p_display_name })` | Returns workspace/project IDs and `already_member`; locked, bounded invite use |
| Create task | Insert into `tasks` with project/title/description/status/priority/owner/scope/acceptance/test plan/creator | Owner/lead RLS; title required and bounded; optional suggested branch update follows insert |
| Change task status/claim | `rpc('update_task_status', { p_task_id, p_status, p_expected_version })` | Atomic row lock; only allowed member/owner/reviewer path; increments version; conflicting versions fail |
| Propose decision | Insert into `architecture_decisions` with current project and authenticated author | Owner/lead RLS, DB constraints on fields |
| Accept decision | `rpc('accept_decision', { p_decision_id, p_expected_version })` | Manager-only and version-checked; updates decision and project context revision atomically |
| Refresh task context | `rpc('refresh_task_context', { p_task_id, p_expected_version })` | Member/manager rules and expected version; records current context revision |
| Update release status | Update `release_checks` status/updater/timestamp for current project | Owner/lead RLS; evidence field exists but the current UI does not edit it |

## MCP contract (deployed)

Endpoint: `https://kmlzmgmpyajdtbrsxtoq.supabase.co/functions/v1/vibecrew-mcp`. The Edge Function validates `Authorization: Bearer vbc_live_<random>` by hashing it and looking up an active personal token. It checks expiry, revocation, and current membership for every request; invalid/missing credentials receive HTTP 401 before MCP tools are served.

| Tool | Input | Returned data | Boundary |
|---|---|---|---|
| `get_project_context` | `{ projectId: UUID }` | Current project objective/revision, accepted decisions, up to 100 tasks with acceptance/test plan and scope, team roles, release checks, and recent activity | Project must belong to the token's workspace |
| `get_my_tasks` | `{}` | Up to 100 tasks assigned to the token owner across workspace projects | `owner_id` is the token's user ID |

There are no MCP write tools, local file tools, prompts, or agent execution endpoints. Codex can use the remote HTTP endpoint; Cursor and similar local-stdio clients use the bridge documented at `agent-kit/mcp/README.md`. The stdio bridge was verified with a mock MCP endpoint; authenticated calls against the deployed Supabase data path still require a real user and token.

## Known contract gaps

No brief editing, project switching UI, task editing/deletion, dependency mutation, PR metadata API, role promotion/removal, invite revocation, or release evidence editing exists. The app has a sample-only local preview. MCP task writeback is intentionally deferred; updates remain in the VibeCrew UI. Realtime, pagination, request IDs, custom API rate limits, and richer retry/backoff are deferred. Shared/authenticated success and failure behavior remains unverified until a user signs in and uses a workspace.
