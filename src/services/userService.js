import { request } from '../lib/api/client.js';
import { apiPath } from '../lib/api/path.js';

// GET /users is paged (default 50, max 100). Callers search and match names across everyone, so read every page.
const USERS_PAGE = 100;

/** @returns {Promise<import('../lib/api/types.js').User[]>} */
export async function list(options = {}) {
  const users = [];
  for (let offset = 0; ; offset += USERS_PAGE) {
    const page = await request('/users', { ...options, query: { limit: USERS_PAGE, offset } });
    if (!Array.isArray(page)) return users;
    users.push(...page);
    if (page.length < USERS_PAGE) return users;
  }
}
/** @returns {Promise<import('../lib/api/types.js').User>} */
export const get = (userId, options = {}) => request(apiPath('users', userId), options);
/** Fetch the signed-in user's own profile, including email and google_linked. @returns {Promise<import('../lib/api/types.js').PrivateUser>} */
export const getMe = (options = {}) => request('/users/me', { ...options, auth: 'required' });
/** @param {import('../lib/api/types.js').UserUpdate} body @returns {Promise<import('../lib/api/types.js').PrivateUser>} */
export const updateMe = (body, options = {}) => request('/users/me', { ...options, method: 'PUT', body, auth: 'required' });

export default { list, get, getMe, updateMe };
