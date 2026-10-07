export function roomEvent(event, roomId) {
  if (event.type === 'lobby.ready') return true;
  const types = ['room_created', 'room_updated', 'room_removed', 'room.updated', 'room.host_changed', 'membership.updated'];
  const id = event.room_id ?? event.room?.id;
  return types.includes(event.type) && (roomId == null || Number(id) === Number(roomId));
}

export function personalRoomEvent(event) {
  return event.type === 'connection.ready' || event.type === 'room.updated' || event.type === 'room.host_changed';
}

export function friendEvent(event) {
  return event.type === 'connection.ready' || event.type === 'friend.updated';
}

export function notificationDestination(notification) {
  const { type, id } = notification.target || {};
  if (!Number.isInteger(id) || id < 1) return null;
  if (notification.kind?.startsWith('message.') && ['room', 'group', 'direct'].includes(type)) return `/messages/${type}/${id}`;
  if (type === 'direct') {
    if (notification.kind === 'friend.request') return '/friends?tab=requests';
    if (notification.kind?.startsWith('friend.')) return '/friends';
    return null;
  }
  if (type === 'room') return `/rooms/${id}`;
  if (type === 'group') return `/groups?group_id=${id}`;
  return null;
}
