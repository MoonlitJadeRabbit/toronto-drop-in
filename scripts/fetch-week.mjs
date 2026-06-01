const res = await fetch("http://localhost:5173/api/week");
if (!res.ok) {
  console.error("HTTP", res.status);
  process.exit(1);
}
const j = await res.json();
console.log(
  JSON.stringify(
    { weekStart: j.weekStart, fetchedAt: j.fetchedAt, centres: j.centres?.length, events: j.events?.length },
    null,
    2
  )
);

