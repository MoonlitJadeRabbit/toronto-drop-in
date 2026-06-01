import { readFile } from "node:fs/promises";

const utf16Decoder = new TextDecoder("utf-16le");

async function getJson(url) {
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      referer:
        "https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/?id=1",
      "user-agent": "TorontoDropInTracker/0.1",
    },
  });
  const buf = await res.arrayBuffer();
  let text = utf16Decoder.decode(buf).replace(/^\uFEFF/, "");
  if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
    text = new TextDecoder("utf-8").decode(buf);
  }
  return JSON.parse(text);
}

const cache = JSON.parse(await readFile("data/cache.json", "utf8"));
const ids = [...new Set(cache.centres.map((c) => Number(String(c.id).replace(/^cot_/, ""))))].slice(0, 40);

let withWeek2 = 0;
for (const id of ids) {
  try {
    const info = await getJson(
      `https://www.toronto.ca/data/parks/live/locations/${id}/sports/info.json`
    );
    const w2 = info.weeks?.find((w) => w.id === 2 || w.json === "week2.json");
    if (w2?.hasPrograms === "true" || w2?.hasPrograms === true) {
      withWeek2++;
      const week = await getJson(
        `https://www.toronto.ca/data/parks/live/locations/${id}/sports/week2.json`
      );
      console.log(id, w2.title, "programs", week.programs?.length ?? 0);
    }
  } catch {
    /* skip */
  }
  await new Promise((r) => setTimeout(r, 25));
}
console.log("centres with week2 programs in sample", withWeek2, "of", ids.length);
