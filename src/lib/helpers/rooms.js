export function roomPositions(room) {
  const layout = room.slot_layout || {};
  const positions = layout.slots || layout.positions || layout.teams?.flatMap(team => team.slots || []) || [];
  if (!Array.isArray(positions) || !positions.length) return Array.from({ length: room.capacity }, (_, index) => ({ value: String(index + 1), label: `Place ${index + 1}` }));
  return positions.map(position => typeof position === 'object'
    ? { value: String(position.id ?? position.key ?? position.position ?? ''), label: position.label || position.name || String(position.id ?? position.key ?? position.position ?? '') }
    : { value: String(position), label: String(position) }).filter(position => position.value);
}

export const VISIBILITIES = [
  { value: 'public', label: 'Public (anyone can find it)' },
  { value: 'private', label: 'Private (invited players only)' },
  { value: 'group', label: 'Group Only (one of my groups)' },
];

export const ADMISSION_POLICIES = [
  { value: 'approval', label: 'I approve each request' },
  { value: 'open', label: 'Anyone can join' },
];

// Only these sports use distance, pace and route notes.
const OUTDOOR_SPORTS = ['walking', 'running', 'cycling'];
export const isOutdoorSport = sport => OUTDOOR_SPORTS.includes(sport?.name?.trim().toLowerCase());

// Sports like football list fixed formats ({ key: '5v5', capacity: 10 }); others accept any capacity.
export const sportFormats = sport => Array.isArray(sport?.formats) ? sport.formats : [];


// A room must start between 1 hour and 14 days from now (same window as the backend)
const MIN_LEAD_MS = 60 * 60 * 1000;
const MAX_LEAD_MS = 14 * 24 * 60 * 60 * 1000;

/** Returns a message for the first schedule problem, or '' when the times are fine. Takes ISO strings. */
export function scheduleError(startsAt, endsAt, { checkStart = true, now = Date.now() } = {}) {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return 'Choose both a start and an end time';
  if (checkStart && start < now) return 'The start time cannot be in the past';
  if (end < now) return 'The end time cannot be in the past';
  if (checkStart && start < now + MIN_LEAD_MS) return 'The room must start at least 1 hour from now';
  if (checkStart && start > now + MAX_LEAD_MS) return 'The room must start within 14 days from now';
  if (end <= start) return 'The end time must be after the start time';
  return '';
}
