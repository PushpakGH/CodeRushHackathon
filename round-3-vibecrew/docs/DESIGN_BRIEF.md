# Design brief

## Direction

- **Audience:** engineers coordinating a dense project from desktop, with mobile used for quick status and context checks.
- **Character:** precise, calm, collaborative.
- **Composition:** compact dark workspace navigation + editorial project header + lifecycle rail + selective coordination signals + dense task/decision content.
- **Background depth:** flat surfaces with restrained layered tint on the primary signal only. No 3D, remote artwork, or decorative charts; readability and offline loading matter more.
- **Signature interaction:** Context Sync list marks a task pack CURRENT or STALE against a project revision; export shows assignment, dependencies, scope, acceptance, and tests together.

## Visual system

- **Typography:** system sans for UI (13 px base; 10–12 px dense metadata; 28–39 px page title); system monospace for IDs, paths, revisions, and state labels. No remote fonts/assets.
- **Width and layout:** desktop content max 1600 px with 24–48 px gutters; 4-column phase rail, 4-column task board, two-column overview/context. Tablet at 820 px collapses the sidebar to an icon rail and task columns to two. Phone at 600 px uses a bottom icon navigation, 13 px gutters, stacked panels/board, and no horizontal page overflow.
- **Spacing:** 4/8/12/16/24/32 px rhythm; small 6–8 px radii for controls, 12 px for major panels; border-led surfaces.
- **Semantic colors:** dark neutral canvas/surfaces; mint accent for accepted/current; amber for attention; coral for failure/stale; violet for design decisions; blue for normal-priority cues. A theme toggle offers a light surface variant.
- **Motion:** short opacity/4 px reveal and hover feedback; disabled when reduced motion is requested.

## Component map

| Screen | Native primitives |
|---|---|
| Overview | Semantic sections, buttons, phase rail, task rows, activity list |
| Discovery | Structured content panels and ordered journey |
| Decisions | Decision register, state badges, accept action |
| Work queue | Search input, filter buttons, status selects, task cards, overlap alert |
| Agent context | Task selector, Markdown preview, copy/download actions, stale alert |
| Team/activity | Member table, role summary, audit rows |
| Integration/release | Checklist status selects and manual PR metadata preview |

No UI/component library is installed in this static project. Native semantic controls minimize setup and keep the app deployable as static files. Labels, focus styling, Escape dismissal, reduced-motion behavior, and responsive navigation are included. Supabase-backed role/membership behavior is wired but has not been exercised with user accounts. The currently available in-app browser exposed a phone-width viewport; tablet and desktop screenshots still need review.
