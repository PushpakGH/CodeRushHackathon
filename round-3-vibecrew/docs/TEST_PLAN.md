# Verification status

**Checked on 2026-10-31.** Status vocabulary: **VERIFIED** means the named observable check passed. **NOT TESTED** means no evidence from the required user flow is available.

| Gate | Status | Evidence / remaining work |
|---|---|---|
| Root cause | VERIFIED | Supabase logs showed PostgREST requests ordering `release_checks` by nonexistent `created_at`; the resulting reads returned HTTP 400. |
| Live schema | VERIFIED | Live `public.release_checks` columns include `updated_at` and do not include `created_at`. |
| Corrected ordering query | VERIFIED | The live table returned its existing 28 rows when ordered by `updated_at`; all 28 have a timestamp. |
| Workspace/project data present | VERIFIED | Live aggregate query returned 4 workspaces, 4 projects, 4 members, and 28 release checks. These counts do not verify who can sign in or whether the members are on one team. |
| Frontend workspace loader fix | VERIFIED LOCALLY | Source and static deployment copy sort release checks by `updated_at`. The Netlify static bundle still needs to be published before the shared site receives this change. |
| MCP context query fix | DEPLOYED | The `vibecrew-mcp` Edge Function redeployed successfully as active version 2 with the corrected query. Authenticated tool-call verification remains. |
| Local preview | VERIFIED | `http://127.0.0.1:4178/` and `/app.js` both returned HTTP 200; the fresh local app rendered the sign-in screen and entered the sample workspace. |
| CSS/HTML static assets | PREVIOUSLY VERIFIED | The Netlify preview loaded styles and rendered the application in the prior release check. Recheck after publishing this change. |
| JS syntax | VERIFIED | `node --check` passed for `app.js` and the MCP bridge server. |
| MCP bridge tests | VERIFIED | `npm test --prefix round-3-vibecrew/agent-kit/mcp`: 1 passed, 0 failed (run with local-loopback permission because the sandbox blocks the test server). |
| Email sign-in and workspace create/join | NOT TESTED IN THIS TURN | No inbox link was opened in a real account during this verification. |
| Two-account sync and RLS isolation | NOT TESTED | Requires two real signed-in accounts in one shared workspace; the synthetic sample is not evidence. |
| Authenticated MCP tool calls | NOT TESTED | Requires a real personal token and project ID from an authenticated workspace. |
| Supabase security advisor | REVIEWED | Six warnings remain for authenticated `SECURITY DEFINER` workflow RPCs and one for leaked-password protection; review before production use. |

## Regression steps after deploying

1. Hard-refresh the Netlify site so the browser loads the corrected `app.js`.
2. Sign in with an existing account that has a workspace. Confirm that the workspace opens and the release checklist renders.
3. Sign in with the organizer account in one browser, create an invitation, and join from a second account/browser. Confirm the second account joins the same workspace (same workspace/project names).
4. Update one low-risk task status in browser A. In browser B, wait up to five seconds and verify the new status appears. Do not use local sample preview for this test.
5. Create a personal MCP token for the second account. Call `get_project_context` with the project's ID; verify it returns current shared data. Revoke the token after testing if it is no longer needed.

The SQL query used to verify the active schema/data without exposing user email addresses was:

```sql
select
  (select count(*) from public.workspaces) as workspaces,
  (select count(*) from public.projects) as projects,
  (select count(*) from public.workspace_members) as members,
  (select count(*) from public.release_checks) as release_checks;
```

The ordering query used by the application is `select * from public.release_checks where project_id = ... order by updated_at asc`.

## Local verification on 2026-11-13

- npm test applies all migrations to a temporary PostgreSQL 16 container with networking disabled. Authenticated role and RLS are enabled for the workflow assertions. It verifies evidence submission, invalid PR rejection, denied self-approval, owner approval, duplicate approval rejection, revision publication and outsider denial. This uses a test auth.uid implementation, rather than Supabase email sessions.
- npm run test:browser uses Chromium at 390, 820 and 1440 pixels. It enters the synthetic sample and checks actual visibility for tasks, context, team and overview, horizontal overflow and browser exceptions. Task-board screenshots are written to ignored test-results. These checks do not exercise live review submission.
- npm run build checks TypeScript and builds the deployable frontend.
- Still required before hosted release: apply the new migration, deploy the MCP function, and verify real sign-in, invitation, review submission and publication using two browser identities and two personal MCP tokens. No authenticated Supabase management connection or deployment credentials were available in this session.

## Hosted backend verification on 2026-11-13

Applied 20261113000100_feature_review.sql through the authenticated project SQL editor inside a transaction. The live REST endpoint now returns permission denied to an unauthenticated request, replacing the previous function-not-found error. Deployed the repository MCP function source through the dashboard and observed the updated deployment timestamp.

Changed Auth Site URL to https://binaryowl-vibecrew.netlify.app/ and added that exact redirect while preserving the existing allow-list entry.

Ran the review SQL assertions against hosted Postgres with actual auth.uid JWT subject settings and authenticated role. All assertions succeeded and synthetic users, workspaces, tasks and activity were rolled back. This verifies hosted database role enforcement and publication semantics, rather than email delivery or browser/IDE sessions.

Still awaiting a real app sign-in for end-to-end invitation, browser convergence and two independently authenticated MCP clients. Dashboard sign-in and app sign-in are separate sessions.
