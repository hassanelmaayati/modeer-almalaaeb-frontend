export const ACTIVITY_TIME_ZONE = 'Asia/Bahrain';
const BAHRAIN_OFFSET = 3 * 60 * 60 * 1000;

export function parseDate(value) {
  if (!value) return null;
  const normalized = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)
    && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value) ? `${value}Z` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value, options, fallback) {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat('en-GB', {
    timeZone: ACTIVITY_TIME_ZONE, ...options,
  }).format(date) : fallback;
}

export function formatActivityDate(value) {
  return formatDate(value, { weekday: 'short', day: 'numeric', month: 'short' }, 'Date unavailable');
}

export function formatActivityTime(value) {
  return formatDate(value, { hour: '2-digit', minute: '2-digit', hour12: false }, 'Time unavailable');
}

export function formatActivitySchedule(startsAt, endsAt) {
  const start = parseDate(startsAt);
  const end = parseDate(endsAt);
  if (!start || !end) return 'Schedule unavailable';
  const sameDate = toBahrainDateTimeInput(start).slice(0, 10) === toBahrainDateTimeInput(end).slice(0, 10);
  return `${formatActivityDate(start)} · ${formatActivityTime(start)}–${sameDate ? '' : `${formatActivityDate(end)} `}${formatActivityTime(end)}`;
}

export function toBahrainDateTimeInput(value) {
  const date = parseDate(value);
  if (!date) return '';
  return new Date(date.getTime() + BAHRAIN_OFFSET).toISOString().slice(0, 16);
}

export function fromBahrainDateTimeInput(value) {
  if (!value) return '';
  const date = parseDate(`${value}+03:00`);
  return date ? date.toISOString() : '';
}
