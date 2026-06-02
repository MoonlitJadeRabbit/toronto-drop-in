/**
 * Copy data/cache.json → data/cache.seed.json for deploy (Render cold starts).
 * Run after a local refresh: ALLOW_REFRESH=1 + POST /api/refresh, then:
 *   node scripts/update-cache-seed.mjs
 */
import { copyFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
await copyFile(join(root, "data", "cache.json"), join(root, "data", "cache.seed.json"));
console.log("Updated data/cache.seed.json — commit and push for Render.");
