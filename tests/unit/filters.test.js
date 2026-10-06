import { describe, expect, it } from 'vitest';
import {
  createRoomListFilters,
  joinedRoomFilters,
  joinedRoomsEmptyState,
  myRoomFilters,
  myRoomsEmptyState,
  toApiFilters,
  withHomeGovernorate,
} from '../../src/lib/helpers/filters';

const params = (query = '') => new URLSearchParams(query);

describe('My rooms filters', () => {
  const filters = myRoomFilters;

  it('resolves each view to its status and order', () => {
    expect(filters.resolve(filters.get(params()))).toEqual({ view: 'active', status: ['open', 'started'], order: 'asc' });
    expect(filters.resolve(filters.get(params('view=history')))).toEqual({ view: 'history', status: ['completed', 'cancelled'], order: 'desc' });
    expect(filters.resolve(filters.get(params('view=all')))).toEqual({ view: 'all', status: [], order: 'asc' });
  });

  it('lets explicit filters win over the view defaults', () => {
    const resolved = filters.resolve(filters.get(params('status=open&status=cancelled&order=desc')));
    expect(resolved).toMatchObject({ status: ['open', 'cancelled'], order: 'desc', view: 'active' });
  });

  it('builds the API query with the page and without the view', () => {
    expect(filters.toQuery(filters.get(params()))).toEqual({ status: ['open', 'started'], order: 'asc', limit: 20, offset: 0 });
    expect(filters.toQuery(filters.get(params('view=history&sport_id=2')), { offset: 20 })).toEqual({
      sport_id: '2',
      status: ['completed', 'cancelled'],
      order: 'desc',
      limit: 20,
      offset: 20,
    });
  });

  it('keeps other filters when the view changes and drops the view defaults', () => {
    const switched = filters.withView({ sport_id: '2', status: ['open'], order: 'desc' }, 'history');
    expect(filters.toSearchParams(switched).toString()).toBe('sport_id=2&view=history');
    expect(filters.toSearchParams(filters.withView({ view: 'history' }, 'active')).toString()).toBe('');
  });

  it('round-trips repeated parameters through the URL', () => {
    const url = filters.toSearchParams({ view: 'all', status: ['completed', 'cancelled'], sport_id: '3', order: 'desc' }).toString();
    expect(url).toBe('view=all&status=completed&status=cancelled&sport_id=3&order=desc');
    expect(filters.get(params(url))).toEqual({ view: 'all', status: ['completed', 'cancelled'], sport_id: '3', order: 'desc' });
  });

  it('does not repeat the view defaults in the URL', () => {
    expect(filters.toSearchParams({ view: 'active', status: ['started', 'open'], order: 'asc' }).toString()).toBe('');
  });

  it('reads the filter bar form', () => {
    const form = new FormData();
    form.append('status', 'completed');
    form.append('status', 'cancelled');
    form.append('sport_id', '2');
    form.append('visibility', '');
    form.append('starts_from', '2026-10-10T18:00');
    expect(filters.fromForm(form, 'history')).toEqual({ view: 'history', sport_id: '2', starts_from: '2026-10-10T15:00:00.000Z' });
  });

  it('validates every filter', () => {
    const problems = [
      { view: 'x' },
      { status: ['archived'] },
      { sport_id: '0' },
      { visibility: 'hidden' },
      { difficulty: 'expert' },
      { order: 'up' },
      { starts_from: 'nope' },
      { starts_from: '2026-10-12T00:00:00Z', starts_to: '2026-10-10T00:00:00Z' },
    ].map((value) => filters.validate(value));
    expect(problems.every(Boolean)).toBe(true);
    expect(new Set(problems).size).toBe(problems.length);
    expect(filters.validate({ view: 'history', status: ['completed'], sport_id: '2', order: 'desc' })).toBeNull();
  });

  it('chooses an empty state for each view and for filtered results', () => {
    const state = (query) => myRoomsEmptyState(filters.get(params(query)));
    expect(state('')).toMatchObject({ action: 'host' });
    expect(state('view=history')).toMatchObject({ action: null });
    expect(state('view=all')).toMatchObject({ action: 'host' });
    expect(state('sport_id=1')).toMatchObject({ action: 'clear', title: 'No rooms match these filters' });
    expect(state('view=history&status=cancelled')).toMatchObject({ action: 'clear' });
  });
});

describe('Joined rooms filters', () => {
  const filters = joinedRoomFilters;
  const query = (view) => filters.toQuery(filters.get(params(view ? `view=${view}` : '')));

  it('turns each view into membership, status and request filters', () => {
    expect(query()).toEqual({ membership: ['accepted'], status: ['open', 'started'], order: 'asc', limit: 20, offset: 0 });
    expect(query('past')).toEqual({ membership: ['accepted'], status: ['completed', 'cancelled'], order: 'desc', limit: 20, offset: 0 });
    expect(query('requests')).toEqual({ membership: ['pending'], status: ['open', 'started'], order: 'asc', requested: 'true', limit: 20, offset: 0 });
    expect(query('invitations')).toEqual({ membership: ['pending'], status: ['open', 'started'], order: 'asc', requested: 'false', limit: 20, offset: 0 });
    expect(query('other')).toEqual({ membership: ['declined', 'removed', 'left'], status: [], order: 'desc', limit: 20, offset: 0 });
  });

  it('keeps the activity when the view changes and drops membership and request filters', () => {
    const switched = filters.withView({ view: 'other', sport_id: '2', membership: ['left'], requested: 'true', status: ['open'] }, 'requests');
    expect(filters.toSearchParams(switched).toString()).toBe('view=requests&sport_id=2');
    expect(filters.toSearchParams(filters.withView({ view: 'invitations' }, 'upcoming')).toString()).toBe('');
  });

  it('validates membership and request type', () => {
    expect(filters.validate({ membership: ['banned'] })).toMatch(/membership/i);
    expect(filters.validate({ requested: 'maybe' })).toMatch(/request/i);
    expect(filters.validate({ view: 'upcoming', membership: ['pending'], requested: 'false' })).toBeNull();
  });

  it('chooses an empty state for each view and for filtered results', () => {
    const state = (value) => joinedRoomsEmptyState(filters.get(params(value)));
    expect(state('')).toMatchObject({ action: 'browse' });
    expect(state('view=past')).toMatchObject({ action: null });
    expect(state('view=requests')).toMatchObject({ action: 'browse' });
    expect(state('view=invitations')).toMatchObject({ action: null });
    expect(state('view=other')).toMatchObject({ action: null });
    expect(state('sport_id=1')).toMatchObject({ action: 'clear' });
    expect(state('view=past&membership=declined')).toMatchObject({ action: 'clear' });
  });
});

describe('createRoomListFilters', () => {
  const custom = createRoomListFilters({
    views: [
      { value: 'a', label: 'A', preset: { membership: ['accepted'], status: ['open'], order: 'asc' } },
      { value: 'b', label: 'B', preset: { membership: ['pending'], requested: 'true', order: 'asc' } },
    ],
    listKeys: ['status', 'membership'],
    textKeys: ['sport_id', 'requested', 'order'],
  });

  it('fills defaults for list and scalar presets and leaves unset presets out', () => {
    expect(custom.resolve(custom.get(params('view=b')))).toEqual({ view: 'b', membership: ['pending'], status: [], order: 'asc', requested: 'true' });
    expect(custom.resolve(custom.get(params()))).toEqual({ view: 'a', membership: ['accepted'], status: ['open'], order: 'asc' });
  });
});

describe('governorate default', () => {
  it('uses the home governorate unless the user chose another or all', () => {
    expect(withHomeGovernorate({}, { district: 'capital' })).toEqual({ district: 'capital' });
    expect(withHomeGovernorate({}, null)).toEqual({ district: 'all' });
    expect(withHomeGovernorate({ district: 'all' }, { district: 'capital' })).toEqual({ district: 'all' });
    expect(withHomeGovernorate({ district: 'southern' }, { district: 'capital' })).toEqual({ district: 'southern' });
  });

  it('sends no district when all governorates are chosen', () => {
    expect(toApiFilters({ district: 'all', sport_id: '2' })).toEqual({ sport_id: '2' });
    expect(toApiFilters({ district: 'capital' })).toEqual({ district: 'capital' });
  });
});
