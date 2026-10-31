# ADR-001 — Hosted system of record

- **Status:** Proposed, awaiting provider setup and review
- **Context:** Team members use separate machines. Browser `localStorage` cannot provide shared identity, tenant isolation, or atomic task claiming.
- **Decision:** Prefer one hosted Supabase Postgres + Auth project for this MVP if an existing/free development project is available and approved. Protect every workspace-scoped row with RLS; use a conditional RPC for atomic claims and revision changes.
- **Consequences:** Requires project URL/publishable key configuration, Auth setup, migrations, RLS policies, and two-account verification. Never expose service-role secrets. If no approved project is available, keep the UI clearly in preview mode.
