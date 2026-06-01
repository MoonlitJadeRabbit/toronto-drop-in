const ids = [1, 2, 3, 90, 789, 3488, 3490, 3491, 3492, 3494, 3495, 3782];
for (const id of ids) {
  const url = `https://www.toronto.ca/data/parks/live/dropin/sports/${id}.json`;
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      referer:
        "https://www.toronto.ca/explore-enjoy/parks-recreation/program-activities/sports/drop-in-sports-map/",
      "user-agent": "Mozilla/5.0 (compatible; TorontoDropInTracker/0.1)",
    },
  });
  console.log(id, res.status, res.headers.get("content-type"));
}

