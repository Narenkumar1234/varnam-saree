/**
 * Order dates and times for display, always in India time (Asia/Kolkata), whatever
 * the server or browser time zone is (Vercel renders in UTC).
 *
 * Built from Intl numeric parts with fixed month names and am/pm, so the server
 * render and the browser hydration produce the identical string even when their
 * ICU locale data differs (e.g. "am" vs "AM", "Sept" vs "Sep").
 */
export const STORE_TIME_ZONE = 'Asia/Kolkata';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: STORE_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function istParts(date: Date) {
  const parts: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour % 24, minute: parts.minute };
}

/** "21 Oct 2026" in IST, or '' for a missing/invalid value. */
export function formatIstDate(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  const p = istParts(date);
  return `${p.day} ${MONTHS[p.month - 1]} ${p.year}`;
}

/** "21 Oct 2026, 4:52 pm" in IST, or '' for a missing/invalid value. */
export function formatIstDateTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  const p = istParts(date);
  const hour12 = p.hour % 12 || 12;
  const meridiem = p.hour < 12 ? 'am' : 'pm';
  return `${p.day} ${MONTHS[p.month - 1]} ${p.year}, ${hour12}:${String(p.minute).padStart(2, '0')} ${meridiem}`;
}
