# Product brief

## User and problem

Small distributed engineering teams use different local AI coding agents on separate machines. Decisions, task ownership, project context, and integration status get scattered across prompts and chats, causing duplicate work and stale assumptions. VibeCrew stores the shared coordination snapshot; it does not run agents or replace GitHub as the code source of truth.

## Primary journey

Owner signs in by email link → creates a workspace and project → invites teammates → creates scoped tasks with acceptance criteria → a teammate claims or updates assigned work → contributor exports a current Markdown context pack → team proposes and accepts decisions → release owners track readiness.

**Demo moment:** two members should see the same accepted decision, assigned task, revision, and activity after separate sign-ins. That cross-account flow is the intended demo but has not been exercised yet.

## Scope

### P0 — implemented in the client/schema

- Email OTP sign-in flow and workspace creation/join UI.
- Workspace/project/task/decision/activity/release-check reads scoped by RLS.
- Hashed invite tokens, 7-day expiration and 10-use cap.
- Task creation and atomic status update with row version checks; member may claim unassigned work and update owned tasks; owner/lead/reviewer can update status.
- Decision proposal and owner/lead acceptance with project context revision increment.
- Client-built context Markdown copy/download, stale revision indicator, path-overlap warning, local preview mode, dark/light theme.
- Five-second polling while the app is visible.

### P1 — deferred

- Realtime subscriptions, editable dependencies, PR metadata, evidence editing, invite revocation, member role management, integration automation, and clearer workspace/project switching.

### P2 — out of scope

- IDE extensions, remote agent execution, shared editor, GitHub App writes/auto-merge, chat/video, enterprise SSO, paid AI behavior, and production hosting/data.

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
| Phone/tablet/desktop visual behavior | Phone view observed; tablet and desktop views not yet observed |
| Public deployment and email redirect | Not run |

## Assumptions, risks, and limits

- Supabase project `kmlzmgmpyajdtbrsxtoq` in `ap-south-1` was created in PushpakGH's organization at an approved quote of $0/month.
- Only the publishable key is in the client. Security relies on reviewed RLS and database functions; the six Supabase advisor warnings are for intentional authenticated `SECURITY DEFINER` RPCs that validate session, membership, role, and versions.
- Supabase Auth email delivery and allowed redirect origins still need dashboard configuration and a real end-to-end sign-in check.
- Current local UI is served from an already running static server at port 4178. No preview hosting has been configured.
- No external GitHub actions, factual outcome metrics, or real user content are fabricated.
