import Field from '../common/Field';
import { KNOCKOUT_TEAM_COUNTS, RACE_TEAM_COUNT } from '../../lib/helpers/cups';

export default function TeamCountAndRules({ format, defaultValues = {} }) {
  return <>
    {/* The input switches with the sport's format: knockout brackets need 4, 8 or 16 teams, races take 2–100. */}
    {format === 'knockout' ? <Field label="Number of teams">
      <select key="knockout" name="team_count" defaultValue={defaultValues.team_count || KNOCKOUT_TEAM_COUNTS[0]} required>
        {KNOCKOUT_TEAM_COUNTS.map(count => <option key={count} value={count}>{count} teams</option>)}
      </select>
    </Field> : <Field label={`Number of teams (${RACE_TEAM_COUNT.min}–${RACE_TEAM_COUNT.max})`}>
      <input key="race" name="team_count" type="number" min={RACE_TEAM_COUNT.min} max={RACE_TEAM_COUNT.max} step={1} defaultValue={defaultValues.team_count || ''} disabled={!format} required />
    </Field>}
    <Field label="Players per team (roster limit)"><input name="roster_limit" type="number" min={1} step={1} defaultValue={defaultValues.roster_limit || ''} required /></Field>
    <Field label="Rules"><textarea name="rules" defaultValue={defaultValues.rules || ''} required /></Field>
  </>;
}
