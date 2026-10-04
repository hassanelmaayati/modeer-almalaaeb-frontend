import { useState } from 'react';
import Field from '../common/Field';
import TeamCountAndRules from './TeamCountAndRules';
import RegistrationDeadline from './RegistrationDeadline';
import { cupSports, formatLabel, sportFormat } from '../../lib/helpers/cups';
import { fromBahrainDateTimeInput } from '../../lib/helpers/date';

export default function CupForm({ sports, onSubmit, onCancel }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [sportId, setSportId] = useState('');
  // Walking and any sport without a cup format are left out; the backend would reject them.
  const options = cupSports(sports);
  const format = sportFormat(options.find(sport => String(sport.id) === sportId));

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const name = form.get('name').trim(), rules = form.get('rules').trim();
    if (!name || !rules) return setError('Name and rules are required.');
    // No format field: the backend derives it from sport_id.
    const body = {
      sport_id: Number(sportId),
      name,
      rules,
      team_count: Number(form.get('team_count')),
      roster_limit: Number(form.get('roster_limit')),
      registration_closes_at: fromBahrainDateTimeInput(form.get('registration_closes_at')) || null,
    };
    setPending(true);
    setError('');
    try { await onSubmit(body); }
    catch (failure) { setError(failure.message); }
    finally { setPending(false); }
  }

  return <form className="form-stack" onSubmit={submit}>
    {error && <p role="alert">{error}</p>}
    <Field label="Cup name"><input name="name" maxLength={120} required /></Field>
    <Field label="Sport">
      <select name="sport_id" value={sportId} onChange={event => setSportId(event.target.value)} required>
        <option value="" disabled>Select a sport</option>
        {options.map(sport => <option key={sport.id} value={sport.id}>{sport.name}</option>)}
      </select>
    </Field>
    {format && <p className="muted">Format: {formatLabel(format)}</p>}
    <TeamCountAndRules format={format} />
    <RegistrationDeadline />
    {options.length === 0 && <p role="alert">No sports are available for cups.</p>}
    <div className="actions">
      <button disabled={pending || !format}>{pending ? 'Creating…' : 'Create cup'}</button>
      <button type="button" disabled={pending} onClick={onCancel}>Cancel</button>
    </div>
  </form>;
}
