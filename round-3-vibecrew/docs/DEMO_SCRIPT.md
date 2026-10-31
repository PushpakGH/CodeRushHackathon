# VibeCrew demo script

## Best team demo: shared workflow (2–3 minutes)

Use two accounts already joined to the same workspace. Do not use the local sample preview for this story.

1. **Open the shared plan:** show the workspace/project, current objective, and task list in browser A.
2. **Handoff:** open **Agent context**, choose a task, and point out the scope, dependencies, acceptance checks, and current decision revision. Explain that an IDE MCP call reads the same shared plan.
3. **Show cross-account sync:** in browser A, change one task's status. In browser B, wait up to five seconds for the same task update. This is database polling, not live file transfer.
4. **Show the IDE connection:** use the teammate's own token to call `get_project_context` with the project's ID. Show its read-only context output.
5. **State the code boundary:** code stays on each developer's device and moves through GitHub branches/pull requests. VibeCrew does not write files or run agents remotely.

If a second signed-in account is unavailable, demonstrate the sample preview only and label its content synthetic/local. Do not present it as shared sync or claim two-account behavior is verified.

## Sample-only walkthrough

1. Open <https://glittery-trifle-03e3fd.netlify.app/> and select **Explore the local sample preview**.
2. In **Work queue**, show task owners, acceptance checks, and the path-overlap advisory. Explain that overlap is a hint, not Git conflict detection.
3. Open **Agent context**, select a task, and show how the Markdown pack contains the task scope, dependencies, acceptance criteria, and expected checks. Refresh it and use Copy or Download.
4. State clearly that sample identities/edits are synthetic and not persistent across refreshes.
