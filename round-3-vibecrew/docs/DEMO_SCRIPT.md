# Demo script — 2 minutes

## Current sample-only walkthrough

1. **Open (10 sec):** Visit https://glittery-trifle-03e3fd.netlify.app/ and choose **Explore the local sample preview**. Say the browser sample is synthetic; it demonstrates interaction, not shared account data.
2. **Coordinate (25 sec):** Open **Work queue**. Show task owners, priorities, acceptance checks and path-overlap advisory. Clarify that overlap is a coordination hint, not Git conflict prediction.
3. **Handoff (45 sec):** Open **Agent context** and select VBC-014. Show how one Markdown pack carries accepted decisions, task scope, dependencies, acceptance criteria and expected checks to a local IDE agent. Refresh the stale snapshot, then use Copy or Download.
4. **Be explicit (10 sec):** Sample identities, edits and context are browser-local and reset. The live Supabase and MCP services are deployed, but this walkthrough has not exercised real accounts or authenticated IDE calls.

## Real team workflow when signed in

1. Sign in via one-time email link; create a workspace/project and task plan.
2. Invite a teammate; each person signs in and creates their own personal MCP token.
3. Configure Codex with the remote endpoint, or Cursor with the local bridge, following `agent-kit/mcp/README.md`.
4. Call `get_project_context` with the project ID and `get_my_tasks` in the IDE. The IDE reads shared coordination data; code and agent execution remain local, and code moves through GitHub.

Do not describe the current sample preview as live cross-device sync. Do not claim authenticated MCP, invite redemption, or two-account RLS behavior until those flows are exercised with real accounts.
