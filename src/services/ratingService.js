import { request } from '../lib/api/client.js';
import { apiPath } from '../lib/api/path.js';

/** Rate a player after a completed room. Final: there is no edit or delete. @param {import('../lib/api/types.js').PlayerRating} body @returns {Promise<import('../lib/api/types.js').PlayerRating>} */
export const give = (roomId, body, options = {}) => request(apiPath('rooms', roomId, 'ratings'), { ...options, method: 'POST', body, auth: 'required' });
/** The ratings the signed-in user gave in this room. @returns {Promise<import('../lib/api/types.js').PlayerRating[]>} */
export const listMine = (roomId, options = {}) => request(apiPath('rooms', roomId, 'ratings', 'mine'), { ...options, auth: 'required' });
/** Public rating summary of any user. @returns {Promise<import('../lib/api/types.js').UserRating>} */
export const getForUser = (userId, options = {}) => request(apiPath('users', userId, 'rating'), options);

export default { give, listMine, getForUser };
