export const EventStatus = /** @type {const} */ ({
  Available: "Available",
  Full: "Full",
  Cancelled: "Cancelled",
  Closed: "Closed",
  Unknown: "Unknown",
});

/**
 * @typedef {Object} CommunityCentre
 * @property {string} id
 * @property {string} name
 * @property {string} address
 * @property {string=} officialUrl
 * @property {number=} lat
 * @property {number=} lng
 */

/**
 * @typedef {Object} DropInEventSource
 * @property {string} sourceName
 * @property {string} sourceUrl
 * @property {string} lastSeenAt ISO string
 * @property {string} rawTextSnippet
 */

/**
 * @typedef {Object} DropInEvent
 * @property {string} id
 * @property {string} centreId
 * @property {string} sport
 * @property {string} start ISO string (local time encoded as ISO with offset when possible)
 * @property {string} end ISO string
 * @property {number} dayOfWeek 0-6 (Sun-Sat)
 * @property {string[]} tags
 * @property {keyof typeof EventStatus} status
 * @property {DropInEventSource} source
 * @property {string=} notes
 */

/**
 * @typedef {Object} WeekPayload
 * @property {string} weekStart YYYY-MM-DD (Monday)
 * @property {string} fetchedAt ISO string
 * @property {CommunityCentre[]} centres
 * @property {DropInEvent[]} events
 */

