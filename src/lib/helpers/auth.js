import * as userService from '../../services/userService';
import * as authService from '../../services/authService';
import { getToken, setToken, clearToken, subscribeSession } from './session';

export const initialSession = () => ({ user: null, loading: !!getToken(), error: null });

const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 30_000];
// A sleeping or unreachable server (network, timeout, 5xx, 408, 429) says nothing about whether the sign-in is valid.
const isTransient = error => !error?.status || error.status >= 500 || [408, 429].includes(error.status);

/**
 * Keeps the session in step with the stored token. Only a rejected token (401) means signed out; a server that is
 * asleep keeps the token, reports `offline: true` (loading stays true so guards wait instead of redirecting) and retries.
 * The returned stop function also has a `retry()` for "Try now".
 */
export function watchUser(setSession) {
  let active = true, controller, timer, failures = 0;
  function restore(token, { retrying = false } = {}) {
    if (!active) return;
    clearTimeout(timer);
    controller?.abort();
    if (!retrying) { failures = 0; setSession({ user: null, loading: !!token, error: null }); }
    if (!token) return;
    const request = controller = new AbortController();
    const current = () => active && !request.signal.aborted && getToken() === token;
    userService.getMe({ signal: request.signal })
      .then(user => { if (current()) { failures = 0; setSession({ user, loading: false, error: null }); } })
      .catch(error => {
        if (!current()) return;
        if (!isTransient(error)) { setSession({ user: null, loading: false, error }); return; }
        setSession({ user: null, loading: true, error, offline: true });
        timer = setTimeout(() => restore(getToken(), { retrying: true }), RETRY_DELAYS_MS[Math.min(failures++, RETRY_DELAYS_MS.length - 1)]);
      });
  }
  const unsubscribe = subscribeSession(restore);
  Promise.resolve().then(() => restore(getToken()));
  const stop = () => { active = false; clearTimeout(timer); controller?.abort(); unsubscribe(); };
  stop.retry = () => { failures = 0; restore(getToken(), { retrying: true }); };
  return stop;
}

export async function authenticate(action, body, setSession) {
  const { token, user } = await action(body);
  setToken(token);
  setSession({ user, loading: false, error: null });
  return user;
}

export async function signOut() {
  const token = getToken();
  try { if (token) await authService.logout(); }
  finally { if (getToken() === token) clearToken(); }
}
