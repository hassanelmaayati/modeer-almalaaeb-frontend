import { request } from '../lib/api/client.js';

/** Exactly one room_id/user_id; newest first, before=id pagination, limit 1–100. @param {import('../lib/api/types.js').MessageQuery} query */
export const list = (query = {}, options = {}) => request('/messages', { ...options, query, auth: 'required' });
/** @param {{ limit?: number }} query */
export const conversations = (query = {}, options = {}) => request('/messages/conversations', { ...options, query, auth: 'required' });
/** Exactly one room_id/recipient_id and a stable UUID client_request_id; no auto retry. @param {import('../lib/api/types.js').MessageInput} body */
export const create = (body, options = {}) => request('/messages', { ...options, method: 'POST', body, auth: 'required' });

export default { list, conversations, create };
