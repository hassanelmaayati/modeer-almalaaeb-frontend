import { useState } from 'react';
import Field from '../common/Field';
import PeoplePicker from '../common/PeoplePicker';
import { photoUrlError } from '../../lib/helpers/photoUrl';
import Select from '../common/Select';

export default function GroupForm({ group, sports, ownerId, onSubmit, onCancel }) {
  const [pending, setPending] = useState(false);
  const [recipients, setRecipients] = useState([]);
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
    setPending(true);
    setError('');
    try { await onSubmit(body, recipients.map(person => person.id)); }
    catch (failure) { setError(failure.message); }
    finally { setPending(false); }
  }

  return <div className="host-scope"><form className="form-stack room-form" onSubmit={submit}>
    {error && <p role="alert">{error}</p>}
    <Field label="Group name"><input name="name" defaultValue={group?.name || ''} required /></Field>
    {!group ? <Field label="Sport"><Select name="sports_id" defaultValue="" required><option value="" disabled>Select an activity</option>{sports.map(sport => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</Select></Field> : <p>Sport: {sports.find(sport => sport.id === group.sports_id)?.name || 'Activity'} (cannot be changed)</p>}
    <Field label="Description"><textarea name="description" defaultValue={group?.description || ''} /></Field>
    <Field label="Photo URL"><input name="photo_url" type="url" defaultValue={group?.photo_url || ''} /></Field>
    {!group && <fieldset className="group-invites">
      <legend>Invite players (optional)</legend>
      <PeoplePicker label="Search people" actionLabel="Invite" exclude={[ownerId, ...recipients.map(person => person.id)]} disabled={pending}
        onPick={person => setRecipients(current => [...current, person])} />
      {recipients.length > 0 && <ul className="friend-list" aria-label="Players to invite">
        {recipients.map(person => <li key={person.id} className="friend-row"><span>{person.user_name}</span>
          <button type="button" className="button-secondary" onClick={() => setRecipients(current => current.filter(item => item.id !== person.id))}>Remove<span className="visually-hidden"> {person.user_name}</span></button></li>)}
      </ul>}
      <p>Players receive invitations and choose whether to accept.</p>
    </fieldset>}
    {!group && sports.length === 0 && <p role="alert">No activities are available for creating a group.</p>}
    <div className="actions"><button disabled={pending || (!group && !sports.length)}>{pending ? 'Saving…' : group ? 'Save changes' : 'Create group'}</button><button type="button" disabled={pending} onClick={onCancel}>Cancel</button></div>
  </form></div>;
}
