const utf16Decoder = new TextDecoder("utf-16le");

async function tryFeed(url, label) {
  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "TorontoDropInTracker/0.1",
      },
    });
    const ct = res.headers.get("content-type");
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0) {
      console.log(label, res.status, "empty");
      return;
    }
    let text;
    try {
      text = utf16Decoder.decode(buf).replace(/^\uFEFF/, "");
      if (!text.trim().startsWith("[") && !text.trim().startsWith("{")) {
        text = new TextDecoder("utf-8").decode(buf);
      }
    } catch {
      text = new TextDecoder("utf-8").decode(buf);
    }
    const j = JSON.parse(text);
    const dates = new Set();
    const walk = (x) => {
      if (!x || typeof x !== "object") return;
      if (Array.isArray(x)) return x.forEach(walk);
      if (x.d) dates.add(String(x.d).slice(0, 10));
      if (x.date) dates.add(String(x.date).slice(0, 10));
      for (const v of Object.values(x)) if (v && typeof v === "object") walk(v);
    };
    walk(j);
    const sorted = [...dates].sort();
    console.log(
      label,
      res.status,
      ct,
      "dates",
      sorted.length ? `${sorted[0]}..${sorted[sorted.length - 1]}` : "none",
      "bytes",
      buf.byteLength
    );
  } catch (e) {
    console.log(label, "err", e.message);
  }
}

const id = 472;
const bases = [
  `https://www.toronto.ca/data/parks/live/dropin/sports/${id}.json`,
  `https://www.toronto.ca/data/parks/live/dropin/${id}.json`,
  `https://www.toronto.ca/data/parks/live/dropin/programs/${id}.json`,
  `https://www.toronto.ca/data/parks/live/dropin/location/${id}.json`,
  `https://www.toronto.ca/data/parks/prd/facilities/complex/${id}/dropin.json`,
  `https://www.toronto.ca/data/parks/prd/facilities/complex/${id}/schedule.json`,
  `https://www.toronto.ca/data/parks/prd/facilities/complex/${id}/dropin/sports.json`,
];
for (const u of bases) await tryFeed(u, u.split("/").slice(-2).join("/"));
