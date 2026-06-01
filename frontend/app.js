import React from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import {
  isPartialCanadianPostalCode,
  normalizeCanadianPostalCode,
} from "/shared/geocode-query.mjs";

const TORONTO_TZ = "America/Toronto";

function torontoYmd(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TORONTO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function torontoTodayYmd() {
  return torontoYmd(new Date());
}

function torontoTodayDow() {
  const [y, m, d] = torontoTodayYmd().split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function dayOfWeekFromLocalDate(localDate) {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function eventDayOfWeek(ev) {
  if (ev.localDate) return dayOfWeekFromLocalDate(ev.localDate);
  return dayOfWeekFromLocalDate(torontoYmd(ev.start));
}

const LS_THEME_KEY = "tdi:theme";
const MAX_DISTANCE_KM = 30;

const WEEKDAYS = [
  { dow: 1, label: "Mon" },
  { dow: 2, label: "Tue" },
  { dow: 3, label: "Wed" },
  { dow: 4, label: "Thu" },
  { dow: 5, label: "Fri" },
  { dow: 6, label: "Sat" },
  { dow: 0, label: "Sun" },
];

const SPORTS = [
  "Badminton",
  "Basketball",
  "Volleyball",
  "Pickleball",
  "Swimming",
  "Table Tennis",
  "Soccer",
  "Open Gym",
];

function sportMatches(eventSport, selected) {
  const s = eventSport.toLowerCase();
  const q = selected.toLowerCase();
  return s.includes(q) || q.includes(s.split(" ")[0]);
}

function isAgeTag(tag) {
  if (!tag || tag === "Drop-in" || tag === "Reserve-a-Spot") return false;
  if (/^gymnasium|^pool|^court/i.test(tag)) return false;
  return /\d/.test(tag) || /years?|adult|child|youth|older|family/i.test(tag);
}

function formatAgeShort(raw) {
  const s = String(raw).trim();
  let m = s.match(/(\d+)\s*-\s*(\d+)\s*years?/i);
  if (m) return `${m[1]}–${m[2]}`;
  m = s.match(/(\d+)\s*years?\s*and\s*over/i);
  if (m) return `${m[1]}+`;
  m = s.match(/(\d+)\s*\+\s*years?/i);
  if (m) return `${m[1]}+`;
  if (/older\s*adult/i.test(s)) return "60+";
  const adultPlus = s.match(/adult\s*(\d+)\s*\+/i);
  if (adultPlus) return `${adultPlus[1]}+`;
  return s.replace(/\s*years?\s*$/i, "").trim();
}

function ageForEvent(ev) {
  const raw = ev.age || (ev.tags || []).find(isAgeTag);
  return raw ? formatAgeShort(raw) : "";
}

function sessionTitle(ev) {
  const age = ageForEvent(ev);
  return age ? `${ev.sport} (${age})` : ev.sport;
}

function h(type, props, ...children) {
  return React.createElement(type, props, ...children);
}

function mondayOfWeek(date) {
  const d = new Date(date);
  const diff = (d.getDay() === 0 ? -6 : 1) - d.getDay();
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toYYYYMMDD(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(startIso, endIso) {
  const fmt = (iso) =>
    new Intl.DateTimeFormat(undefined, {
      timeZone: TORONTO_TZ,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  return `${fmt(startIso)}–${fmt(endIso)}`;
}

function formatShortDate(iso) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: TORONTO_TZ,
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function eventLocalDate(ev) {
  return (
    ev.localDate ||
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TORONTO_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ev.start))
  );
}

function mondayOfWeekToronto(fromDate = new Date()) {
  const ymd = torontoYmd(fromDate);
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  const monday = new Date(y, m - 1, d);
  const diff = dow === 0 ? -6 : 1 - dow;
  monday.setDate(monday.getDate() + diff);
  return monday;
}

function weekBounds(weekOffset) {
  const monday = mondayOfWeekToronto();
  monday.setDate(monday.getDate() + weekOffset * 7);
  const end = new Date(monday);
  end.setDate(end.getDate() + 7);
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const startYmd = fmt(monday);
  const endYmd = fmt(end);
  const label = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(monday);
  const labelEnd = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(end.getTime() - 86400000));
  return {
    startYmd,
    endYmd,
    rangeLabel: `${label} – ${labelEnd}`,
  };
}

function eventInWeek(ev, startYmd, endYmd) {
  const ld = eventLocalDate(ev);
  return ld >= startYmd && ld < endYmd;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function statusClass(status) {
  const s = (status || "").toLowerCase();
  if (s === "available") return "good";
  if (s === "cancelled" || s === "closed") return "bad";
  return "warn";
}

async function loadSchedule() {
  const weekStart = toYYYYMMDD(mondayOfWeek(new Date()));
  const maxAttempts = 90;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const trySchedule = await fetch("/api/schedule");
    if (trySchedule.ok) return trySchedule.json();

    if (trySchedule.status === 503) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    const week = await fetch(`/api/week?start=${encodeURIComponent(weekStart)}&days=14`);
    if (week.ok) return week.json();
    throw new Error("Could not load schedules");
  }

  throw new Error(
    "Schedules are still loading on the server (first deploy can take 1–2 minutes). Please refresh the page."
  );
}

function App() {
  const [theme, setTheme] = React.useState(() => localStorage.getItem(LS_THEME_KEY) || "light");
  const [payload, setPayload] = React.useState(null);
  const [loadError, setLoadError] = React.useState(null);

  const [address, setAddress] = React.useState("");
  const [userLoc, setUserLoc] = React.useState(null);
  const [locLabel, setLocLabel] = React.useState("");
  const [locStatus, setLocStatus] = React.useState(""); // idle | loading | ok | fail

  const todayDow = React.useMemo(() => torontoTodayDow(), []);
  const todayYmd = React.useMemo(() => torontoTodayYmd(), []);
  const [selectedDow, setSelectedDow] = React.useState(() => torontoTodayDow());
  const [selectedSport, setSelectedSport] = React.useState("Badminton");
  const [weekOffset, setWeekOffset] = React.useState(0); // 0 = this week, 1 = next week

  const week = React.useMemo(() => weekBounds(weekOffset), [weekOffset]);

  const nextWeekHasData = React.useMemo(() => {
    const nw = weekBounds(1);
    return (payload?.events ?? []).some((ev) => eventInWeek(ev, nw.startYmd, nw.endYmd));
  }, [payload]);

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
    localStorage.setItem(LS_THEME_KEY, theme);
  }, [theme]);

  React.useEffect(() => {
    (async () => {
      try {
        setPayload(await loadSchedule());
      } catch (e) {
        setLoadError(String(e?.message ?? e));
      }
    })();
  }, []);

  React.useEffect(() => {
    const q = address.trim();
    const postal = normalizeCanadianPostalCode(q);

    if (q.length < 2 && !postal) {
      setUserLoc(null);
      setLocLabel("");
      setLocStatus("");
      return;
    }

    if (isPartialCanadianPostalCode(q)) {
      setUserLoc(null);
      setLocLabel("");
      setLocStatus("");
      return;
    }

    setLocStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setUserLoc({ lat: data.lat, lng: data.lng });
          setLocLabel(data.label || q);
          setLocStatus("ok");
        } else {
          setUserLoc(null);
          setLocLabel("");
          setLocStatus("fail");
        }
      } catch {
        setUserLoc(null);
        setLocStatus("fail");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [address]);

  const eventsByCentre = React.useMemo(() => {
    const map = new Map();

    for (const ev of payload?.events ?? []) {
      if (!eventInWeek(ev, week.startYmd, week.endYmd)) continue;
      if (eventDayOfWeek(ev) !== selectedDow) continue;
      if (!sportMatches(ev.sport, selectedSport)) continue;
      if (!map.has(ev.centreId)) map.set(ev.centreId, []);
      map.get(ev.centreId).push(ev);
    }
    for (const [, list] of map) {
      list.sort((a, b) => new Date(a.start) - new Date(b.start));
    }
    return map;
  }, [payload, selectedDow, selectedSport, week]);

  const centreList = React.useMemo(() => {
    const allCentres = (payload?.centres ?? []).slice();
    let rows = allCentres.map((centre) => {
      const sessions = eventsByCentre.get(centre.id) ?? [];
      let distanceKm = null;
      if (userLoc && typeof centre.lat === "number" && typeof centre.lng === "number") {
        distanceKm = haversineKm(userLoc.lat, userLoc.lng, centre.lat, centre.lng);
      }
      return { centre, sessions, distanceKm };
    });

    rows = rows.filter((r) => r.sessions.length > 0);

    if (userLoc && locStatus === "ok") {
      rows = rows.filter(
        (r) => r.distanceKm != null && r.distanceKm <= MAX_DISTANCE_KM
      );
      rows.sort((a, b) => a.distanceKm - b.distanceKm);
    } else {
      rows.sort((a, b) => a.centre.name.localeCompare(b.centre.name));
    }

    return rows;
  }, [payload, eventsByCentre, userLoc, locStatus]);

  const selectedLabel = WEEKDAYS.find((d) => d.dow === selectedDow)?.label ?? "";

  let locHint = "";
  if (locStatus === "loading") locHint = "Finding your location…";
  else if (locStatus === "fail")
    locHint = "Not found — try a Toronto street address or postal code (e.g. M5V 2T6)";
  else if (locStatus === "ok") locHint = `Nearest within ${MAX_DISTANCE_KM} km`;

  return h(
    "div",
    { className: "page" },
    h(
      "button",
      {
        type: "button",
        className: "theme-toggle",
        onClick: () => setTheme((t) => (t === "light" ? "dark" : "light")),
      },
      theme === "light" ? "Dark" : "Light"
    ),

    h("h1", { className: "title" }, "Toronto drop-in sports"),

    h("input", {
      className: "address-input",
      type: "text",
      placeholder: "Street address or postal code (e.g. M5V 2T6)",
      value: address,
      onChange: (e) => setAddress(e.target.value),
      autoComplete: "postal-code",
      inputMode: "text",
      spellCheck: false,
    }),
    locHint ? h("p", { className: `loc-hint ${locStatus}` }, locHint) : null,

    h("p", { className: "tab-label" }, "Week"),
    h(
      "div",
      { className: "week-tabs", role: "tablist", "aria-label": "Week" },
      h(
        "button",
        {
          type: "button",
          className: `week-tab ${weekOffset === 0 ? "active" : ""}`,
          onClick: () => setWeekOffset(0),
        },
        "This week"
      ),
      h(
        "button",
        {
          type: "button",
          className: `week-tab ${weekOffset === 1 ? "active" : ""}`,
          onClick: () => setWeekOffset(1),
        },
        "Next week"
      )
    ),
    h("p", { className: "sub week-range" }, week.rangeLabel),
    payload?.dataTo
      ? h(
          "p",
          { className: "sub data-note" },
          `Schedules through ${payload.dataTo} (city map + each centre's drop-in page).`
        )
      : null,
    weekOffset === 1 && payload && !nextWeekHasData
      ? h(
          "p",
          { className: "empty" },
          `No next-week drop-in sports posted yet for this filter. Try another sport or check the centre's page on toronto.ca.`
        )
      : null,

    h(
      "div",
      { className: "day-tabs", role: "tablist", "aria-label": "Day" },
      ...WEEKDAYS.map(({ dow, label }) =>
        h(
          "button",
          {
            key: dow,
            type: "button",
            role: "tab",
            className: `day-tab ${selectedDow === dow ? "active" : ""} ${dow === todayDow ? "today" : ""}`,
            onClick: () => setSelectedDow(dow),
          },
          label,
          dow === todayDow ? h("span", { className: "today-dot" }) : null
        )
      )
    ),

    h("p", { className: "tab-label" }, "Sport"),
    h(
      "div",
      { className: "sport-tabs", role: "tablist", "aria-label": "Sport" },
      ...SPORTS.map((s) =>
        h(
          "button",
          {
            key: s,
            type: "button",
            role: "tab",
            className: `sport-tab ${selectedSport === s ? "active" : ""}`,
            onClick: () => setSelectedSport(s),
          },
          s
        )
      )
    ),

    h(
      "p",
      { className: "sub" },
      loadError
        ? loadError
        : payload
          ? `${weekOffset === 0 ? "This week" : "Next week"} · ${selectedLabel} · ${selectedSport} · ${centreList.length} centres${locStatus === "ok" ? " nearby" : ""}`
          : "Loading schedules… (first server load can take 1–2 minutes)"
    ),

    payload && centreList.length === 0
      ? h(
          "p",
          { className: "empty" },
          locStatus === "ok"
            ? "No matching sessions nearby. Try next week, another sport, or day."
            : `No ${selectedSport} on ${selectedLabel} for ${weekOffset === 0 ? "this week" : "next week"}. Try another sport — Sundays are often lighter.`
        )
      : null,

    h(
      "div",
      { className: "centre-list" },
      ...centreList.map(({ centre, sessions, distanceKm }) =>
        h(
          "article",
          { key: centre.id, className: "centre-row" },
          h(
            "div",
            { className: "centre-head" },
            h("h2", null, centre.name),
            distanceKm != null
              ? h("span", { className: "dist" }, formatDistance(distanceKm) + " away")
              : h("span", { className: "dist muted" }, centre.address || "")
          ),
          h(
            "ul",
            { className: "sessions" },
            ...sessions.map((ev) =>
              h(
                "li",
                { key: ev.id },
                h("span", { className: "sport" }, sessionTitle(ev)),
                h(
                  "span",
                  { className: "when" },
                  `${formatShortDate(ev.start)} · ${formatTime(ev.start, ev.end)}`
                ),
                h("span", { className: `status ${statusClass(ev.status)}` }, ev.status || "—")
              )
            )
          )
        )
      )
    )
  );
}

createRoot(document.getElementById("app")).render(h(App));
