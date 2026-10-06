import { parseDate } from './date';

export const CUP_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'registration', label: 'Registration open' },
  { value: 'published', label: 'Published' },
  { value: 'completed', label: 'Completed' },
];

// Knockout brackets need a power of two; races just rank finishers, so any size in range works.
export const KNOCKOUT_TEAM_COUNTS = [4, 8, 16];
export const RACE_TEAM_COUNT = { min: 2, max: 100 };

const CUP_FORMATS = ['knockout', 'race'];

/** The backend owns each sport's cup format (SportSchema.cup_format); null means the sport has no cups (e.g. walking). */
export const sportFormat = sport => CUP_FORMATS.includes(sport?.cup_format) ? sport.cup_format : null;

export const cupSports = sports => sports.filter(sport => sportFormat(sport));

export const formatLabel = format => format === 'race' ? 'Race' : format === 'knockout' ? 'Knockout' : 'Format pending';

export const statusLabel = status => CUP_STATUSES.find(option => option.value === status)?.label || status;

// Ownership comes from the cup itself; there is no global organizer role.
export const isOrganizer = (cup, user) => !!user && cup.organizer?.id === user.id;

// Pending and accepted entries still hold a place; declined and withdrawn ones don't.
const ACTIVE_ENTRY = ['pending', 'accepted'];
export const isActiveEntry = entry => ACTIVE_ENTRY.includes(entry.status);
export const acceptedEntries = cup => cup.entries.filter(entry => entry.status === 'accepted');

/** Reason the organizer can't publish yet, or '' when the backend would accept it. */
export function publishBlocker(cup) {
  const accepted = acceptedEntries(cup).length;
  // Knockout brackets are drawn for exactly team_count teams; a race only needs someone to race against.
  if (cup.format === 'knockout' && accepted !== cup.team_count) return `Needs exactly ${cup.team_count} accepted teams (${accepted} now).`;
  if (cup.format === 'race' && accepted < 2) return `Needs at least 2 accepted teams (${accepted} now).`;
  if (!cup.format) return "Cups aren't available for this sport.";
  return '';
}

/** Entering is only allowed before registration_closes_at. */
export const registrationClosed = cup => {
  const closes = cup.registration_closes_at && parseDate(cup.registration_closes_at);
  return !!closes && closes.getTime() <= Date.now();
};

/** Groups the user owns, for the cup's sport, that don't already hold a place in it. */
export function eligibleGroups(groups, cup, userId) {
  const taken = new Set(cup.entries.filter(isActiveEntry).map(entry => entry.group_id));
  // Groups use sports_id (plural) while cups use sport_id.
  return groups.filter(group => group.owner_id === userId && group.sports_id === cup.sport_id && !taken.has(group.id));
}

/** Parse "h:mm:ss", "mm:ss" or plain seconds into seconds; NaN when invalid. */
export function parseDuration(text) {
  const parts = String(text).trim().split(':');
  if (parts.length > 3 || parts.some(part => !/^\d+(\.\d+)?$/.test(part))) return NaN;
  return parts.reduce((total, part) => total * 60 + Number(part), 0);
}

export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '';
  const whole = Math.floor(seconds), fraction = seconds - whole;
  const h = Math.floor(whole / 3600), m = Math.floor((whole % 3600) / 60), s = whole % 60 + fraction;
  const ss = (s < 10 ? '0' : '') + (Number.isInteger(s) ? s : s.toFixed(2));
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// Fallback only: a cup 409 normally carries the backend's detail (stale revision or a state conflict such as a full bracket).
export const STALE_CUP_MESSAGE = 'This cup changed since you loaded it. The latest version is shown; please try again.';
