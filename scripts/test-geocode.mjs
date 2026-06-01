const q = process.argv[2] || "55 John St";
const base = process.argv[3] || "http://localhost:5173";

const geo = await fetch(`${base}/api/geocode?q=${encodeURIComponent(q)}`);
console.log("geocode", geo.status, (await geo.text()).slice(0, 120));

for (const path of ["/api/schedule", "/api/week"]) {
  const res = await fetch(`${base}${path}`);
  console.log(path, res.status);
  const j = await res.json();
  const withCoords = (j.centres ?? []).filter((c) => typeof c.lat === "number").length;
  console.log("  centres", j.centres?.length, "with lat/lng", withCoords);
  if (j.error) console.log("  err", j.error);
}
