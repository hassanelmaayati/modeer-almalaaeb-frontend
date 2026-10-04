import { request } from '../lib/api/client.js';
import { apiPath } from '../lib/api/path.js';

/** Authenticated; owners see all rows, others accepted members plus their invitation. */
export const list = (groupId, options = {}) => request(apiPath('groups', groupId, 'members'), { ...options, auth: 'required' });
/** Owner-only invitation. Existing memberships cannot be reinvited, including left/removed. */
export const invite = (groupId, userId, options = {}) => request(apiPath('groups', groupId, 'members'), { ...options, method: 'POST', body: { user_id: userId }, auth: 'required' });
/** Self: accepted/declined/left; owner editing another user: removed. @param {import('../lib/api/types.js').MembershipUpdate} body */
export const update = (groupId, userId, body, options = {}) => request(apiPath('groups', groupId, 'members', userId), { ...options, method: 'PATCH', body, auth: 'required' });

export default { list, invite, update };
