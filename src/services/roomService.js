import { request } from '../lib/api/client.js';
import { apiPath } from '../lib/api/path.js';

/** Public/open discovery, more than 15 minutes before start, ordered by start. @param {import('../lib/api/types.js').RoomQuery} query */
export const list = (query = {}, options = {}) => request('/rooms', { ...options, query });
/**
 * @param {import('../lib/api/types.js').MyRoomsQuery} query
 * @returns {Promise<import('../lib/api/types.js').MyRoomsPage>}
 */
export const listMine = (query = {}, options = {}) => request('/rooms/mine', { ...options, query, auth: 'required' });
export const listJoined = (query = {}, options = {}) => request('/rooms/joined', { ...options, query, auth: 'required' });
/** Optional bearer exposes exact venue to host. Nonpublic rooms are visible only to host. */
export const get = (roomId, options = {}) => request(apiPath('rooms', roomId), { ...options, auth: 'optional' });
/** @param {import('../lib/api/types.js').RoomInput} body */
export const create = (body, options = {}) => request('/rooms', { ...options, method: 'POST', body, auth: 'required' });
/** Host-only PUT requires current revision. @param {import('../lib/api/types.js').RoomUpdate} body */
export const update = (roomId, body, options = {}) => request(apiPath('rooms', roomId), { ...options, method: 'PUT', body, auth: 'required' });
/** Cancel an open room with a required reason. */
export const cancel = (roomId, reason, options = {}) => request(apiPath('rooms', roomId, 'cancel'), { ...options, method: 'POST', body: { reason }, auth: 'required' });

export default { list, listMine, listJoined, get, create, update, cancel };
