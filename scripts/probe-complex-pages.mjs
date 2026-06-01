const complexes = [472, 24, 3501, 3643];

for (const id of complexes) {
  const url = `https://www.toronto.ca/data/parks/prd/facilities/complex/${id}/index.html`;
  const res = await fetch(url, { headers: { "user-agent": "TorontoDropInTracker/0.1" } });
  const html = await res.text();
  console.log("\n=== complex", id, res.status, "len", html.length);
  const jsons = [...new Set([...html.matchAll(/\/data\/parks\/[^"'\s]+\.json/gi)].map((m) => m[0]))];
  console.log("json", jsons.slice(0, 15));
  const dropinLinks = [...html.matchAll(/dropin\/sports\/(\d+)\.json/gi)].map((m) => m[0]);
  console.log("dropin sports json", dropinLinks.slice(0, 5));
  if (html.includes("dropintable") || html.includes("Programs")) {
    console.log("has program table markers");
  }
}
