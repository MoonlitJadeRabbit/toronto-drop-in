import { readFile } from "node:fs/promises";

const c = JSON.parse(await readFile("data/cache.json", "utf8"));
console.log("cache weekStart", c.weekStart, "rangeEnd", c.rangeEnd, "events", c.events?.length);

const dates = new Set();
for (const e of c.events) {
  const ld = e.localDate || e.start?.slice(0, 10);
  if (ld) dates.add(ld);
}
const sorted = [...dates].sort();
console.log("date range in cache:", sorted[0], "to", sorted[sorted.length - 1]);
console.log("unique dates", sorted.length);

const TORONTO_TZ = "America/Toronto";
function torontoYmd(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TORONTO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function mondayOfWeekToronto(fromDate = new Date()) {
  const ymd = torontoYmd(fromDate);
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  const monday = new Date(y, m - 1, d);
  const diff = dow === 0 ? -6 : 1 - dow;
  monday.setDate(monday.getDate() + diff);
  return monday;
}

function weekBounds(weekOffset) {
  const monday = mondayOfWeekToronto();
  monday.setDate(monday.getDate() + weekOffset * 7);
  const end = new Date(monday);
  end.setDate(end.getDate() + 7);
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: fmt(monday), end: fmt(end) };
}

const today = torontoYmd();
console.log("today toronto", today);

for (const off of [0, 1]) {
  const w = weekBounds(off);
  let n = 0;
  for (const e of c.events) {
    const ld = e.localDate || e.start.slice(0, 10);
    if (ld >= w.start && ld < w.end) n++;
  }
  console.log(`week offset ${off}: ${w.start} to ${w.end} -> ${n} events`);
}

const sun = c.events.filter((e) => {
  const ld = e.localDate || e.start.slice(0, 10);
  const [y, m, d] = ld.split("-").map(Number);
  return new Date(y, m - 1, d).getDay() === 0;
});
console.log("sunday events", sun.length, sun.slice(0, 5).map((e) => ({ sport: e.sport, ld: e.localDate || e.start.slice(0, 10) })));
