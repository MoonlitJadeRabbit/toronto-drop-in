const id = 472;
const urls = [
  `https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/?id=${id}`,
  `https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/?id=${id}#tab=dropin`,
  `https://www.toronto.ca/data/parks/img/facilities/complex/${id}/index.html`,
  `https://www.toronto.ca/data/parks/img/facilities/complex/${id}/index.html#tab=dropin`,
  `https://www.toronto.ca/data/parks/prd/facilities/complex/${id}/index.html#tab=dropin`,
];

for (const url of urls) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      accept: "text/html",
    },
    redirect: "follow",
  });
  const html = await res.text();
  const title = (html.match(/<title>([^<]+)/i) || [])[1] || "";
  const dropin = (html.match(/drop-?in/gi) || []).length;
  const jsonPaths = [...new Set([...html.matchAll(/\/data\/parks\/[^"'\s<>]+/gi)].map((m) => m[0]))];
  console.log("\n", url.split("toronto.ca")[1]);
  console.log(" ", res.status, "len", html.length, "title", title.slice(0, 60), "dropin", dropin);
  console.log(" ", jsonPaths.slice(0, 8));
}
