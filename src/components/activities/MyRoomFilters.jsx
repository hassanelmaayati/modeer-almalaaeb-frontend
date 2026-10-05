import { useState } from 'react';
import { toBahrainDateTimeInput } from '../../lib/helpers/date';
import {
  myRoomFiltersFromForm,
  ORDER_OPTIONS,
  ROOM_STATUS_OPTIONS,
  validateMyRoomFilters,
  VISIBILITY_OPTIONS,
} from '../../lib/helpers/filters';

export default function MyRoomFilters({ filters, sports = [], onApply, onClear }) {
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    const values = myRoomFiltersFromForm(new FormData(event.currentTarget), filters.view);
    const problem = validateMyRoomFilters(values);
    setError(problem || '');
    if (!problem) onApply(values);
  }

  return (
    <form className="room-filters panel" onSubmit={handleSubmit}>
      <fieldset>
        <legend>Status</legend>
        <div className="button-row">
          {ROOM_STATUS_OPTIONS.map(({ value, label }) => (
            <label key={value}>
              <input type="checkbox" name="status" value={value} defaultChecked={filters.status.includes(value)} /> {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="filter-fields">
        <label className="form-field">Activity
          <select name="sport_id" defaultValue={filters.sport_id || ''}>
            <option value="">All activities</option>
            {sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}
          </select>
        </label>
        <label className="form-field">Visibility
          <select name="visibility" defaultValue={filters.visibility || ''}>
            <option value="">Any visibility</option>
            {VISIBILITY_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="form-field">From
          <input type="datetime-local" name="starts_from" defaultValue={toBahrainDateTimeInput(filters.starts_from)} />
        </label>
        <label className="form-field">Until
          <input type="datetime-local" name="starts_to" defaultValue={toBahrainDateTimeInput(filters.starts_to)} />
        </label>
        <label className="form-field">Sort
          <select name="order" defaultValue={filters.order}>
            {ORDER_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <p className="muted">Dates and times are shown in Bahrain time. No status checked shows every status.</p>
      {error && <p role="alert" className="error-message">{error}</p>}
      <div className="button-row">
        <button type="submit" className="button">Apply filters</button>
        <button type="button" className="button-secondary" onClick={() => { setError(''); onClear(); }}>Clear filters</button>
      </div>
    </form>
  );
}
