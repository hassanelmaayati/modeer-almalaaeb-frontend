import { fromBahrainDateTimeInput, parseDate } from './date';

export const DIFFICULTIES = [
  { value: 'beginners', label: 'Beginners' },
  { value: 'medium', label: 'Medium' },
  { value: 'advanced', label: 'Advanced' },
];

export const DISTRICTS = [
  { value: 'capital', label: 'Capital' },
  { value: 'muharraq', label: 'Muharraq' },
  { value: 'northern', label: 'Northern' },
  { value: 'southern', label: 'Southern' },
];

export const ALL_GOVERNORATES = 'all';

const ROOM_FILTER_KEYS = ['sport_id', 'difficulty', 'district', 'starts_from', 'starts_to'];

export function getRoomFilters(searchParams) {
  const filters = {};
  for (const key of ROOM_FILTER_KEYS) {
    const value = searchParams.get(key);
    if (value) filters[key] = value;
  }
  return filters;
}

export function validateRoomFilters(filters) {
  if (filters.sport_id && !/^[1-9]\d*$/.test(String(filters.sport_id))) {
    return 'Choose a valid activity.';
  }
  if (filters.difficulty && !DIFFICULTIES.some(({ value }) => value === filters.difficulty)) {
    return 'Choose a valid difficulty.';
  }
  if (filters.district && filters.district !== ALL_GOVERNORATES && !DISTRICTS.some(({ value }) => value === filters.district)) {
    return 'Choose a valid governorate.';
  }
  const from = filters.starts_from ? parseDate(filters.starts_from) : null;
  const to = filters.starts_to ? parseDate(filters.starts_to) : null;
  if ((filters.starts_from && !from) || (filters.starts_to && !to)) return 'Choose valid dates.';
  if (from && to && from > to) return 'The From date must be before or equal to the Until date.';
  return null;
}

export function filtersFromForm(formData) {
  const filters = {};
  for (const key of ROOM_FILTER_KEYS) {
    const raw = String(formData.get(key) || '').trim();
    if (raw) filters[key] = key.startsWith('starts_') ? fromBahrainDateTimeInput(raw) || raw : raw;
  }
  return filters;
}

export function optionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value;
}

/** Without an explicit governorate filter, a signed-in user with a home governorate sees their own first. */
export function withHomeGovernorate(filters, user) {
  if (filters.district) return filters;
  return { ...filters, district: user?.district || ALL_GOVERNORATES };
}

/** Query for GET /rooms: "all governorates" means no district parameter. */
export function toApiFilters(filters) {
  const { district, ...rest } = filters;
  return district && district !== ALL_GOVERNORATES ? { ...rest, district } : rest;
}

export const ROOM_STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'started', label: 'Started' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
  { value: 'group', label: 'Group' },
];

export const ORDER_OPTIONS = [
  { value: 'asc', label: 'Soonest first' },
  { value: 'desc', label: 'Latest first' },
];

export const MEMBERSHIP_OPTIONS = [
  { value: 'accepted', label: 'Accepted' },
  { value: 'pending', label: 'Pending' },
  { value: 'declined', label: 'Declined' },
  { value: 'removed', label: 'Removed' },
  { value: 'left', label: 'Left' },
];

export const ROOM_LIST_PAGE_SIZE = 20;

const hasValue = (value) => !(value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length));
const sameSet = (first, second) => first.length === second.length && first.every((value) => second.includes(value));
const isOption = (options) => (value) => options.some((option) => option.value === value);

const FILTER_RULES = [
  ['status', isOption(ROOM_STATUS_OPTIONS), 'Choose a valid status.'],
  ['membership', isOption(MEMBERSHIP_OPTIONS), 'Choose a valid membership status.'],
  ['requested', (value) => value === 'true' || value === 'false', 'Choose a valid request type.'],
  ['sport_id', (value) => /^[1-9]\d*$/.test(String(value)), 'Choose a valid activity.'],
  ['visibility', isOption(VISIBILITY_OPTIONS), 'Choose a valid visibility.'],
  ['difficulty', isOption(DIFFICULTIES), 'Choose a valid difficulty.'],
  ['order', isOption(ORDER_OPTIONS), 'Choose a valid order.'],
];

export function createRoomListFilters({ views, defaultView = views[0].value, listKeys = ['status'], textKeys, pageSize = ROOM_LIST_PAGE_SIZE }) {
  const viewOf = (value) => views.find((view) => view.value === value) || views.find((view) => view.value === defaultView);
  const presetKeys = [...new Set(views.flatMap((view) => Object.keys(view.preset)))];
  const isList = (key) => listKeys.includes(key);

  function get(searchParams) {
    const filters = {};
    const view = searchParams.get('view');
    if (view) filters.view = view;
    for (const key of listKeys) {
      const values = searchParams.getAll(key).filter(Boolean);
      if (values.length) filters[key] = values;
    }
    for (const key of textKeys) {
      const value = searchParams.get(key);
      if (value) filters[key] = value;
    }
    return filters;
  }

  function resolve(filters) {
    const view = viewOf(filters.view);
    const result = { ...filters, view: view.value };
    for (const key of presetKeys) {
      const explicit = filters[key];
      const preset = view.preset[key];
      const value = isList(key) ? (explicit?.length ? explicit : preset ?? []) : explicit || preset;
      if (value !== undefined) result[key] = value;
    }
    return result;
  }

  function normalize(filters) {
    const view = viewOf(filters.view);
    const result = {};
    for (const [key, value] of Object.entries(filters)) {
      if (hasValue(value)) result[key] = value;
    }
    if (result.view === defaultView) delete result.view;
    for (const key of presetKeys) {
      if (!(key in result)) continue;
      const preset = view.preset[key];
      const same = isList(key) ? sameSet(result[key], preset ?? []) : result[key] === preset;
      if (same) delete result[key];
    }
    return result;
  }

  function withView(filters, view) {
    const kept = { ...filters };
    for (const key of presetKeys) delete kept[key];
    return normalize({ ...kept, view });
  }

  function validate(filters) {
    if (filters.view && !views.some(({ value }) => value === filters.view)) return 'Choose a valid view.';
    for (const [key, valid, message] of FILTER_RULES) {
      const value = filters[key];
      if (!hasValue(value)) continue;
      if (!(isList(key) ? value.every(valid) : valid(value))) return message;
    }
    const from = filters.starts_from ? parseDate(filters.starts_from) : null;
    const to = filters.starts_to ? parseDate(filters.starts_to) : null;
    if ((filters.starts_from && !from) || (filters.starts_to && !to)) return 'Choose valid dates.';
    if (from && to && from > to) return 'The From date must be before or equal to the Until date.';
    return null;
  }

  function fromForm(formData, view) {
    const filters = { view };
    for (const key of listKeys) filters[key] = formData.getAll(key).map(String).filter(Boolean);
    for (const key of textKeys) {
      const raw = String(formData.get(key) || '').trim();
      if (raw) filters[key] = key.startsWith('starts_') ? fromBahrainDateTimeInput(raw) || raw : raw;
    }
    return normalize(filters);
  }

  function toSearchParams(filters) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(normalize(filters))) {
      for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
    }
    return params;
  }

  function toQuery(filters, { limit = pageSize, offset = 0 } = {}) {
    const query = resolve(filters);
    delete query.view;
    return { ...query, limit, offset };
  }

  return { views, defaultView, pageSize, get, resolve, normalize, withView, validate, fromForm, toSearchParams, toQuery };
}

export const myRoomFilters = createRoomListFilters({
  views: [
    { value: 'active', label: 'Active', preset: { status: ['open', 'started'], order: 'asc' } },
    { value: 'history', label: 'History', preset: { status: ['completed', 'cancelled'], order: 'desc' } },
    { value: 'all', label: 'All', preset: { status: [], order: 'asc' } },
  ],
  listKeys: ['status'],
  textKeys: ['sport_id', 'visibility', 'difficulty', 'starts_from', 'starts_to', 'order'],
});

export const joinedRoomFilters = createRoomListFilters({
  views: [
    { value: 'upcoming', label: 'Upcoming', preset: { membership: ['accepted'], status: ['open', 'started'], order: 'asc' } },
    { value: 'past', label: 'Past', preset: { membership: ['accepted'], status: ['completed', 'cancelled'], order: 'desc' } },
    { value: 'requests', label: 'Requests', preset: { membership: ['pending'], requested: 'true', status: ['open', 'started'], order: 'asc' } },
    { value: 'invitations', label: 'Invitations', preset: { membership: ['pending'], requested: 'false', status: ['open', 'started'], order: 'asc' } },
    { value: 'other', label: 'Other', preset: { membership: ['declined', 'removed', 'left'], order: 'desc' } },
  ],
  listKeys: ['status', 'membership'],
  textKeys: ['sport_id', 'requested', 'starts_from', 'starts_to', 'order'],
});

export const REQUEST_OPTIONS = [
  { value: 'true', label: 'Asked to join' },
  { value: 'false', label: 'Invited by the host' },
];

export function myRoomsEmptyState(filters) {
  const refined = Object.keys(myRoomFilters.normalize(filters)).some((key) => key !== 'view');
  if (refined) {
    return {
      title: 'No rooms match these filters',
      description: 'Try different filters, or clear them to go back to your active rooms.',
      action: 'clear',
    };
  }
  const { view } = myRoomFilters.resolve(filters);
  if (view === 'history') {
    return {
      title: 'No room history yet',
      description: 'Rooms you host that have been completed or cancelled will show up here.',
      action: null,
    };
  }
  if (view === 'all') {
    return {
      title: "You haven't hosted any rooms yet",
      description: 'Create your first room and let people know where to meet.',
      action: 'host',
    };
  }
  return {
    title: "You aren't hosting any active rooms",
    description: 'Host a room to get people together. Rooms that have ended are under History.',
    action: 'host',
  };
}
