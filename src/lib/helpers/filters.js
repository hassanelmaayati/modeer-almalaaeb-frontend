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

// ---------- My rooms (the rooms the signed-in user hosts) ----------
//
// All filter state lives in the URL. A "view" is a quick preset that picks the status and order,
// so the URL stays short: /my-rooms (active), /my-rooms?view=history, /my-rooms?status=open&sport_id=2

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

/** Active is the default: what a host checks day to day. History is everything that has ended. */
export const MY_ROOM_VIEWS = [
  { value: 'active', label: 'Active', status: ['open', 'started'], order: 'asc' },
  { value: 'history', label: 'History', status: ['completed', 'cancelled'], order: 'desc' },
  { value: 'all', label: 'All', status: [], order: 'asc' },
];

export const DEFAULT_MY_ROOM_VIEW = 'active';
export const MY_ROOMS_PAGE_SIZE = 20;

const MY_ROOM_TEXT_KEYS = ['sport_id', 'visibility', 'difficulty', 'starts_from', 'starts_to', 'order'];
const viewOf = (value) => MY_ROOM_VIEWS.find((view) => view.value === value) || MY_ROOM_VIEWS[0];
const sameSet = (first, second) => first.length === second.length && first.every((value) => second.includes(value));

/** Reads the explicit filters from the URL. Missing status or order mean "use the view's default". */
export function getMyRoomFilters(searchParams) {
  const filters = {};
  const view = searchParams.get('view');
  if (view) filters.view = view;
  const status = searchParams.getAll('status').filter(Boolean);
  if (status.length) filters.status = status;
  for (const key of MY_ROOM_TEXT_KEYS) {
    const value = searchParams.get(key);
    if (value) filters[key] = value;
  }
  return filters;
}

/** The filters with the view's defaults filled in: what is actually shown and sent. */
export function resolveMyRoomFilters(filters) {
  const view = viewOf(filters.view);
  return {
    ...filters,
    view: view.value,
    status: filters.status?.length ? filters.status : view.status,
    order: filters.order || view.order,
  };
}

/** Drops values that only repeat the view's defaults, so the URL stays short. */
export function normalizeMyRoomFilters(filters) {
  const view = viewOf(filters.view);
  const result = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) continue;
    result[key] = value;
  }
  if (result.view === DEFAULT_MY_ROOM_VIEW) delete result.view;
  if (result.status && sameSet(result.status, view.status)) delete result.status;
  if (result.order === view.order) delete result.order;
  return result;
}

/** Switching view keeps sport, visibility, difficulty and dates, but resets status and order to the view's own. */
export function withMyRoomView(filters, view) {
  const kept = { ...filters };
  delete kept.status;
  delete kept.order;
  return normalizeMyRoomFilters({ ...kept, view });
}

export function validateMyRoomFilters(filters) {
  if (filters.view && !MY_ROOM_VIEWS.some(({ value }) => value === filters.view)) return 'Choose a valid view.';
  if (filters.status?.some((value) => !ROOM_STATUS_OPTIONS.some((option) => option.value === value))) return 'Choose a valid status.';
  if (filters.sport_id && !/^[1-9]\d*$/.test(String(filters.sport_id))) return 'Choose a valid activity.';
  if (filters.visibility && !VISIBILITY_OPTIONS.some(({ value }) => value === filters.visibility)) return 'Choose a valid visibility.';
  if (filters.difficulty && !DIFFICULTIES.some(({ value }) => value === filters.difficulty)) return 'Choose a valid difficulty.';
  if (filters.order && !ORDER_OPTIONS.some(({ value }) => value === filters.order)) return 'Choose a valid order.';
  const from = filters.starts_from ? parseDate(filters.starts_from) : null;
  const to = filters.starts_to ? parseDate(filters.starts_to) : null;
  if ((filters.starts_from && !from) || (filters.starts_to && !to)) return 'Choose valid dates.';
  if (from && to && from > to) return 'The From date must be before or equal to the Until date.';
  return null;
}

/** Reads the filter bar form. Status comes from checkboxes, dates are typed in Bahrain time. */
export function myRoomFiltersFromForm(formData, view) {
  const filters = { view, status: formData.getAll('status').map(String).filter(Boolean) };
  for (const key of MY_ROOM_TEXT_KEYS) {
    const raw = String(formData.get(key) || '').trim();
    if (raw) filters[key] = key.startsWith('starts_') ? fromBahrainDateTimeInput(raw) || raw : raw;
  }
  return normalizeMyRoomFilters(filters);
}

/** URL parameters for the filters. A list becomes repeated parameters (status=a&status=b). */
export function myRoomFiltersToSearchParams(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(normalizeMyRoomFilters(filters))) {
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  }
  return params;
}

/** Query for GET /rooms/mine: the resolved filters plus the page. `view` is a UI concept, so it is not sent. */
export function toMyRoomsQuery(filters, { limit = MY_ROOMS_PAGE_SIZE, offset = 0 } = {}) {
  const query = resolveMyRoomFilters(filters);
  delete query.view;
  return { ...query, limit, offset };
}
