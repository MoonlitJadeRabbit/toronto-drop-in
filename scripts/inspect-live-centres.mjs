const url = "https://www.toronto.ca/data/parks/live/centres.json";
const res = await fetch(url, { headers: { accept: "application/json" } });
const text = await res.text();
console.log(JSON.stringify({ status: res.status, contentType: res.headers.get("content-type"), prefix: text.slice(0, 200) }, null, 2));

