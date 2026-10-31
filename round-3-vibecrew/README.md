# VibeCrew

**One engineering plan. One shared context. Many agents. One team.**

VibeCrew is a coordination workspace for distributed engineering teams that use different local coding agents. GitHub remains the code source of truth; each developer's machine remains the place where code and agents run. This round uses a small static HTML/CSS/JavaScript client with Supabase Auth, Postgres, row-level security, and scoped database functions for shared coordination data.

## Run locally

From this folder, run:

```powershell
python -m http.server 4178 --bind 127.0.0.1
```

Open <http://localhost:4178/>. Keep the terminal open while using the preview; stop the server with `Ctrl+C`. No Node build or package install is required. The Supabase JavaScript client is loaded from jsDelivr, so live sign-in also needs internet access. If that script or the backend is unavailable, use **Explore the local sample preview**; preview edits are synthetic and reset on reload. Theme preference is stored locally.

## First shared workspace

1. Open **Sign in** and enter a display name and email. Supabase sends a one-time link; no email is submitted by this guide.
2. If the link is rejected, open Supabase Dashboard → Authentication → URL Configuration. Add the exact local origin/redirect and the eventual preview origin to Redirect URLs. For local work, use `http://localhost:4178/**` (and `http://127.0.0.1:4178/**` if needed). Email delivery can be rate-limited by Supabase's default sender; configure a verified sender if delivery is unavailable.
3. After sign-in, create a workspace and first project, or join using an invitation URL/code. Owners can create invitation links for **member** or **reviewer** roles. Links are bearer credentials: share only with intended teammates; they expire after 7 days and allow up to 10 joins.
4. To deploy a static preview, publish this folder as the site root on Netlify or another static host. Add its origin to Supabase Redirect URLs before testing email sign-in there. Do not use a service-role key in browser code.

The browser config in `supabase-config.js` contains only the project's public publishable key. Access control depends on the applied RLS policies and validated database functions. This is a hackathon demo backend, not a production security review.

## Current implementation

- Email one-time-link sign-in; workspace create/join and member-scoped reads.
- Shared task creation, assignment, status transitions with version checks, and a five-second refresh loop.
- Hashed invite tokens, database-checked workspace membership, proposed/accepted decisions with project revision updates, and release-check status updates.
- A client-generated Markdown context pack with copy/download, context staleness, and advisory path-overlap warnings.
- A separate local sample preview and persistent light/dark theme.

Not implemented: task edit/delete UI, dependency editing/validation, PR metadata updates, role promotion/removal, invite revocation UI, evidence editing for release checks, GitHub OAuth/App writes, agent execution, or real-time push subscriptions. Cross-account sign-in, email delivery, RLS isolation under two users, invite redemption, concurrent conflict behavior, and deployed sign-in are **not verified yet** because no user accounts have been exercised.

## Project map

- `index.html`, `styles.css`, `app.js` — responsive static client.
- `supabase-config.js` — URL and publishable key only.
- `supabase/migrations/` — local mirrors of migrations applied to project `kmlzmgmpyajdtbrsxtoq` (Supabase CLI was unavailable in the build environment).
- `docs/` — concise scope, design, architecture, API behavior, and check status.
- `agent-kit/skills/vibecrew-team/SKILL.md` — portable contributor skill draft.

The parent repository at `E:\CODR\Hack\CodeRushHackathon` owns Git. Keep this round's work in `round-3-vibecrew/`; do not initialize a nested repository or edit the earlier round folders as part of this project.
