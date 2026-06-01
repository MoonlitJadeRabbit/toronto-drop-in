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
| [Render](https://render.com) | Free web service, set start command `node backend/server.mjs` |
| [Railway](https://railway.app) | Similar, connect this repo |
| [Fly.io](https://fly.io) | Small VM, good for always-on |

Point your domain’s **DNS** at the host (usually a `CNAME` to their URL). Add your domain in the host’s dashboard and enable HTTPS.

GitHub Pages alone won’t run the backend; use GitHub only to store code and deploy elsewhere.

## Project layout

- `frontend/` — React UI (loaded via esm.sh)
- `backend/server.mjs` — API, scraper, static files
- `backend/location-dropin.mjs` — centre-page schedule fetcher
- `shared/` — timezone helpers, geocoding, schema types
- `data/overrides.json` — manual status overrides

## License

MIT (add a `LICENSE` file if you publish publicly).
