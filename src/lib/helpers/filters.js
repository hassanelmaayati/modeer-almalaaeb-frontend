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
  if (filters.district && !DISTRICTS.some(({ value }) => value === filters.district)) {
    return 'Choose a valid district.';
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
