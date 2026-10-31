# Round 2 — Event Auction System

Standalone single-page demo for CodeRush challenge R2-01. It runs a five-minute auction for one synthetic prize, validates strictly increasing INR bids, records a public bid history, closes at the persisted deadline, and announces either the winner or that the lot went unsold. Dark mode follows the device preference until changed and remembers the visitor's selection.

## Run locally

From this folder:

```powershell
python -m http.server 4174
```

Open <http://localhost:4174> and keep the terminal running. The auction, bid history, and deadline persist in this browser's `localStorage`. Use **Reset demo** to clear the current auction and restart its five-minute timer. Use a private window or clear this project's browser storage for a clean presentation.

## Data and demo boundaries

This is a self-contained, single-browser prototype with no account system or server. Display names are self-entered, and bids synchronize between tabs through browser storage events. They do not synchronize across devices or provide server-authoritative ordering; simultaneous remote bidders require a shared backend with atomic bid validation and trusted server time. The prize and bids are synthetic. No real auction, payment, or award is conducted.

## Deploy quickly with Netlify

Use [Netlify Drop](https://app.netlify.com/drop), sign in if prompted, and drag the **`round-2-event-auction` folder** (the one containing `index.html`, `styles.css`, and `app.js`) into the drop zone. Do not upload only `index.html` or the parent repository. Open the generated URL and check that `<your-site>/styles.css` loads. This is a static site and needs no build command. Each visitor's bids remain in that visitor's browser.

Vercel can also serve the static folder: import the pushed repository and set the project root to `round-2-event-auction`, framework preset to **Other**, build command blank, and output directory `.`. The Vercel account and repository branch must be available first.
