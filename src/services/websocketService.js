import { API_BASE, request } from '../lib/api/client';
import { getToken, subscribeSession } from '../lib/helpers/session';
import messageService from './messageService';

const listeners = new Set();
const statusListeners = new Set();
let status = 'idle';

export function listen(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function watchStatus(listener) {
  statusListeners.add(listener);
  try { listener(status); } catch { /* Observers are independent. */ }
  return () => statusListeners.delete(listener);
}

function emit(event) {
  for (const listener of listeners) {
    try { listener(event); } catch { /* One consumer must not interrupt the others. */ }
  }
}

function setStatus(value) {
  status = value;
  for (const listener of statusListeners) {
    try { listener(value); } catch { /* Observers are independent. */ }
  }
}

function socketUrl(path) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url;
}

// Each start returns cleanup. App starts one authenticated connection per account.
export function start() {
  let stopped = false, socket, timer, heartbeat, controller, attempts = 0, generation = 0;
  const delivered = new Set();

  function disconnect() {
    generation += 1;
    clearTimeout(timer);
    clearInterval(heartbeat);
    controller?.abort();
    if (socket) { socket.onclose = null; socket.close(); socket = null; }
  }

  function reconnect() {
    if (stopped || !getToken()) return;
    setStatus('reconnecting');
    const delay = Math.min(1000 * 2 ** attempts++, 30_000);
    timer = setTimeout(connect, delay);
  }

  async function connect() {
    if (stopped || !getToken()) { setStatus('idle'); return; }
    const current = ++generation;
    setStatus(attempts ? 'reconnecting' : 'connecting');
    controller = new AbortController();
    try {
      const { ticket } = await request('/socket-ticket', { method: 'POST', body: {}, auth: 'required', signal: controller.signal });
      if (stopped || current !== generation) return;
      if (!ticket) throw new Error('The server returned no socket ticket.');
      const url = socketUrl('/ws');
      url.searchParams.set('ticket', ticket);
      socket = new WebSocket(url);
      const connection = socket;
      socket.onopen = () => {
        if (stopped || current !== generation) return;
        heartbeat = setInterval(() => { if (connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify({ action: 'ping' })); }, 20_000);
      };
      socket.onmessage = ({ data }) => {
        if (stopped || current !== generation) return;
        try {
          const event = JSON.parse(data);
          if (!event || typeof event.type !== 'string') return;
          if (event.type === 'ready') { attempts = 0; setStatus('connected'); emit({ type: 'connection.ready' }); }
          if (event.type === 'message.created') {
            if (!Number.isInteger(event.message?.id)) return;
            if (delivered.has(event.message?.id)) return;
            delivered.add(event.message?.id);
            if (delivered.size > 1000) delivered.delete(delivered.values().next().value);
          }
          emit(event);
        } catch { /* Ignore malformed transport frames. */ }
      };
      socket.onclose = () => { clearInterval(heartbeat); if (current === generation) reconnect(); };
      socket.onerror = () => connection.close();
    } catch (error) {
      if (stopped || current !== generation || error.name === 'AbortError') return;
      setStatus('error');
      reconnect();
    }
  }

  const unwatch = subscribeSession(() => { disconnect(); delivered.clear(); attempts = 0; connect(); });
  connect();
  return () => { stopped = true; disconnect(); unwatch(); setStatus('idle'); };
}

// Public discovery has a separate, compatible lobby connection for guests too.
export function startLobby(district) {
  let stopped = false, socket, timer, heartbeat, attempts = 0, generation = 0, connectedBefore = false;
  function reconnect() {
    clearInterval(heartbeat);
    if (!stopped) timer = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 30_000));
  }
  function connect() {
    if (stopped) return;
    const current = ++generation;
    try {
      socket = new WebSocket(socketUrl('/ws/lobby'));
      const connection = socket;
      connection.onopen = () => {
        if (stopped || current !== generation) return;
        connection.send(JSON.stringify({ action: 'subscribe', ...(district ? { district } : {}) }));
        heartbeat = setInterval(() => { if (connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify({ action: 'ping' })); }, 20_000);
      };
      connection.onmessage = ({ data }) => {
        if (stopped || current !== generation) return;
        try {
          const event = JSON.parse(data);
          // Pages already fetched when they mounted, so the first connection has nothing to catch up on; only a reconnect does.
          if (event?.type === 'subscribed') { attempts = 0; if (connectedBefore) emit({ type: 'lobby.ready' }); connectedBefore = true; }
          if (event && typeof event.type === 'string') emit(event);
        } catch { /* Ignore malformed transport frames. */ }
      };
      connection.onclose = () => { if (!stopped && current === generation) reconnect(); };
      connection.onerror = () => { if (!stopped && current === generation) connection.close(); };
    } catch { reconnect(); }
  }
  connect();
  return () => { stopped = true; generation += 1; clearTimeout(timer); clearInterval(heartbeat); if (socket) { socket.onclose = null; socket.close(); } };
}

export function mergeMessages(existing, incoming) {
  const messages = new Map(existing.map(message => [message.id, message]));
  for (const message of incoming) messages.set(message.id, message);
  return [...messages.values()].sort((a, b) => a.id - b.id);
}

// Recover missed history using the existing before-ID API, including long outages.
export async function recoverMessages(target, existing = [], options = {}) {
  const latest = Math.max(0, ...existing.map(message => message.id));
  let before, recovered = [];
  while (!options.signal?.aborted) {
    const page = await messageService.list({ ...messageService.targetQuery(target), ...(before ? { before } : {}), limit: 100 }, options);
    recovered = mergeMessages(recovered, page.filter(message => message.id > latest));
    const oldest = page.length ? Math.min(...page.map(message => message.id)) : 0;
    if (page.length < 100 || oldest <= latest || oldest === before) break;
    before = oldest;
  }
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return mergeMessages(existing, recovered);
}

export default { start, startLobby, listen, watchStatus, mergeMessages, recoverMessages };
