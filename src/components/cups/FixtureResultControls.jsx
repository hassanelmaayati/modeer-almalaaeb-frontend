import { useState } from 'react';
import useAction from '../../lib/helpers/useAction';
import Select from '../common/Select';

export default function FixtureResultControls({ fixture, homeName, awayName, onRecord }) {
  const [home, setHome] = useState(''), [away, setAway] = useState(''), [winner, setWinner] = useState('');
  const { pending, error, run } = useAction();
  // Knockouts need a winner to advance, so a draw (e.g. decided on penalties) must name one.
  const draw = home !== '' && away !== '' && Number(home) === Number(away);

  function submit(event) {
    event.preventDefault();
    const result = { fixture_id: fixture.id, home_score: Number(home), away_score: Number(away) };
    if (draw) result.winner_group_id = Number(winner);
    run(() => onRecord(result));
  }

  return <form className="fixture-result" onSubmit={submit}>
    {error && <p role="alert">{error}</p>}
    <label>{homeName} <input type="number" min={0} step={1} value={home} onChange={event => setHome(event.target.value)} required /></label>
    <label>{awayName} <input type="number" min={0} step={1} value={away} onChange={event => setAway(event.target.value)} required /></label>
    {draw && <label>Winner
      <Select value={winner} onChange={event => setWinner(event.target.value)} required>
        <option value="" disabled>Select</option>
        <option value={fixture.home_group_id}>{homeName}</option>
        <option value={fixture.away_group_id}>{awayName}</option>
      </Select>
    </label>}
    <button disabled={pending}>{pending ? 'Saving…' : 'Save result'}</button>
  </form>;
}
