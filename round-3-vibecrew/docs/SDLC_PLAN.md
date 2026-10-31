# SDLC plan and phase gates

The product lifecycle is explicit: **Discovery → Design → Ready → Implementation → Integration → Release**. The current UI displays the workflow and Supabase persists workspaces, tasks, decisions, activity, and release-check status. A read-only MCP layer lets local IDE agents read the current project plan and a contributor's task list. Brief approvals, dependency validation, GitHub integration metadata, release evidence, IDE writeback, and full gate enforcement remain future work.

| Phase | Required artifacts | Exit condition |
|---|---|---|
| Discovery | Problem, users, workaround, objective, journey, scope, assumptions, non-goals, risks, observable acceptance | Owner accepts the versioned brief |
| Design | Component/system overview, entities, API boundaries, auth/data isolation, failure cases, UI map, ADRs | Lead accepts core architecture and contracts |
| Ready | Small tasks with owner/unassigned state, dependencies, acceptance, test plan, branch, path scope | No unresolved cycle; each P0 task has accountable ownership or visible unassigned state |
| Implementation | Claim/update/block/complete, progress evidence, task context revision, stale warning | Vertical slices meet their acceptance checks |
| Integration | Branch, commit SHA, PR URL, reviewer, CI/review/merge metadata, blocker owner | Human review and CI policy are satisfied before recording merge |
| Release | Build, critical journey, env, deployment, smoke test, limits, rollback, handoff | Each checklist row has VERIFIED / FAILED / NOT TESTED plus evidence |

## Roles and route access (server-enforced target)

| Role | Allowed actions/data | Product areas |
|---|---|---|
| OWNER | Create workspace; invite members/reviewers; create tasks/decisions; accept decisions; update release-check status | All current app areas |
| LEAD | Owner-equivalent project management in database; no promotion UI exists | All current app areas |
| MEMBER | Read workspace; claim unassigned task; update own task; export context | Overview, queue, context, team, release read view |
| REVIEWER | Read workspace; update task status; export context | Overview, queue, context, team, release read view |

Membership and permission checks are enforced in RLS and database functions, not only by hiding controls. Lead promotion/removal is not available in the UI.

## Delivery order under a two-hour round

1. **Scope and service access (10 min):** confirm backend project and access; preserve 15–20 minutes for verification/demo.
2. **Schema and trust boundary (20 min):** migration, membership model, RLS, invitation design, auth setup.
3. **Vertical slice A (25 min):** owner creates workspace/project and second account joins via invite; verify tenant isolation.
4. **Vertical slice B (25 min):** brief/decision revision and task create/atomic claim with two sessions.
5. **Vertical slice C (20 min):** context pack, stale warning, activity/polling, path overlap.
6. **Integration (10 min):** manual PR metadata and release checklist.
7. **Protected close (15–20 min):** browser checks, mobile/desktop, deployment preview if already authorized/free, demo rehearsal, honest status.

The static client, schema, and read-only MCP endpoint are deployed to Supabase. The local stdio bridge passes a mock-server integration test; the real-user token path remains unverified until Auth is configured and a user signs in. Remaining integration work is the public frontend preview, Auth redirect/email delivery, two authenticated accounts, and RLS/conflict verification. If Auth is not ready, keep the demo on the labeled synthetic preview; do not call it distributed.
