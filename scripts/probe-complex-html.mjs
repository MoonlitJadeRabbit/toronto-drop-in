const id = 472;
const url = `https://www.toronto.ca/data/parks/prd/facilities/complex/${id}/index.html`;
const html = await fetch(url, { headers: { "user-agent": "TorontoDropInTracker/0.1" } }).then((r) =>
  r.text()
);
console.log("status len", html.length);
const keywords = ["dropin", "drop-in", "schedule", "program", "json", "iframe", "sports", "tab="];
for (const kw of keywords) {
  const idx = html.toLowerCase().indexOf(kw);
  if (idx >= 0) console.log(kw, "at", idx, html.slice(Math.max(0, idx - 40), idx + 120).replace(/\s+/g, " "));
}
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/gi)].map((m) => m[1]);
console.log("scripts", scripts.slice(0, 20));
