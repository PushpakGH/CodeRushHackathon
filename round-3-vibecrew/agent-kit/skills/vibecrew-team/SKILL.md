---
name: vibecrew-team
description: Follow an accepted VibeCrew project context, task assignment, ownership scope, and team Git workflow when implementing work in a local repository.
---

# VibeCrew team workflow

Use this skill when a VibeCrew project context pack or task assignment is supplied.

1. Read the supplied `VIBECREW_CONTEXT.md` or pasted task pack first. Note project/task ID, owner, accepted context revision, dependencies, branch, declared file scope, acceptance criteria, and expected checks.
2. Read the target repository's `AGENTS.md` and other contributor instructions. Inspect `git status --short --branch` before editing; preserve existing user changes and local data.
3. If the pack is marked stale or its revision conflicts with an accepted decision in the repository, ask the developer to refresh the pack before changing architecture/API assumptions.
4. Confirm the task is assigned to you or intentionally unassigned/claimable. Do not claim another person's task. Check declared path ownership and advisory overlaps with teammates before editing shared areas.
5. Work inside the declared task scope. Coordinate a scope change with the team; do not silently expand the assignment.
6. Implement a small vertical slice and run the task's expected checks plus relevant repository checks. Inspect the diff for secrets, unrelated edits, and generated files.
7. Commit a coherent change on the team's agreed short-lived branch. Push only that branch when the user/team has authorized it. Open a normal pull request and request human review; never auto-merge, force-push, bypass checks, or discard someone else's work.
8. Report the exact task ID, files changed, commands run and outcomes, remaining risks, branch/commit/PR evidence, and any blocker. Update VibeCrew progress with evidence; do not say a remote agent ran or a task is complete without confirmation.

Path reservations and overlap warnings are advisory. They can reduce accidental contention but do not prove a Git conflict has happened or guarantee one will not happen. Never expose secrets, access tokens, personal credentials, or private data in a context pack, commit, screenshot, or log.
