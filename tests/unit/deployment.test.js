import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const environment = vi.hoisted(() => ({ file: {} }));
vi.mock('vite', async importOriginal => ({
  ...await importOriginal(),
  loadEnv: vi.fn(() => ({ ...environment.file })),
}));

const backend = 'https://hassan-modeer.example/api/v1';
const cleanups = [];
let session;

class FakeSocket {
  static OPEN = 1;
  static instances = [];
  constructor(url) {
    this.url = String(url);
    this.readyState = 0;
    this.send = vi.fn();
    FakeSocket.instances.push(this);
  }
  open() { this.readyState = 1; this.onopen?.(); }
  event(value) { this.onmessage?.({ data: JSON.stringify(value) }); }
  close() { this.readyState = 3; this.onclose?.(); }
}

function dispose() {
  while (cleanups.length) cleanups.pop()();
  session?.clearToken();
  session = undefined;
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VERCEL', '');
  vi.stubEnv('VITE_API_BASE_URL', undefined);
  vi.stubEnv('VITE_API_PROXY_TARGET', undefined);
  environment.file = {};
  FakeSocket.instances = [];
});

afterEach(() => {
  dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function configuration(command = 'build', mode = 'production') {
  const { default: factory } = await import('../../vite.config.js');
  return () => factory({ command, mode });
}

describe('actual Vite deployment configuration', () => {
  it.each([
    undefined,
    '',
    'http://hassan-modeer.example/api/v1',
    'https://hassan-modeer.example',
    'https://hassan-modeer.example/api/v2',
    'https://hassan-modeer.example/api/v1?debug=1',
    'https://hassan-modeer.example/api/v1#fragment',
    'https://hassan modeer.example/api/v1',
    'https:///api/v1',
    'https://hassan-modeer.example/api/v1/extra',
  ])('rejects missing or invalid Vercel API destination %s', async value => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('VITE_API_BASE_URL', value);
    expect(await configuration()).toThrow(/VITE_API_BASE_URL.*HTTPS.*\/api\/v1/);
  });

  it.each([backend, `${backend}/`])('accepts HTTPS API destination %s on Vercel', async value => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('VITE_API_BASE_URL', value);
    expect(await configuration()).not.toThrow();
  });

  it('uses process settings ahead of env-file API and proxy settings', async () => {
    environment.file = { VITE_API_BASE_URL: 'http://old.example/api/v1', VITE_API_PROXY_TARGET: 'http://127.0.0.1:8000' };
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('VITE_API_BASE_URL', backend);
    vi.stubEnv('VITE_API_PROXY_TARGET', 'http://127.0.0.1:8999');
    const config = (await configuration())();
    expect(config.server.proxy['/api']).toMatchObject({ target: 'http://127.0.0.1:8999', ws: true });
    expect(config.preview.proxy['/api']).toEqual(config.server.proxy['/api']);
  });

  it('refuses an invalid process API setting even when the env file is valid', async () => {
    environment.file = { VITE_API_BASE_URL: backend };
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('VITE_API_BASE_URL', 'http://invalid.example/api/v1');
    expect(await configuration()).toThrow(/VITE_API_BASE_URL.*HTTPS.*\/api\/v1/);
  });

  it('accepts a valid env-file API setting when the process does not set it', async () => {
    environment.file = { VITE_API_BASE_URL: backend };
    vi.stubEnv('VERCEL', '1');
    expect(await configuration()).not.toThrow();
  });

  it('retains local production builds and the local HTTP/WS proxy without new required env', async () => {
    const config = (await configuration())();
    expect(config.server.proxy['/api']).toMatchObject({ target: 'http://127.0.0.1:8000', ws: true });
  });

  it('does not impose the Vercel build requirement on development serving', async () => {
    vi.stubEnv('VERCEL', '1');
    expect(await configuration('serve', 'development')).not.toThrow();
  });
});

describe('actual services with an external HTTPS backend', () => {
  it.each([backend, `${backend}/`])('uses %s for HTTPS requests and secure sockets, then fully cleans up', async value => {
    vi.stubEnv('VITE_API_BASE_URL', value);
    vi.stubGlobal('WebSocket', FakeSocket);
    const fetch = vi.fn(async url => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(String(url).endsWith('/socket-ticket')
        ? { ticket: 'one-use-test-ticket', expires_in: 30 }
        : [{ id: 1, name: 'Soccer' }]),
    }));
    vi.stubGlobal('fetch', fetch);

    const { API_BASE } = await import('../../src/lib/api/client.js');
    const { default: sports } = await import('../../src/services/sportService.js');
    const sockets = await import('../../src/services/websocketService.js');
    session = await import('../../src/lib/helpers/session.js');
    vi.useFakeTimers();
    expect(API_BASE).toBe(backend);
    await expect(sports.list()).resolves.toEqual([{ id: 1, name: 'Soccer' }]);
    expect(fetch).toHaveBeenCalledWith(`${backend}/sports`, expect.objectContaining({ method: 'GET' }));

    const token = `header.${btoa(JSON.stringify({ sub: '7', exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
    session.setToken(token);
    const statuses = [];
    cleanups.push(sockets.watchStatus(status => statuses.push(status)), sockets.start());
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(fetch).toHaveBeenLastCalledWith(`${backend}/socket-ticket`, expect.objectContaining({
      method: 'POST', body: '{}', headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
    }));
    const authenticated = FakeSocket.instances[0];
    expect(authenticated.url).toBe('wss://hassan-modeer.example/api/v1/ws?ticket=one-use-test-ticket');
    expect(authenticated.url).not.toContain(token);
    expect([...new URL(authenticated.url).searchParams.keys()]).toEqual(['ticket']);
    authenticated.open();
    authenticated.event({ type: 'ready' });
    expect(statuses.at(-1)).toBe('connected');

    cleanups.push(sockets.startLobby());
    const lobby = FakeSocket.instances[1];
    expect(lobby.url).toBe('wss://hassan-modeer.example/api/v1/ws/lobby');
    expect(lobby.url).not.toContain(token);
    lobby.open();
    expect(lobby.send).toHaveBeenCalledWith('{"action":"subscribe"}');
    await vi.advanceTimersByTimeAsync(20_000);
    expect(authenticated.send).toHaveBeenCalledWith('{"action":"ping"}');
    expect(lobby.send).toHaveBeenCalledWith('{"action":"ping"}');

    dispose();
    // jsdom queues a storage event when logout removes the persisted token.
    await vi.advanceTimersByTimeAsync(0);
    expect(statuses.at(-1)).toBe('idle');
    expect(FakeSocket.instances.every(socket => socket.readyState === 3)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.instances).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
