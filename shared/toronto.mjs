export const TORONTO_TZ = "America/Toronto";

export function parseCalendarDate(dateVal) {
  const m = String(dateVal).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return {
    y,
    mo,
    d,
    localDate: `${m[1]}-${m[2]}-${m[3]}`,
    dayOfWeek: new Date(y, mo, d).getDay(),
  };
}

/** Wall clock in Toronto -> UTC ISO string */
export function torontoWallToUTC(y, mo, d, hour, minute) {
  const pad = (n) => String(n).padStart(2, "0");
  for (const off of ["-04:00", "-05:00"]) {
    const iso = `${y}-${pad(mo + 1)}-${pad(d)}T${pad(hour)}:${pad(minute)}:00${off}`;
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) continue;
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: TORONTO_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .formatToParts(dt)
        .map((x) => [x.type, x.value])
    );
    if (
      Number(p.year) === y &&
      Number(p.month) === mo + 1 &&
      Number(p.day) === d &&
      Number(p.hour) === hour &&
      Number(p.minute) === minute
    ) {
      return dt.toISOString();
    }
  }
  return new Date(Date.UTC(y, mo, d, hour + 4, minute)).toISOString();
}

export function torontoYmd(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TORONTO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function torontoTodayYmd() {
  return torontoYmd(new Date());
}

export function torontoTodayDow() {
  const [y, m, d] = torontoTodayYmd().split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function dayOfWeekFromLocalDate(localDate) {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function eventDayOfWeek(ev) {
  if (ev.localDate) return dayOfWeekFromLocalDate(ev.localDate);
  return dayOfWeekFromLocalDate(torontoYmd(ev.start));
}

export function includesLocalDateRange(localDate, startYmd, endYmd) {
  return localDate >= startYmd && localDate < endYmd;
}
