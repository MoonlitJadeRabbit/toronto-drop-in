const r = await fetch("http://localhost:5173/app.js");
console.log("app.js", r.status, (await r.text()).includes("eventDayOfWeek") ? "has helpers" : "missing");
const h = await fetch("http://localhost:5173/");
console.log("html", h.status);
