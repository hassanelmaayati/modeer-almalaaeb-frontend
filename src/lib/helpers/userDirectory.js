import { useEffect, useMemo, useSyncExternalStore } from 'react';
import userService from '../../services/userService';

// Names are looked up by id (GET /users?ids=) and cached, so no page ever loads the whole user table.
const TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // id -> { user, at }; user is null for an id the server did not return
const inflight = new Map(); // id -> Promise
const listeners = new Set();
let version = 0;

const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
const getVersion = () => version;
const cleanIds = ids => [...new Set((ids || []).map(Number).filter(id => Number.isInteger(id) && id > 0))];

function notify() {
  version += 1;
  for (const listener of listeners) listener();
}

export const peekUser = id => cache.get(Number(id))?.user ?? null;

/** Add profiles we already have (search results, the signed-in user) so they are not fetched again. */
export function rememberUsers(users) {
  const at = Date.now();
  for (const user of users || []) if (user?.id != null) cache.set(Number(user.id), { user, at });
  notify();
}

export function resetUserDirectory() {
  cache.clear();
  inflight.clear();
  notify();
}

/** Load the profiles that are missing or older than five minutes. Failures leave them unknown (shown as "Player N"). */
export async function ensureUsers(ids, options = {}) {
  const wanted = cleanIds(ids);
  const now = Date.now();
  const missing = wanted.filter(id => { const entry = cache.get(id); return !entry || now - entry.at > TTL_MS; });
  const fresh = missing.filter(id => !inflight.has(id));
  if (fresh.length) {
    const request = Promise.resolve().then(() => userService.listByIds(fresh, options))
      .then(users => {
        const found = new Set(users.map(user => user.id));
        rememberUsers(users);
        // Remember ids the server did not return too, so a deleted user is not asked for again on every render.
        for (const id of fresh) if (!found.has(id)) cache.set(id, { user: null, at: Date.now() });
      })
      .catch(() => {})
      .finally(() => { for (const id of fresh) inflight.delete(id); notify(); });
    for (const id of fresh) inflight.set(id, request);
  }
  await Promise.all(missing.map(id => inflight.get(id)).filter(Boolean));
}

/** The known profiles for these ids, loading any that are missing. Use with playerName(users, id). */
export default function useUsers(ids) {
  const key = cleanIds(ids).sort((a, b) => a - b).join(',');
  useEffect(() => { if (key) ensureUsers(key.split(',')); }, [key]);
  const current = useSyncExternalStore(subscribe, getVersion);
  return useMemo(() => (key ? key.split(',').map(peekUser).filter(Boolean) : []), [key, current]); // eslint-disable-line react-hooks/exhaustive-deps
}
