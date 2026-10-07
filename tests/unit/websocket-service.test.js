import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../../src/lib/api/client';
import { clearToken, setToken } from '../../src/lib/helpers/session';
import messageService from '../../src/services/messageService';
import { listen, watchStatus, start, startLobby, mergeMessages, recoverMessages } from '../../src/services/websocketService';

vi.mock('../../src/lib/api/client', () => ({ API_BASE: '/api/v1', request: vi.fn() }));
vi.mock('../../src/services/messageService', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, default: { ...actual.default, list: vi.fn() } };
});

class FakeSocket {
  static OPEN = 1;
  static instances = [];
  constructor(url) { this.url = String(url); this.readyState = 0; this.send = vi.fn(); FakeSocket.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
  event(value) { this.onmessage?.({ data: typeof value === 'string' ? value : JSON.stringify(value) }); }
  close() { this.readyState = 3; this.onclose?.(); }
}

const cleanups = [];
const token = id => `header.${btoa(JSON.stringify({ sub: String(id), exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', FakeSocket);
  FakeSocket.instances = [];
  request.mockReset().mockImplementation(async () => ({ ticket: `ticket-${request.mock.calls.length}`, expires_in: 30 }));
  messageService.list.mockReset();
  setToken(token(1));
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  clearToken();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('authenticated realtime connection', () => {
  it('uses a one-use HTTP ticket, waits for server readiness and deduplicates message IDs', async () => {
    const events = [], statuses = [];
    cleanups.push(listen(event => events.push(event)), watchStatus(value => statuses.push(value)), start());
    await flush();
    const socket = FakeSocket.instances[0];
    expect(socket.url).toBe('ws://localhost:3000/api/v1/ws?ticket=ticket-1');
    expect(request).toHaveBeenCalledWith('/socket-ticket', expect.objectContaining({ method: 'POST', auth: 'required', signal: expect.any(AbortSignal) }));
    socket.open();
    expect(statuses.at(-1)).toBe('connecting');
    socket.event({ type: 'ready' });
    socket.event({ type: 'message.created', message: { id: 8, group_id: 2, body: 'Hello' } });
    socket.event({ type: 'message.created', message: { id: 8, group_id: 2, body: 'Hello' } });
    socket.event('bad JSON');
    socket.event({ type: 'message.created' });
    expect(statuses.at(-1)).toBe('connected');
    expect(events.map(event => event.type)).toEqual(['connection.ready', 'ready', 'message.created']);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(socket.send).toHaveBeenCalledWith('{"action":"ping"}');
  });

  it('gets a fresh ticket for every reconnect and caps failed reconnect delay at thirty seconds', async () => {
    cleanups.push(start());
    await flush();
    const delays = [1000, 2000, 4000, 8000, 16000, 30000, 30000];
    for (const delay of delays) {
      FakeSocket.instances.at(-1).close();
      const count = request.mock.calls.length;
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(request).toHaveBeenCalledTimes(count);
      await vi.advanceTimersByTimeAsync(1);
      expect(request).toHaveBeenCalledTimes(count + 1);
      expect(FakeSocket.instances.at(-1).url).toContain(`ticket=ticket-${count + 1}`);
    }
  });

  it('ignores old-account events, resets deduplication and closes connections on logout', async () => {
    const events = [];
    cleanups.push(listen(event => events.push(event)), start());
    await flush();
    const oldSocket = FakeSocket.instances[0];
    oldSocket.event({ type: 'message.created', message: { id: 7 } });
    setToken(token(2));
    await flush();
    expect(oldSocket.readyState).toBe(3);
    oldSocket.event({ type: 'message.created', message: { id: 99 } });
    FakeSocket.instances.at(-1).event({ type: 'message.created', message: { id: 7 } });
    expect(events.map(event => event.message.id)).toEqual([7, 7]);
    clearToken();
    const count = request.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(request).toHaveBeenCalledTimes(count);
    expect(FakeSocket.instances.at(-1).readyState).toBe(3);
  });

  it('aborts outstanding tickets and ignores their late result when disposed', async () => {
    let resolve;
    request.mockImplementation(() => new Promise(done => { resolve = done; }));
    const stop = start();
    const signal = request.mock.calls[0][1].signal;
    stop();
    resolve({ ticket: 'late' });
    await flush();
    expect(signal.aborted).toBe(true);
    expect(FakeSocket.instances).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('retries ticket/network failures and recovers when connectivity returns', async () => {
    request.mockRejectedValueOnce(new Error('Offline'));
    const states = [];
    cleanups.push(watchStatus(value => states.push(value)), start());
    await flush();
    expect(states).toContain('error');
    await vi.advanceTimersByTimeAsync(1000);
    const socket = FakeSocket.instances.at(-1);
    socket.open(); socket.event({ type: 'ready' });
    expect(states.at(-1)).toBe('connected');
  });

  it('isolates failing observers and has only one active connection after effect cleanup and restart', async () => {
    const received = vi.fn(), statuses = vi.fn();
    cleanups.push(listen(() => { throw new Error('Bad observer'); }), listen(received), watchStatus(() => { throw new Error('Bad status observer'); }), watchStatus(statuses));
    const stopFirst = start();
    await flush();
    const first = FakeSocket.instances[0];
    stopFirst();
    cleanups.push(start());
    await flush();
    first.event({ type: 'message.created', message: { id: 1 } });
    const active = FakeSocket.instances.at(-1);
    active.open(); active.event({ type: 'ready' });
    active.event({ type: 'notification.created', notification: { id: 2 } });
    expect(received.mock.calls.map(([event]) => event.type)).toEqual(['connection.ready', 'ready', 'notification.created']);
    expect(statuses).toHaveBeenLastCalledWith('connected');
    expect(FakeSocket.instances.filter(socket => socket.readyState !== 3)).toHaveLength(1);
  });
});

describe('public live discovery', () => {
  it('subscribes to all districts without authentication and cleans up retry and heartbeat timers', async () => {
    clearToken();
    const events = [];
    cleanups.push(listen(event => events.push(event)));
    const stop = startLobby();
    const socket = FakeSocket.instances[0];
    socket.open();
    expect(socket.send).toHaveBeenCalledWith('{"action":"subscribe"}');
    socket.event({ type: 'subscribed' });
    socket.event({ type: 'room_removed', room_id: 5 });
    // The first connection has nothing to catch up on, so it does not announce lobby.ready (pages just fetched).
    expect(events.map(event => event.type)).toEqual(['subscribed', 'room_removed']);
    socket.close(); stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(request).not.toHaveBeenCalled();
  });

  it('ignores stale lobby handlers after reconnect and effect cleanup', async () => {
    const events = [];
    cleanups.push(listen(event => events.push(event)));
    const stop = startLobby('capital');
    const first = FakeSocket.instances[0];
    first.open(); first.close();
    await vi.advanceTimersByTimeAsync(1000);
    const current = FakeSocket.instances.at(-1);
    current.open();
    first.open(); first.event({ type: 'room_created', room: { id: 9 } }); first.onerror?.();
    expect(first.send).toHaveBeenCalledTimes(1);
    expect(current.send).toHaveBeenCalledWith('{"action":"subscribe","district":"capital"}');
    stop();
    current.open(); current.event({ type: 'room_created', room: { id: 10 } });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(events).toEqual([]);
    expect(FakeSocket.instances).toHaveLength(2);
  });
});

describe('missed message recovery', () => {
  it('merges out-of-order duplicate messages into a stable chronological history', () => {
    expect(mergeMessages([{ id: 2, body: 'old' }, { id: 1 }], [{ id: 3 }, { id: 2, body: 'new' }])).toEqual([{ id: 1 }, { id: 2, body: 'new' }, { id: 3 }]);
  });

  it('paginates beyond one hundred missed messages until reaching known history', async () => {
    const descending = (high, low) => Array.from({ length: high - low + 1 }, (_, index) => ({ id: high - index }));
    messageService.list.mockResolvedValueOnce(descending(250, 151)).mockResolvedValueOnce(descending(150, 51));
    const history = await recoverMessages({ type: 'group', id: 3 }, [{ id: 80 }]);
    expect(messageService.list.mock.calls.map(([query]) => query)).toEqual([{ group_id: 3, limit: 100 }, { group_id: 3, limit: 100, before: 151 }]);
    expect(history.map(message => message.id)).toEqual(Array.from({ length: 171 }, (_, index) => index + 80));
  });

  it('loads an empty room history and stops cancelled recovery before requesting data', async () => {
    messageService.list.mockResolvedValue([]);
    await expect(recoverMessages({ type: 'room', id: 2 })).resolves.toEqual([]);
    const controller = new AbortController(); controller.abort();
    await expect(recoverMessages({ type: 'direct', id: 3 }, [], { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(messageService.list).toHaveBeenCalledTimes(1);
  });

  it('announces lobby.ready only after a reconnect, so pages catch up on what they missed', async () => {
    const events = [];
    cleanups.push(listen(event => events.push(event.type)));
    const stop = startLobby();
    const first = FakeSocket.instances[0];
    first.open(); first.event({ type: 'subscribed' });
    expect(events).toEqual(['subscribed']);
    first.close();
    await vi.advanceTimersByTimeAsync(1000);
    const second = FakeSocket.instances.at(-1);
    second.open(); second.event({ type: 'subscribed' });
    expect(events).toEqual(['subscribed', 'lobby.ready', 'subscribed']);
    stop();
  });
});
