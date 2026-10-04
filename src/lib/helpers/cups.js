export const CUP_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'registration', label: 'Registration open' },
  { value: 'published', label: 'Published' },
  { value: 'completed', label: 'Completed' },
];

// Mirrors the backend: it derives a cup's format from its sport, so the client never sends format.
const KNOCKOUT_SPORTS = ['football', 'basketball', 'volleyball', 'tennis', 'padel', 'badminton'];
const RACE_SPORTS = ['running', 'cycling', 'kayaking', 'swimming'];

// Knockout brackets need a power of two; races just rank finishers, so any size in range works.
export const KNOCKOUT_TEAM_COUNTS = [4, 8, 16];
export const RACE_TEAM_COUNT = { min: 2, max: 100 };

/** @returns {'knockout'|'race'|null} null for sports with no cups (e.g. walking). */
export function sportFormat(sport) {
  const name = sport?.name?.trim().toLowerCase();
  if (KNOCKOUT_SPORTS.includes(name)) return 'knockout';
  if (RACE_SPORTS.includes(name)) return 'race';
  return null;
}

export const cupSports = sports => sports.filter(sport => sportFormat(sport));

export const formatLabel = format => format === 'race' ? 'Race' : format === 'knockout' ? 'Knockout' : 'Format pending';

export const statusLabel = status => CUP_STATUSES.find(option => option.value === status)?.label || status;
