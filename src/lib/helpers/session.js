const TOKEN_KEY = 'token';
const listeners = new Set();
let memoryToken = null;
let expirationTimer = null;
let storageUnavailable = false;

/** Decode a JWT payload for expiry checks only; the backend verifies its signature. */
export function decodeToken(token) {
  try {
    if (typeof token !== 'string' || token.split('.').length !== 3) return null;
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    if (!Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now()) return null;
    if (!/^\d+$/.test(String(payload.sub ?? ''))) return null;
    return payload;
  } catch {
    return null;
  }
}

function readStoredToken() {
  if (storageUnavailable) return memoryToken;
  try {
    return globalThis.localStorage ? globalThis.localStorage.getItem(TOKEN_KEY) : memoryToken;
  } catch {
    storageUnavailable = true;
    return memoryToken;
  }
}

function notifySession(token = getToken()) {
  for (const listener of listeners) listener(token);
}

function watchExpiration(payload) {
  clearTimeout(expirationTimer);
  expirationTimer = null;
  if (!payload) return;
  expirationTimer = setTimeout(() => {
    expirationTimer = null;
    getToken();
  }, Math.min(Math.max(payload.exp * 1000 - Date.now(), 1), 2147483647));
  expirationTimer.unref?.();
}

function commitSession(token, payload) {
  memoryToken = token;
  try {
    if (token) globalThis.localStorage?.setItem(TOKEN_KEY, token);
    else globalThis.localStorage?.removeItem(TOKEN_KEY);
  } catch {
    // Browser storage failures leave the current session usable in memory.
    storageUnavailable = true;
  }
  watchExpiration(payload);
  notifySession(token);
}

/** Read a current token, removing malformed or expired persisted sessions. */
export function getToken() {
  const token = readStoredToken();
  const payload = decodeToken(token);
  if (token && !payload) {
    clearToken();
    return null;
  }
  if (payload && expirationTimer === null) watchExpiration(payload);
  return token || null;
}

/** Persist only a valid, unexpired backend token. Returns the decoded payload. */
export function setToken(token) {
  const payload = decodeToken(token);
  if (!payload) throw new Error('The server returned an invalid or expired session.');
  commitSession(token, payload);
  return payload;
}

/** Remove the session and notify subscribers in this tab. */
export function clearToken() {
  commitSession(null, null);
}

/** Subscribe to login, logout, expiry, and token changes in other tabs. */
export function subscribeSession(listener) {
  if (listeners.size === 0) globalThis.addEventListener?.('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) globalThis.removeEventListener?.('storage', onStorage);
  };
}

function onStorage(event) {
  if (event.key !== TOKEN_KEY && event.key !== null) return;
  memoryToken = null;
  watchExpiration(null);
  notifySession();
}
