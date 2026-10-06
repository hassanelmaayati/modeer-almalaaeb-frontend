import { useState } from 'react';
import Field from '../common/Field';
import TeamCountAndRules from './TeamCountAndRules';
import RegistrationDeadline from './RegistrationDeadline';
import { cupSports, formatLabel, sportFormat } from '../../lib/helpers/cups';
import { fromBahrainDateTimeInput } from '../../lib/helpers/date';
import Select from '../common/Select';

/** Creates a cup, or edits one when `cup` is passed (the sport can't change after creation). */
export default function CupForm({ cup, sports, onSubmit, onCancel }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [sportId, setSportId] = useState(cup ? String(cup.sport_id) : '');
  // Walking and any sport without a cup format are left out; the backend would reject them.
  const options = cupSports(sports);
  const format = cup ? cup.format : sportFormat(options.find(sport => String(sport.id) === sportId));
  const editing = !!cup;

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const name = form.get('name').trim(), rules = form.get('rules').trim();
    if (!name || !rules) return setError('Name and rules are required.');
    const closesAt = fromBahrainDateTimeInput(form.get('registration_closes_at')) || null;
    // Open registration needs a closing time; the backend rejects clearing it with a 400.
    if (editing && cup.status === 'registration' && !closesAt) return setError('Registration is open, so a closing time is required.');
    // No format field: the backend derives it from sport_id.
    const body = {
      name,
      rules,
      team_count: Number(form.get('team_count')),
      roster_limit: Number(form.get('roster_limit')),
      registration_closes_at: closesAt,
    };
    if (!editing) body.sport_id = Number(sportId);
    setPending(true);
    setError('');
    try { await onSubmit(body); }
    catch (failure) { setError(failure.message); }
    finally { setPending(false); }
  }

  return <form className="form-stack" onSubmit={submit}>
    {error && <p role="alert">{error}</p>}
    <Field label="Cup name"><input name="name" maxLength={100} defaultValue={cup?.name || ''} required /></Field>
    {editing ? <p>Sport: {sports.find(sport => sport.id === cup.sport_id)?.name || 'Activity'} (cannot be changed)</p> : <Field label="Sport">
      <Select name="sport_id" value={sportId} onChange={event => setSportId(event.target.value)} required>
        <option value="" disabled>Select a sport</option>
        {options.map(sport => <option key={sport.id} value={sport.id}>{sport.name}</option>)}
      </Select>
    </Field>}
    {format && <p className="muted">Format: {formatLabel(format)}</p>}
    <TeamCountAndRules format={format} defaultValues={cup} />
    <RegistrationDeadline defaultValue={cup?.registration_closes_at} />
    {!editing && options.length === 0 && <p role="alert">No sports are available for cups.</p>}
    <div className="actions">
      <button disabled={pending || !format}>{pending ? 'Saving…' : editing ? 'Save changes' : 'Create cup'}</button>
      <button type="button" disabled={pending} onClick={onCancel}>Cancel</button>
    </div>
  </form>;
}
