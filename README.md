# vibez.is-a.dev

Personal site — a bio card that flips into a live music panel.
Static HTML/CSS/JS on GitHub Pages. No build step.

**Music data:** Spotify scrobbles to Last.fm, and the site reads Last.fm.
Put your username + free API key (from [last.fm/api/account/create](https://www.last.fm/api/account/create)) in `js/config.js` and everything goes live.
Album art comes from Last.fm and iTunes, with a fallback cat.

**Run locally:** `python3 -m http.server 8000` → open http://localhost:8000

**Test:** `node test.js`

**Deploy:** push to `main` — GitHub Pages handles the rest.
