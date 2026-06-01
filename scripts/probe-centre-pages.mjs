const ids = [472, 24, 17];
const utf16Decoder = new TextDecoder("utf-16le");

for (const id of ids) {
  const pageUrl = `https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/?id=${id}`;
  const res = await fetch(pageUrl, {
    headers: { "user-agent": "TorontoDropInTracker/0.1" },
  });
  const html = await res.text();
  const jsonUrls = [...html.matchAll(/\/data\/parks\/[^"']+\.json/gi)].map((m) => m[0]);
  const dropin = [...html.matchAll(/drop-?in/gi)].length;
  console.log("\n===", id, "status", res.status, "dropin mentions", dropin);
  console.log("json paths", [...new Set(jsonUrls)].slice(0, 10));

  const feed = `https://www.toronto.ca/data/parks/live/dropin/sports/${id}.json`;
  const fr = await fetch(feed, {
    headers: {
      accept: "application/json",
      referer: pageUrl,
      "user-agent": "TorontoDropInTracker/0.1",
    },
  });
  const text = utf16Decoder.decode(await fr.arrayBuffer()).replace(/^\uFEFF/, "");
  const j = JSON.parse(text);
  const dates = new Set();
  for (const g of j) for (const r of g.r ?? []) if (r.d) dates.add(String(r.d).slice(0, 10));
  const sorted = [...dates].sort();
  console.log("sports feed dates:", sorted[0], "->", sorted[sorted.length - 1], "count", sorted.length);
}
