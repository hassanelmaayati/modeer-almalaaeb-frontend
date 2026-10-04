import { request } from '../lib/api/client.js';
import { apiPath } from '../lib/api/path.js';

/** Owner invites an accepted team member. @param {{ user_id: number, group_id: number }} body */
export const invite = (cupId, body, options = {}) => request(apiPath('cups', cupId, 'roster'), { ...options, method: 'POST', body, auth: 'required' });
/** Self: accepted/declined/left; owner editing another user: removed. @param {import('../lib/api/types.js').MembershipUpdate} body */
export const update = (cupId, userId, body, options = {}) => request(apiPath('cups', cupId, 'roster', userId), { ...options, method: 'PATCH', body, auth: 'required' });

export default { invite, update };
