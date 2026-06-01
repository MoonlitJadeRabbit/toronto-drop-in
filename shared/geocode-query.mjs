/** Canadian postal code: A1A 1A1 */
const POSTAL_RE = /^[A-Z]\d[A-Z]\d[A-Z]\d$/;

/**
 * @param {string} raw
 * @returns {string | null} Normalized "A1A 1A1" or null if not a full postal code
 */
export function normalizeCanadianPostalCode(raw) {
  const compact = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!POSTAL_RE.test(compact)) return null;
  return `${compact.slice(0, 3)} ${compact.slice(3)}`;
}

/**
 * @param {string} raw
 */
export function isPartialCanadianPostalCode(raw) {
  const compact = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (compact.length === 0) return false;
  if (POSTAL_RE.test(compact)) return false;
  return /^[A-Z](\d([A-Z](\d([A-Z])?)?)?)?$/.test(compact);
}

/**
 * Build a Nominatim-friendly query (postal codes scoped to Toronto area).
 * @param {string} raw
 */
export function buildGeocodeQuery(raw) {
  const trimmed = String(raw ?? "").trim();
  const postal = normalizeCanadianPostalCode(trimmed);
  if (postal) {
    return {
      type: "postal",
      postal,
      q: `${postal}, Toronto, Ontario, Canada`,
    };
  }
  const lower = trimmed.toLowerCase();
  if (/\btoronto\b|\bon\b/.test(lower)) {
    return { type: "address", q: trimmed };
  }
  return { type: "address", q: `${trimmed}, Toronto, Ontario, Canada` };
}
