# Free Invoice Generator

A client-side-only invoice generator. No build step, no backend, no accounts.

## Files
- `index.html` — landing page + app (includes clearly-labeled placeholder slots for future ads/affiliates; no ad code is loaded)
- `app.js` — all logic (vanilla JS, no dependencies)
- `styles.css` — screen styles
- `print.css` — print stylesheet: printing / "Save as PDF" outputs only the invoice

## Run / deploy
Open `index.html` in any browser, or drop the whole folder into any static host
(e.g. the root of a GitHub Pages repo) — no configuration needed.

## Privacy
All data stays in the user's browser. Saved invoices use `localStorage` on the
user's device only; nothing is transmitted anywhere.
