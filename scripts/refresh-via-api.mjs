const res = await fetch("http://localhost:5173/api/refresh", { method: "POST" });
const body = await res.json();
const dates = body.events?.map((e) => e.localDate).filter(Boolean).sort();
console.log({
  ok: res.ok,
  centres: body.centres?.length,
  events: body.events?.length,
  dataFrom: body.dataFrom,
  dataTo: body.dataTo,
  nextWeekSample: dates?.filter((d) => d >= "2026-06-01" && d < "2026-06-08").length,
});
