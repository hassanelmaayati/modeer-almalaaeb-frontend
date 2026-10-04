import Field from '../common/Field';
import { CUP_STATUSES } from '../../lib/helpers/cups';

export default function CupStatusFilters({ value, onChange }) {
  return <div className="filters">
    <Field label="Status">
      <select value={value} onChange={event => onChange(event.target.value)}>
        <option value="">All statuses</option>
        {CUP_STATUSES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </Field>
  </div>;
}
