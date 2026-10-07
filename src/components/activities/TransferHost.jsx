import { useState } from 'react';
import Field from '../common/Field';
import Select from '../common/Select';

/** Host-only: pick an accepted, non-no-show player and hand them the room (asks first; the host loses control). */
export default function TransferHost({ candidates, pending, onTransfer }) {
  const [selected, setSelected] = useState('');

  function submit(event) {
    event.preventDefault();
    const target = candidates.find(candidate => String(candidate.id) === selected);
    if (!target) return;
    if (!window.confirm(`Make ${target.name} the host? You will no longer be able to manage this room.`)) return;
    onTransfer(target.id);
  }

  return <section className="panel" aria-labelledby="transfer-host-title">
    <h2 id="transfer-host-title">Transfer host</h2>
    {candidates.length === 0
      ? <p className="muted">When a player has an accepted place, you can hand the room over to them here.</p>
      : <form className="form-stack" onSubmit={submit}>
        <Field label="New host">
          <Select value={selected} onChange={event => setSelected(event.target.value)} required>
            <option value="" disabled>Choose a player</option>
            {candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
          </Select>
        </Field>
        <button disabled={pending || !selected}>Transfer host</button>
      </form>}
  </section>;
}
