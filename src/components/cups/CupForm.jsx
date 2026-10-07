import { useState } from 'react';
import Field from '../common/Field';
import TeamCountAndRules from './TeamCountAndRules';
import RegistrationDeadline from './RegistrationDeadline';
import { KNOCKOUT_TEAM_COUNTS, cupSports, formatLabel, sportFormat } from '../../lib/helpers/cups';
import { fromBahrainDateTimeInput } from '../../lib/helpers/date';
import Select from '../common/Select';
import CupPreviewCard from './CupPreviewCard';
import { toBahrainDateTimeInput } from '../../lib/helpers/date';

/** Creates a cup, or edits one when `cup` is passed (the sport can't change after creation). */
export default function CupForm({ cup, sports, onSubmit, onCancel }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [sportId, setSportId] = useState(cup ? String(cup.sport_id) : '');
  // Walking and any sport without a cup format are left out; the backend would reject them.
  const options = cupSports(sports);
  const format = cup ? cup.format : sportFormat(options.find(sport => String(sport.id) === sportId));
  const editing = !!cup;
  // A live copy of the typed values, so the cup card beside the form can preview the cup.
  const [draft, setDraft] = useState(() => ({ name: cup?.name || '', team_count: cup ? String(cup.team_count) : '', roster_limit: cup ? String(cup.roster_limit) : '', rules: cup?.rules || '', registration_closes_at: toBahrainDateTimeInput(cup?.registration_closes_at) }));
  function track(event) {
    const form = new FormData(event.currentTarget);
    setDraft(previous => Object.fromEntries(Object.keys(previous).map(key => [key, form.has(key) ? String(form.get(key)) : previous[key]])));
  }
  const sport = sports.find(item => String(item.id) === sportId);
  const checks = [
    { label: 'Name your cup', done: !!draft.name.trim() },
    { label: 'Choose a sport', done: !!sportId },
    { label: 'Set the teams', done: !!(format === 'knockout' ? draft.team_count || KNOCKOUT_TEAM_COUNTS[0] : draft.team_count) },
    { label: 'Set the roster', done: !!draft.roster_limit },
    { label: 'Write the rules', done: !!draft.rules.trim() },
    { label: 'Set a closing time', done: !!draft.registration_closes_at },
  ];

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

  const actions = <div className="actions room-form-actions">
    <button disabled={pending || !format}>{pending ? 'Saving…' : editing ? 'Save changes' : 'Create cup'}</button>
    <button type="button" disabled={pending} onClick={onCancel}>Cancel</button>
  </div>;
  const sportField = <Field label="Sport">
    <Select name="sport_id" value={sportId} onChange={event => setSportId(event.target.value)} required>
      <option value="" disabled>Select a sport</option>
      {options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </Select>
  </Field>;

  return <div className={`room-form-layout${editing ? ' is-solo' : ''}`}>
    <form className="form-stack room-form" onSubmit={submit} onChange={track}>
      {error && <p role="alert">{error}</p>}
      <section className="room-step" aria-labelledby="step-cup">
        <h2 id="step-cup" className="room-step-title"><span className="room-step-num">1</span>Name your cup</h2>
        <Field label="Cup name"><input name="name" maxLength={100} defaultValue={cup?.name || ''} required /></Field>
        {editing ? <p className="room-step-wide">Sport: {sport?.name || 'Activity'} (cannot be changed)</p> : sportField}
        {format && <p className="muted room-step-wide">Format: {formatLabel(format)}</p>}
      </section>
      <section className="room-step" aria-labelledby="step-field">
        <h2 id="step-field" className="room-step-title"><span className="room-step-num">2</span>Set the field and rules</h2>
        <TeamCountAndRules format={format} defaultValues={cup || {}} />
      </section>
      <section className="room-step" aria-labelledby="step-open">
        <h2 id="step-open" className="room-step-title"><span className="room-step-num">3</span>Open registration</h2>
        <RegistrationDeadline defaultValue={cup?.registration_closes_at} />
      </section>
      {!editing && options.length === 0 && <p role="alert">No sports are available for cups.</p>}
      {actions}
    </form>
    {!editing && <CupPreviewCard sport={sport} format={format} draft={draft} checks={checks} />}
  </div>;
}
