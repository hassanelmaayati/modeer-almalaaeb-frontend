import { request } from '../lib/api/client.js';
import { apiPath } from '../lib/api/path.js';

/** @returns {Promise<import('../lib/api/types.js').User[]>} */
export const list = (options = {}) => request('/users', options);
/** @returns {Promise<import('../lib/api/types.js').User>} */
export const get = (userId, options = {}) => request(apiPath('users', userId), options);
/** Fetch the authoritative public profile of the signed-in user. */
export const getMe = (options = {}) => request('/users/me', { ...options, auth: 'required' });
/** @param {import('../lib/api/types.js').UserUpdate} body */
export const updateMe = (body, options = {}) => request('/users/me', { ...options, method: 'PUT', body, auth: 'required' });

export default { list, get, getMe, updateMe };
