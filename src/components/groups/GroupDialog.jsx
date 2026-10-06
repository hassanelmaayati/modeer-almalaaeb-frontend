import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { chatPath } from '../../lib/helpers/messages';
import Dialog from '../common/Dialog';
import AsyncState from '../common/AsyncState';
import GroupForm from './GroupForm';
import RoomList from '../activities/RoomList';
import HomeGameCard from '../home/HomeGameCard';
import Icon from '../common/Icon';
import SportIcon from '../common/SportIcon';
import { emptyResource, startRequest } from '../../lib/helpers/request';
import groupService from '../../services/groupService';
import groupMemberService from '../../services/groupMemberService';
import roomService from '../../services/roomService';
import { inviteCandidates, playerName } from '../../lib/helpers/groups';
import { findOwnMembership } from '../../lib/helpers/memberships';
import { listen } from '../../services/websocketService';
import { roomEvent } from '../../lib/helpers/live';

export default function GroupDialog({ user, groupId, sports, users, onClose, onChanged, onPreviewRoom }) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resource, setResource] = useState(emptyResource);
  const [revision, setRevision] = useState(0);
  const reload = () => setRevision(value => value + 1);
  useEffect(() => startRequest(async signal => {
    const [group, members, rooms] = await Promise.all([
      groupService.get(groupId, { signal }), groupMemberService.list(groupId, { signal }), roomService.list({}, { signal }),
    ]);
    return { group, members, rooms: rooms.filter((room) => room.group_id === groupId) };
  }, setResource), [groupId, revision]);
  useEffect(() => listen(event => {
    if (editing) return;
    if (event.type === 'connection.ready' || roomEvent(event) || ['group.updated', 'membership.updated'].includes(event.type) && Number(event.group_id) === groupId) setRevision(value => value + 1);
  }), [groupId, editing]);
  const { group, members = [], rooms = [] } = resource.data || {};
  const owner = group?.owner_id === user?.id;
  const ownMembership = findOwnMembership(members, user?.id);
  const sportName = group ? sports.find((sport) => sport.id === group.sports_id)?.name || 'Activity' : '';
  const candidates = group ? inviteCandidates(users, group.owner_id, members) : [];

  async function runAction(action, success) {
    if (pending) return;
    setPending(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
      reload();
      onChanged();
    } catch (failure) { setError(failure.message); }
    finally { setPending(false); }
  }

  async function save(body) {
    await groupService.update(groupId, body);
    setEditing(false);
    setMessage('Group updated.');
    reload();
    onChanged();
  }

  function invite(event) {
    event.preventDefault();
    const target = Number(new FormData(event.currentTarget).get('player'));
    runAction(() => groupMemberService.invite(groupId, target), 'Invitation sent.');
  }

  function changeMember(targetId, status, success) {
    runAction(() => groupMemberService.update(groupId, targetId, { status }), success);
  }

  return <Dialog title={group?.name || 'Group details'} className="groups-scope" onClose={onClose}>
    <AsyncState loading={resource.loading} error={resource.error} onRetry={reload}>
      {group && <>
        <p className="group-dialog-sport"><SportIcon name={sportName} size={26} /><span>{sportName}</span></p>
        {editing ? <GroupForm group={group} sports={sports} onSubmit={save} onCancel={() => { setEditing(false); reload(); }} /> : <>
          {group.description && <p>{group.description}</p>}
          {group.photo_url && <img className="group-cover" src={group.photo_url} alt="" />}
          <p className="group-owner"><Icon name="people" />Owner: {playerName(users, group.owner_id)}</p>
          <div className="actions">
            {(owner || ownMembership?.status === 'accepted') && <Link className="button button-primary" to={chatPath('group', group.id)}>Open group chat</Link>}
            {owner && <button type="button" className="button-secondary" disabled={pending} onClick={() => setEditing(true)}>Edit group</button>}
          </div>
        </>}
        {ownMembership?.status === 'pending' && !owner && <div className="actions">
          <button type="button" disabled={pending} onClick={() => changeMember(user.id, 'accepted', 'Invitation accepted.')}>Accept invitation</button>
          <button type="button" className="button-secondary" disabled={pending} onClick={() => changeMember(user.id, 'declined', 'Invitation declined.')}>Decline invitation</button>
        </div>}
        {ownMembership?.status === 'accepted' && !owner && <button type="button" className="button-secondary" disabled={pending} onClick={() => changeMember(user.id, 'left', 'You left the group.')}>Leave group</button>}
        {ownMembership && !['pending', 'accepted'].includes(ownMembership.status) && <p>Your membership is {ownMembership.status}. A new invitation is currently unavailable.</p>}
        <section aria-label="Group members" className="group-section">
          <h3>Members</h3>
          <ul className="member-list">
            <li className="member-row">
              <span className="member-initial" aria-hidden="true">{playerName(users, group.owner_id)[0]?.toUpperCase()}</span>
              <span className="member-name">{playerName(users, group.owner_id)}</span>
              <span className="status-badge member-owner">Owner</span>
            </li>
            {members.filter((member) => member.user_id !== group.owner_id).map((member) => <li key={member.id} className="member-row">
              <span className="member-initial" aria-hidden="true">{playerName(users, member.user_id)[0]?.toUpperCase()}</span>
              <span className="member-name">{playerName(users, member.user_id)}</span>
              <span className={`status-badge member-${member.status}`}>{member.status}</span>
              {owner && ['accepted', 'pending'].includes(member.status) && <button type="button" className="button-secondary" aria-label={`Remove ${playerName(users, member.user_id)}`} disabled={pending} onClick={() => changeMember(member.user_id, 'removed', 'Member removed.')}>Remove member</button>}
            </li>)}
          </ul>
        </section>
        {owner && <section className="group-section">
          <h3>Invite registered player</h3>
          {candidates.length > 0 ? <form onSubmit={invite} className="form-stack">
            <label htmlFor="invite-player">Player</label><select id="invite-player" name="player" defaultValue="" required><option value="" disabled>Choose a player</option>{candidates.map((player) => <option key={player.id} value={player.id}>{player.user_name}</option>)}</select>
            <button disabled={pending}>{pending ? 'Sending…' : 'Invite'}</button>
          </form> : <p>No other players are available to invite.</p>}
        </section>}
        <section className="group-section">
          <h3>Public activities</h3>
          <p className="muted">This list includes discoverable public activities. Private group activities are unavailable here.</p>
          <RoomList Card={HomeGameCard} rooms={rooms} sports={sports} onPreview={onPreviewRoom} emptyTitle="No upcoming public group activities" />
        </section>
      </>}
    </AsyncState>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </Dialog>;
}
