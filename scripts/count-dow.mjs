import { readFile } from "node:fs/promises";

const c = JSON.parse(await readFile("data/cache.json", "utf8"));
const byDow = {};
for (const e of c.events) {
  const ld = e.localDate || e.start.slice(0, 10);
  const [y, m, d] = ld.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  byDow[dow] = (byDow[dow] || 0) + 1;
}
console.log("by dow (0=Sun):", byDow);
const sun = c.events.filter((e) => {
  const ld = e.localDate || e.start.slice(0, 10);
  const [y, m, d] = ld.split("-").map(Number);
  return new Date(y, m - 1, d).getDay() === 0;
});
console.log("sunday sample", sun.slice(0, 3).map((e) => ({ sport: e.sport, ld: e.localDate || e.start.slice(0, 10) })));
