import { statusLabel } from '../../lib/helpers/cups';

export default function CupStatusBadge({ status }) {
  return <span className={`status-badge cup-status-${status}`}>{statusLabel(status)}</span>;
}
