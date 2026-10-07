import { request, requestPage } from '../lib/api/client.js';
import { apiPath } from '../lib/api/path.js';

const MINE_PAGE = 100;
const MAX_MINE_PAGES = 10;

/** Public groups, paged (limit default 50, max 100) with member_count. @returns {Promise<import('../lib/api/types.js').Group[]>} */
export const list = (query = {}, options = {}) => request('/groups', { ...options, query });
/** The signed-in user's groups (owned, joined or invited) with member_count and role; one page plus X-Total-Count. */
export const minePage = (query = {}, options = {}) => requestPage('/groups/mine', { ...options, query, auth: 'required' });
/** Every group of the signed-in user (a few pages at most), for pickers that need all of them. */
export async function mine(options = {}) {
  const groups = [];
  for (let page = 0; page < MAX_MINE_PAGES; page += 1) {
    const { items } = await minePage({ limit: MINE_PAGE, offset: page * MINE_PAGE }, options);
    groups.push(...items);
    if (items.length < MINE_PAGE) break;
  }
  return groups;
}
/** @returns {Promise<import('../lib/api/types.js').Group>} */
export const get = (groupId, options = {}) => request(apiPath('groups', groupId), options);
/** Uses sports_id (plural). Creation does not add an owner membership. @param {import('../lib/api/types.js').GroupInput} body */
export const create = (body, options = {}) => request('/groups', { ...options, method: 'POST', body, auth: 'required' });
/** Owner only; PUT requires name and cannot change sports_id. @param {import('../lib/api/types.js').GroupUpdate} body */
export const update = (groupId, body, options = {}) => request(apiPath('groups', groupId), { ...options, method: 'PUT', body, auth: 'required' });

export default { list, minePage, mine, get, create, update };
