import { request } from '../lib/api/client.js';
import { apiPath } from '../lib/api/path.js';

/** Sports expose only id/name; format presets are not returned by this backend. @returns {Promise<import('../lib/api/types.js').Sport[]>} */
export const list = (options = {}) => request('/sports', options);
/** @returns {Promise<import('../lib/api/types.js').Sport>} */
export const get = (sportId, options = {}) => request(apiPath('sports', sportId), options);

export default { list, get };
