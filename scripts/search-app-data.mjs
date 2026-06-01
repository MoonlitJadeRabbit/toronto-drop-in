import { readFile } from "node:fs/promises";

const text = await readFile(
  "C:/Users/junye/.cursor/projects/d-Torontodropin/agent-tools/e1930ff7-62a3-4a80-883d-2b53b0437c4e.txt",
  "utf8"
);

for (const pat of ["app_data=", "var app_data", "locationdataURL", "appURL", "mapURL"]) {
  let idx = 0;
  while ((idx = text.indexOf(pat, idx)) !== -1) {
    const slice = text.slice(idx, idx + 400);
    if (slice.includes("locationdata") || slice.includes("app_data") || pat === "app_data=") {
      console.log(slice.replace(/\s+/g, " ").slice(0, 350));
      console.log("---");
    }
    idx += pat.length;
    if (idx > 500000) break;
  }
}
