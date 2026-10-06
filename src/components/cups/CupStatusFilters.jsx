import { CUP_STATUSES } from '../../lib/helpers/cups';

const OPTIONS = [{ value: '', label: 'All cups' }, ...CUP_STATUSES];

export default function CupStatusFilters({ value, onChange }) {
  return <div className="status-chips" role="group" aria-label="Filter cups by status">
    {OPTIONS.map(option => <button key={option.value} type="button" className="status-chip" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}
