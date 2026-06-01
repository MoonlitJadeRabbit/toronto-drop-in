const ids = [472, 24, 17];
const utf16Decoder = new TextDecoder("utf-16le");

for (const id of ids) {
  const url = `https://www.toronto.ca/data/parks/live/dropin/sports/${id}.json`;
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      referer:
        "https://www.toronto.ca/explore-enjoy/parks-recreation/program-activities/sports/drop-in-sports-map/",
      "user-agent": "TorontoDropInTracker/0.1",
    },
  });
  const buf = await res.arrayBuffer();
  const text = utf16Decoder.decode(buf).replace(/^\uFEFF/, "");
  const j = JSON.parse(text);
  const dates = new Set();
  for (const g of j) for (const r of g.r ?? []) if (r.d) dates.add(String(r.d).slice(0, 10));
  const sorted = [...dates].sort();
  console.log(id, "status", res.status, "dates", sorted[0], "->", sorted[sorted.length - 1], "count", sorted.length);
}
