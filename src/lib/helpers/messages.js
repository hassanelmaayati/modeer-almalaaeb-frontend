export const CHAT_TYPES = ['room', 'group', 'direct'];

export const CHAT_TYPE_LABELS = {
  room: 'Room chat',
  group: 'Group chat',
  direct: 'Direct chat',
};

export function parseChatTarget(params) {
  const { type, id } = params;
  if (type === undefined && id === undefined) return null;
  const number = Number(id);
  if (!CHAT_TYPES.includes(type) || !Number.isInteger(number) || number < 1) return { invalid: true };
  return { type, id: number };
}

export function chatPath(type, id) {
  return `/messages/${type}/${id}`;
}

export function chatKey(type, id) {
  return `${type}:${id}`;
}

export const CONVERSATION_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'room', label: 'Rooms' },
  { value: 'group', label: 'Groups' },
  { value: 'direct', label: 'Direct' },
];

export const CONVERSATION_TYPE_BADGES = { room: 'Room', group: 'Group', direct: 'Direct' };

export function conversationTarget(conversation) {
  const id = conversation.type === 'room' ? conversation.room_id : conversation.type === 'group' ? conversation.group_id : conversation.user_id;
  return { type: conversation.type, id };
}

export function conversationKey(conversation) {
  const { type, id } = conversationTarget(conversation);
  return chatKey(type, id);
}

export function conversationPath(conversation) {
  const { type, id } = conversationTarget(conversation);
  return chatPath(type, id);
}

export function isSystemMessage(message) {
  return message.type === 'system' || message.sender_id === null || message.sender_id === undefined;
}

export function messagePreview(conversation, viewerId, nameOf) {
  const message = conversation.last_message;
  if (!message) return null;
  if (isSystemMessage(message)) return { text: message.body, system: true };
  if (String(message.sender_id) === String(viewerId)) return { text: `You: ${message.body}`, system: false };
  if (conversation.type === 'direct') return { text: message.body, system: false };
  return { text: `${nameOf(message.sender_id)}: ${message.body}`, system: false };
}

const dayKey = (date, timeZone) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);

export function formatConversationTime(value, now = new Date(), timeZone = 'Asia/Bahrain') {
  const date = value ? new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const today = dayKey(now, timeZone);
  const that = dayKey(date, timeZone);
  if (that === today) return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${that}T00:00:00Z`)) / dayMs);
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'long' }).format(date);
  return new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function sortConversations(conversations) {
  const latest = (conversation) => conversation.last_message?.id ?? 0;
  return [...conversations].sort((first, second) => latest(second) - latest(first));
}

export function filterConversations(conversations, { type = 'all', query = '' } = {}) {
  const text = query.trim().toLowerCase();
  return conversations.filter((conversation) => (
    (type === 'all' || conversation.type === type)
    && (!text || conversation.title.toLowerCase().includes(text))
  ));
}

export function messageConversationKey(message, viewerId) {
  if (message.room_id != null) return chatKey('room', message.room_id);
  if (message.group_id != null) return chatKey('group', message.group_id);
  const other = String(message.sender_id) === String(viewerId) ? message.recipient_id : message.sender_id;
  return chatKey('direct', other);
}

export function applyMessage(conversations, message, viewerId) {
  const key = messageConversationKey(message, viewerId);
  const index = conversations.findIndex((conversation) => conversationKey(conversation) === key);
  if (index === -1) return null;
  const current = conversations[index].last_message;
  if (current && current.id >= message.id) return conversations;
  const updated = { ...conversations[index], last_message: message };
  return sortConversations([...conversations.slice(0, index), updated, ...conversations.slice(index + 1)]);
}
