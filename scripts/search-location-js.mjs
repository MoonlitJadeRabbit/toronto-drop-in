import { readFile } from "node:fs/promises";

const path =
  process.argv[2] ||
  "C:/Users/junye/.cursor/projects/d-Torontodropin/agent-tools/e1930ff7-62a3-4a80-883d-2b53b0437c4e.txt";
const text = await readFile(path, "utf8");

const needles = [
  "dropin",
  "drop-in",
  "/data/parks",
  "live/dropin",
  "Next Week",
  "nextWeek",
  "weekOf",
  "weekStart",
  "sports/",
  "fepe",
  "pfr",
  "location/?id",
];
for (const n of needles) {
  let idx = 0;
  let count = 0;
  const samples = [];
  while ((idx = text.indexOf(n, idx)) !== -1 && count < 5) {
    samples.push(text.slice(Math.max(0, idx - 60), idx + 80).replace(/\s+/g, " "));
    idx += n.length;
    count++;
  }
  if (samples.length) console.log("\n==", n, "==", samples.length, "hits");
  for (const s of samples) console.log(s);
}

const urlRe = /https?:\/\/[^"'\\s]+/g;
const urls = [...new Set([...text.matchAll(urlRe)].map((m) => m[0]))].filter((u) =>
  /toronto\.ca.*(dropin|parks|sport|schedule|fepe|pfr)/i.test(u)
);
console.log("\nfiltered urls", urls.slice(0, 40));
