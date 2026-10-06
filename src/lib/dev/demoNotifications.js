// Sample notifications for eyeballing the page design without touching the database.
// Only used when the dev server is running and the page is opened with ?demo=1.
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function demoNotifications(now = Date.now()) {
  const ago = ms => new Date(now - ms).toISOString();
  return [
    { id: 9, kind: 'message.created', target: { type: 'group', id: 1 }, text: 'New message from Sara in Seef Strikers', created_at: ago(4 * MINUTE), read_at: null },
    { id: 8, kind: 'friend.request', target: { type: 'direct', id: 2 }, text: 'Ali sent you a friend request', created_at: ago(35 * MINUTE), read_at: null },
    { id: 7, kind: 'room.admitted', target: { type: 'room', id: 4 }, text: 'You are in! The host accepted your request for Friday padel at Riffa', created_at: ago(3 * HOUR), read_at: null },
    { id: 6, kind: 'group.invited', target: { type: 'group', id: 2 }, text: 'Omar invited you to join Dawn Swimmers', created_at: ago(5 * HOUR), read_at: ago(4 * HOUR) },
    { id: 5, kind: 'message.created', target: { type: 'direct', id: 3 }, text: 'New message from Hassan', created_at: ago(DAY + 2 * HOUR), read_at: ago(DAY) },
    { id: 4, kind: 'room.cancelled', target: { type: 'room', id: 6 }, text: 'Sunday morning run was cancelled by the host. Reason: heat warning', created_at: ago(DAY + 5 * HOUR), read_at: null },
    { id: 3, kind: 'cup.published', target: { type: 'cup', id: 1 }, text: 'The Seef Sunrise 10K bracket has been published', created_at: ago(3 * DAY), read_at: ago(3 * DAY - HOUR) },
    { id: 2, kind: 'friend.accepted', target: { type: 'direct', id: 4 }, text: 'Noor accepted your friend request', created_at: ago(4 * DAY), read_at: ago(4 * DAY - HOUR) },
    { id: 1, kind: 'room.reminder', target: { type: 'room', id: 8 }, text: 'Basketball at Isa Town starts tomorrow at 19:00', created_at: ago(6 * DAY), read_at: ago(6 * DAY - HOUR) },
  ];
}
