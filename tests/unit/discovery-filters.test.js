import { describe, expect, it } from 'vitest';
import { filtersFromForm, getRoomFilters, validateRoomFilters } from '../../src/lib/helpers/filters';

describe('backend discovery filter boundaries', () => {
  it('only forwards supported, nonempty filters from a bookmarked URL', () => {
    const query = new URLSearchParams('sport_id=2&district=capital&difficulty=&group_id=3&starts_from=2030-10-10T15%3A00%3A00Z');
    expect(getRoomFilters(query)).toEqual({ sport_id: '2', district: 'capital', starts_from: '2030-10-10T15:00:00Z' });
  });

  it('normalizes Bahrain form times across the previous UTC date', () => {
    const form = new FormData();
    form.set('sport_id', '2');
    form.set('starts_from', '2030-10-10T01:30');
    form.set('starts_to', '2030-10-10T03:30');
    form.set('difficulty', '');
    expect(filtersFromForm(form)).toEqual({ sport_id: '2', starts_from: '2030-10-09T22:30:00.000Z', starts_to: '2030-10-10T00:30:00.000Z' });
  });

  it.each([
    [{ sport_id: '0' }, /valid activity/],
    [{ sport_id: '-2' }, /valid activity/],
    [{ sport_id: '2.5' }, /valid activity/],
    [{ difficulty: 'professional' }, /valid difficulty/],
    [{ district: 'Manama' }, /valid governorate/],
    [{ starts_from: 'not-a-date' }, /valid dates/],
    [{ starts_to: 'not-a-date' }, /valid dates/],
    [{ starts_from: '2030-10-11T15:00:00Z', starts_to: '2030-10-10T15:00:00Z' }, /From date/],
  ])('rejects invalid filters %j before a discovery request', (filters, message) => {
    expect(validateRoomFilters(filters)).toMatch(message);
  });

  it('accepts inclusive equal bounds with equivalent offsets and an open-ended range', () => {
    expect(validateRoomFilters({ starts_from: '2030-10-10T18:00:00+03:00', starts_to: '2030-10-10T15:00:00Z' })).toBeNull();
    expect(validateRoomFilters({ sport_id: '2', difficulty: 'medium', district: 'capital', starts_from: '2030-10-10T15:00:00Z' })).toBeNull();
  });
});
