# Toronto Drop-In Sports Tracker

Find drop-in sports at Toronto community centres — filter by day, sport, and distance from your address or postal code.

Data comes from the City of Toronto drop-in map and each centre’s facility schedule (including next week).

## Run locally

Requires **Node 18+**.

```bash
node backend/server.mjs
```

Open [http://localhost:5173](http://localhost:5173).

### Refresh schedule cache

```bash
set ALLOW_REFRESH=1
curl -X POST http://localhost:5173/api/refresh
```

The first refresh takes about a minute (fetches every centre). Cached data is stored in `data/cache.json` (not committed).

## Deploy & custom domain

This app needs the **Node server** (not static-only hosting). Good options:

| Host | Notes |
|------|--------|
| [Render](https://render.com) | Free web service; see below |
| [Railway](https://railway.app) | Similar, connect this repo |
| [Fly.io](https://fly.io) | Small VM, good for always-on |

Set **`ALLOW_REFRESH=1`**. Start command: `node backend/server.mjs`.

### Why Render feels slow on the free plan

Two separate delays:

1. **“Service waking up” (Render splash)** — Free services **sleep after ~15 minutes** with no traffic. The first visit starts the container again (often 30–60+ seconds). This is Render, not your app. Fixes: paid plan, or an external uptime ping every ~14 minutes.
2. **“Loading schedules…”** — After sleep, Render’s disk is empty. The app used to scrape Toronto’s APIs from scratch (~1–2 minutes). **`data/cache.seed.json`** is bundled in the repo; on startup the server copies it to `cache.json` so the list appears right away, then refreshes in the background.

Update the seed after a local refresh:

```bash
node scripts/update-cache-seed.mjs
git add data/cache.seed.json && git commit -m "Update schedule seed" && git push
```

Point your domain’s **DNS** at the host (usually a `CNAME` to their URL). Add your domain in the host’s dashboard and enable HTTPS.

GitHub Pages alone won’t run the backend; use GitHub only to store code and deploy elsewhere.

## Project layout

- `frontend/` — React UI (loaded via esm.sh)
- `backend/server.mjs` — API, scraper, static files
- `backend/location-dropin.mjs` — centre-page schedule fetcher
- `shared/` — timezone helpers, geocoding, schema types
- `data/overrides.json` — manual status overrides

## Publish to GitHub

Git is initialized locally. To create the remote repo and push:

```powershell
gh auth login
.\scripts\publish-to-github.ps1
```

Creates a public repo named **`toronto-drop-in`** under your GitHub account. Rename in the script if you prefer.

## License

MIT — see [LICENSE](LICENSE).
