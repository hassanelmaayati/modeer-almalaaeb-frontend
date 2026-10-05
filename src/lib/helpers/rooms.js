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

const clean = value => (typeof value === 'string' ? value.trim() : value);
const hasValue = value => value !== undefined && value !== null && value !== '';

export function buildRoomBody(values, { editing = false, revision } = {}) {
  const title = clean(values.title);
  const area = clean(values.area);
  if (!title) return { error: 'A title is required.' };
  if (!area) return { error: 'Choose an area.' };
  if (values.visibility === 'group' && !values.group_id) return { error: 'Choose which group this room is for' };

  const body = {
    sport_id: Number(values.sport_id),
    title,
    difficulty: values.difficulty,
    starts_at: values.starts_at,
    ends_at: values.ends_at,
    capacity: Number(values.capacity),
    visibility: values.visibility,
    admission_policy: values.admission_policy,
    district: values.district,
    area,
  };
  if (values.visibility === 'group') body.group_id = Number(values.group_id);
  if (hasValue(values.distance_km)) body.distance_km = Number(values.distance_km);
  // The pin has no "clear" on the backend, so it is only sent when set.
  if (values.venue_location) body.venue_location = values.venue_location;

  for (const name of ['description', 'venue_notes', 'pace_notes', 'route_notes']) {
    const text = clean(values[name]);
    if (hasValue(text)) body[name] = text;
    else if (editing && name in values) body[name] = null;
  }
  if (editing) body.revision = revision;
  return { body };
}

const ROOM_FIELDS = [
  'sport_id', 'title', 'description', 'difficulty', 'starts_at', 'ends_at', 'capacity', 'visibility',
  'group_id', 'admission_policy', 'district', 'area', 'venue_location', 'venue_notes', 'distance_km',
  'pace_notes', 'route_notes',
];
const spaced = text => text.replaceAll('_', ' ').toLowerCase();

// Which form field a validation message is about, from its path or, for rule messages, its first words.
function fieldFor(path, text) {
  const named = path.find(part => ROOM_FIELDS.includes(String(part).split('.')[0]));
  if (named) return String(named).split('.')[0];
  const lead = spaced(text);
  return ROOM_FIELDS.find(name => lead.startsWith(spaced(name))) || null;
}

/**
 * Splits a failed create/update into messages for specific fields and a general banner.
 * 422 validation messages (area not in district, pin outside Bahrain, capacity not matching the sport's format,
 * group required, start window...) go to their field. Network, server and conflict errors only get the banner.
 * @returns {{ banner: string, fields: Record<string, string> }}
 */
export function roomErrors(error) {
  const fields = {};
  const general = [];
  if (error?.status === 422) {
    const issues = Array.isArray(error.detail)
      ? error.detail.map(issue => ({ path: issue.loc || [], text: issue.msg || 'Invalid value' }))
      : [{ path: [], text: String(error.detail || error.message) }];
    for (const { path, text } of issues) {
      const raw = text.replace(/^Value error, /, '');
      const field = fieldFor(path, raw);
      // The API says "district"; the app calls it a governorate.
      const message = raw.replace(/\bdistrict\b/g, 'governorate');
      if (field && !fields[field]) fields[field] = message;
      else if (!field) general.push(message);
    }
    if (Object.keys(fields).length) general.unshift('Please fix the highlighted fields.');
  } else {
    general.push(error?.message || 'Something went wrong. Please try again.');
  }
  return { banner: general.join(' '), fields };
}
