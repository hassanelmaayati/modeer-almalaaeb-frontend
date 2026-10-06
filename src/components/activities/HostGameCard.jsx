import Icon from '../common/Icon';
import SportIcon from '../common/SportIcon';
import { DIFFICULTIES, optionLabel } from '../../lib/helpers/filters';
import { formatActivityDate, formatActivityTime, fromBahrainDateTimeInput } from '../../lib/helpers/date';
import { ADMISSION_POLICIES, VISIBILITIES } from '../../lib/helpers/rooms';

/** A live preview of the room as it is being filled in, plus a checklist of what is still missing. */
export default function HostGameCard({ sport, draft, capacity, districtLabel, area, visibility, checks }) {
  const start = fromBahrainDateTimeInput(draft.starts_at);
  const done = checks.filter(check => check.done).length;
  const percent = Math.round((done / checks.length) * 100);
  const policy = ADMISSION_POLICIES.find(item => item.value === draft.admission_policy)?.label;
  const visible = VISIBILITIES.find(item => item.value === visibility)?.label;
  return <aside className="host-preview" aria-label="Game preview">
    <p className="host-preview-kicker">Your game card</p>
    <article className="host-card">
      <header className="host-card-top">
        <span className="host-card-sport"><SportIcon name={sport?.name} size={30} /></span>
        <span className="host-card-sportname">{sport ? sport.name : 'Sport not chosen'}</span>
      </header>
      <h3 className={draft.title ? '' : 'is-placeholder'}>{draft.title || 'Your game title'}</h3>
      <ul>
        <li className={start ? '' : 'is-placeholder'}><Icon name="calendar" /><span>{start ? `${formatActivityDate(start)} · ${formatActivityTime(start)}` : 'Pick a start time'}</span></li>
        <li className={area ? '' : 'is-placeholder'}><Icon name="pin" /><span>{area ? `${area}${districtLabel ? ` · ${districtLabel}` : ''}` : 'Pick a place'}</span></li>
        <li className={capacity ? '' : 'is-placeholder'}><Icon name="people" /><span>{capacity ? `${capacity} players` : 'Set the number of players'}</span></li>
        <li><Icon name={draft.admission_policy === 'open' ? 'bolt' : 'lock'} /><span>{policy || 'Host approval'}</span></li>
      </ul>
      <div className="host-card-pills">
        <span>{optionLabel(DIFFICULTIES, draft.difficulty)}</span>
        {visible && <span>{visible}</span>}
      </div>
    </article>
    <section className="host-progress" aria-label="Readiness">
      <div className="host-progress-head"><strong>{done === checks.length ? 'Ready to host' : 'Getting ready'}</strong><span>{done} of {checks.length}</span></div>
      <div className="host-progress-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
      <ul className="host-checks">
        {checks.map(check => <li key={check.label} className={check.done ? 'is-done' : ''}><span className="host-check-mark" aria-hidden="true">{check.done ? <Icon name="check" size={14} /> : null}</span>{check.label}</li>)}
      </ul>
    </section>
  </aside>;
}
