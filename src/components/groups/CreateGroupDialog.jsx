import { useState } from 'react';
import Dialog from '../common/Dialog';
import GroupForm from './GroupForm';
import groupService from '../../services/groupService';
import groupMemberService from '../../services/groupMemberService';
import { inviteCandidates, playerName } from '../../lib/helpers/groups';

export default function CreateGroupDialog({ sports, users, userId, onClose, onCreated, onOpenGroup }) {
  const [result, setResult] = useState(null);

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
    </> : <GroupForm sports={sports} candidates={inviteCandidates(users, userId)} onSubmit={create} onCancel={onClose} />}
  </Dialog>;
}
