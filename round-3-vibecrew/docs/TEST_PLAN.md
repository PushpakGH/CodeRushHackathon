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

## Live email delivery recovery

A real app sign-in request returned HTTP 504. Supabase custom Gmail SMTP was configured on port 564. Changed the port to 587 and observed the dashboard success confirmation. A fresh request for the authorized test address succeeded and the app displayed its inbox confirmation. Inbox receipt and redemption still require the user to open the private link. No SMTP password was read or changed.

## Authenticated live MCP check on 2026-11-14

Signed into the deployed app through a newly delivered email link for the explicitly authorized account. The account loaded its existing workspace and project. Created an approved temporary seven-day read-only token. Two independent stdio MCP clients both listed get_project_context and get_my_tasks and read the same live project context at revision 1. Context fingerprints matched after excluding the per-request generatedAt timestamp. These were two clients of one account, rather than two different user identities.

Revoked the temporary token through the app. The live MCP endpoint subsequently returned HTTP 401 for that credential. Removed its temporary local file. Existing user credentials were preserved.

## Live invitation creation on 2026-11-14

With explicit approval, created a Member invitation from the signed-in owner session. The form returned a nonempty invitation URL, enabled Copy link and displayed no error. Kept the bearer link private and closed its one-time output. The invite retains its normal seven-day / ten-use lifetime. A second account has not redeemed this invitation, so cross-identity joining remains unverified.

## Shared planning and scoped progress — 2026-11-14

Local build, two Chromium browser tests, PostgreSQL migration/authorization assertions, and MCP bridge tests pass. The context-editor browser test supplies a synthetic runtime state and verifies owner editing and member read-only rendering. It does not claim a live document was published.

The hosted context/progress schema was applied and rollback-only tests passed with actual auth.uid subject claims. Those tests cover empty workspace creation, publication revision and stale-version checks, denied member publication, denied read-only agent write, claimed task ownership and progress with expected versions.

Production replacement of the vibecrew-mcp Edge Function was rejected by automatic approval review pending explicit permission for that exact function deployment. Frontend release and live document-to-IDE/agent-write smoke checks await that coordinated rollout.

## Approved production rollout — 2026-11-14

After explicit approval, submitted the production vibecrew-mcp replacement. Browser automation disconnected during confirmation, so verified deployment through the public health response: HTTP 200 and all three tools including update_my_task. Netlify reported ready for b901de7 after the GitHub push.

The expanded context editor/member view and project-switch draft reset pass Chromium checks. The new scoped write path passes hosted rollback SQL tests and local bridge validation. A fresh authenticated browser-to-MCP progress-token check remains unverified because the browser transport disconnected. Existing production tokens remain read-only by default.
