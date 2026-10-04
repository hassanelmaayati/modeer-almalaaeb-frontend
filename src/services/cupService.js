import { request } from '../lib/api/client.js';
import { apiPath } from '../lib/api/path.js';

/** Public cups plus current organizer's drafts when signed in. @param {{ status?: 'draft'|'registration'|'published'|'completed' }} query */
export const list = (query = {}, options = {}) => request('/cups', { ...options, query, auth: 'optional' });
/** Drafts are visible only to their organizer. */
export const get = (cupId, options = {}) => request(apiPath('cups', cupId), { ...options, auth: 'optional' });
/** @param {import('../lib/api/types.js').CupInput} body */
export const create = (body, options = {}) => request('/cups', { ...options, method: 'POST', body, auth: 'required' });
/** Organizer-only; revision required for state/results updates. @param {import('../lib/api/types.js').CupUpdate} body */
export const update = (cupId, body, options = {}) => request(apiPath('cups', cupId), { ...options, method: 'PATCH', body, auth: 'required' });
/** Organizer-only deletion, 204. */
export const remove = (cupId, options = {}) => request(apiPath('cups', cupId), { ...options, method: 'DELETE', auth: 'required' });
/** Team owner enters their team during registration. @param {import('../lib/api/types.js').CupEntryInput} body */
export const createEntry = (cupId, body, options = {}) => request(apiPath('cups', cupId, 'entries'), { ...options, method: 'POST', body, auth: 'required' });
/** Organizer approves/declines; team owner withdraws. @param {import('../lib/api/types.js').CupEntryUpdate} body */
export const updateEntry = (cupId, groupId, body, options = {}) => request(apiPath('cups', cupId, 'entries', groupId), { ...options, method: 'PUT', body, auth: 'required' });

export default { list, get, create, update, remove, createEntry, updateEntry };
