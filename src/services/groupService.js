import { request } from '../lib/api/client.js';
import { apiPath } from '../lib/api/path.js';

/** Public, unpaginated list of all groups. @returns {Promise<import('../lib/api/types.js').Group[]>} */
export const list = (options = {}) => request('/groups', options);
/** @returns {Promise<import('../lib/api/types.js').Group>} */
export const get = (groupId, options = {}) => request(apiPath('groups', groupId), options);
/** Uses sports_id (plural). Creation does not add an owner membership. @param {import('../lib/api/types.js').GroupInput} body */
export const create = (body, options = {}) => request('/groups', { ...options, method: 'POST', body, auth: 'required' });
/** Owner only; PUT requires name and cannot change sports_id. @param {import('../lib/api/types.js').GroupUpdate} body */
export const update = (groupId, body, options = {}) => request(apiPath('groups', groupId), { ...options, method: 'PUT', body, auth: 'required' });

export default { list, get, create, update };
