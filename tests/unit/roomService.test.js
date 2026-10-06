import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setToken } from '../../src/lib/helpers/session';
import roomService from '../../src/services/roomService';

const base64Url = (value) => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const token = () => `${base64Url({ alg: 'HS256' })}.${base64Url({ sub: '1', exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`;

const page = { items: [], total: 0, limit: 20, offset: 0, has_more: false };
let calls;

beforeEach(() => {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    calls.push({ url, authorization: init.headers.Authorization });
    return { ok: true, status: 200, text: async () => JSON.stringify(page) };
  }));
});

describe('roomService.listMine', () => {
  it('requires a signed-in user and sends nothing without one', async () => {
    await expect(roomService.listMine()).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(0);
  });

  it('repeats array values and skips empty ones', async () => {
    setToken(token());
    await roomService.listMine({ status: ['completed', 'cancelled'], sport_id: 2, order: 'desc', limit: 20, offset: 0, visibility: '' });
    expect(calls[0].url).toBe('/api/v1/rooms/mine?status=completed&status=cancelled&sport_id=2&order=desc&limit=20&offset=0');
    expect(calls[0].authorization).toMatch(/^Bearer /);
  });
});

describe('roomService.listJoined', () => {
  it('requires a signed-in user', async () => {
    await expect(roomService.listJoined()).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(0);
  });

  it('sends membership lists and keeps requested=false', async () => {
    setToken(token());
    await roomService.listJoined({ membership: ['pending', 'declined'], requested: false, status: ['open'], limit: 20, offset: 40 });
    await roomService.listJoined({ membership: 'accepted', requested: true });
    expect(calls[0].url).toBe('/api/v1/rooms/joined?membership=pending&membership=declined&requested=false&status=open&limit=20&offset=40');
    expect(calls[1].url).toBe('/api/v1/rooms/joined?membership=accepted&requested=true');
  });
});

describe('roomService.list', () => {
  it('stays public and sends no token', async () => {
    setToken(token());
    await roomService.list({ district: 'capital' });
    expect(calls[0].url).toBe('/api/v1/rooms?district=capital');
    expect(calls[0].authorization).toBeUndefined();
  });
});
