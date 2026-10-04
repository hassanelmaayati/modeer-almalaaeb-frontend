import { request } from '../lib/api/client';
import { apiPath } from '../lib/api/path';

export const list = (query = {}, options = {}) => request('/notifications', { ...options, query, auth: 'required' });
export const markRead = (id, options = {}) => request(apiPath('notifications', id), { ...options, method: 'PATCH', body: { read: true }, auth: 'required' });
export const markAllRead = (options = {}) => request('/notifications', { ...options, method: 'PATCH', body: { read: true }, auth: 'required' });

export default { list, markRead, markAllRead };
