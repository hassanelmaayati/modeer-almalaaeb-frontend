import { useState } from 'react';
import { toBahrainDateTimeInput } from '../../lib/helpers/date';
import {
  MEMBERSHIP_OPTIONS,
  ORDER_OPTIONS,
  REQUEST_OPTIONS,
  ROOM_STATUS_OPTIONS,
  VISIBILITY_OPTIONS,
} from '../../lib/helpers/filters';
import Select from '../common/Select';
import DateTimeInput from '../common/DateTimeInput';

function CheckboxGroup({ name, legend, options, selected }) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="button-row">
        {options.map(({ value, label }) => (
          <label key={value}>
            <input type="checkbox" name={name} value={value} defaultChecked={selected.includes(value)} /> {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SelectField({ name, label, anyLabel, options, value }) {
  return (
    <label className="form-field">{label}
      <Select name={name} defaultValue={value || ''}>
        {anyLabel !== undefined && <option value="">{anyLabel}</option>}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </Select>
    </label>
  );
}

export default function RoomListFilters({ filterSet, filters, sports = [], fields, onApply, onClear }) {
  const [error, setError] = useState('');
  const has = (field) => fields.includes(field);
  const sportOptions = sports.map((sport) => ({ value: String(sport.id), label: sport.name }));

  function handleSubmit(event) {
    event.preventDefault();
    const values = filterSet.fromForm(new FormData(event.currentTarget), filters.view);
    const problem = filterSet.validate(values);
    setError(problem || '');
    if (!problem) onApply(values);
  }

  return (
    <form className="room-filters panel" onSubmit={handleSubmit}>
      {has('membership') && (
        <CheckboxGroup name="membership" legend="Membership" options={MEMBERSHIP_OPTIONS} selected={filters.membership ?? []} />
      )}
      {has('status') && (
        <CheckboxGroup name="status" legend="Status" options={ROOM_STATUS_OPTIONS} selected={filters.status ?? []} />
      )}
      <div className="filter-fields">
        {has('sport_id') && (
          <SelectField name="sport_id" label="Activity" anyLabel="All activities" options={sportOptions} value={filters.sport_id} />
        )}
        {has('requested') && (
          <SelectField name="requested" label="Request type" anyLabel="Any" options={REQUEST_OPTIONS} value={filters.requested} />
        )}
        {has('visibility') && (
          <SelectField name="visibility" label="Visibility" anyLabel="Any visibility" options={VISIBILITY_OPTIONS} value={filters.visibility} />
        )}
        {has('dates') && (
          <>
            <label className="form-field">From
              <DateTimeInput  name="starts_from" defaultValue={toBahrainDateTimeInput(filters.starts_from)} />
            </label>
            <label className="form-field">Until
              <DateTimeInput  name="starts_to" defaultValue={toBahrainDateTimeInput(filters.starts_to)} />
            </label>
          </>
        )}
        {has('order') && (
          <SelectField name="order" label="Sort" options={ORDER_OPTIONS} value={filters.order} />
        )}
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
