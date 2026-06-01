import { readFile } from "node:fs/promises";
import {
  mergeCityAndLocationEvents,
  scrapeAllLocationSports,
} from "../backend/location-dropin.mjs";

const cache = JSON.parse(await readFile("data/cache.json", "utf8"));
const sampleCentres = cache.centres.slice(0, 5);
const cityEvents = cache.events.filter((e) => sampleCentres.some((c) => c.id === e.centreId));

const locationEvents = await scrapeAllLocationSports({ centres: sampleCentres, throttleMs: 10 });
const merged = mergeCityAndLocationEvents(cityEvents, locationEvents);

const nextWeekStart = "2026-06-01";
const nextWeekEnd = "2026-06-08";
const inNext = merged.filter(
  (e) => e.localDate >= nextWeekStart && e.localDate < nextWeekEnd
);
const cityNext = cityEvents.filter(
  (e) => e.localDate >= nextWeekStart && e.localDate < nextWeekEnd
);

console.log({
  sampleCentres: sampleCentres.length,
  cityEvents: cityEvents.length,
  locationEvents: locationEvents.length,
  merged: merged.length,
  cityNextWeek: cityNext.length,
  mergedNextWeek: inNext.length,
  dataTo: [...merged.map((e) => e.localDate)].sort().pop(),
});
