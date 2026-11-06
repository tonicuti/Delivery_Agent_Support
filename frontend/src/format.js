// Everything a person reads goes through here: local clock, spoken-style durations, no codes.
const DAY_TIME = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const CLOCK = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
const ISO_STAMP = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z/g;

export const URGENT_HOURS = 3;

const sameDay = (a, b) => a.toDateString() === b.toDateString();

/** "15:24" today, "yesterday 15:24", otherwise "6 Nov, 15:24". */
export function fmtTime(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  const now = new Date();
  if (sameDay(date, now)) return `Today ${CLOCK.format(date)}`;
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (sameDay(date, yesterday)) return `Yesterday ${CLOCK.format(date)}`;
  return DAY_TIME.format(date).replace(",", "");
}
export const fmtClock = (iso) => (iso ? CLOCK.format(new Date(iso)) : "—");
export const fmtPct = (p) => (p == null ? "—" : `${Math.round(p * 100)}%`);

/** Replace machine timestamps inside free text ("Now expected 2026-11-06T17:00:00Z") with readable ones. */
export const prettyText = (text) => (text ? text.replace(ISO_STAMP, (stamp) => fmtTime(stamp)) : text);

export const humanize = (text) =>
  text ? String(text).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "—";

export function hoursBetween(laterIso, earlierIso) {
  return (new Date(laterIso).getTime() - new Date(earlierIso).getTime()) / 3_600_000;
}

/** "35 min", "2 h 5 min", "3 days". */
export function fmtDuration(minutes) {
  const total = Math.round(Math.abs(minutes));
  if (total < 60) return `${total} min`;
  if (total < 48 * 60) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  return `${Math.floor(total / 1440)} days`;
}

export function fmtRemaining(hours) {
  if (hours == null) return "No promise yet";
  return hours < 0 ? `${fmtDuration(hours * 60)} overdue` : `${fmtDuration(hours * 60)} left`;
}

export const remainingTone = (hours) =>
  hours == null ? "none" : hours < 0 ? "overdue" : hours < URGENT_HOURS ? "urgent" : "ok";

export const fmtAge = (minutes) => (minutes == null ? "—" : minutes < 1 ? "Just now" : `${fmtDuration(minutes)} ago`);

export const customerWord = (type) => (type === "B2B" ? "Business customer" : type === "B2C" ? "Private customer" : "Customer");

/** Order of a shipment's journey. */
export const STAGES = ["Waiting", "Picking", "Packed", "Loaded", "On the road"];

export const bandOf = (p) => (p == null ? null : p < 0.2 ? "Low" : p <= 0.5 ? "Medium" : "High");

/** Reasons an order is no longer being watched, in words. */
export const STOPPED = {
  delivered: "Delivered",
  cancelled: "Cancelled",
  replacement_authorized: "Replacement approved",
  no_visible_promise: "No delivery promise",
  no_order_lines: "No items",
  not_created_yet: "Not started",
  order_not_found: "Not found",
};

/** Plain names for the steps a run reports as skipped or failed. */
export const stoppedWord = (reason) => STOPPED[reason] ?? humanize(reason);
