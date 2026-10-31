# Round 2 — Event Auction System

Standalone single-page demo for CodeRush challenge R2-01. Create up to 25 item auctions, set a positive INR starting price and a 1-minute-to-24-hour duration, then switch between lots with separate deadlines and bid histories. Valid bids must exceed the current lot's highest bid; each lot closes at its persisted deadline and shows the winner or an unsold result. Dark mode follows the device preference until changed and remembers the visitor's selection.

## Run locally

From this folder:

```powershell
python -m http.server 4174
```

Open <http://localhost:4174> and keep the terminal running. Use **Create auction** to add an item; the timer begins immediately. Auctions, bid history, deadlines, and the selected lot persist in this browser's `localStorage`. **Restart this lot** clears only that lot's bids after confirmation and restarts its configured duration. Use a private window or the per-lot restart control for a clean presentation.

## Data and demo boundaries

This is a self-contained, single-browser prototype with no account system or server. Anyone using this browser can create lots and bid; display names are self-entered. Auction state syncs between tabs through browser storage events but not across devices, and it cannot provide server-authoritative ordering. Simultaneous remote bidders or organizer-only controls require an authenticated backend with atomic bid validation and trusted server time. The starter prize and bids are synthetic. No real auction, payment, or award is conducted.

## Deploy quickly with Netlify

Use [Netlify Drop](https://app.netlify.com/drop), sign in if prompted, and drag the **`round-2-event-auction` folder** (the one containing `index.html`, `styles.css`, and `app.js`) into the drop zone. Do not upload only `index.html` or the parent repository. Open the generated URL and check that `<your-site>/styles.css` loads. This is a static site and needs no build command. Each visitor's bids remain in that visitor's browser.

Vercel can also serve the static folder: import the pushed repository and set the project root to `round-2-event-auction`, framework preset to **Other**, build command blank, and output directory `.`. The Vercel account and repository branch must be available first.
