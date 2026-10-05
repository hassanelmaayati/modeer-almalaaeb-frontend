import { useState } from 'react';
import { toBahrainDateTimeInput } from '../../lib/helpers/date';
import { ALL_GOVERNORATES, DIFFICULTIES, DISTRICTS, filtersFromForm, validateRoomFilters } from '../../lib/helpers/filters';

export default function RoomFilters({ filters, sports = [], onApply, onClear }) {
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    const values = filtersFromForm(new FormData(event.currentTarget));
    const problem = validateRoomFilters(values);
    setError(problem || '');
    if (!problem) onApply(values);
  }

  return (
    <form className="room-filters panel" onSubmit={handleSubmit}>
      <div className="filter-fields">
        <label className="form-field">Activity
          <select name="sport_id" defaultValue={filters.sport_id || ''}>
            <option value="">All activities</option>
            {sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}
          </select>
        </label>
        <label className="form-field">Difficulty
          <select name="difficulty" defaultValue={filters.difficulty || ''}>
            <option value="">All levels</option>
            {DIFFICULTIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="form-field">Governorate
          <select name="district" defaultValue={filters.district || ''}>
            <option value={ALL_GOVERNORATES}>All governorates</option>
            {DISTRICTS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="form-field">From
          <input type="datetime-local" name="starts_from" defaultValue={toBahrainDateTimeInput(filters.starts_from)} />
        </label>
        <label className="form-field">Until
          <input type="datetime-local" name="starts_to" defaultValue={toBahrainDateTimeInput(filters.starts_to)} />
        </label>
      </div>
      <p className="muted">Dates and times are shown in Bahrain time.</p>
      {error && <p role="alert" className="error-message">{error}</p>}
      <div className="button-row">
        <button type="submit" className="button">Apply filters</button>
        <button type="button" className="button-secondary" onClick={() => { setError(''); onClear(); }}>Clear filters</button>
      </div>
    </form>
  );
}
