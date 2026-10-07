import { request } from '../lib/api/client.js';
import { apiPath } from '../lib/api/path.js';

const IDS_PER_CALL = 100;
const SEARCH_PAGE = 100;
const MAX_SCAN_PAGES = 20;

/** Public profiles for specific ids (at most 100 per call, so longer lists are split). @returns {Promise<import('../lib/api/types.js').User[]>} */
export async function listByIds(ids, options = {}) {
  const unique = [...new Set((ids || []).map(Number).filter(id => Number.isInteger(id) && id > 0))];
  const users = [];
  for (let start = 0; start < unique.length; start += IDS_PER_CALL) {
    const page = await request('/users', { ...options, query: { ids: unique.slice(start, start + IDS_PER_CALL).join(',') } });
    if (Array.isArray(page)) users.push(...page);
  }
  return users;
}

/**
 * People search by name. The API is asked to filter (?search=), but every result is checked here too: if any result
 * does not match, the server ignored the filter, so we scan the (paged) user list ourselves rather than show wrong people.
 * @returns {Promise<import('../lib/api/types.js').User[]>}
 */
export async function search(text, options = {}) {
  const needle = String(text || '').trim();
  if (!needle) return [];
  const lower = needle.toLowerCase();
  const matches = user => String(user.user_name || '').toLowerCase().includes(lower);
  const first = await request('/users', { ...options, query: { search: needle, limit: SEARCH_PAGE } });
  if (Array.isArray(first) && first.every(matches)) return first;
  const found = [];
  for (let page = 0; page < MAX_SCAN_PAGES; page += 1) {
    const users = page === 0 && Array.isArray(first) ? first : await request('/users', { ...options, query: { limit: SEARCH_PAGE, offset: page * SEARCH_PAGE } });
    if (!Array.isArray(users)) break;
    found.push(...users.filter(matches));
    if (users.length < SEARCH_PAGE) break;
  }
  return found;
}

/** @returns {Promise<import('../lib/api/types.js').User>} */
export const get = (userId, options = {}) => request(apiPath('users', userId), options);
/** Fetch the signed-in user's own profile, including email and google_linked. @returns {Promise<import('../lib/api/types.js').PrivateUser>} */
export const getMe = (options = {}) => request('/users/me', { ...options, auth: 'required' });
/** @param {import('../lib/api/types.js').UserUpdate} body @returns {Promise<import('../lib/api/types.js').PrivateUser>} */
export const updateMe = (body, options = {}) => request('/users/me', { ...options, method: 'PUT', body, auth: 'required' });

export default { listByIds, search, get, getMe, updateMe };
