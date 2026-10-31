# Data model — applied to Supabase

Schema definitions are in `supabase/migrations/`. All eight exposed public tables have RLS enabled; the live project currently has zero user rows.

| Table | Important fields and constraints |
|---|---|
| `workspaces` | Name (2–80 chars), creator, timestamp |
| `workspace_members` | Workspace/user composite key, display name (1–48), owner/lead/member/reviewer role |
| `projects` | Workspace, name, objective (≤2,000), repository URL, lifecycle stage, context revision ≥1 |
| `tasks` | Project, unique task key, title (1–90), bounded description/scope/dependencies/criteria, constrained status/priority, owner, expected version |
| `architecture_decisions` | Project/key, bounded context/decision/consequence, status, version, author/approver |
| `activity_events` | Project, actor, type, entity, bounded summary, timestamp; append-only to clients |
| `release_checks` | Project/key/title/detail, NOT_TESTED/VERIFIED/FAILED status, optional evidence, updater |
| `workspace_invites` | Workspace, unique 64-hex SHA-256 token hash, member/reviewer role, expiry, usage cap/count, revocation time |

## Access and invariants

- A signed-in owner creates the workspace, owner membership, first project, and release-check starter rows in one transaction.
- Every project/task/decision/activity/release read is scoped to current membership through RLS. Workspace membership rows are readable only by another member of that workspace.
- Direct invite-table access is denied. Only manager-checked create-invite and token-hash join functions can issue/use invitations. Joins serialize use-count updates and reject expired/revoked/full links.
- Task status changes use a row lock and expected-version check, then update status/assignment/version atomically. A member can claim an unassigned task or update a task they own; managers/reviewers can update status.
- Accepting a proposed decision locks and version-checks the row, records approver/time, and increments project `context_revision` in one transaction.
- An unexposed `private` schema holds RLS helper and trigger functions. Public RPCs use locked `search_path`, validate signed-in identity, membership, role, and input constraints, and have no anon execute grants.
- Indexes cover workspace/member lookups, project/status/owner tasks, decision status, activity chronology, invite expiry, and referenced creator/owner/actor/approver columns.

Retention/deletion policy and a member removal flow are not implemented. This is a hackathon schema; do not store source code, prompt transcripts, service secrets, or sensitive personal information in it.
