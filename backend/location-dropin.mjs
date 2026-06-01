import { parseCalendarDate, torontoWallToUTC } from "../shared/toronto.mjs";

const LOCATION_DATA_BASE = "https://www.toronto.ca/data/parks/live/locations/";
const LOCATION_PAGE_BASE =
  "https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/";

const DAY_OFFSET = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

const utf16Decoder = new TextDecoder("utf-16le");

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

function addDaysYmd(ymd, days) {
  const cal = parseCalendarDate(ymd);
  if (!cal) return null;
  const d = new Date(cal.y, cal.mo, cal.d);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function localDateForWeekDay(weekStartYmd, dayName) {
  const offset = DAY_OFFSET[String(dayName ?? "").toLowerCase()];
  if (offset == null) return null;
  return addDaysYmd(weekStartYmd, offset);
}

function statusFromLocationTime(row) {
  const s = String(row?.status ?? "").toLowerCase();
  if (s === "cancelled") return "Cancelled";
  if (s === "closed") return "Closed";
  return "Available";
}

function hasProgramsFlag(value) {
  return value === true || value === "true";
}

async function fetchLocationJson(locationId, path) {
  const url = `${LOCATION_DATA_BASE}${locationId}/${path}`;
  const referer = `${LOCATION_PAGE_BASE}?id=${locationId}`;
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      referer,
      "user-agent": "TorontoDropInTracker/0.1 (educational project)",
    },
  });
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  let text = utf16Decoder.decode(buf).replace(/^\uFEFF/, "");
  if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
    text = new TextDecoder("utf-8").decode(buf);
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * @param {{ locationId: number, centreId: string, centreName: string, officialUrl?: string }} centre
 * @returns {Promise<import("../shared/schema.mjs").DropInEvent[]>}
 */
export async function scrapeLocationSportsWeeks(centre) {
  const { locationId, centreId, centreName, officialUrl } = centre;
  const nowIso = new Date().toISOString();
  const sourceUrl = officialUrl || `${LOCATION_PAGE_BASE}?id=${locationId}`;
  const events = [];

  const info = await fetchLocationJson(locationId, "sports/info.json");
  const weeks = Array.isArray(info?.weeks) ? info.weeks : [];

  for (const week of weeks) {
    if (!hasProgramsFlag(week?.hasPrograms) || !week?.json) continue;
    const weekStart = String(week.title ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) continue;

    const data = await fetchLocationJson(locationId, `sports/${week.json}`);
    const programs = Array.isArray(data?.programs) ? data.programs : [];

    for (const program of programs) {
      for (const dayRow of program?.days ?? []) {
        const sport = String(dayRow?.title ?? program?.program ?? "Drop-in").trim();
        if (!sport) continue;

        for (const slot of dayRow?.times ?? []) {
          const localDate = localDateForWeekDay(weekStart, slot?.day);
          const time = parseTimeRange(slot?.title);
          if (!localDate || !time) continue;

          const cal = parseCalendarDate(localDate);
          if (!cal) continue;

          const startIso = torontoWallToUTC(
            cal.y,
            cal.mo,
            cal.d,
            time.start.hour,
            time.start.minute
          );
          const endIso = torontoWallToUTC(cal.y, cal.mo, cal.d, time.end.hour, time.end.minute);

          const age = dayRow?.age ? String(dayRow.age).trim() : undefined;
          const tags = ["Drop-in"];
          if (age) tags.push(age);

          const eventId = `loc_${locationId}_${sport
            .toLowerCase()
            .replaceAll(/[^a-z0-9]+/g, "_")}_${localDate}_${String(time.start.hour).padStart(2, "0")}${String(
            time.start.minute
          ).padStart(2, "0")}`;

          events.push({
            id: eventId,
            centreId,
            sport,
            age,
            localDate,
            start: startIso,
            end: endIso,
            dayOfWeek: cal.dayOfWeek,
            tags,
            status: statusFromLocationTime(slot),
            source: {
              sourceName: `${centreName} facility page`,
              sourceUrl,
              lastSeenAt: nowIso,
              rawTextSnippet: `${sport} | ${localDate} | ${slot.title}`.slice(0, 240),
            },
            notes:
              String(slot?.comment ?? "").trim() ||
              (String(slot?.status ?? "").toLowerCase() === "cancelled" ? "Cancelled on facility schedule." : undefined),
          });
        }
      }
    }

    await new Promise((r) => setTimeout(r, 20));
  }

  return events;
}

export function eventMergeKey(event) {
  const d = new Date(event.start);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const sport = String(event.sport ?? "")
    .toLowerCase()
    .replaceAll(/\s+/g, " ")
    .trim();
  return `${event.centreId}|${event.localDate}|${hour}:${minute}|${sport}`;
}

/**
 * City map feed wins when the same session appears on both sources.
 * @param {import("../shared/schema.mjs").DropInEvent[]} cityEvents
 * @param {import("../shared/schema.mjs").DropInEvent[]} locationEvents
 */
export function mergeCityAndLocationEvents(cityEvents, locationEvents) {
  const byKey = new Map();
  for (const e of cityEvents) byKey.set(eventMergeKey(e), e);
  for (const e of locationEvents) {
    const key = eventMergeKey(e);
    if (!byKey.has(key)) byKey.set(key, e);
  }
  const seenIds = new Set();
  const merged = [];
  for (const e of byKey.values()) {
    if (seenIds.has(e.id)) continue;
    seenIds.add(e.id);
    merged.push(e);
  }
  return merged;
}

/**
 * @param {Array<{ id: string, name: string, officialUrl?: string }>} centres
 */
export async function scrapeAllLocationSports({ centres, throttleMs = 35 }) {
  const all = [];
  for (const centre of centres) {
    const locationId = Number(String(centre.id).replace(/^cot_/, ""));
    if (!Number.isFinite(locationId)) continue;
    const events = await scrapeLocationSportsWeeks({
      locationId,
      centreId: centre.id,
      centreName: centre.name,
      officialUrl: centre.officialUrl,
    });
    all.push(...events);
    await new Promise((r) => setTimeout(r, throttleMs));
  }
  return all;
}
