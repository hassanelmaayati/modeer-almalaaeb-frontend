import Icon from '../common/Icon';
import SportIcon from '../common/SportIcon';
import { formatLabel } from '../../lib/helpers/cups';
import { formatActivityDate, formatActivityTime, fromBahrainDateTimeInput } from '../../lib/helpers/date';

/** A live preview of the cup as it is being filled in, plus a checklist of what is still missing (same look as the host-a-room card). */
export default function CupPreviewCard({ sport, format, draft, checks }) {
  const closes = fromBahrainDateTimeInput(draft.registration_closes_at);
  const done = checks.filter(check => check.done).length;
  const percent = Math.round((done / checks.length) * 100);
  const teams = Number(draft.team_count);
  const roster = Number(draft.roster_limit);
  return <aside className="host-preview" aria-label="Cup preview">
    <p className="host-preview-kicker">Your cup card</p>
    <article className="host-card">
      <header className="host-card-top">
        <span className="host-card-sport"><SportIcon name={sport?.name} size={30} /></span>
        <span className="host-card-sportname">{sport ? sport.name : 'Sport not chosen'}</span>
      </header>
      <h3 className={draft.name ? '' : 'is-placeholder'}>{draft.name || 'Your cup name'}</h3>
      <ul>
        <li className={format ? '' : 'is-placeholder'}><Icon name="trophy" /><span>{format ? formatLabel(format) : 'Pick a sport for the format'}</span></li>
        <li className={teams ? '' : 'is-placeholder'}><Icon name="people" /><span>{teams ? `${teams} teams` : 'Set the number of teams'}</span></li>
        <li className={roster ? '' : 'is-placeholder'}><Icon name="userplus" /><span>{roster ? `${roster} ${roster === 1 ? 'player' : 'players'} per team` : 'Set the roster limit'}</span></li>
        <li className={closes ? '' : 'is-placeholder'}><Icon name="calendar" /><span>{closes ? `Closes ${formatActivityDate(closes)} · ${formatActivityTime(closes)}` : 'No closing time yet'}</span></li>
      </ul>
      {draft.rules.trim() && <p className="host-card-rules">{draft.rules.trim()}</p>}
    </article>
    <section className="host-progress" aria-label="Readiness">
      <div className="host-progress-head"><strong>{done === checks.length ? 'Ready to create' : 'Getting ready'}</strong><span>{done} of {checks.length}</span></div>
      <div className="host-progress-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
      <ul className="host-checks">
        {checks.map(check => <li key={check.label} className={check.done ? 'is-done' : ''}><span className="host-check-mark" aria-hidden="true">{check.done ? <Icon name="check" size={14} /> : null}</span>{check.label}</li>)}
      </ul>
    </section>
  </aside>;
}
