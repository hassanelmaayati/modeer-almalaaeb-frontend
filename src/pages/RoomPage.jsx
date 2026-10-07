import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import roomService from '../services/roomService';
import roomMemberService from '../services/roomMemberService';
import sportService from '../services/sportService';
import { listen } from '../services/websocketService';
import { emptyResource, startRequest } from '../lib/helpers/request';
import { roomEvent } from '../lib/helpers/live';
import { getRoomAdmissionState } from '../lib/helpers/memberships';
import { roomDetailItems, roomPositions } from '../lib/helpers/rooms';
import { playerName } from '../lib/helpers/groups';
import useUsers from '../lib/helpers/userDirectory';
import { chatPath } from '../lib/helpers/messages';
import { formatActivityDate, formatActivitySchedule, formatActivityTime, parseDate } from '../lib/helpers/date';
import { DISTRICTS, optionLabel } from '../lib/helpers/filters';
import AsyncState from '../components/common/AsyncState';
import CancelRoomForm from '../components/activities/CancelRoomForm';
import LocationView from '../components/activities/LocationView';
import RatePlayers, { PlayerRatingRow } from '../components/ratings/RatePlayers';
import PeoplePicker from '../components/common/PeoplePicker';
import TransferHost from '../components/activities/TransferHost';

export default function RoomPage({ session }) {
  const { roomId } = useParams();
  const location = useLocation();
  const user = session.user;
  const userId = user?.id;
  const [resource, setResource] = useState(emptyResource);
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(location.state?.saved ? 'Changes saved.' : '');
  const [now, setNow] = useState(() => Date.now());
  const reload = () => setRetry(value => value + 1);
  useEffect(() => startRequest(async signal => {
    const [room, members, sports] = await Promise.all([roomService.get(roomId, { signal }), roomMemberService.list(roomId, { signal }), sportService.list({ signal })]);
    return { room, members, sports };
  }, setResource), [roomId, userId, retry]);
  useEffect(() => listen(event => { if (event.type === 'connection.ready' || roomEvent(event, roomId)) setRetry(value => value + 1); }), [roomId]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);

  async function run(action, success) {
    if (pending) return;
    setPending(true); setError(''); setMessage('');
    try { const result = await action(); setMessage(typeof success === 'function' ? success(result) : success); }
    catch (failure) { setError(failure.message); }
    finally { setPending(false); reload(); }
  }

  async function requestPlace() {
    const [room, members] = await Promise.all([roomService.get(roomId), roomMemberService.list(roomId)]);
    const eligibility = getRoomAdmissionState(room, members, user);
    if (!eligibility.canRequest) throw new Error(eligibility.message || 'Requests are unavailable.');
    return roomMemberService.request(roomId);
  }

  const { room, members = [], sports = [] } = resource.data || {};
  // Names come from a by-id lookup of only the host and the members, never the whole user table.
  const users = useUsers(room ? [room.host_id, ...members.map(member => member.user_id)] : []);
  // A host change (a transfer, or room.host_changed from another tab/device) is announced from the data itself.
  const [seenHostId, setSeenHostId] = useState(null);
  const [newHostId, setNewHostId] = useState(null);
  if (room && room.host_id !== seenHostId) {
    setSeenHostId(room.host_id);
    if (seenHostId != null) setNewHostId(room.host_id);
  }
  const admission = room ? getRoomAdmissionState(room, members, user, now) : null;
  const own = admission?.membership;
  const canSeeRoster = admission?.isHost || own?.status === 'accepted';
  const positions = room ? roomPositions(room) : [];
  const occupied = new Set(members.filter(member => member.status === 'accepted' && member.user_id !== userId).map(member => member.position));
  const canChoose = own?.status === 'accepted' && room.status === 'open' && now < parseDate(room.starts_at)?.getTime();
  // Accepted players who did not no-show can take over as host.
  const transferCandidates = members
    .filter(member => member.status === 'accepted' && member.attendance !== 'no_show' && member.user_id !== room?.host_id)
    .map(member => ({ id: member.user_id, name: playerName(users, member.user_id) }));
  const instantJoin = room?.admission_policy === 'open';
  const joinMessage = result => result?.status === 'accepted' ? 'You joined this room.' : 'Request sent. Waiting for host approval.';
  const loadError = resource.error?.status === 404 ? new Error('Room not found. It may have been removed, or it is private.') : resource.error;

  return <main>
    <AsyncState loading={resource.loading || session.loading} error={loadError} onRetry={reload}>
      {room && <>
        <header className="page-header"><h1>{room.title}</h1><p>{formatActivitySchedule(room.starts_at, room.ends_at)} (Bahrain)</p><p>{room.area} · {optionLabel(DISTRICTS, room.district)}</p></header>
        {room.status === 'cancelled' && <section className="panel" aria-label="Cancellation"><h2>Room cancelled</h2>
          <p>{room.cancelled_at ? `The host cancelled this room on ${formatActivityDate(room.cancelled_at)} at ${formatActivityTime(room.cancelled_at)} (Bahrain time).` : 'The host cancelled this room.'}</p>
          {room.cancellation_reason && <p>Reason: {room.cancellation_reason}</p>}
        </section>}
        {canSeeRoster && <p><Link className="button" to={chatPath('room', room.id)}>{room.status === 'cancelled' ? 'View room chat' : 'Open room chat'}</Link></p>}
        <section className="panel"><h2>Details</h2><dl className="activity-details">
          {roomDetailItems(room, { sportName: sports.find(sport => sport.id === room.sport_id)?.name, hostName: playerName(users, room.host_id) }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl></section>
        <section className="panel"><h2>Room lobby</h2><p>Status: {room.status}</p><p>{room.slots_left} available places of {room.capacity}; the host has a place.</p>
          {room.description && <p>{room.description}</p>}{room.notes && <p>Notes: {room.notes}</p>}{room.venue_notes && <p>Meeting details: {room.venue_notes}</p>}
          {room.venue_location && <><h3>Venue location</h3><LocationView location={room.venue_location} /></>}
          {admission.message && <p role="status">{admission.message}</p>}
          {!user && <Link to="/sign-in">Sign in to request a place</Link>}
          {admission.canRequest && <button type="button" disabled={pending} onClick={() => run(requestPlace, joinMessage)}>{instantJoin ? 'Join room' : 'Request to join'}</button>}
          {own?.status === 'pending' && own.requested === false && <div className="button-row">
            <button type="button" disabled={pending || room.status !== 'open' || admission.atCutoff || admission.full} onClick={() => run(() => roomMemberService.update(roomId, userId, { status: 'accepted' }), 'Invitation accepted.')}>Accept invitation</button>
            <button type="button" disabled={pending} onClick={() => run(() => roomMemberService.update(roomId, userId, { status: 'declined' }), 'Invitation declined.')}>Decline invitation</button>
          </div>}
          {own && ['pending', 'accepted'].includes(own.status) && !admission.isHost && <button type="button" disabled={pending} onClick={() => run(() => roomMemberService.leave(roomId), 'You left the activity.')}>{own.status === 'pending' ? 'Withdraw request' : 'Leave room'}</button>}
        </section>
        {canSeeRoster && <section className="panel"><h2>Players</h2><ul className="member-list">
          <li>{playerName(users, room.host_id)} — Host</li>
          {members.filter(member => member.user_id !== room.host_id).map(member => <li key={member.id}>
            {playerName(users, member.user_id)} — {member.status}{member.position && ` · Place ${member.position}`}
            {admission.isHost && member.status === 'pending' && member.requested && <div className="button-row">
              <button disabled={pending || room.status !== 'open' || admission.atCutoff || admission.full} onClick={() => run(() => roomMemberService.update(roomId, member.user_id, { status: 'accepted' }), 'Player approved.')}>Approve {playerName(users, member.user_id)}</button>
              <button disabled={pending} onClick={() => run(() => roomMemberService.update(roomId, member.user_id, { status: 'declined' }), 'Request declined.')}>Decline {playerName(users, member.user_id)}</button>
            </div>}
            {admission.isHost && ['pending', 'accepted'].includes(member.status) && ['open', 'started'].includes(room.status) && <button disabled={pending} onClick={() => run(() => roomMemberService.update(roomId, member.user_id, { status: 'removed' }), 'Player removed.')}>Remove {playerName(users, member.user_id)}</button>}
            {admission.isHost && member.status === 'accepted' && ['started', 'completed'].includes(room.status) && <form className="form-stack" onSubmit={event => {
              event.preventDefault();
              run(() => roomMemberService.update(roomId, member.user_id, { attendance: new FormData(event.currentTarget).get('attendance') }), 'Player record updated.');
            }}>
              <label>Attendance for {playerName(users, member.user_id)}<select name="attendance" defaultValue={member.attendance || 'unknown'}><option value="unknown">Unknown</option><option value="present">Present</option><option value="no_show">No show</option><option value="excused">Excused</option></select></label>
              <button disabled={pending}>Save {playerName(users, member.user_id)} record</button>
            </form>}
            {/* The host can rate only players who were present, once the room is completed. Ratings are final, so a saved one is locked. */}
            {admission.isHost && room.status === 'completed' && member.status === 'accepted' && member.attendance === 'present' &&
              <PlayerRatingRow userId={member.user_id} name={playerName(users, member.user_id)} given={member.rating}
                onRate={(id, rating) => roomMemberService.update(roomId, id, { rating }).then(reload)} />}
          </li>)}
        </ul></section>}
        <RatePlayers room={room} members={members} users={users} user={user} />
        {canChoose && <section className="panel"><h2>Your place</h2><form className="form-stack" onSubmit={event => {
          event.preventDefault();
          const position = new FormData(event.currentTarget).get('position') || null;
          run(() => roomMemberService.update(roomId, userId, { position }), 'Place updated.');
        }}><label>Place<select key={own.position || 'unset'} name="position" defaultValue={own.position || ''}>
          <option value="">No assigned place</option>{positions.map(position => <option key={position.value} value={position.value} disabled={occupied.has(position.value)}>{position.label}{occupied.has(position.value) ? ' — taken' : ''}</option>)}
          {own.position && !positions.some(position => position.value === own.position) && <option value={own.position}>{own.position}</option>}
        </select></label><button disabled={pending}>Save place</button></form></section>}
        {admission.isHost && room.status === 'open' && <section className="panel"><h2>Host controls</h2>
          <Link className="button-secondary" to={`/rooms/${roomId}/edit`}>Edit room</Link>
          <PeoplePicker label="Invite player" actionLabel="Invite" exclude={[room.host_id, ...members.map(member => member.user_id)]}
            disabled={pending || admission.atCutoff || admission.full} onPick={player => run(() => roomMemberService.invite(roomId, player.id), 'Invitation sent.')} />
          <CancelRoomForm title={room.title} pending={pending} onConfirm={reason => run(() => roomService.cancel(roomId, reason), 'Room cancelled.')} />
        </section>}
        {admission.isHost && ['open', 'started'].includes(room.status) && <TransferHost candidates={transferCandidates} pending={pending}
          onTransfer={id => run(() => roomService.transferHost(roomId, id), '')} />}
      </>}
    </AsyncState>
    {newHostId != null && <p role="status">{playerName(users, newHostId)} is now the host.</p>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </main>;
}
