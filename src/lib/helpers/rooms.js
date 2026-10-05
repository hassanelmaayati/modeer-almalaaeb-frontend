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

