# CodeRush Hackathon — DSLC plan

## Event shape

- Five teams of three; AI coding tools are allowed.
- Round 1: R1-01 Smart Kanban Task Board, 45 minutes, 100 points.
- Later rounds: separate projects for Rounds 2, 3, and the final MVP. Keep each runnable project in its own root child folder; do not couple their packages or data.
- Judging rubric, exact submission mechanics, required framework, and host account state are unknown. The stated feature checklist is the Round 1 acceptance rubric.

## Discovery and scope

- **User:** a small team coordinating tasks, priorities, and deadlines.
- **Problem:** task ownership and progress are hard to scan when work lives in informal notes.
- **Primary journey:** open the board → create or edit a task → move it among To Do, In Progress, and Completed → refresh and see the same board.
- **Demo moment:** drag a task into Completed; its count and saved state update immediately. The status control also supports non-drag and keyboard use.
- **P0:** title, description, priority, due date; three status columns; create, edit, delete, move; high priority tasks sort first in each column; local persistence; responsive/accessibility basics.
- **P1:** search and priority filters, concise summary counts, due-date cues, and a persisted light/dark appearance toggle.
- **P2 / out of scope:** accounts, shared real-time team data, server/database, comments, notifications, integrations, analytics, role management, and final-round AWS infrastructure.
- **Assumptions:** one browser/device per board for this round; sample starter tasks are synthetic and editable; local browser storage is acceptable because the challenge asks for refresh persistence, not cross-device sync.

## Design and architecture

- One page at `/` for one user journey; there are no distinct roles or protected data.
- Static HTML, CSS, and browser JavaScript in `round-1-smart-kanban/`. No backend/API or external component library: native semantic controls and the browser `localStorage` API minimize setup risk for a 45-minute build.
- Entity: `{ id, title, description, priority, dueDate, status, createdAt, updatedAt }`. Validate title and priority at the form boundary; use stable generated IDs; only accept the three known statuses. Storage failures should leave the board usable for the current session and show an error.
- Responsive composition: header and compact toolbar above a three-column desktop board; columns become a vertically stacked board on narrow screens. Phone target 375 px, tablet 768 px, desktop 1280 px. Use a calm warm-white canvas, ink text, teal action color, amber priority cues, 8 px spacing rhythm, clear focus rings, and short motion that respects reduced-motion settings.
- Component map: page header/summary, search and priority filter, three status sections, task cards, native `<dialog>` task form, accessible status selector, and live status message. No decorative background assets; the board itself is the visual focus.
- Failure cases: invalid or blank title; malformed stored data; storage unavailable/full; empty filtered columns; stale dates. No external service or secrets are required.

## Delivery sequence (Round 1: 45 minutes)

1. **Discover / define (6 min):** confirm the brief, assumptions, P0 and observable checks.
2. **Design / scaffold (6 min):** set the visual tokens and create the isolated static project.
3. **Build (22 min):** implement the complete CRUD, movement, filters and persistence journey.
4. **Verify / demo / submit (11 min, 24% buffer):** run available checks, inspect phone/tablet/desktop when browser tooling is available, fix blocking defects, rehearse, and prepare submission.

## Acceptance checklist

- [VERIFIED] A task can be created with title, description, priority, and due date; the updated dialog was submitted in the browser.
- [VERIFIED] Tasks appear in To Do, In Progress, and Completed.
- [VERIFIED] A task can move columns through the board-column control in the edit dialog.
- [VERIFIED] A task can be edited and deleted; temporary QA data was removed after checking.
- [VERIFIED] Board data persisted after a page refresh in the same browser.
- [VERIFIED] Theme toggle switches between light and dark, saves the selection, and restores it after refresh; the dark board and task dialog were visually inspected.
- [VERIFIED] High priority tasks sort ahead of medium/low priority tasks in each column; a newly created medium task was confirmed below the existing high task. The first high priority task is tagged "First up".
- [NOT TESTED] Drag-and-drop movement and search/priority filtering were not exercised in the browser.
- [NOT TESTED] Desktop UI was inspected, but phone and tablet layouts were not visually inspected.
- [VERIFIED] Staged diff reviewed on the Round 1 branch; no secrets or generated build output are included.
- [NOT DEPLOYED] No hosting account/CLI is configured in this workspace; deployment guidance is in the Round 1 README.

## Round 1 follow-up: dark mode

The board now follows the OS color preference until the user chooses a theme. The top-bar toggle then stores that choice in browser localStorage. Dark tokens cover the board, cards, controls, and task dialog; accessible labels and theme-color metadata track the current appearance. Vercel CLI and local Vercel authentication are not configured here, so no deployment was attempted.

## Round 1 follow-up: form layout repair

The dialog's Cancel button shared the close-icon styling class, which forced icon sizing onto its label. The icon rule is now scoped to the icon button, dialog actions have a fixed usable size, and the board-column select is stacked beneath its label. The completed-task due date also no longer appears as overdue. In-browser verification confirmed the dialog layout and exercised task create, edit, move, delete, and refresh persistence; the temporary test task was removed.

## Tool, Git, and deployment decision

- The workspace was empty. GitHub confirms the supplied public repo is empty on `main`; the connected GitHub integration has pull access but no push access. A local Git repo and `hackathon/round-1-smart-kanban` branch are being used for recoverable milestones. Remote push is unavailable through the connected integration; no default-branch push will be attempted.
- Node/npm and AWS CLI are present. Vercel and Netlify CLIs and provider environment variables were not detected in the initial check. No connected design/component MCP was needed for a dependency-free static board. AWS is reserved for the final round per the request.
- Use a local static server for Round 1. Vercel/Netlify preview remains a later option if an authenticated free-tier setup is actually available; otherwise share the local demo or use their dashboard after the user signs in.

## Architecture decision

**ADR:** Keep Round 1 as an isolated static child project with localStorage. This satisfies refresh persistence without spending the short feature round on accounts, server deployment, database setup, or cross-round coupling. If a later round requires collaboration across devices, add a backend to that round's separate project rather than silently changing this feature's data boundary.

## Round 2 — R2-01 Event Auction System

### Discovery and scope

- **User/problem:** event participants need a clear way to bid on one item, see the current leader, and audit the bid sequence; the organizer needs an unambiguous close and winner state.
- **Primary journey:** open the live lot → enter a display name and amount above the current bid → see the bid become the leader in history → let the deadline expire → see the winning bidder, or an unsold result if there were no bids.
- **Demo moment:** place a valid bid, attempt an equal/lower bid to show validation, then let the timer expire and show the winner. For a quick demo restart, use the explicit reset control (confirmation required).
- **P0:** one visible item and starting price, live five-minute deadline, display name and bid entry, reject malformed/equal/lower bids, current highest bid and history, no bids accepted after deadline, winner or unsold state, persistence over refresh, dark mode.
- **P1:** same-browser cross-tab updates, clear validation/closed/storage-error states, resettable demo setup, responsive and keyboard-accessible controls.
- **P2 / out of scope:** accounts, real multi-device sync, server-authoritative bids, payments, multiple lots, reserve prices, bid increments, anti-fraud, and production auction/legal workflows.
- **Assumptions:** INR, a ₹1,200 starting price, and a five-minute timer are synthetic demo defaults because event specifics were not provided. A single-browser static implementation fits a 45-minute feature round. A shared server is needed for separate devices.

### Design, architecture, and edge cases

- Single page `/`, one participant interaction model, no authentication or protected resources. Display names are self-entered and not verified identities.
- Isolated static HTML/CSS/JS project in `round-2-event-auction/`. Integer paise internally avoid floating-point bid comparisons; browser formatting displays INR. Local storage records start/end timestamps and bid entries; time is derived from an absolute deadline so refresh cannot extend the auction.
- Bids are validated against the current leader and deadline at submission. Loaded state is shape-checked. `textContent` renders bidder names safely. A local-storage failure leaves the in-memory demo usable and explains that changes will not survive refresh. Storage events update other tabs; they cannot make separate devices authoritative or prevent simultaneous-write races.
- Edge cases: whitespace-only/overlong names; malformed, negative, too-small, equal, unsafe-range, or over-precision amounts; deadline crossing between render and submit; no-bid close; malformed saved state; unavailable storage; history cap; live versus closed winner labels; theme-storage failure; reset confirmation; narrow viewport and reduced motion.
- Visual direction: editorial auction catalog with a sage illustrated prize card, neutral ink/paper surfaces, lime bid action, mono labels/timer, desktop split layout, and stacked mobile layout. Dark mode uses matching tokens. Native controls provide visible focus and semantic labels.

### Acceptance and delivery

- [ ] First visit displays one item, ₹1,200 starting price, and a five-minute countdown.
- [ ] A non-empty display name and valid bid strictly above the leader add a history row and update the leader.
- [ ] Invalid, equal, lower, over-precision, and malformed bids leave the leader and history unchanged.
- [ ] Refresh preserves bids and the same end time; other tabs receive browser-storage updates.
- [ ] At/after deadline, bids are rejected; the app names the highest bidder or reports the lot unsold.
- [ ] Reset requires confirmation, clears bids, and starts a new timer.
- [ ] Light/dark mode works and persists when browser storage is available.
- [ ] Phone/tablet/desktop layouts, keyboard focus, and reduced-motion behavior are checked before handoff.
- **Timebox:** brief/scope 4 min; timer/bid vertical slice 16 min; UI/theme 12 min; edge handling 4 min; integration, checks, and demo rehearsal 9 min. Protect the final 20% (9 min) for verification and submission.
- **Risks:** localStorage is not a trusted shared ledger; client clocks can be changed; a static demo cannot safely determine real winners. A backend with atomic bid writes and server time is required for a real multi-device auction.
- **Deployment:** static hosting is suitable for a non-production demo. Netlify Drop is the quick manual option; publish only `round-2-event-auction` and use synthetic data.
