import { request } from '../lib/api/client.js';
import { apiPath } from '../lib/api/path.js';

/** Read-only roster of every team in the cup; public cups need no sign-in. @returns {Promise<import('../lib/api/types.js').Membership[]>} */
export const list = (cupId, options = {}) => request(apiPath('cups', cupId, 'roster'), { ...options, auth: 'optional' });
/** Owner invites an accepted team member. @param {{ user_id: number, group_id: number }} body */
export const invite = (cupId, body, options = {}) => request(apiPath('cups', cupId, 'roster'), { ...options, method: 'POST', body, auth: 'required' });
/** Self: accepted/declined/left; owner editing another user: removed. @param {import('../lib/api/types.js').MembershipUpdate} body */
export const update = (cupId, userId, body, options = {}) => request(apiPath('cups', cupId, 'roster', userId), { ...options, method: 'PATCH', body, auth: 'required' });

export default { list, invite, update };
