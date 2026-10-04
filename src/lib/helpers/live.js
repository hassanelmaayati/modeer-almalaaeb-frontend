export function roomEvent(event, roomId) {
  if (event.type === 'lobby.ready') return true;
  const types = ['room_created', 'room_updated', 'room_removed', 'room.updated', 'membership.updated'];
  const id = event.room_id ?? event.room?.id;
  return types.includes(event.type) && (roomId == null || Number(id) === Number(roomId));
}

export function notificationDestination(notification) {
  const { type, id } = notification.target || {};
  if (!Number.isInteger(id) || id < 1) return null;
  if (type === 'room') return `/rooms/${id}`;
  if (type === 'group') return `/groups?group_id=${id}`;
  return null;
}
