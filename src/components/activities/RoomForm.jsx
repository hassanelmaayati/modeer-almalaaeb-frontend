import { useState } from 'react';
import Field from '../common/Field';
import LocationPicker from './LocationPicker';
import HostGameCard from './HostGameCard';
import { DIFFICULTIES, DISTRICTS } from '../../lib/helpers/filters';
import { areasFor } from '../../lib/helpers/areas';
import { fromBahrainDateTimeInput, toBahrainDateTimeInput } from '../../lib/helpers/date';
import { ADMISSION_POLICIES, VISIBILITIES, buildRoomBody, isOutdoorSport, isRoomFrozen, isStaleConflict, roomErrors, scheduleError, sportFormats, withoutFrozenFields } from '../../lib/helpers/rooms';
import Select from '../common/Select';
import DateTimeInput from '../common/DateTimeInput';

export default function RoomForm({ room, sports, groups, onSubmit, onCancel, onReload, occupied = 0 }) {
    const editing = !!room;
    const [frozen] = useState(() => editing && isRoomFrozen(room));
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [stale, setStale] = useState(false);
    const [sportId, setSportId] = useState(room ? String(room.sport_id) : '');
    const [visibility, setVisibility] = useState(room?.visibility || 'public');
    const [district, setDistrict] = useState(room?.district || '');
    // Capacity and area depend on the sport and governorate, so they are reset in the change handlers below.
    const [capacity, setCapacity] = useState(room ? String(room.capacity) : '');
    const [area, setArea] = useState(room?.area || '');
    const [pin, setPin] = useState(room?.venue_location || null);

    const sport = sports.find(item => String(item.id) === sportId);
    const formats = sportFormats(sport);
    const outdoor = isOutdoorSport(sport);
    const earliest = toBahrainDateTimeInput(new Date());

    // A live copy of the typed values, so the game card beside the form can preview the room.
    const [draft, setDraft] = useState(() => ({
        title: room?.title || '',
        starts_at: toBahrainDateTimeInput(room?.starts_at),
        ends_at: toBahrainDateTimeInput(room?.ends_at),
        difficulty: room?.difficulty || 'beginners',
        admission_policy: room?.admission_policy || 'approval',
    }));
    function track(event) {
        const form = new FormData(event.currentTarget);
        // Disabled inputs are not in the form data, so keep their previous value.
        setDraft(previous => Object.fromEntries(Object.keys(previous).map(key => [key, form.has(key) ? String(form.get(key)) : previous[key]])));
    }
    const checks = [
        { label: 'Choose a sport', done: !!sportId },
        { label: 'Name your game', done: !!draft.title.trim() },
        { label: 'Set a start', done: !!draft.starts_at },
        { label: 'Set an end', done: !!draft.ends_at },
        { label: formats.length ? 'Pick a format' : 'Set the players', done: !!capacity },
        { label: 'Pick a governorate', done: !!district },
        { label: 'Pick an area', done: !!area },
    ];

    async function submit(event) { 
        event.preventDefault();

        if (pending) return;
        setFieldErrors({});
        setStale(false);

        if (editing && !frozen && Number(capacity) < occupied) {
            setFieldErrors({ capacity: `Capacity can't be lower than the ${occupied} places already taken.` });
            return setError('Please fix the highlighted fields.');
        }

        const form = new FormData(event.currentTarget);

        // Times are typed in Bahrain time and sent as UTC ISO strings (the backend rejects times without a timezone).
        const startsAt = frozen ? room.starts_at : fromBahrainDateTimeInput(form.get('starts_at'));
        const endsAt = frozen ? room.ends_at : fromBahrainDateTimeInput(form.get('ends_at'));
        // On edit, an unchanged start is not re-checked: it may already be less than an hour away.
        const startChanged = !editing || form.get('starts_at') !== toBahrainDateTimeInput(room.starts_at);
        const problem = frozen ? '' : scheduleError(startsAt, endsAt, { checkStart: startChanged });
        if (problem) return setError(problem);

        const values = {
            sport_id: sportId,
            title: form.get('title'),
            description: form.get('description'),
            notes: form.get('notes'),
            difficulty: form.get('difficulty'),
            starts_at: startsAt,
            ends_at: endsAt,
            capacity,
            visibility,
            group_id: form.get('group_id'),
            admission_policy: form.get('admission_policy'),
            district,
            area,
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
            await onSubmit(frozen ? withoutFrozenFields(body) : body);
        } catch (failure) {
            // The inputs are uncontrolled, so they keep what the user typed; only the messages change.
            const { banner, fields } = roomErrors(failure);
            setError(banner);
            setFieldErrors(fields);
            setStale(isStaleConflict(failure));
        } finally {
            setPending(false);
        }
    }

    return <div className="room-form-layout">
        <form className="form-stack room-form" onSubmit={submit} onChange={track}>
            {error && <p role="alert">{error}</p>}
            {stale && onReload && <button type="button" className="button-secondary" onClick={onReload}>Reload latest version</button>}
            {frozen && <p role="status">Schedule, location and capacity can't be changed in the last 15 minutes before the start.</p>}

            <section className="room-step" aria-labelledby="step-game">
                <h2 id="step-game" className="room-step-title"><span className="room-step-num">1</span>Pick the game</h2>
                <Field label="Sport" error={fieldErrors.sport_id}>
                    <Select name="sport_id" value={sportId} onChange={event => { setSportId(event.target.value); setCapacity(''); }} disabled={frozen} required>
                        <option value="" disabled>Select a sport</option>
                        {sports.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </Select>
                </Field>

                <Field label="Title" error={fieldErrors.title}><input name="title" maxLength={100} defaultValue={room?.title || ''} required /></Field>
                <Field label="Description" error={fieldErrors.description}><textarea name="description" defaultValue={room?.description || ''} /></Field>
                <Field label="Difficulty" error={fieldErrors.difficulty}>
                    <Select name="difficulty" defaultValue={room?.difficulty || 'beginners'}>
                        {DIFFICULTIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                    </Select>
                </Field>
            </section>

            <section className="room-step" aria-labelledby="step-when">
                <h2 id="step-when" className="room-step-title"><span className="room-step-num">2</span>Set the time</h2>
                <Field label="Starts (Bahrain time)" error={fieldErrors.starts_at}>
                    <DateTimeInput name="starts_at"  min={earliest} defaultValue={toBahrainDateTimeInput(room?.starts_at)} disabled={frozen} required />
                </Field>
                <Field label="Ends (Bahrain time)" error={fieldErrors.ends_at}>
                    <DateTimeInput name="ends_at"  min={earliest} defaultValue={toBahrainDateTimeInput(room?.ends_at)} disabled={frozen} required />
                </Field>
                <p className="muted room-step-wide">Rooms can start between 1 hour and 14 days from now.</p>
            </section>

            <section className="room-step" aria-labelledby="step-who">
                <h2 id="step-who" className="room-step-title"><span className="room-step-num">3</span>Choose who plays</h2>
                <Field label={formats.length ? 'Format' : 'Capacity (players)'} error={fieldErrors.capacity}>
                    {formats.length
                        ? <Select name="capacity" value={capacity} onChange={event => setCapacity(event.target.value)} disabled={frozen} required>
                            <option value="" disabled>Select a format</option>
                            {formats.map(format => <option key={format.key} value={format.capacity} disabled={format.capacity < occupied}>{format.key} ({format.capacity} players)</option>)}
                        </Select>
                        : <input name="capacity" type="number" min={Math.max(1, occupied)} step="1" value={capacity} onChange={event => setCapacity(event.target.value)} disabled={frozen} required />}
                    {editing && occupied > 0 && <span className="muted">{occupied} {occupied === 1 ? 'place is' : 'places are'} already taken, including yours. Capacity can't go below that.</span>}
                </Field>

                <Field label="Joining" error={fieldErrors.admission_policy}>
                    <Select name="admission_policy" defaultValue={room?.admission_policy || 'approval'}>
                        {ADMISSION_POLICIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                    </Select>
                </Field>

                <Field label="Who can see this room" error={fieldErrors.visibility}>
                    <Select name="visibility" value={visibility} onChange={event => setVisibility(event.target.value)}>
                        {VISIBILITIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                    </Select>
                </Field>

                {visibility === 'group' && <Field label="Group" error={fieldErrors.group_id}>
                    <Select name="group_id" defaultValue={room?.group_id || ''} required>
                        <option value="" disabled>Select a group</option>
                        {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </Select>
                    {groups.length === 0 && <span role="alert">You don't own any groups yet.</span>}
                </Field>}
            </section>

            <section className="room-step" aria-labelledby="step-where">
                <h2 id="step-where" className="room-step-title"><span className="room-step-num">4</span>Say where</h2>
                <Field label="Governorate" error={fieldErrors.district}>
                    <Select name="district" value={district} onChange={event => { setDistrict(event.target.value); setArea(''); }} disabled={frozen} required>
                        <option value="" disabled>Select a governorate</option>
                        {DISTRICTS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                    </Select>
                </Field>

                <Field label="Area" error={fieldErrors.area}>
                    <Select name="area" value={area} onChange={event => setArea(event.target.value)} disabled={frozen || !district} required>
                        <option value="" disabled>{district ? 'Select an area' : 'Choose a governorate first'}</option>
                        {areasFor(district).map(area => <option key={area} value={area}>{area}</option>)}
                    </Select>
                </Field>

                <fieldset className="room-step-wide">
                    <legend>Activity Location (private)</legend>
                    <p className="muted">The area above is public. The pin and notes below are shown only to you and the players you admit.</p>
                    <LocationPicker value={pin} onChange={setPin} disabled={frozen} />
                    {fieldErrors.venue_location && <p role="alert" className="field-error">{fieldErrors.venue_location}</p>}
                    <Field label="Location notes (optional)" error={fieldErrors.venue_notes}>
                        <textarea name="venue_notes" placeholder="Court number, parking, meeting point…" defaultValue={room?.venue_notes || ''} disabled={frozen} />
                    </Field>
                </fieldset>
            </section>

            <section className="room-step" aria-labelledby="step-extra">
                <h2 id="step-extra" className="room-step-title"><span className="room-step-num">5</span>Add the details</h2>
                {outdoor && <>
                    <Field label="Distance (km)" error={fieldErrors.distance_km}><input name="distance_km" type="number" min="0.1" step="0.1" defaultValue={room?.distance_km ?? ''} /></Field>
                    <Field label="Pace notes" error={fieldErrors.pace_notes}><input name="pace_notes" defaultValue={room?.pace_notes || ''} /></Field>
                    <Field label="Route notes" error={fieldErrors.route_notes}><textarea name="route_notes" defaultValue={room?.route_notes || ''} /></Field>
                </>}

                <Field label="Notes" error={fieldErrors.notes}>
                    <textarea name="notes" placeholder="Anything players should know: what to bring, rules…" defaultValue={room?.notes || ''} />
                </Field>
            </section>

            <div className="actions room-form-actions">
                <button disabled={pending || !sportId}>{pending ? 'Saving…' : editing ? 'Save changes' : 'Create room'}</button>
                <button type="button" disabled={pending} onClick={onCancel}>Cancel</button>
            </div>
        </form>
        <HostGameCard
            sport={sport}
            draft={draft}
            capacity={capacity}
            districtLabel={DISTRICTS.find(item => item.value === district)?.label}
            area={area}
            visibility={visibility}
            checks={checks}
        />
    </div>;
}
