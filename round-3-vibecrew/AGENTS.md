# VibeCrew project instructions

- Keep this round's code and docs inside `round-3-vibecrew/`; the parent repository owns Git. Never initialize a nested repository or edit earlier round folders as part of this project.
- Shared mode uses Supabase Auth, Postgres, RLS, and scoped database functions. `supabase-config.js` may contain only the project URL and public publishable key. Never add service-role credentials to browser code or Git.
- The local sample preview uses synthetic in-memory data and is labeled; it is not shared and resets on reload. Do not claim Auth, email delivery, cross-device behavior, or tenant isolation as tested until observed with real sessions.
- Keep role, membership, resource, and version checks in RLS/database functions. UI visibility is not authorization. Task path overlap is an advisory heuristic, not proof of a Git conflict.
- Preserve existing files and changes. Inspect `git status` before Git operations, stage only VibeCrew paths, review the staged diff, and do not force-push or push the default branch.
- Prefer semantic controls, keyboard access, visible focus, reduced motion, truthful states, and phone/tablet/desktop layouts. Inspect rendered views before claiming visual verification.
- Update `docs/` and local migration mirrors when the schema or behavior changes. Keep unverified acceptance criteria marked **NOT TESTED**.
