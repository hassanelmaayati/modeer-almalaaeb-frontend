import { useState } from 'react';
import Field from '../common/Field';
import LocationPicker from './LocationPicker';
import { DIFFICULTIES, DISTRICTS } from '../../lib/helpers/filters';
import { areasFor } from '../../lib/helpers/areas';
import { fromBahrainDateTimeInput, toBahrainDateTimeInput } from '../../lib/helpers/date';
import { ADMISSION_POLICIES, VISIBILITIES, buildRoomBody, isOutdoorSport, roomErrors, scheduleError, sportFormats } from '../../lib/helpers/rooms';

export default function RoomForm({ room, sports, groups, onSubmit, onCancel }) {
    const editing = !!room;
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [sportId, setSportId] = useState(room ? String(room.sport_id) : '');
    const [visibility, setVisibility] = useState(room?.visibility || 'public');
    const [district, setDistrict] = useState(room?.district || '');
    const [pin, setPin] = useState(room?.venue_location || null);

    const sport = sports.find(item => String(item.id) === sportId);
    const formats = sportFormats(sport);
    const outdoor = isOutdoorSport(sport);
    const earliest = toBahrainDateTimeInput(new Date());

    async function submit(event) { 
        event.preventDefault();

        if (pending) return;
        setFieldErrors({});

        const form = new FormData(event.currentTarget);

        // Times are typed in Bahrain time and sent as UTC ISO strings (the backend rejects times without a timezone).
        const startsAt = fromBahrainDateTimeInput(form.get('starts_at'));
        const endsAt = fromBahrainDateTimeInput(form.get('ends_at'));
        // On edit, an unchanged start is not re-checked: it may already be less than an hour away.
        const startChanged = !editing || form.get('starts_at') !== toBahrainDateTimeInput(room.starts_at);
        const problem = scheduleError(startsAt, endsAt, { checkStart: startChanged });
        if (problem) return setError(problem);

        const values = {
            sport_id: sportId,
            title: form.get('title'),
            description: form.get('description'),
            difficulty: form.get('difficulty'),
            starts_at: startsAt,
            ends_at: endsAt,
            capacity: form.get('capacity'),
            visibility,
            group_id: form.get('group_id'),
            admission_policy: form.get('admission_policy'),
            district,
            area: form.get('area'),
            // The pin and notes are private: the backend only shows them to the host and admitted players.
            venue_location: pin,
            venue_notes: form.get('venue_notes'),
        };
        if (outdoor) Object.assign(values, {
            distance_km: form.get('distance_km'),
            pace_notes: form.get('pace_notes'),
            route_notes: form.get('route_notes'),
        });

        const { body, error: invalid } = buildRoomBody(values, { editing, revision: room?.revision });
        if (invalid) return setError(invalid);

        setPending(true);
        setError('');
        try {
            await onSubmit(body);
        } catch (failure) {
            // The inputs are uncontrolled, so they keep what the user typed; only the messages change.
            const { banner, fields } = roomErrors(failure);
            setError(banner);
            setFieldErrors(fields);
        } finally {
            setPending(false);
        }
    }

    return <form className="form-stack" onSubmit={submit}>
        {error && <p role="alert">{error}</p>}

        <Field label="Sport" error={fieldErrors.sport_id}>
            <select name="sport_id" value={sportId} onChange={event => setSportId(event.target.value)} required>
                <option value="" disabled>Select a sport</option>
                {sports.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
        </Field>

        <Field label="Title" error={fieldErrors.title}><input name="title" maxLength={100} defaultValue={room?.title || ''} required /></Field>
        <Field label="Description" error={fieldErrors.description}><textarea name="description" defaultValue={room?.description || ''} /></Field>

        <Field label="Starts (Bahrain time)" error={fieldErrors.starts_at}>
            <input name="starts_at" type="datetime-local" min={earliest} defaultValue={toBahrainDateTimeInput(room?.starts_at)} required />
        </Field>
        <Field label="Ends (Bahrain time)" error={fieldErrors.ends_at}>
            <input name="ends_at" type="datetime-local" min={earliest} defaultValue={toBahrainDateTimeInput(room?.ends_at)} required />
        </Field>
        <p className="muted">Rooms can start between 1 hour and 14 days from now.</p>

        <Field label="Difficulty" error={fieldErrors.difficulty}>
            <select name="difficulty" defaultValue={room?.difficulty || 'beginners'}>
                {DIFFICULTIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
        </Field>

        {/* The key resets this field when the sport changes, so an old capacity never lingers. */}
        <Field key={sportId} label={formats.length ? 'Format' : 'Capacity (players)'} error={fieldErrors.capacity}>
            {formats.length
                ? <select name="capacity" defaultValue={room?.capacity || ''} required>
                    <option value="" disabled>Select a format</option>
                    {formats.map(format => <option key={format.key} value={format.capacity}>{format.key} ({format.capacity} players)</option>)}
                </select>
                : <input name="capacity" type="number" min="1" step="1" defaultValue={room?.capacity || ''} required />}
        </Field>

        <Field label="District" error={fieldErrors.district}>
            <select name="district" value={district} onChange={event => setDistrict(event.target.value)} required>
                <option value="" disabled>Select a district</option>
                {DISTRICTS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
        </Field>

        <Field key={district} label="Area" error={fieldErrors.area}>
            <select name="area" defaultValue={district === room?.district ? room.area : ''} disabled={!district} required>
                <option value="" disabled>{district ? 'Select an area' : 'Choose a district first'}</option>
                {areasFor(district).map(area => <option key={area} value={area}>{area}</option>)}
            </select>
        </Field>

        <fieldset>
            <legend>Exact venue (private)</legend>
            <p className="muted">The area above is public. The pin and notes below are shown only to you and the players you admit.</p>
            <LocationPicker value={pin} onChange={setPin} canClear={!room?.venue_location} />
            {fieldErrors.venue_location && <p role="alert" className="field-error">{fieldErrors.venue_location}</p>}
            <Field label="Venue notes (optional)" error={fieldErrors.venue_notes}>
                <textarea name="venue_notes" placeholder="Court number, parking, meeting point…" defaultValue={room?.venue_notes || ''} />
            </Field>
        </fieldset>

        <Field label="Who can see this room" error={fieldErrors.visibility}>
            <select name="visibility" value={visibility} onChange={event => setVisibility(event.target.value)}>
                {VISIBILITIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
        </Field>

        {visibility === 'group' && <Field label="Group" error={fieldErrors.group_id}>
            <select name="group_id" defaultValue={room?.group_id || ''} required>
                <option value="" disabled>Select a group</option>
                {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
            {groups.length === 0 && <span role="alert">You don't own any groups yet.</span>}
        </Field>}

        <Field label="Joining" error={fieldErrors.admission_policy}>
            <select name="admission_policy" defaultValue={room?.admission_policy || 'approval'}>
                {ADMISSION_POLICIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
        </Field>

        {outdoor && <>
            <Field label="Distance (km)" error={fieldErrors.distance_km}><input name="distance_km" type="number" min="0.1" step="0.1" defaultValue={room?.distance_km ?? ''} /></Field>
            <Field label="Pace notes" error={fieldErrors.pace_notes}><input name="pace_notes" defaultValue={room?.pace_notes || ''} /></Field>
            <Field label="Route notes" error={fieldErrors.route_notes}><textarea name="route_notes" defaultValue={room?.route_notes || ''} /></Field>
        </>}

        <div className="actions">
            <button disabled={pending || !sportId}>{pending ? 'Saving…' : editing ? 'Save changes' : 'Create room'}</button>
            <button type="button" disabled={pending} onClick={onCancel}>Cancel</button>
        </div>
    </form>;
}