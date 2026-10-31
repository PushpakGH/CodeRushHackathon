# Verification status

Status vocabulary: **VERIFIED** means observed in an actual running app or relevant check; **FAILED** means attempted and broken; **NOT TESTED** means no evidence yet.

| Gate | Status | Evidence / remaining work |
|---|---|---|
| JavaScript syntax | VERIFIED | `node --check round-3-vibecrew/app.js` exits 0 |
| Static server and entry route | VERIFIED | `http://localhost:4178/` is open in the in-app browser and renders the sign-in screen |
| Local sample preview and task board | VERIFIED | Opened the preview; board, task cards, and mobile navigation rendered |
| Auth screen | VERIFIED | Supabase-backed email OTP form rendered; no email was submitted |
| Phone visual layout | VERIFIED | In-app browser screenshot at 375 px wide; no visible horizontal overflow in the task board |
| Tablet and desktop layout | NOT TESTED | The current browser control surface did not provide a viewport override |
| Create/join workspace with real Auth session | NOT TESTED | Needs user email sign-in and Auth redirect/email setup |
| Shared task/decision/release writes | NOT TESTED | Needs authenticated owner account |
| Invalid/expired/full invite and double-claim conflict | NOT TESTED | Database functions contain checks; no runtime user sessions to exercise them |
| Cross-workspace RLS isolation | NOT TESTED | Tables show RLS enabled; needs two accounts/workspaces and direct unauthorized-read verification |
| Supabase schema/migrations | VERIFIED | Remote migration list shows `20261031104215` and `20261031104310`; all 8 public tables report RLS enabled |
| Supabase security advisor | REVIEWED | Six warnings are scoped signed-in `SECURITY DEFINER` RPCs; no anonymous execute warning in current advisor output |
| Build/lint/test suites | NOT APPLICABLE | Plain static HTML/CSS/JS project has no package manifest or configured build/test scripts |
| Preview deployment and deployed sign-in | NOT RUN | No hosting provider deployed/configured |

## Before judging

1. Configure Supabase Auth Site URL and Redirect URLs for the actual deployed origin; test email delivery.
2. Sign in as an owner; create a workspace and task; invite a separate account as member; verify shared data and task claim.
3. Try the same task from two sessions and confirm the stale second update is rejected and refreshed.
4. Confirm another account with no membership cannot read or mutate the workspace; leave all unauthorized attempts unrecorded as successful.
5. Verify invite expiry/cap by inspecting database behavior or dedicated test data, not a real teammate's live invite.
6. Inspect phone, tablet, and desktop after deployment and verify context export and essential keyboard flows.
7. Keep all release checks as **NOT TESTED** until evidence is captured; recording status alone does not constitute proof.
