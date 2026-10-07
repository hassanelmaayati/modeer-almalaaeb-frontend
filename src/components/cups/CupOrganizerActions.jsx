import { useState } from 'react';
import CupForm from './CupForm';
import RegistrationDeadline from './RegistrationDeadline';
import useAction from '../../lib/helpers/useAction';
import { publishBlocker } from '../../lib/helpers/cups';
import { fromBahrainDateTimeInput, parseDate } from '../../lib/helpers/date';

export default function CupOrganizerActions({ cup, sports, onUpdate, onDelete }) {
  const [mode, setMode] = useState(null);
  const { pending, error, setError, run } = useAction();
  // The backend only allows edits before the cup is published, and deletion only while it is a draft.
  const canEdit = cup.status === 'draft' || cup.status === 'registration';
  const blocker = cup.status === 'registration' ? publishBlocker(cup) : '';

  async function openRegistration(event) {
    event.preventDefault();
    const closesAt = fromBahrainDateTimeInput(new FormData(event.currentTarget).get('registration_closes_at'));
    // The backend refuses to open registration without a closing time in the future.
    const date = parseDate(closesAt);
    if (!date || date.getTime() <= Date.now()) return setError('Pick a closing time in the future.');
    // One PATCH so the deadline and the status change share the same revision.
    if (await run(() => onUpdate({ status: 'registration', registration_closes_at: closesAt }))) setMode(null);
  }

  function publish() {
    if (!window.confirm('Publish this cup? Entries are locked and results can be recorded.')) return;
    run(() => onUpdate({ status: 'published' }));
  }

  function remove() {
    if (window.confirm('Delete this draft cup? This cannot be undone.')) run(onDelete);
  }

  if (cup.status === 'published' || cup.status === 'completed') return null;
  // Editing gets the same stepped form and live card as creating a cup.
  if (mode === 'edit') return <section className="home-section host-scope" aria-label="Edit cup">
    {error && <p role="alert">{error}</p>}
    <CupForm cup={cup} sports={sports} onCancel={() => setMode(null)}
      onSubmit={async body => { await onUpdate(body); setMode(null); }} />
  </section>;
  return <section className="home-section cup-panel" aria-label="Organizer actions">
    <h2>Organizer</h2>
    {error && <p role="alert">{error}</p>}
    {mode === 'open' ? <form className="form-stack" onSubmit={openRegistration}>
      <RegistrationDeadline defaultValue={cup.registration_closes_at} />
      <div className="actions">
        <button disabled={pending}>{pending ? 'Opening…' : 'Open registration'}</button>
        <button type="button" disabled={pending} onClick={() => { setMode(null); setError(''); }}>Cancel</button>
      </div>
    </form>
    : <div className="actions">
      {canEdit && <button type="button" onClick={() => setMode('edit')}>Edit details</button>}
      {cup.status === 'draft' && <>
        <button type="button" onClick={() => setMode('open')}>Open registration…</button>
        <button type="button" className="button-secondary" disabled={pending} onClick={remove}>Delete cup</button>
      </>}
      {cup.status === 'registration' && <button type="button" disabled={pending || !!blocker} onClick={publish}>{pending ? 'Publishing…' : 'Publish cup'}</button>}
    </div>}
    {blocker && !mode && <p className="muted">{blocker}</p>}
  </section>;
}
