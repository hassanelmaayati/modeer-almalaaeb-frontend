import { CUP_STATUSES } from '../../lib/helpers/cups';

const OPTIONS = [{ value: '', label: 'All cups' }, ...CUP_STATUSES];

export default function CupStatusFilters({ value, onChange, signedIn = false }) {
  // Drafts are only visible to their organizer, so guests would always get an empty list.
  const options = signedIn ? OPTIONS : OPTIONS.filter(option => option.value !== 'draft');
  return <div className="status-chips" role="group" aria-label="Filter cups by status">
    {options.map(option => <button key={option.value} type="button" className="status-chip" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}
