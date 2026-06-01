import { readFile } from "node:fs/promises";

const text = await readFile(
  "C:/Users/junye/.cursor/projects/d-Torontodropin/agent-tools/e1930ff7-62a3-4a80-883d-2b53b0437c4e.txt",
  "utf8"
);

for (const n of [
  "locationdataURL",
  "app_data",
  "sports/info.json",
  "dropinprograms",
  "weeks",
  "/sports/",
]) {
  let idx = 0;
  const samples = [];
  while ((idx = text.indexOf(n, idx)) !== -1 && samples.length < 8) {
    samples.push(text.slice(Math.max(0, idx - 100), idx + 150).replace(/\s+/g, " "));
    idx += n.length;
  }
  if (samples.length) {
    console.log("\n==", n, "==");
    for (const s of samples) console.log(s);
  }
}
