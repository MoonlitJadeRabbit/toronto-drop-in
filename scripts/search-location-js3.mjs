import { readFile } from "node:fs/promises";

const text = await readFile(
  "C:/Users/junye/.cursor/projects/d-Torontodropin/agent-tools/e1930ff7-62a3-4a80-883d-2b53b0437c4e.txt",
  "utf8"
);

const idx = text.indexOf("locationdataURL:");
if (idx >= 0) console.log(text.slice(idx, idx + 500).replace(/\s+/g, " "));

const idx2 = text.indexOf('locationdataURL="');
if (idx2 >= 0) console.log("quoted", text.slice(idx2, idx2 + 200));

// function d for week loading
const dIdx = text.indexOf("function d(v,b,x,w,t)");
if (dIdx >= 0) console.log("\nd fn", text.slice(dIdx, dIdx + 1200).replace(/\s+/g, " "));

// sports/info.json handler
const sIdx = text.indexOf("/sports/info.json");
if (sIdx >= 0) console.log("\nsports info", text.slice(sIdx - 200, sIdx + 1500).replace(/\s+/g, " "));
