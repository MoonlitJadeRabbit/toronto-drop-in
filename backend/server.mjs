import http from "node:http";
import { access, copyFile, readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";
import {
  mergeCityAndLocationEvents,
  scrapeAllLocationSports,
} from "./location-dropin.mjs";
import { buildGeocodeQuery, normalizeCanadianPostalCode } from "../shared/geocode-query.mjs";
import {
  parseCalendarDate,
  torontoWallToUTC,
  torontoTodayYmd,
  torontoYmd,
} from "../shared/toronto.mjs";

const PORT = process.env.PORT ? Number(process.env.PORT) : 5173;
const ROOT = normalize(join(process.cwd()));
const FRONTEND_DIR = join(ROOT, "frontend");
const DATA_DIR = join(ROOT, "data");
const CACHE_PATH = join(DATA_DIR, "cache.json");
const CACHE_SEED_PATH = join(DATA_DIR, "cache.seed.json");
const OVERRIDES_PATH = join(DATA_DIR, "overrides.json");

const MIME_BY_EXT = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const LIVE_ALERTS_TTL_MS = 30_000;
let liveAlertsCache = /** @type {{ fetchedAtMs: number, byLocationId: Map<number, any> } | null} */ (
  null
);
let liveAlertsInFlight = /** @type {Promise<Map<number, any>> | null} */ (null);

const CACHE_STALE_MS = 6 * 60 * 60 * 1000; // 6 hours
let refreshInFlight = /** @type {Promise<any> | null} */ (null);
let coordsByLocationId = /** @type {Map<number, { lat: number, lng: number }> | null} */ (null);
const geocodeCache = new Map();

const TORONTO_VIEWBOX = "-79.64,43.58,-79.11,43.86";
const NOMINATIM_HEADERS = {
  "user-agent": "TorontoDropInTracker/0.1 (torontodropin.ca)",
  accept: "application/json",
};

/** Nominatim often returns this for postalcode+Toronto — wrong for distance sorting. */
function isGenericTorontoCentroid(lat, lng) {
  return Math.abs(lat - 43.6534817) < 0.002 && Math.abs(lng - -79.3839347) < 0.002;
}

function inGtaBox(lat, lng) {
  return lat >= 43.58 && lat <= 43.86 && lng >= -79.64 && lng <= -79.11;
}

async function fetchNominatimSearch(q, { bounded = true } = {}) {
  const params = new URLSearchParams({
    format: "json",
    limit: "5",
    countrycodes: "ca",
    q,
  });
  if (bounded) {
    params.set("viewbox", TORONTO_VIEWBOX);
    params.set("bounded", "1");
  }
  const geoRes = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: NOMINATIM_HEADERS }
  );
  if (!geoRes.ok) return [];
  const hits = await geoRes.json();
  return Array.isArray(hits) ? hits : [];
}

function pickNominatimHit(hits) {
  for (const hit of hits) {
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (isGenericTorontoCentroid(lat, lng)) continue;
    if (!inGtaBox(lat, lng)) continue;
    return { lat, lng, label: hit.display_name };
  }
  return null;
}

async function geocodeCanadianPostal(postal) {
  const compact = postal.replace(/\s/g, "");
  const params = new URLSearchParams({
    q: compact,
    lang: "en",
    keys: "nominatim,locate,fsa",
  });
  const res = await fetch(`https://geolocator.api.geo.ca/?${params}`, {
    headers: NOMINATIM_HEADERS,
  });
  if (!res.ok) return null;
  const hits = await res.json();
  if (!Array.isArray(hits) || hits.length === 0) return null;

  const fsa = postal.slice(0, 3);
  const nominatim = hits.find(
    (h) =>
      h.key === "nominatim" &&
      typeof h.lat === "number" &&
      typeof h.lng === "number" &&
      !isGenericTorontoCentroid(h.lat, h.lng) &&
      inGtaBox(h.lat, h.lng)
  );
  if (nominatim) {
    return {
      lat: nominatim.lat,
      lng: nominatim.lng,
      label: `${postal}, Toronto`,
    };
  }

  const locate =
    hits.find(
      (h) =>
        h.key === "locate" &&
        h.category === "PostalCode" &&
        h.name === fsa &&
        typeof h.lat === "number" &&
        typeof h.lng === "number"
    ) ??
    hits.find(
      (h) =>
        h.key === "locate" &&
        typeof h.lat === "number" &&
        typeof h.lng === "number" &&
        inGtaBox(h.lat, h.lng)
    );
  if (locate) {
    return {
      lat: locate.lat,
      lng: locate.lng,
      label: `${postal}, Toronto`,
    };
  }

  const fsaHit = hits.find(
    (h) =>
      h.key === "fsa" &&
      typeof h.lat === "number" &&
      typeof h.lng === "number" &&
      inGtaBox(h.lat, h.lng)
  );
  if (fsaHit) {
    return {
      lat: fsaHit.lat,
      lng: fsaHit.lng,
      label: `${postal}, Toronto`,
    };
  }

  return null;
}

async function resolveGeocode(rawQ, built) {
  if (built.type === "postal") {
    const fromCanada = await geocodeCanadianPostal(built.postal);
    if (fromCanada) return { ...fromCanada, postalCode: built.postal };

    let picked = pickNominatimHit(await fetchNominatimSearch(built.q, { bounded: true }));
    if (!picked) picked = pickNominatimHit(await fetchNominatimSearch(built.q, { bounded: false }));
    if (picked) return { ...picked, label: `${built.postal}, Toronto`, postalCode: built.postal };
    return null;
  }

  let picked = pickNominatimHit(await fetchNominatimSearch(built.q, { bounded: true }));
  if (!picked) picked = pickNominatimHit(await fetchNominatimSearch(built.q, { bounded: false }));
  if (!picked) return null;
  return { lat: picked.lat, lng: picked.lng, label: picked.label };
}

async function getCoordsByLocationId() {
  if (coordsByLocationId) return coordsByLocationId;
  const featureUrl =
    "https://services3.arcgis.com/b9WvedVPoizGfvfD/arcgis/rest/services/COT_Sports_Drop_In_View/FeatureServer/0/query" +
    "?f=json&where=show_on_sports_map%20%3D%20%27Yes%27&returnGeometry=false&outFields=locationid,x,y" +
    "&resultRecordCount=2000";
  const j = await fetch(featureUrl).then((r) => r.json());
  const map = new Map();
  for (const f of j?.features ?? []) {
    const a = f.attributes ?? {};
    const id = a.locationid;
    if (typeof id === "number" && typeof a.y === "number" && typeof a.x === "number") {
      map.set(id, { lat: a.y, lng: a.x });
    }
  }
  coordsByLocationId = map;
  return map;
}

async function enrichCentresWithCoordsAsync(centres) {
  const needsLookup = centres.some(
    (c) => typeof c.lat !== "number" || typeof c.lng !== "number"
  );
  if (!needsLookup) return centres;
  const map = await getCoordsByLocationId();
  return centres.map((c) => {
    if (typeof c.lat === "number" && typeof c.lng === "number") return c;
    const locId = Number(String(c.id).replace(/^cot_/, ""));
    const coords = map.get(locId);
    if (!coords) return c;
    return { ...c, lat: coords.lat, lng: coords.lng };
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, null, 2));
}

function sendText(res, status, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": contentType });
  res.end(text);
}

function parseUrl(reqUrl) {
  const url = new URL(reqUrl, `http://localhost:${PORT}`);
  return url;
}

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

async function writeJson(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function mondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toYYYYMMDD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function includesWeek(eventIso, weekStartYYYYMMDD) {
  const weekStart = new Date(`${weekStartYYYYMMDD}T00:00:00`);
  const weekEnd = addDays(weekStart, 7);
  const t = new Date(eventIso);
  return t >= weekStart && t < weekEnd;
}

function includesRange(eventIso, startYYYYMMDD, endYYYYMMDD) {
  const start = new Date(`${startYYYYMMDD}T00:00:00`);
  const end = new Date(`${endYYYYMMDD}T00:00:00`);
  const t = new Date(eventIso);
  return t >= start && t < end;
}

function applyOverrides(payload, overrides) {
  const centreOverrides = new Map(
    (overrides.centreOverrides ?? []).map((o) => [o.centreId, o])
  );
  const eventOverrides = new Map(
    (overrides.eventOverrides ?? []).map((o) => [o.eventId, o])
  );
  const ruleOverrides = Array.isArray(overrides.ruleOverrides) ? overrides.ruleOverrides : [];

  const centres = payload.centres.map((c) => {
    const o = centreOverrides.get(c.id);
    if (!o) return c;
    return { ...c, ...(o.patch ?? {}) };
  });

  const events = payload.events.map((e) => {
    const o = eventOverrides.get(e.id);
    let next = o ? { ...e, ...(o.patch ?? {}) } : e;

    for (const r of ruleOverrides) {
      const match = r?.match ?? {};
      if (match?.centreId && match.centreId !== next.centreId) continue;
      if (match?.sport && String(match.sport).toLowerCase() !== String(next.sport).toLowerCase())
        continue;
      if (match?.startGte && new Date(next.start) < new Date(match.startGte)) continue;
      if (match?.startLt && new Date(next.start) >= new Date(match.startLt)) continue;
      next = { ...next, ...(r.patch ?? {}) };
    }

    return next;
  });

  return { ...payload, centres, events };
}

async function getLiveCentreAlerts() {
  const now = Date.now();
  if (liveAlertsCache && now - liveAlertsCache.fetchedAtMs < LIVE_ALERTS_TTL_MS) {
    return liveAlertsCache.byLocationId;
  }
  // Never block schedule responses on a live feed fetch — use stale/empty and refresh in background.
  if (!liveAlertsInFlight) {
    liveAlertsInFlight = fetchLiveCentreAlerts().finally(() => {
      liveAlertsInFlight = null;
    });
  }
  return liveAlertsCache?.byLocationId ?? new Map();
}

async function fetchLiveCentreAlerts() {
  const url = "https://www.toronto.ca/data/parks/live/centres.json";
  let byLocationId = new Map();
  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "TorontoDropInTracker/0.1",
      },
    });
    if (res.ok) {
      const j = await res.json();
      for (const asset of j?.assets ?? []) {
        const locId = asset?.LocationID;
        if (typeof locId !== "number") continue;
        byLocationId.set(locId, asset);
      }
    }
  } catch {
    // Best-effort; keep empty.
  }

  liveAlertsCache = { fetchedAtMs: Date.now(), byLocationId };
  return byLocationId;
}

function applyLiveAlertsToWeekPayload(payload, byLocationId) {
  const events = payload.events.map((e) => {
    const locId = Number(String(e.centreId).replace(/^cot_/, ""));
    const alert = byLocationId.get(locId);
    if (!alert) return e;

    // Heuristic based on the City map JS:
    // - Status 2 is "servicealert"
    // - other non-1 statuses can indicate closure/alert
    const statusNum = alert?.Status;
    const reason = String(alert?.Reason ?? "").trim();
    const comments = String(alert?.Comments ?? "").trim();
    const posted = String(alert?.PostedDate ?? "").trim();
    const note = [reason, comments, posted ? `Posted: ${posted}` : ""].filter(Boolean).join(" — ");

    if (statusNum === 2) {
      // Service alert: don't assume cancelled, but surface loudly.
      return { ...e, status: e.status === "Available" ? "Unknown" : e.status, notes: note || e.notes };
    }

    // Closure / severe alert: mark as closed unless explicitly cancelled already.
    if (e.status === "Cancelled") return { ...e, notes: note || e.notes };
    return { ...e, status: "Closed", notes: note || e.notes };
  });

  return { ...payload, events };
}

function parseTimeToken(token) {
  const m = token.trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const isPm = m[3] === "pm";
  if (isPm && hour !== 12) hour += 12;
  if (!isPm && hour === 12) hour = 0;
  return { hour, minute };
}

function parseTimeRange(str) {
  const cleaned = String(str ?? "")
    .replaceAll("–", "-")
    .replaceAll(" to ", "-")
    .replaceAll(/\s+/g, " ")
    .trim();

  const m = cleaned.match(
    /(\d{1,2}:\d{2}\s*(?:am|pm))\s*-\s*(\d{1,2}:\d{2}\s*(?:am|pm))/i
  );
  if (!m) return null;
  const start = parseTimeToken(m[1]);
  const end = parseTimeToken(m[2]);
  if (!start || !end) return null;
  return { start, end };
}

function statusFromProgramRow(row) {
  // From City UI code:
  // - if row.res (reserve a spot), row.s == 2 => Available; row.s == 1 => Some Spots Left; else Full
  // - else: Drop-in Only (no reserve)
  if (row?.res) {
    if (row?.s === 2 || row?.s === 1) return "Available";
    return "Full";
  }
  return "Available";
}

async function scrapeCityDropinSports({ maxLocations = 9999 }) {
  const featureUrl =
    "https://services3.arcgis.com/b9WvedVPoizGfvfD/arcgis/rest/services/COT_Sports_Drop_In_View/FeatureServer/0/query" +
    "?f=json" +
    "&where=show_on_sports_map%20%3D%20%27Yes%27" +
    "&returnGeometry=false" +
    "&outFields=*" +
    "&resultOffset=0" +
    "&resultRecordCount=2000";

  const sourceUrl = "https://www.toronto.ca/explore-enjoy/parks-recreation/program-activities/sports/drop-in-sports-map/";
  const nowIso = new Date().toISOString();

  const featuresJson = await fetch(featureUrl, {
    headers: {
      "user-agent":
        "TorontoDropInTracker/0.1 (educational project; contact: local-dev)",
      accept: "application/json",
    },
  }).then((r) => r.json());

  const features = Array.isArray(featuresJson?.features) ? featuresJson.features : [];
  const picked = features.slice(0, maxLocations);

  /** @type {import("../shared/schema.mjs").CommunityCentre[]} */
  const centres = [];
  /** @type {import("../shared/schema.mjs").DropInEvent[]} */
  const events = [];

  const utf16Decoder = new TextDecoder("utf-16le");

  async function fetchSchedule(locationId) {
    const scheduleUrl = `https://www.toronto.ca/data/parks/live/dropin/sports/${locationId}.json`;
    try {
      const res = await fetch(scheduleUrl, {
        headers: {
          "user-agent": "TorontoDropInTracker/0.1",
          accept: "application/json",
          referer: sourceUrl,
        },
      });
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      // These feeds are often UTF-16LE encoded.
      const text = utf16Decoder.decode(buf).replace(/^\uFEFF/, "");
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  for (const f of picked) {
    const a = f.attributes ?? {};
    const locationId = a.locationid ?? a.LocationID ?? a.location_id;
    if (locationId == null) continue;

    const centreId = `cot_${locationId}`;
    const centreName = a.complexname ?? a.ComplexName ?? `Location ${locationId}`;
    const address = a.address ?? "";
    const officialUrl = a.website ?? "";

    const lng = typeof a.x === "number" ? a.x : undefined;
    const lat = typeof a.y === "number" ? a.y : undefined;

    centres.push({
      id: centreId,
      name: String(centreName),
      address: String(address),
      officialUrl: officialUrl ? String(officialUrl) : undefined,
      lat,
      lng,
    });

    const schedule = await fetchSchedule(locationId);
    if (!Array.isArray(schedule) || schedule.length === 0) continue;

    for (const group of schedule) {
      for (const row of group?.r ?? []) {
        const dateVal = row?.d;
        const timeVal = row?.t;
        const activity = String(row?.c ?? "").trim();
        if (!dateVal || !timeVal || !activity) continue;

        const time = parseTimeRange(timeVal);
        const cal = parseCalendarDate(dateVal);
        if (!time || !cal) continue;

        const startIso = torontoWallToUTC(
          cal.y,
          cal.mo,
          cal.d,
          time.start.hour,
          time.start.minute
        );
        const endIso = torontoWallToUTC(cal.y, cal.mo, cal.d, time.end.hour, time.end.minute);

        const sport = activity.replaceAll(/\s+/g, " ");
        const eventId = `${centreId}_${sport
          .toLowerCase()
          .replaceAll(/[^a-z0-9]+/g, "_")}_${cal.localDate}_${String(time.start.hour).padStart(2, "0")}${String(
          time.start.minute
        ).padStart(2, "0")}`;

        const tags = ["Drop-in"];
        if (row?.age) tags.push(String(row.age));
        if (row?.f) tags.push(String(row.f));
        if (row?.res) tags.push("Reserve-a-Spot");

        events.push({
          id: eventId,
          centreId,
          sport,
          age: row?.age ? String(row.age).trim() : undefined,
          localDate: cal.localDate,
          start: startIso,
          end: endIso,
          dayOfWeek: cal.dayOfWeek,
          tags,
          status: statusFromProgramRow(row),
          source: {
            sourceName: "City of Toronto drop-in sports map",
            sourceUrl,
            lastSeenAt: nowIso,
            rawTextSnippet: `${sport} | ${cal.localDate} | ${timeVal}`.slice(0, 240),
          },
          notes: row?.res
            ? row?.s === 1
              ? "Some spots left (reservation)."
              : row?.s === 2
                ? "Available (reservation)."
                : "May be full (reservation)."
            : undefined,
        });
      }
    }

    // Throttle between locations (polite scraping).
    await new Promise((r) => setTimeout(r, 35));
  }

  // Basic de-dupe
  const seen = new Set();
  const dedupedEvents = [];
  for (const e of events) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    dedupedEvents.push(e);
  }

  return { centres, events: dedupedEvents, sourceUrl };
}

function inferStatusFromText(text) {
  const t = text.toLowerCase();
  if (/\bcancel(l)?ed\b/.test(t)) return "Cancelled";
  if (/\bclosed\b/.test(t)) return "Closed";
  if (/\bfull\b/.test(t)) return "Full";
  if (/\bavailable\b/.test(t)) return "Available";
  return "Unknown";
}

function cacheDateSpan(events) {
  const dates = (events ?? [])
    .map((e) => e.localDate || (e.start ? String(e.start).slice(0, 10) : null))
    .filter(Boolean)
    .sort();
  if (dates.length === 0) return { dataFrom: null, dataTo: null };
  return { dataFrom: dates[0], dataTo: dates[dates.length - 1] };
}

async function refreshCache() {
  const scraped = await scrapeCityDropinSports({});
  const locationEvents = await scrapeAllLocationSports({ centres: scraped.centres });
  const mergedEvents = mergeCityAndLocationEvents(scraped.events, locationEvents);
  const fetchedAt = new Date().toISOString();
  const span = cacheDateSpan(mergedEvents);
  const weekStart = toYYYYMMDD(mondayOfWeek(new Date()));

  /** @type {import("../shared/schema.mjs").WeekPayload} */
  const payload = {
    weekStart,
    fetchedAt,
    dataFrom: span.dataFrom,
    dataTo: span.dataTo,
    centres: scraped.centres,
    events: mergedEvents,
  };

  await writeJson(CACHE_PATH, payload);
  return payload;
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Render free tier wipes disk on sleep — restore bundled schedules so the UI is instant. */
async function bootstrapCacheFromSeed() {
  if (await pathExists(CACHE_PATH)) return false;
  if (!(await pathExists(CACHE_SEED_PATH))) return false;
  await copyFile(CACHE_SEED_PATH, CACHE_PATH);
  console.log("Restored schedule cache from cache.seed.json");
  return true;
}

function scheduleBackgroundRefresh(existingCache) {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = refreshCache()
    .catch((err) => {
      console.error("Background refresh failed:", err?.message ?? err);
      return existingCache;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

async function ensureFreshCache({ waitForRefresh = false } = {}) {
  let cache;
  try {
    cache = await readJson(CACHE_PATH);
  } catch {
    cache = null;
  }

  const hasEvents = (cache?.events?.length ?? 0) > 0;
  const fetchedAtMs = cache?.fetchedAt ? new Date(cache.fetchedAt).getTime() : 0;
  const isStale = !fetchedAtMs || Number.isNaN(fetchedAtMs) || Date.now() - fetchedAtMs > CACHE_STALE_MS;
  const today = torontoTodayYmd();
  const dataTo = cache?.dataTo ?? null;
  const needsNewerDates = !dataTo || dataTo < today;
  const shouldRefresh = !hasEvents || isStale || needsNewerDates;

  if (shouldRefresh) {
    const refreshPromise = scheduleBackgroundRefresh(cache);
    if (!hasEvents && waitForRefresh) return refreshPromise;
    if (!hasEvents) return cache;
  }

  return cache;
}

async function serveStatic(req, res) {
  const url = parseUrl(req.url ?? "/");
  let pathname = url.pathname;
  if (pathname === "/") pathname = "/index.html";

  const safePath = normalize(pathname).replaceAll("..", "");
  const filePath = pathname.startsWith("/shared/")
    ? join(ROOT, safePath)
    : join(FRONTEND_DIR, safePath);
  const ext = extname(filePath);

  const stream = createReadStream(filePath);
  let responded = false;

  stream.on("error", () => {
    if (responded) return;
    responded = true;
    if (!res.headersSent) sendText(res, 404, "Not found");
    else res.end();
  });

  if (responded) return;
  responded = true;
  res.writeHead(200, {
    "content-type": MIME_BY_EXT[ext] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  stream.pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = parseUrl(req.url ?? "/");

    if (url.pathname.startsWith("/api/")) {
      const weekStart =
        url.searchParams.get("start") ?? toYYYYMMDD(mondayOfWeek(new Date()));

      if (url.pathname === "/api/status" && req.method === "GET") {
        let cache = null;
        try {
          cache = await readJson(CACHE_PATH);
        } catch {
          /* no cache yet */
        }
        return sendJson(res, 200, {
          ready: (cache?.events?.length ?? 0) > 0,
          refreshing: Boolean(refreshInFlight),
          eventCount: cache?.events?.length ?? 0,
          dataTo: cache?.dataTo ?? null,
          fetchedAt: cache?.fetchedAt ?? null,
        });
      }

      if (url.pathname === "/api/schedule" && req.method === "GET") {
        const cache = await ensureFreshCache();
        if (!cache || (cache.events?.length ?? 0) === 0) {
          return sendJson(res, 503, {
            error: "Schedule cache not ready",
            refreshing: Boolean(refreshInFlight),
            hint: "First load on the server can take 1–2 minutes. Retry shortly.",
          });
        }
        const overrides = await readJson(OVERRIDES_PATH);
        const span = cacheDateSpan(cache.events);
        const filtered = {
          ...cache,
          ...span,
          weekStart: toYYYYMMDD(mondayOfWeek(new Date())),
          events: cache.events ?? [],
        };
        const liveAlerts = await getLiveCentreAlerts();
        const withLive = applyLiveAlertsToWeekPayload(filtered, liveAlerts);
        const withCoords = {
          ...withLive,
          centres: await enrichCentresWithCoordsAsync(withLive.centres ?? []),
        };
        return sendJson(res, 200, applyOverrides(withCoords, overrides));
      }

      if (url.pathname === "/api/week" && req.method === "GET") {
        const cache = await ensureFreshCache();
        if (!cache || (cache.events?.length ?? 0) === 0) {
          return sendJson(res, 503, {
            error: "Schedule cache not ready",
            refreshing: Boolean(refreshInFlight),
          });
        }
        const overrides = await readJson(OVERRIDES_PATH);
        const days = Math.min(14, Math.max(1, Number(url.searchParams.get("days") || "7")));
        const rangeEnd = toYYYYMMDD(addDays(new Date(`${weekStart}T00:00:00`), days));
        const filtered = {
          ...cache,
          events: (cache.events ?? []).filter((e) => {
            const ld = e.localDate || torontoYmd(e.start);
            return days > 7
              ? ld >= weekStart && ld < rangeEnd
              : includesWeek(e.start, weekStart);
          }),
          weekStart,
          rangeEnd: days > 7 ? rangeEnd : undefined,
        };
        const liveAlerts = await getLiveCentreAlerts();
        const withLive = applyLiveAlertsToWeekPayload(filtered, liveAlerts);
        const withCoords = {
          ...withLive,
          centres: await enrichCentresWithCoordsAsync(withLive.centres ?? []),
        };
        return sendJson(res, 200, applyOverrides(withCoords, overrides));
      }

      if (url.pathname === "/api/centres" && req.method === "GET") {
        const cache = await readJson(CACHE_PATH);
        return sendJson(res, 200, cache.centres ?? []);
      }

      if (url.pathname === "/api/geocode" && req.method === "GET") {
        const rawQ = (url.searchParams.get("q") ?? "").trim();
        if (!rawQ) return sendJson(res, 400, { error: "Missing q" });

        const postal = normalizeCanadianPostalCode(rawQ);
        const cacheKey = (postal ?? rawQ).toLowerCase();
        if (geocodeCache.has(cacheKey)) return sendJson(res, 200, geocodeCache.get(cacheKey));

        const built = buildGeocodeQuery(rawQ);
        const resolved = await resolveGeocode(rawQ, built);
        if (!resolved) return sendJson(res, 404, { error: "Location not found" });

        geocodeCache.set(cacheKey, resolved);
        return sendJson(res, 200, resolved);
      }

      if (url.pathname === "/api/refresh" && req.method === "POST") {
        if (process.env.ALLOW_REFRESH !== "1") {
          return sendJson(res, 403, { error: "Refresh disabled. Set ALLOW_REFRESH=1." });
        }
        const payload = await refreshCache();
        return sendJson(res, 200, payload);
      }

      if (url.pathname === "/api/refresh" && req.method === "GET") {
        if (process.env.ALLOW_REFRESH !== "1") {
          return sendJson(res, 403, { error: "Refresh disabled. Set ALLOW_REFRESH=1." });
        }
        scheduleBackgroundRefresh(null);
        return sendJson(res, 202, { status: "Refresh started" });
      }

      return sendJson(res, 404, { error: "Not found" });
    }

    return serveStatic(req, res);
  } catch (err) {
    return sendJson(res, 500, {
      error: "Internal server error",
      detail: String(err?.message ?? err),
    });
  }
});

async function startServer() {
  await bootstrapCacheFromSeed();
  fetchLiveCentreAlerts().catch(() => {});
  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    if (process.env.ALLOW_REFRESH === "1") {
      console.log("Starting background schedule refresh…");
      scheduleBackgroundRefresh(null).catch(() => {});
    }
    setInterval(() => {
      ensureFreshCache().catch(() => {});
    }, CACHE_STALE_MS);
  });
}

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});

