import { useState } from 'react';
import useAction from '../../lib/helpers/useAction';
import { formatDuration, parseDuration } from '../../lib/helpers/cups';

export default function RaceResultsForm({ entries, onRecord }) {
  // The backend rejects a mix of times and positions, so the whole form uses one mode.
  const [mode, setMode] = useState(() => entries.some(entry => entry.position != null) ? 'position' : 'time');
  const { pending, error, setError, run } = useAction();

  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const results = [];
    for (const entry of entries) {
      const value = String(form.get(`value-${entry.group_id}`) || '').trim();
      // Each row sends exactly one of did_not_finish, finish_time_seconds or position; DNF wins if both are filled.
      if (form.get(`dnf-${entry.group_id}`)) results.push({ group_id: entry.group_id, did_not_finish: true });
      else if (value && mode === 'time') {
        const seconds = parseDuration(value);
        if (!(seconds > 0)) return setError(`${entry.group_name}: enter a time like 42:10 or 1:02:30.`);
        results.push({ group_id: entry.group_id, finish_time_seconds: seconds });
      } else if (value) results.push({ group_id: entry.group_id, position: Number(value) });
    }
    if (!results.length) return setError('Enter at least one result.');
    run(() => onRecord(results));
  }

  return <form className="form-stack" onSubmit={submit}>
    <h3>Record results</h3>
    {error && <p role="alert">{error}</p>}
    <fieldset className="actions">
      <legend>Record by</legend>
      <label><input type="radio" name="mode" checked={mode === 'time'} onChange={() => setMode('time')} /> Finish time</label>
      <label><input type="radio" name="mode" checked={mode === 'position'} onChange={() => setMode('position')} /> Position</label>
    </fieldset>
    {/* key={mode} resets the inputs so values typed as times aren't sent as positions. */}
    <table key={mode} className="race-results">
      <thead><tr><th>Team</th><th>{mode === 'time' ? 'Time (h:mm:ss)' : 'Position'}</th><th>DNF</th></tr></thead>
      <tbody>
        {entries.map(entry => <tr key={entry.group_id}>
          <td>{entry.group_name}</td>
          <td>{mode === 'time'
            ? <input name={`value-${entry.group_id}`} inputMode="decimal" placeholder="42:10" defaultValue={formatDuration(entry.finish_time_seconds)} aria-label={`${entry.group_name} time`} />
            : <input name={`value-${entry.group_id}`} type="number" min={1} step={1} defaultValue={entry.position ?? ''} aria-label={`${entry.group_name} position`} />}</td>
          <td><input name={`dnf-${entry.group_id}`} type="checkbox" defaultChecked={entry.did_not_finish} aria-label={`${entry.group_name} did not finish`} /></td>
        </tr>)}
      </tbody>
    </table>
    <div className="actions"><button disabled={pending}>{pending ? 'Saving…' : 'Save results'}</button></div>
  </form>;
}
