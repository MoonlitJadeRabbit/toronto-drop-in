const id = process.argv[2] ?? "90";
const url = `https://www.toronto.ca/data/parks/live/dropin/sports/${id}.json`;
const res = await fetch(url, { headers: { accept: "application/json" } });
const text = await res.text();
console.log(
  JSON.stringify(
    {
      url,
      status: res.status,
      contentType: res.headers.get("content-type"),
      bodyPrefix: text.slice(0, 200),
    },
    null,
    2
  )
);


