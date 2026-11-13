# Frontend migration plan

## Goal

Move VibeCrew to a modern React frontend without changing the rendered design, route names, copy, Supabase schema/RPC contracts, role rules, or MCP behavior.

## Current pass

- **Done:** Vite production build, React 19 + TypeScript root, bundled Supabase JS client, Redux Toolkit theme state, TanStack Query workspace read cache, React-rendered existing shell markup, React invite dialog, targeted invite-dialog wrapping/spacing, Netlify build output configuration.
- **Preserved for compatibility:** Existing Supabase auth/workspace/task/decision/token workflows and their selectors/event handlers remain in `app.js` while the shell is rendered by React.
- **Not complete:** Moving the remaining forms, route views, task/decision/release renderers, and action handlers into typed React components/hooks. Do not describe the frontend as fully converted until those compatibility handlers are removed.

## Safe completion sequence

1. Keep a DOM/visual baseline from the existing CSS and markup; keep Supabase RLS/RPC as the authorization boundary.
2. Move session/workspace/read models behind typed Supabase service functions and TanStack Query keys; invalidate affected keys after mutations.
3. Port one screen at a time into React components, preserving IDs only where still needed for automation/testing; maintain the existing route hashes and accessibility labels.
4. Port mutations/forms into React handlers with existing validation and error states; delete legacy listeners only after equivalent flows work.
5. Compare key screens at desktop/mobile widths, build production output, then run the documented user journey (sign-in, workspace join, create task, decisions/context, invite, release checks).
6. Keep changes on the feature branch and uncommitted until the user reviews the finished migration.

## Acceptance checklist

- [x] Production build emits static Netlify `dist/` output.
- [x] Existing screen markup/styles are the source of truth; no redesign.
- [x] Invite modal copy and actions are retained, with responsive wrapping fix.
- [ ] All user-facing screens and interactions are React-owned; no legacy DOM runtime.
- [ ] Supabase auth, invite acceptance, task/decision/release updates and MCP setup are smoke-checked after the full port.
- [ ] Rendered phone, tablet, and desktop layouts visually compared.
