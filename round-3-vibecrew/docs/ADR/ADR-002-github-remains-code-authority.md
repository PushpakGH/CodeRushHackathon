# ADR-002 — GitHub remains code authority

- **Status:** Accepted as a product constraint; not connected by this preview
- **Context:** Coordination metadata should not imply VibeCrew owns source code, CI, reviews, or merge history.
- **Decision:** VibeCrew records branch, commit, PR, reviewer, CI, review, and merge metadata manually in P0. GitHub remains authoritative for the underlying code and review events.
- **Consequences:** No auto-merge, GitHub write, OAuth/App installation, webhook, or CI integration is implied. Add automation only after a working integration is authorized and verified.
