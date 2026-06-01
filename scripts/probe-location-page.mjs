const id = 472;
const pageUrl = `https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/?id=${id}`;
const html = await fetch(pageUrl, {
  headers: { "user-agent": "TorontoDropInTracker/0.1" },
}).then((r) => r.text());

console.log("len", html.length);
const patterns = [
  /\/data\/parks\/[^"'\s)]+/gi,
  /dropin[^"'\s)]+/gi,
  /drop-in[^"'\s)]+/gi,
  /schedule[^"'\s)]+/gi,
  /\.json[^"'\s)]+/gi,
  /locationid[=:]\s*\d+/gi,
  /tab=dropin/gi,
];
for (const p of patterns) {
  const hits = [...new Set([...html.matchAll(p)].map((m) => m[0]))].slice(0, 20);
  if (hits.length) console.log(p, hits);
}

const dropIdx = html.toLowerCase().indexOf("drop-in");
if (dropIdx >= 0) {
  console.log("\n--- drop-in context ---");
  console.log(html.slice(dropIdx - 200, dropIdx + 800).replace(/\s+/g, " "));
}

const scriptSrc = [...html.matchAll(/<script[^>]+src="([^"]+)"/gi)].map((m) => m[1]);
console.log("\nscripts", scriptSrc.filter((s) => /drop|park|schedule|program/i.test(s)));
