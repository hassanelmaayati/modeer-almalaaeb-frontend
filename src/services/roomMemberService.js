import { request as apiRequest } from '../lib/api/client.js';
import { apiPath } from '../lib/api/path.js';

/** Public membership list; count accepted rows for occupancy. */
export const list = (roomId, options = {}) => apiRequest(apiPath('rooms', roomId, 'members'), options);
/** Request self admission; always pending, including rooms with open admission policy. */
export const request = (roomId, options = {}) => apiRequest(apiPath('rooms', roomId, 'members'), { ...options, method: 'POST', body: {}, auth: 'required' });
/** Only host may invite another user. */
export const invite = (roomId, userId, options = {}) => apiRequest(apiPath('rooms', roomId, 'members'), { ...options, method: 'POST', body: { user_id: userId }, auth: 'required' });
/** Permission depends on the action: host approval/attendance/rating, self slot or response. @param {import('../lib/api/types.js').RoomMemberUpdate} body */
export const update = (roomId, userId, body, options = {}) => apiRequest(apiPath('rooms', roomId, 'members', userId), { ...options, method: 'PATCH', body, auth: 'required' });
/** Withdraw/leave; 204, row retained as left, so another POST cannot rejoin. */
export const leave = (roomId, options = {}) => apiRequest(apiPath('rooms', roomId, 'members', 'me'), { ...options, method: 'DELETE', auth: 'required' });

export default { list, request, invite, update, leave };
