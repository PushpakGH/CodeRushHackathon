# Round 1 — Smart Kanban Task Board

Standalone static project for CodeRush challenge R1-01. It supports task creation, editing, deletion, drag-and-drop/status movement, priority-first sorting within each column, search, priority filtering, and browser-local persistence. The first high priority task in each column is marked "First up".

Use the sun/moon button in the top bar to switch themes. The first visit follows the device color preference; a manual choice is remembered in that browser.

## Run locally

From this folder, start any static file server, for example:

```powershell
python -m http.server 4173
```

Then open <http://localhost:4173>. Keep that terminal open while using the preview. If Python is unavailable, use a local static server already installed on your machine or open `index.html` directly; browser storage is scoped to that origin.

## Data boundary

Tasks stay in this browser's `localStorage`; they are not shared with teammates, uploaded, or synced across devices. Starter examples are synthetic and can be edited or deleted.

## Fast free preview

**Fastest: Netlify Drop.** This project is plain HTML/CSS/JavaScript, so it needs no build step. Open [Netlify Drop](https://app.netlify.com/drop), then drag the `round-1-smart-kanban` folder (the one containing `index.html`) onto the page. It creates a one-off deploy URL; drag the same folder again to publish later changes. The browser board stores tasks locally on each visitor's device, so it does not sync between teammates.

**If the deployed page has no styling:** redeploy the `round-1-smart-kanban` folder itself and make sure `index.html`, `styles.css`, and `app.js` are all at the deployed site root. Don't upload only `index.html` or the outer CodeRush repository folder. Open `https://YOUR-SITE.netlify.app/styles.css`; if that URL is a 404, the CSS file was not included at the correct level. Netlify's [drag-and-drop guide](https://docs.netlify.com/deploy/create-deploys/) expects the folder containing the site's HTML, CSS, and JavaScript files.

**Vercel option:** sign in to Vercel CLI once, open a terminal in this folder, then run `npx vercel`. For the plain static-site setup, use Framework Preset `Other`, leave the build command blank, and set the output directory to `.`. The CLI creates a preview deployment by default. If importing through GitHub instead, set the project root to `round-1-smart-kanban`; that requires the branch to be pushed to GitHub first. Vercel's free Hobby plan is for personal, non-commercial use, so check that its terms fit your event before choosing it.

For either option, share only synthetic demo data. Keep AWS for the final round as planned.
