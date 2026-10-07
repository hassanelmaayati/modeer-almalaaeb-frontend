import { useState } from 'react';
import Dialog from '../common/Dialog';
import GroupForm from './GroupForm';
import groupService from '../../services/groupService';
import groupMemberService from '../../services/groupMemberService';
import { playerName } from '../../lib/helpers/groups';
import useUsers from '../../lib/helpers/userDirectory';

export default function CreateGroupDialog({ sports, userId, onClose, onCreated, onOpenGroup }) {
  const [result, setResult] = useState(null);
  // Names of invitees whose invitation failed (search results are already cached, so this rarely fetches).
  const users = useUsers(result?.failed.map(failure => failure.userId) ?? []);

  async function create(body, recipients) {
    const group = await groupService.create(body);
    const invitations = await Promise.allSettled(recipients.map((id) => groupMemberService.invite(group.id, id)));
    const failed = invitations.flatMap((response, index) => response.status === 'rejected' ? [{ userId: recipients[index], error: response.reason.message }] : []);
    setResult({ group, failed });
    onCreated(group);
  }

  return <Dialog title="Create group" className="groups-scope" onClose={onClose}>
    {result ? <>
      <p role="status">{result.group.name} was created.</p>
      {result.failed.length > 0 && <div role="alert"><p>The group was saved, but these invitations failed:</p><ul>{result.failed.map((failure) => <li key={failure.userId}>{playerName(users, failure.userId)}: {failure.error}</li>)}</ul><p>Open the group to retry an invitation.</p></div>}
      <button type="button" onClick={() => onOpenGroup(result.group.id)}>Open group</button>
    </> : <GroupForm sports={sports} ownerId={userId} onSubmit={create} onCancel={onClose} />}
  </Dialog>;
}
