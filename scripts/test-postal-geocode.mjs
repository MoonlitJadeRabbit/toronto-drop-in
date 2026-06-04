/**
 * Compare postal geocode results (should differ by area, not all downtown).
 * Usage: node backend/server.mjs  (in another terminal)
 *        node scripts/test-postal-geocode.mjs
 */
const base = process.argv[2] || "http://localhost:5173";

const samples = ["M5V 2T6", "M4B 1B3", "M1P 4P5", "M5S 1A1"];

const results = [];
for (const q of samples) {
  const res = await fetch(`${base}/api/geocode?q=${encodeURIComponent(q)}`);
  const body = res.ok ? await res.json() : { error: await res.text() };
  results.push({ q, status: res.status, ...body });
}

const downtown = { lat: 43.6534817, lng: -79.3839347 };
let ok = true;
for (const r of results) {
  if (r.status !== 200) {
    console.log("FAIL", r.q, r.status, r.error);
    ok = false;
    continue;
  }
  const sameDowntown =
    Math.abs(r.lat - downtown.lat) < 0.001 && Math.abs(r.lng - downtown.lng) < 0.001;
  console.log(r.q, "->", r.lat.toFixed(5), r.lng.toFixed(5), sameDowntown ? "(DOWNTOWN BUG)" : "");
  if (sameDowntown) ok = false;
}

const uniq = new Set(results.filter((r) => r.lat).map((r) => `${r.lat},${r.lng}`));
if (uniq.size < 2 && results.every((r) => r.status === 200)) {
  console.log("FAIL: all postals resolved to the same point");
  ok = false;
}

process.exit(ok ? 0 : 1);
