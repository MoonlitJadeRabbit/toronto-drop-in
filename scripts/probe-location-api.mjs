const id = Number(process.argv[2] || 472);
const base = `https://www.toronto.ca/data/parks/live/locations/${id}`;
const referer = `https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/?id=${id}`;

const headers = {
  accept: "application/json",
  referer,
  "user-agent": "TorontoDropInTracker/0.1 (educational)",
};

const utf16Decoder = new TextDecoder("utf-16le");

async function getJson(path) {
  const res = await fetch(`${base}/${path}`, { headers });
  const buf = await res.arrayBuffer();
  let text = utf16Decoder.decode(buf).replace(/^\uFEFF/, "");
  if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
    text = new TextDecoder("utf-8").decode(buf);
  }
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, raw: text.slice(0, 200) };
  }
}

const info = await getJson("sports/info.json");
console.log("sports/info", info.status, JSON.stringify(info.data, null, 2));

if (info.data?.weeks) {
  for (const w of info.data.weeks) {
    if (!w?.json) continue;
    const week = await getJson(`sports/${w.json}`);
    const programs = week.data?.programs ?? [];
    const days = new Set();
    for (const p of programs) {
      for (const d of p.days ?? []) {
        for (const t of d.times ?? []) days.add(t.day);
      }
    }
    console.log(
      "\nweek",
      w.id,
      w.title,
      "hasPrograms",
      w.hasPrograms,
      "file",
      w.json,
      "programCount",
      programs.length,
      "days",
      [...days]
    );
    if (programs[0]) {
      console.log("sample program", JSON.stringify(programs[0], null, 2).slice(0, 800));
    }
  }
}
