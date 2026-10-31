# Product brief

## User and problem

Small distributed engineering teams use different local AI coding agents on separate machines. Decisions, task ownership, project context, and integration status get scattered across prompts and chats, causing duplicate work and stale assumptions. VibeCrew stores the shared coordination snapshot; it does not run agents or replace GitHub as the code source of truth.

## Primary journey

Owner signs in by email link → creates a workspace and project → invites teammates → creates scoped tasks with acceptance criteria → a teammate claims or updates assigned work → each contributor connects a local agent through MCP to read the same current project context → team proposes and accepts decisions → release owners track readiness.

**Demo moment:** two members should see the same accepted decision and task from separate sign-ins, then ask different local IDE agents for the same VibeCrew project context. That cross-account/MCP flow is the intended demo but has not been exercised with real user accounts yet.

## Scope

### P0 — implemented in the client/schema

- Email OTP sign-in flow and workspace creation/join UI.
- Workspace/project/task/decision/activity/release-check reads scoped by RLS.
- Hashed invite tokens, 7-day expiration and 10-use cap.
- Task creation and atomic status update with row version checks; member may claim unassigned work and update owned tasks; owner/lead/reviewer can update status.
- Decision proposal and owner/lead acceptance with project context revision increment.
- Client-built context Markdown copy/download, stale revision indicator, path-overlap warning, local preview mode, dark/light theme.
- Remote, read-only MCP access for each contributor's local coding agent: fetch current project context or the caller's assigned tasks through a workspace-scoped personal token.
- Five-second polling while the app is visible.

### P1 — deferred

- Realtime subscriptions, editable dependencies, PR metadata, evidence editing, invite revocation, member role management, integration automation, and clearer workspace/project switching.

### P2 — out of scope

- Native IDE extensions, IDE writeback, remote agent execution, shared editor, GitHub App writes/auto-merge, chat/video, enterprise SSO, paid AI behavior, and production hosting/data. MCP is the provider-neutral bridge between shared planning data and local agents.

## Roles and boundaries

| Role | Intended actions | App areas |
|---|---|---|
| Owner | Create workspace; invite members/reviewers; create tasks/decisions; accept decisions; update release status | All areas |
| Lead | Same project management actions as owner | All areas (lead promotion is not available in the UI) |
| Member | Read shared project; claim unassigned task; update their own task; read/export context | Overview, queue, context, team, release |
| Reviewer | Read shared project; update task status; read/export context | Overview, queue, context, team, release |

The database enforces membership and manager/owner checks. Client-side hidden/disabled controls are convenience only. Invite links currently create member or reviewer access; role promotion/removal is not provided.

## Acceptance and verification status

| Acceptance | Status |
|---|---|
| Static client opens and sample preview renders | Verified locally in the in-app browser |
| New account can sign in and receive email link | Not tested; no user email submitted |
| Owner can create workspace and project | Wired to database RPC; not tested with an authenticated user |
| Members share persisted data and outside users are isolated | Schema/RLS applied; two-account runtime test not run |
| Task status update rejects stale version and enforces role/ownership | Database RPC implemented; concurrency/authorization runtime tests not run |
| Invite redemption works, including expired/full/invalid cases | Database checks implemented; runtime test not run |
| Decision acceptance updates revision atomically | Database RPC implemented; runtime test not run |
| MCP stdio bridge exposes only two read tools and forwards an authenticated call | Verified with a local MCP integration test |
| Deployed MCP health works and unauthenticated tools/list is rejected | Verified: health 200; tools/list 401 |
| A real user token can read a workspace project over MCP | Not tested; no authenticated account/token exists yet |
| Phone/tablet/desktop visual behavior | Phone view observed; tablet and desktop views not yet observed |
| Public deployment and email redirect | Not run |

## Assumptions, risks, and limits

- Supabase project `kmlzmgmpyajdtbrsxtoq` in `ap-south-1` was created in PushpakGH's organization at an approved quote of $0/month.
- Only the publishable key is in the client. Security relies on reviewed RLS and database functions; the six Supabase advisor warnings are for intentional authenticated `SECURITY DEFINER` RPCs that validate session, membership, role, and versions.
- Supabase Auth email delivery and allowed redirect origins still need dashboard configuration and a real end-to-end sign-in check.
- MCP shares coordination context only. It cannot inspect or synchronize local files, write task updates, or execute agents; GitHub remains the code source of truth.
- The hosted MCP endpoint is live; the static frontend preview deployment and email sign-in are not yet complete.
- No external GitHub actions, factual outcome metrics, or real user content are fabricated.
