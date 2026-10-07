import { useState } from 'react';
import Field from '../common/Field';
import { photoUrlError } from '../../lib/helpers/photoUrl';
import Select from '../common/Select';

export default function GroupForm({ group, sports, candidates = [], onSubmit, onCancel }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const name = form.get('name').trim();
    if (!name) { setError('Group name is required.'); return; }
    const body = { name, description: form.get('description').trim() || null, photo_url: form.get('photo_url').trim() || null };
    const photoError = photoUrlError(body.photo_url);
    if (photoError) { setError(photoError); return; }
    if (!group) body.sports_id = Number(form.get('sports_id'));
    const recipients = form.getAll('recipients').map(Number);
    setPending(true);
    setError('');
    try { await onSubmit(body, recipients); }
    catch (failure) { setError(failure.message); }
    finally { setPending(false); }
  }

  const invitable = !group && candidates.length > 0;
  return <div className="host-scope"><form className="form-stack room-form" onSubmit={submit}>
    {error && <p role="alert">{error}</p>}
    <Field label="Group name"><input name="name" defaultValue={group?.name || ''} required /></Field>
    {!group ? <Field label="Sport"><Select name="sports_id" defaultValue="" required><option value="" disabled>Select an activity</option>{sports.map(sport => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</Select></Field> : <p>Sport: {sports.find(sport => sport.id === group.sports_id)?.name || 'Activity'} (cannot be changed)</p>}
    <Field label="Description"><textarea name="description" defaultValue={group?.description || ''} /></Field>
    <Field label="Photo URL"><input name="photo_url" type="url" defaultValue={group?.photo_url || ''} /></Field>
    {invitable && <div>
      <Field label="Invite players (optional)"><Select name="recipients" multiple data-placeholder="Choose players" defaultValue={[]} size={Math.min(candidates.length, 5)}>{candidates.map(player => <option key={player.id} value={player.id}>{player.user_name}</option>)}</Select></Field>
      <p className="muted">Players receive invitations and choose whether to accept.</p>
    </div>}
    {!group && sports.length === 0 && <p role="alert">No activities are available for creating a group.</p>}
    <div className="actions"><button disabled={pending || (!group && !sports.length)}>{pending ? 'Saving…' : group ? 'Save changes' : 'Create group'}</button><button type="button" disabled={pending} onClick={onCancel}>Cancel</button></div>
  </form></div>;
}
