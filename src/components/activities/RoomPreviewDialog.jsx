import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { emptyResource, startRequest } from '../../lib/helpers/request';
import roomService from '../../services/roomService';
import roomMemberService from '../../services/roomMemberService';
import { formatActivitySchedule } from '../../lib/helpers/date';
import { DIFFICULTIES, DISTRICTS, optionLabel } from '../../lib/helpers/filters';
import { getRoomAdmissionState } from '../../lib/helpers/memberships';
import AsyncState from '../common/AsyncState';
import Dialog from '../common/Dialog';

export default function RoomPreviewDialog({ room: selectedRoom, sportName, onClose, onUpdated, session = { user: null, loading: false } }) {
  const { user, loading: userLoading } = session;
  const location = useLocation();
  const [preview, setPreview] = useState(() => emptyResource());
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const reload = () => setRetry((count) => count + 1);
  const roomId = selectedRoom.id;
  const userId = user?.id;

  useEffect(() => startRequest(async (signal) => {
    const [room, members] = await Promise.all([
      roomService.get(roomId, { signal, auth: userId ? 'optional' : 'none' }),
      roomMemberService.list(roomId, { signal }),
    ]);
    return { room, members };
  }, setPreview), [roomId, userId, retry]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleMembershipAction(action) {
    setSaving(true);
    setActionError('');
    setActionMessage('');
    try {
      // Refresh eligibility before mutating: discovery and membership may have changed.
      const [room, members] = await Promise.all([
        roomService.get(selectedRoom.id, { auth: 'optional' }),
        roomMemberService.list(selectedRoom.id),
      ]);
      const current = getRoomAdmissionState(room, members, user);
      if (action === 'request') {
        if (!current.canRequest) throw new Error(current.message || 'This activity is unavailable for requests.');
        await roomMemberService.request(room.id);
        setActionMessage('Your request was sent. It is pending host approval.');
      } else {
        if (!current.canWithdraw) throw new Error('There is no pending request to withdraw.');
        await roomMemberService.leave(room.id);
        setActionMessage('Your request was withdrawn.');
      }
      onUpdated?.();
    } catch (error) {
      setActionError(error.message || 'The request could not be updated. Please try again.');
    } finally {
      setSaving(false);
      reload();
    }
  }

  const room = preview.data?.room;
  const admission = room ? getRoomAdmissionState(room, preview.data.members, user, now) : null;

  return (
    <Dialog title={room?.title || selectedRoom.title} onClose={onClose}>
      <AsyncState loading={preview.loading} error={preview.error} onRetry={reload}>
        {room && <>
          <p className="eyebrow">{sportName || 'Activity'}</p>
          <p>{formatActivitySchedule(room.starts_at, room.ends_at)} (Bahrain time)</p>
          <dl className="activity-details">
            <div><dt>Area</dt><dd>{room.public_area} · {optionLabel(DISTRICTS, room.district)}</dd></div>
            <div><dt>Difficulty</dt><dd>{optionLabel(DIFFICULTIES, room.difficulty)}</dd></div>
            <div><dt>Accepted players</dt><dd>{admission.acceptedCount} / {room.capacity}</dd></div>
            <div><dt>Status</dt><dd>{room.status}</dd></div>
            {room.distance_km != null && <div><dt>Distance</dt><dd>{room.distance_km} km</dd></div>}
            {room.pace_notes && <div><dt>Pace</dt><dd>{room.pace_notes}</dd></div>}
            {room.venue_details && <div><dt>Venue details</dt><dd>{room.venue_details}</dd></div>}
          </dl>
          {room.description && <p>{room.description}</p>}
          {room.route_notes && <p>{room.route_notes}</p>}
          <p className="muted">Requests are pending until the host approves them. New requests close 15 minutes before the start.</p>
          {admission.message && <p className="status-message" role="status">{admission.message}</p>}
          {!user && !userLoading && !admission.message && <p>
            <Link className="button" to="/sign-in" state={{ from: location.pathname + location.search }}>Sign in to request a place</Link>
          </p>}
          <div className="button-row">
            {admission.canRequest && <button type="button" className="button" disabled={saving || userLoading} onClick={() => handleMembershipAction('request')}>{saving ? 'Sending request…' : 'Request to join'}</button>}
            {admission.canWithdraw && <button type="button" className="button-secondary" disabled={saving || userLoading} onClick={() => handleMembershipAction('withdraw')}>{saving ? 'Withdrawing…' : 'Withdraw request'}</button>}
            <button type="button" className="button-secondary" disabled={saving} onClick={reload}>Refresh activity</button>
          </div>
        </>}
      </AsyncState>
      {actionError && <p role="alert" className="error-message">{actionError}</p>}
      {actionMessage && <p role="status" className="success-message">{actionMessage}</p>}
    </Dialog>
  );
}
