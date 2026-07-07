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
const LS_FAVOURITES_KEY = "tdi:favourite-centres";
const MAX_DISTANCE_KM = 30;

function requestBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Object.assign(new Error("unsupported"), { geoReason: "unsupported" }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      (err) => {
        const geoReason =
          err?.code === 1
            ? "permission"
            : err?.code === 2
              ? "unavailable"
              : err?.code === 3
                ? "timeout"
                : "unknown";
        reject(Object.assign(err ?? new Error("geolocation failed"), { geoReason }));
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
    );
  });
}

function geoFailureReason(err) {
  if (!window.isSecureContext) return "insecure";
  if (err?.geoReason) return err.geoReason;
  return "unknown";
}

function loadFavouriteIds() {
  try {
    const raw = localStorage.getItem(LS_FAVOURITES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function saveFavouriteIds(ids) {
  localStorage.setItem(LS_FAVOURITES_KEY, JSON.stringify([...ids]));
}

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

function weekHasAnyEvents(payload, startYmd, endYmd) {
  return (payload?.events ?? []).some((ev) => eventInWeek(ev, startYmd, endYmd));
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
  if (s === "cancelled" || s === "closed" || s === "ended") return "bad";
  if (s === "in progress") return "progress";
  return "warn";
}

/** @returns {null | "in-progress" | "ended"} */
function sessionTimePhase(ev, nowMs = Date.now()) {
  const start = new Date(ev.start).getTime();
  const end = new Date(ev.end).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (nowMs >= end) return "ended";
  if (nowMs >= start) return "in-progress";
  return null;
}

function sessionDisplayStatus(ev, nowMs = Date.now()) {
  const phase = sessionTimePhase(ev, nowMs);
  if (phase === "ended") return { label: "Ended", className: "bad" };
  if (phase === "in-progress") return { label: "In progress", className: "progress" };
  return { label: ev.status || "—", className: statusClass(ev.status) };
}

async function loadSchedule() {
  const weekStart = toYYYYMMDD(mondayOfWeek(new Date()));
  const maxAttempts = 90;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const trySchedule = await fetch("/api/schedule");
    if (trySchedule.ok) return trySchedule.json();

    if (trySchedule.status === 503) {
      await new Promise((r) => setTimeout(r, attempt < 3 ? 400 : 1500));
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
  const [scheduleLoading, setScheduleLoading] = React.useState(true);
  const [serverRefreshing, setServerRefreshing] = React.useState(false);
  const [loadError, setLoadError] = React.useState(null);
  const wasRefreshingRef = React.useRef(false);

  const [address, setAddress] = React.useState("");
  const [userLoc, setUserLoc] = React.useState(null);
  const [locLabel, setLocLabel] = React.useState("");
  const [locStatus, setLocStatus] = React.useState(""); // idle | loading | ok | fail | gps-fail
  const [locGpsError, setLocGpsError] = React.useState(null); // permission | insecure | timeout | ...
  const autoLocRef = React.useRef(null);

  const applyAutoLocation = React.useCallback((coords) => {
    autoLocRef.current = coords;
    setUserLoc(coords);
    setLocLabel("Your location");
    setLocGpsError(null);
    setLocStatus("ok");
  }, []);

  const restoreAutoLocation = React.useCallback(() => {
    if (autoLocRef.current) {
      setUserLoc(autoLocRef.current);
      setLocLabel("Your location");
      setLocStatus("ok");
      return true;
    }
    return false;
  }, []);

  const locateUser = React.useCallback(
    async ({ clearAddress = false } = {}) => {
      if (clearAddress) setAddress("");
      setLocStatus("loading");
      setLocGpsError(null);
      try {
        applyAutoLocation(await requestBrowserLocation());
      } catch (err) {
        setLocStatus("gps-fail");
        setLocGpsError(geoFailureReason(err));
        setUserLoc(null);
        setLocLabel("");
      }
    },
    [applyAutoLocation]
  );

  const useNearMe = React.useCallback(() => locateUser({ clearAddress: true }), [locateUser]);

  const todayDow = React.useMemo(() => torontoTodayDow(), []);
  const todayYmd = React.useMemo(() => torontoTodayYmd(), []);
  const [selectedDow, setSelectedDow] = React.useState(() => torontoTodayDow());
  const [selectedSport, setSelectedSport] = React.useState("Badminton");
  const [weekOffset, setWeekOffset] = React.useState(0); // 0 = this week, 1 = next week
  const [favouriteIds, setFavouriteIds] = React.useState(() => loadFavouriteIds());
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const toggleFavourite = React.useCallback((centreId) => {
    setFavouriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(centreId)) next.delete(centreId);
      else next.add(centreId);
      saveFavouriteIds(next);
      return next;
    });
  }, []);

  const week = React.useMemo(() => weekBounds(weekOffset), [weekOffset]);

  const nextWeekHasData = React.useMemo(() => {
    const nw = weekBounds(1);
    return (payload?.events ?? []).some((ev) => eventInWeek(ev, nw.startYmd, nw.endYmd));
  }, [payload]);

  const reloadSchedule = React.useCallback(async () => {
    setScheduleLoading(true);
    setLoadError(null);
    try {
      setPayload(await loadSchedule());
    } catch (e) {
      setLoadError(String(e?.message ?? e));
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
    localStorage.setItem(LS_THEME_KEY, theme);
  }, [theme]);

  React.useEffect(() => {
    reloadSchedule();
  }, [reloadSchedule]);

  React.useEffect(() => {
    let cancelled = false;

    async function pollStatus() {
      try {
        const res = await fetch("/api/status");
        if (!res.ok || cancelled) return;
        const st = await res.json();
        const refreshing = Boolean(st.refreshing);
        setServerRefreshing(refreshing);
        if (wasRefreshingRef.current && !refreshing && st.ready) {
          await reloadSchedule();
        }
        wasRefreshingRef.current = refreshing;
      } catch {
        /* best-effort */
      }
    }

    pollStatus();
    const id = setInterval(pollStatus, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [reloadSchedule]);

  React.useEffect(() => {
    locateUser();
  }, [locateUser]);

  React.useEffect(() => {
    const q = address.trim();
    const postal = normalizeCanadianPostalCode(q);

    if (q.length < 2 && !postal) {
      if (restoreAutoLocation()) return;
      setUserLoc(null);
      setLocLabel("");
      setLocStatus((prev) =>
        prev === "gps-fail" || prev === "loading" ? prev : ""
      );
      return;
    }

    if (isPartialCanadianPostalCode(q)) {
      if (restoreAutoLocation()) return;
      setUserLoc(null);
      setLocLabel("");
      setLocStatus((prev) =>
        prev === "gps-fail" || prev === "loading" ? prev : ""
      );
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
  }, [address, restoreAutoLocation]);

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

    const favouriteRows = [];
    const otherRows = [];
    for (const row of rows) {
      if (favouriteIds.has(row.centre.id)) favouriteRows.push(row);
      else otherRows.push(row);
    }

    const sortByDistance = (a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) {
        return a.centre.name.localeCompare(b.centre.name);
      }
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    };

    if (userLoc && locStatus === "ok") {
      let nearby = otherRows.filter(
        (r) => r.distanceKm != null && r.distanceKm <= MAX_DISTANCE_KM
      );
      // If coords are missing, show matches anyway rather than a false empty state.
      if (nearby.length === 0 && otherRows.length > 0) {
        const missingDistance = otherRows.every((r) => r.distanceKm == null);
        if (missingDistance) nearby = otherRows;
      }
      nearby.sort(sortByDistance);
      favouriteRows.sort(sortByDistance);
      return [...favouriteRows, ...nearby];
    }

    favouriteRows.sort((a, b) => a.centre.name.localeCompare(b.centre.name));
    otherRows.sort((a, b) => a.centre.name.localeCompare(b.centre.name));
    return [...favouriteRows, ...otherRows];
  }, [payload, eventsByCentre, userLoc, locStatus, favouriteIds]);

  const selectedLabel = WEEKDAYS.find((d) => d.dow === selectedDow)?.label ?? "";

  const usingManualAddress = address.trim().length >= 2 || normalizeCanadianPostalCode(address.trim());
  const waitingOnLocation = locStatus === "loading" && !usingManualAddress;
  const cacheStaleForView = Boolean(payload?.dataTo && week.startYmd > payload.dataTo);
  const noEventsInViewWeek = Boolean(
    payload && !weekHasAnyEvents(payload, week.startYmd, week.endYmd)
  );
  const waitingOnFreshData =
    (serverRefreshing || cacheStaleForView) && noEventsInViewWeek && !loadError;
  const listStillLoading =
    scheduleLoading ||
    (!payload && !loadError) ||
    (waitingOnFreshData && centreList.length === 0);

  let locHint = "";
  if (locStatus === "loading")
    locHint = usingManualAddress
      ? "Finding address…"
      : "Allow location when your browser asks to sort centres nearest to you.";
  else if (locStatus === "gps-fail") {
    const gpsHints = {
      insecure:
        "Location only works on a secure connection (https). Enter an address below instead.",
      permission:
        "Location access is blocked. Allow it in your browser’s settings for this site, tap the pin to try again, or enter an address.",
      timeout: "Could not get your location in time. Tap the pin to try again or enter an address.",
      unavailable:
        "Your device could not determine location. Try the pin again or enter an address.",
      unsupported: "This browser does not support location. Enter an address below.",
      unknown: "Could not use your location. Tap the pin to try again or enter an address.",
    };
    locHint = gpsHints[locGpsError] ?? gpsHints.unknown;
  } else if (locStatus === "fail")
    locHint = "Not found — try a Toronto street address or postal code (e.g. M5V 2T6)";
  else if (locStatus === "ok")
    locHint = usingManualAddress
      ? `Nearest within ${MAX_DISTANCE_KM} km`
      : `Sorted nearest to you (within ${MAX_DISTANCE_KM} km)`;

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

    h(
      "div",
      { className: "location-row" },
      h("input", {
        className: "address-input",
        type: "text",
        placeholder: "Optional: address or postal code (e.g. M5V 2T6)",
        value: address,
        onChange: (e) => setAddress(e.target.value),
        autoComplete: "postal-code",
        inputMode: "text",
        spellCheck: false,
        "aria-label": "Street address or postal code",
      }),
      h(
        "button",
        {
          type: "button",
          className: `loc-btn${locStatus === "ok" && !usingManualAddress ? " active" : ""}`,
          onClick: useNearMe,
          disabled: locStatus === "loading" && !usingManualAddress,
          title: "Use my current location",
          "aria-label": "Use my current location",
        },
        h(
          "svg",
          {
            className: "loc-btn-icon",
            viewBox: "0 0 24 24",
            width: 20,
            height: 20,
            "aria-hidden": true,
          },
          h("path", {
            fill: "currentColor",
            d: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z",
          })
        )
      )
    ),
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
        : listStillLoading
          ? "Loading schedules… (may take 1–2 minutes on first visit)"
          : waitingOnLocation
            ? `${weekOffset === 0 ? "This week" : "Next week"} · ${selectedLabel} · ${selectedSport} · sorting by your location…`
            : `${weekOffset === 0 ? "This week" : "Next week"} · ${selectedLabel} · ${selectedSport} · ${centreList.length} centres${locStatus === "ok" ? " nearby" : ""}`
    ),

    listStillLoading
      ? h(
          "p",
          { className: "empty loading-msg" },
          "Loading community centres… This can take 1–2 minutes the first time the server wakes up."
        )
      : !waitingOnLocation && payload && centreList.length === 0
        ? h(
            "p",
            { className: "empty" },
            locStatus === "ok"
              ? "No matching sessions nearby. Favourites still show if they have this sport today. Try another day or sport."
              : `No ${selectedSport} on ${selectedLabel} for ${weekOffset === 0 ? "this week" : "next week"}. Try another sport — Sundays are often lighter.`
          )
        : null,

    h(
      "div",
      { className: "centre-list" },
      ...centreList.map(({ centre, sessions, distanceKm }) => {
        const isFavourite = favouriteIds.has(centre.id);
        return h(
          "article",
          {
            key: centre.id,
            className: `centre-row${isFavourite ? " centre-row-favourite" : ""}`,
          },
          h(
            "div",
            { className: "centre-head" },
            h(
              "div",
              { className: "centre-title-wrap" },
              h("h2", null, centre.name),
              h(
                "button",
                {
                  type: "button",
                  className: `fav-btn${isFavourite ? " is-favourite" : ""}`,
                  "aria-label": isFavourite
                    ? `Remove ${centre.name} from favourites`
                    : `Add ${centre.name} to favourites`,
                  "aria-pressed": isFavourite,
                  onClick: () => toggleFavourite(centre.id),
                },
                isFavourite ? "★" : "☆"
              )
            ),
            distanceKm != null
              ? h(
                  "span",
                  { className: "dist" },
                  formatDistance(distanceKm) + " away",
                  isFavourite && distanceKm > MAX_DISTANCE_KM
                    ? h("span", { className: "fav-pill" }, "Favourite")
                    : null
                )
              : h("span", { className: "dist muted" }, centre.address || "")
          ),
          h(
            "ul",
            { className: "sessions" },
            ...sessions.map((ev) => {
              const { label, className } = sessionDisplayStatus(ev, nowMs);
              return h(
                "li",
                { key: ev.id },
                h("span", { className: "sport" }, sessionTitle(ev)),
                h(
                  "span",
                  { className: "when" },
                  `${formatShortDate(ev.start)} · ${formatTime(ev.start, ev.end)}`
                ),
                h("span", { className: `status ${className}` }, label)
              );
            })
          )
        );
      })
    )
  );
}

createRoot(document.getElementById("app")).render(h(App));
