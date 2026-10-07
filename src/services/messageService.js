import { request } from '../lib/api/client.js';
import { apiPath } from '../lib/api/path.js';
import { newClientId } from '../lib/helpers/uuid.js';

/** Exactly one room_id/user_id/group_id; newest first, before=id pagination. */
export const list = (query = {}, options = {}) => request('/messages', { ...options, query, auth: 'required' });
/** @param {{ limit?: number, include_empty?: boolean }} query */
export const conversations = (query = {}, options = {}) => request('/messages/conversations', { ...options, query, auth: 'required' });
/** Exactly one room_id/recipient_id/group_id and a stable UUID client_request_id; no auto retry. @param {import('../lib/api/types.js').MessageInput} body */
export const create = (body, options = {}) => request('/messages', { ...options, method: 'POST', body, auth: 'required' });

/** Edit your own message. Returns the updated message (with edited_at). */
export const update = (messageId, body, options = {}) => request(apiPath('messages', messageId), { ...options, method: 'PATCH', body: { body }, auth: 'required' });
/** Delete your own message. The row stays as a tombstone (deleted: true). */
export const remove = (messageId, options = {}) => request(apiPath('messages', messageId), { ...options, method: 'DELETE', auth: 'required' });

export function targetQuery({ type, id }) {
  if (!['room', 'group', 'direct'].includes(type) || !Number.isInteger(Number(id)) || Number(id) < 1) throw new TypeError('Choose a valid message target.');
  return { [type === 'direct' ? 'user_id' : `${type}_id`]: Number(id) };
}

export function targetBody(target, body, clientRequestId = newClientId()) {
  const query = targetQuery(target);
  return { ...(target.type === 'direct' ? { recipient_id: query.user_id } : query), body, client_request_id: clientRequestId };
}

export function emptyConversation(target, title) {
  return { type: target.type, ...targetQuery(target), title, last_message: null };
}

export default { list, conversations, create, update, remove, targetQuery, targetBody, emptyConversation };
