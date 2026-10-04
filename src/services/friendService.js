import { request } from '../lib/api/client.js';
import { apiPath } from '../lib/api/path.js';

/** Includes pending, accepted and historical connections belonging to the current user. */
export const list = (options = {}) => request('/friends', { ...options, auth: 'required' });
/** @param {{ other_user_id: number }} body */
export const create = (body, options = {}) => request('/friends', { ...options, method: 'POST', body, auth: 'required' });
/** Target accepts/declines; each user can update only their own block flag. @param {import('../lib/api/types.js').FriendUpdate} body */
export const update = (userId, body, options = {}) => request(apiPath('friends', userId), { ...options, method: 'PATCH', body, auth: 'required' });

export default { list, create, update };
