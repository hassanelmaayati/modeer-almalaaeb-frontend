import { clearToken, getToken } from '../helpers/session.js';

export const API_BASE = (import.meta.env?.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '');

// The free Render plan sleeps when idle and takes up to a minute to wake: wait for it instead of failing at once.
const REQUEST_TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 1_000;
const SLOW_AFTER_MS = 6_000;
export const WAKING_MESSAGE = 'The server is waking up, this can take up to a minute. Please try again shortly.';
const OFFLINE_MESSAGE = 'You appear to be offline. Check your connection and try again.';
const WAKING_STATUSES = [502, 503, 504];

/** HTTP or network failure, including FastAPI field validation errors. */
export class ApiError extends Error {
  constructor(message, { status = 0, detail = null, fieldErrors = {}, retryAfter = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.fieldErrors = fieldErrors;
    this.retryAfter = retryAfter;
  }
}

// --- "Is the server awake?" state, shown as an app-level banner -------------------------------------------------
let waking = false;
const wakingListeners = new Set();

function setWaking(value) {
  if (waking === value) return;
  waking = value;
  for (const listener of wakingListeners) listener(value);
}

/** Calls listener(true) while requests are slow or failing because the backend is asleep, listener(false) once it answers. */
export function watchServerWaking(listener) {
  wakingListeners.add(listener);
  listener(waking);
  return () => wakingListeners.delete(listener);
}

// --- errors --------------------------------------------------------------------------------------------------
/** Retry-After is seconds or an HTTP date; returns whole seconds, or null when absent or unreadable. */
function retryAfterSeconds(response) {
  const raw = response.headers?.get?.('Retry-After');
  if (!raw) return null;
  const seconds = /^\d+$/.test(raw.trim()) ? Number(raw) : (Date.parse(raw) - Date.now()) / 1000;
  return Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : null;
}

export function tooManyAttemptsMessage(seconds) {
  // Browsers only see Retry-After cross-origin if the backend exposes it; without it we can't give a number.
  if (seconds == null) return 'Too many attempts, please try again in a few minutes.';
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Too many attempts, try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`;
}

function normalizeError(response, data) {
  const detail = data?.detail ?? null;
  const fieldErrors = {};
  let message = typeof detail === 'string' ? detail : '';
  if (Array.isArray(detail)) {
    const messages = detail.map((issue) => {
      const path = (issue.loc || []).filter((part) => !['body', 'query', 'path'].includes(part)).join('.');
      const explanation = issue.msg || 'Invalid value';
      if (path) fieldErrors[path] = explanation;
      return path ? `${path}: ${explanation}` : explanation;
    });
    message = messages.join('; ');
  }
  const { status } = response;
  const retryAfter = status === 429 ? retryAfterSeconds(response) : null;
  if (status === 429) message = tooManyAttemptsMessage(retryAfter);
  else if (status === 413) message = 'That is too large to send. Make it shorter or smaller and try again.';
  else if (WAKING_STATUSES.includes(status) && !message) message = WAKING_MESSAGE;
  return new ApiError(message || `Request failed (${status}).`, { status, detail, fieldErrors, retryAfter });
}

// --- transport -----------------------------------------------------------------------------------------------
function abortError() {
  return new DOMException('Aborted', 'AbortError');
}

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
    function onAbort() { clearTimeout(timer); reject(abortError()); }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** One fetch with a timeout that is separate from the caller's own abort signal. */
async function attempt(url, init, signal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), REQUEST_TIMEOUT_MS);
  const slow = setTimeout(() => setWaking(true), SLOW_AFTER_MS);
  const onAbort = () => controller.abort(signal.reason);
  if (signal?.aborted) onAbort(); else signal?.addEventListener('abort', onAbort, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    clearTimeout(slow);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Fetch with one retry for GETs (reads are safe to repeat; writes never are). */
async function send(url, init, signal) {
  const canRetry = init.method === 'GET';
  for (let tries = 0; ; tries += 1) {
    let response;
    try {
      response = await attempt(url, init, signal);
    } catch (error) {
      // Only the caller's own abort is passed through; a timeout or network failure is "the server isn't answering".
      if (signal?.aborted || (error.name === 'AbortError' && !signal)) throw error;
      if (canRetry && tries === 0) { await pause(RETRY_DELAY_MS, signal); continue; }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ApiError(OFFLINE_MESSAGE);
      setWaking(true);
      throw new ApiError(WAKING_MESSAGE, { status: 0 });
    }
    if (canRetry && tries === 0 && WAKING_STATUSES.includes(response.status)) { await pause(RETRY_DELAY_MS, signal); continue; }
    // Any answer means the server is up, even an error answer.
    setWaking(WAKING_STATUSES.includes(response.status));
    return response;
  }
}

async function execute(path, { method = 'GET', body, query, auth = 'none', signal } = {}) {
  if (!['none', 'required', 'optional'].includes(auth)) throw new TypeError('Unknown authentication mode.');
  const token = auth === 'none' ? null : getToken();
  if (auth === 'required' && !token) {
    throw new ApiError('Please sign in to continue.', { status: 401 });
  }
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    // An array repeats the parameter (?status=a&status=b), as FastAPI expects for list parameters.
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === undefined || item === null || item === '') continue;
      parameters.append(key, item instanceof Date ? item.toISOString() : String(item));
    }
  }
  const suffix = parameters.size ? `?${parameters}` : '';
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await send(`${API_BASE}/${path.replace(/^\/+/, '')}${suffix}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }, signal);

  if (response.status === 401 && token && getToken() === token) clearToken();
  if (response.status === 204) return { data: null, response };
  let data;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error;
    if (!response.ok) throw normalizeError(response, null);
    throw new ApiError('The server returned an unreadable response.', { status: response.status });
  }
  if (!response.ok) throw normalizeError(response, data);
  return { data, response };
}

/**
 * Execute a JSON API request. GETs are retried once after a timeout or an asleep-server answer; writes are never retried.
 * @param {string} path Resource path relative to /api/v1.
 * @param {{ method?: string, body?: unknown, query?: object, auth?: 'none'|'required'|'optional', signal?: AbortSignal }} options
 * @returns {Promise<unknown>} A backend object/array, or null for a 204 response.
 */
export async function request(path, options) {
  return (await execute(path, options)).data;
}

/**
 * GET a paged list. `total` is the X-Total-Count header (null if the server did not send or expose it).
 * @returns {Promise<{ items: unknown[], total: number|null }>}
 */
export async function requestPage(path, options) {
  const { data, response } = await execute(path, options);
  const header = response.headers?.get?.('X-Total-Count');
  const total = header == null || header === '' ? null : Number(header);
  return { items: Array.isArray(data) ? data : [], total: Number.isFinite(total) ? total : null };
}
