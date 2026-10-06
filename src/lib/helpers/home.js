export function playersNeeded(room) {
  if (room.slots_left == null) return 'Players needed: private';
  if (room.slots_left <= 0) return 'Room is full';
  return `${room.slots_left} ${room.slots_left === 1 ? 'player' : 'players'} needed`;
}
