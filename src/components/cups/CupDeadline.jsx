import { formatActivityDay, formatActivityMonth, formatActivityTime, formatActivityWeekday } from '../../lib/helpers/date';

/** Registration deadline as a small calendar tile plus the weekday and time, instead of a dotted text line. */
export default function CupDeadline({ closesAt, children }) {
  if (!closesAt) return null;
  return <div className="cup-deadline">
    <span className="cup-deadline-tile" aria-hidden="true">
      <span>{formatActivityMonth(closesAt)}</span>
      <strong>{formatActivityDay(closesAt)}</strong>
    </span>
    <span className="cup-deadline-text">
      <span className="cup-deadline-label">Registration closes</span>
      <strong>{formatActivityWeekday(closesAt)}, {formatActivityTime(closesAt)} <span className="muted">Bahrain time</span></strong>
    </span>
    {children}
  </div>;
}
