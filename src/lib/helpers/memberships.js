import { parseDate } from './date';

export function findOwnMembership(members, userId) {
  if (userId == null) return null;
  return members.find((member) => String(member.user_id) === String(userId)) || null;
}

export function acceptedMemberCount(members) {
  return members.filter((member) => member.status === 'accepted').length;
}

export function getRoomAdmissionState(room, members, user, now = Date.now()) {
  const membership = findOwnMembership(members, user?.id);
  const acceptedCount = acceptedMemberCount(members);
  const start = parseDate(room.starts_at);
  const isHost = Boolean(user && String(room.host_id) === String(user.id));
  const atCutoff = !start || now >= start.getTime() - 15 * 60 * 1000;
  const full = room.slots_left != null ? room.slots_left <= 0 : acceptedCount >= room.capacity;
  let message = '';

  if (isHost) message = "You're hosting this activity.";
  else if (membership?.status === 'pending') message = membership.requested === false ? 'You were invited. Accept or decline in the room lobby.' : 'Request pending. The host must approve your place.';
  else if (membership?.status === 'accepted') message = 'You are admitted to this activity.';
  else if (membership?.status === 'left') message = 'You left this activity. Another request is unavailable.';
  else if (membership?.status === 'declined') message = 'Your request was declined. Another request is unavailable.';
  else if (membership?.status === 'removed') message = 'You were removed from this activity. Another request is unavailable.';
  else if (membership) message = 'You already have a membership record for this activity.';
  else if (room.status !== 'open') message = 'This activity is no longer open for requests.';
  else if (atCutoff) message = 'Requests close 15 minutes before the activity starts.';
  else if (full) message = 'This activity is full.';

  return {
    membership, acceptedCount, isHost, atCutoff, full, message,
    canRequest: Boolean(user && !isHost && !membership && room.status === 'open' && !atCutoff && !full),
    canWithdraw: Boolean(user && !isHost && membership?.status === 'pending'),
  };
}
