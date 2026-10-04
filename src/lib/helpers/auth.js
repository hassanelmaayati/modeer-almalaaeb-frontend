import * as userService from '../../services/userService';
import * as authService from '../../services/authService';
import { getToken, setToken, clearToken, subscribeSession } from './session';

export const initialSession = () => ({ user: null, loading: !!getToken(), error: null });

export function watchUser(setSession) {
  let active = true, controller;
  function restore(token) {
    if (!active) return;
    controller?.abort();
    setSession({ user: null, loading: !!token, error: null });
    if (!token) return;
    const request = controller = new AbortController();
    const current = () => active && !request.signal.aborted && getToken() === token;
    userService.getMe({ signal: request.signal })
      .then(user => { if (current()) setSession({ user, loading: false, error: null }); })
      .catch(error => { if (current()) setSession({ user: null, loading: false, error }); });
  }
  const unsubscribe = subscribeSession(restore);
  Promise.resolve().then(() => restore(getToken()));
  return () => { active = false; controller?.abort(); unsubscribe(); };
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
