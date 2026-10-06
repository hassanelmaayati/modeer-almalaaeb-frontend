import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RoomForm from '../../src/components/activities/RoomForm';
import CancelRoomForm from '../../src/components/activities/CancelRoomForm';
import LocationPicker from '../../src/components/activities/LocationPicker';
import LocationView from '../../src/components/activities/LocationView';
import { buildRoomBody, isOutdoorSport, isRoomFrozen, roomErrors, scheduleError, sportFormats, withoutFrozenFields } from '../../src/lib/helpers/rooms';

const map = vi.hoisted(() => ({ handlers: null }));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, center }) => <div aria-label="Venue map" data-center={center.join(',')}>{children}</div>,
  TileLayer: () => null,
  Marker: ({ position }) => <span aria-label="Venue pin">{position.join(',')}</span>,
  useMapEvents: handlers => { map.handlers = handlers; },
}));
vi.mock('../../src/lib/helpers/leaflet', () => ({
  BAHRAIN_BOUNDS: [[25.5, 50.3], [26.4, 50.9]],
  BAHRAIN_CENTER: [26.05, 50.55],
  OSM_TILES: { url: '', attribution: '' },
}));

const now = Date.parse('2030-01-01T12:00:00Z');
const sports = [{ id: 1, name: 'Football', formats: [{ key: '2v2', capacity: 4 }, { key: '5v5', capacity: 10 }] }, { id: 2, name: 'Running' }];
const room = {
  id: 1, revision: 3, sport_id: 1, title: 'Evening football', description: 'Friendly',
  starts_at: '2030-01-01T14:00:00Z', ends_at: '2030-01-01T15:00:00Z', capacity: 4,
  difficulty: 'beginners', visibility: 'public', admission_policy: 'approval', district: 'capital', area: 'Manama',
  venue_location: { latitude: 26.2, longitude: 50.6 }, venue_notes: 'Court 2',
};
const addedSports = [
  { id: 5, name: 'Walking', formats: null, outdoor: true },
  { id: 6, name: 'Marathon', formats: null, outdoor: true },
  { id: 7, name: 'Cycling', formats: null, outdoor: true },
  { id: 8, name: 'Handball', formats: null, outdoor: false },
];

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(now);
  map.handlers = null;
});

function form(props = {}) {
  return render(<RoomForm room={room} sports={sports} groups={[]} onSubmit={vi.fn()} onCancel={vi.fn()} {...props} />);
}
function submit() { fireEvent.submit(screen.getByRole('button', { name: /Save changes|Create room/ }).closest('form')); }

describe('activity schedule boundaries and editable payloads', () => {
  it.each([
    [60 * 60_000, ''],
    [60 * 60_000 - 1, 'at least 1 hour'],
    [14 * 24 * 60 * 60_000, ''],
    [14 * 24 * 60 * 60_000 + 1, 'within 14 days'],
    [-1, 'cannot be in the past'],
  ])('checks a start %i milliseconds from now at the inclusive boundaries', (offset, error) => {
    expect(scheduleError(new Date(now + offset).toISOString(), new Date(now + offset + 60 * 60_000).toISOString(), { now })).toContain(error);
  });
  it.each(['missing', null])('refuses missing or malformed schedule %s', value => {
    expect(scheduleError(value, room.ends_at, { now })).toMatch(/Choose both/);
  });
  it('allows an unchanged nearby start while still rejecting an end before its start', () => {
    expect(scheduleError(new Date(now + 10 * 60_000).toISOString(), room.ends_at, { now, checkStart: false })).toBe('');
    expect(scheduleError(room.starts_at, room.starts_at, { now })).toMatch(/after the start/);
  });
  it('preserves omission on create and persists explicit optional clears on edit', () => {
    const values = { ...room, title: ' Evening football ', area: ' Manama ', venue_location: null, venue_notes: ' ', description: '' };
    const created = buildRoomBody(values).body;
    expect(created).not.toHaveProperty('venue_location');
    expect(created).not.toHaveProperty('venue_notes');
    const edited = buildRoomBody(values, { editing: true, revision: 3 }).body;
    expect(edited).toMatchObject({ title: 'Evening football', area: 'Manama', venue_location: null, venue_notes: null, description: null, revision: 3 });
  });
  it('requires a group for group visibility and excludes an old group for public rooms', () => {
    expect(buildRoomBody({ ...room, visibility: 'group' }).error).toMatch(/which group/);
    expect(buildRoomBody({ ...room, group_id: 10 }).body).not.toHaveProperty('group_id');
    expect(buildRoomBody({ ...room, visibility: 'group', group_id: '10' }).body.group_id).toBe(10);
  });
  it('freezes exactly fifteen minutes before start and removes protected update fields without mutating input', () => {
    const cutoff = Date.parse(room.starts_at) - 15 * 60_000;
    expect(isRoomFrozen(room, cutoff - 1)).toBe(false);
    expect(isRoomFrozen(room, cutoff)).toBe(true);
    const input = { ...room, title: 'New title', venue_location: null, revision: 3 };
    expect(withoutFrozenFields(input)).toMatchObject({ title: 'New title', revision: 3 });
    for (const key of ['sport_id', 'capacity', 'starts_at', 'district', 'area', 'venue_location']) expect(withoutFrozenFields(input)).not.toHaveProperty(key);
    expect(input.capacity).toBe(4);
  });
  it('maps nested API validation to the location field and translates governorate terminology', () => {
    expect(roomErrors({ status: 422, detail: [
      { loc: ['body', 'venue_location', 'latitude'], msg: 'Value error, venue_location must be inside Bahrain' },
      { loc: ['body', 'area'], msg: 'Value error, area does not belong to district' },
    ] })).toEqual({ banner: 'Please fix the highlighted fields.', fields: { venue_location: 'venue_location must be inside Bahrain', area: 'area does not belong to governorate' } });
  });
});

describe('room form save, failure and conflict behavior', () => {
  it('lets an editor clear a saved optional pin and notes and sends the current revision', async () => {
    const onSubmit = vi.fn().mockResolvedValue(null);
    form({ onSubmit });
    fireEvent.click(screen.getByRole('button', { name: 'Clear pin' }));
    fireEvent.change(screen.getByLabelText('Location notes (optional)'), { target: { value: '' } });
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ venue_location: null, venue_notes: null, revision: 3, starts_at: new Date(room.starts_at).toISOString() });
  });
  it('keeps values and highlights backend field errors after a failed save', async () => {
    const onSubmit = vi.fn().mockRejectedValue({ status: 422, detail: [{ loc: ['body', 'area'], msg: 'area does not belong to district' }] });
    form({ onSubmit });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Unsaved title' } });
    submit();
    await screen.findByText('area does not belong to governorate');
    expect(screen.getByLabelText('Title')).toHaveValue('Unsaved title');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
  it('offers explicit reload on a stale revision while retaining the typed title', async () => {
    const onReload = vi.fn();
    form({ onSubmit: vi.fn().mockRejectedValue({ status: 409, message: 'Room changed since you loaded it' }), onReload });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Keep my edit' } });
    submit();
    fireEvent.click(await screen.findByRole('button', { name: 'Reload latest version' }));
    expect(onReload).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Title')).toHaveValue('Keep my edit');
  });
  it('prevents capacity below occupied places from sending an update', () => {
    const onSubmit = vi.fn();
    form({ occupied: 6, onSubmit });
    submit();
    expect(screen.getByText("Capacity can't be lower than the 6 places already taken.")).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('prevents duplicate saves while a request remains pending', async () => {
    const onSubmit = vi.fn(() => new Promise(() => {}));
    form({ onSubmit });
    submit();
    fireEvent.submit(screen.getByRole('button', { name: 'Saving…' }).closest('form'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });
  it('resets area when governorate changes and resets capacity when the sport changes', () => {
    form();
    fireEvent.change(screen.getByLabelText('Governorate'), { target: { value: 'southern' } });
    expect(screen.getByLabelText('Area')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Sport'), { target: { value: '2' } });
    expect(screen.getByLabelText('Capacity (players)')).toHaveValue(null);
    expect(screen.getByLabelText('Distance (km)')).toBeVisible();
  });
  it('leaves descriptive controls editable during the frozen window and omits frozen fields', async () => {
    const onSubmit = vi.fn().mockResolvedValue(null);
    form({ room: { ...room, starts_at: new Date(now + 15 * 60_000).toISOString() }, onSubmit });
    expect(screen.getByLabelText('Sport')).toBeDisabled();
    expect(screen.getByLabelText('Starts (Bahrain time)')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Clear pin' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Updated title' } });
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ title: 'Updated title', revision: 3 });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('venue_location');
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('capacity');
  });
});

describe('location picker and private map', () => {
  it('rounds a valid pin to six decimals and ignores coordinates outside the Bahrain bounds', () => {
    const onChange = vi.fn();
    render(<LocationPicker value={null} onChange={onChange} />);
    act(() => map.handlers.click({ latlng: { lat: 26.123456789, lng: 50.654321987 } }));
    expect(onChange).toHaveBeenCalledWith({ latitude: 26.123457, longitude: 50.654322 });
    act(() => map.handlers.click({ latlng: { lat: 27, lng: 50.6 } }));
    expect(onChange).toHaveBeenCalledOnce();
  });
  it.each([[25.5, 50.3], [26.4, 50.9]])('accepts the inclusive map boundary %s %s', (lat, lng) => {
    const onChange = vi.fn();
    render(<LocationPicker value={null} onChange={onChange} />);
    act(() => map.handlers.click({ latlng: { lat, lng } }));
    expect(onChange).toHaveBeenCalledWith({ latitude: lat, longitude: lng });
  });
  it('provides no mutation controls or click subscription when frozen', () => {
    render(<LocationPicker value={room.venue_location} onChange={vi.fn()} disabled />);
    expect(map.handlers).toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Venue pin')).toHaveTextContent('26.2,50.6');
  });
  it('shows a read-only location with a usable coordinate link', () => {
    render(<LocationView location={room.venue_location} />);
    expect(screen.getByRole('link', { name: 'Open in OpenStreetMap' })).toHaveAttribute('href', 'https://www.openstreetmap.org/?mlat=26.2&mlon=50.6#map=17/26.2/50.6');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(map.handlers).toBeNull();
  });
});

describe('new deployed sports with no room format presets', () => {
  it.each(addedSports)('uses null formats and appropriate outdoor metadata for $name', sport => {
    expect(sportFormats(sport)).toEqual([]);
    expect(isOutdoorSport(sport)).toBe(sport.outdoor);
    expect(sportFormats({ ...sport, formats: undefined })).toEqual([]);
  });
  it.each(addedSports)('edits and submits $name with numeric capacity and its supported optional fields', async sport => {
    const onSubmit = vi.fn().mockResolvedValue(null);
    form({ sports: addedSports, room: { ...room, sport_id: sport.id, capacity: 8, distance_km: 5.5, pace_notes: ' Easy pace ', route_notes: ' Coast route ' }, onSubmit });
    expect(screen.getByLabelText('Capacity (players)')).toHaveValue(8);
    expect(screen.queryByLabelText('Format')).not.toBeInTheDocument();
    for (const candidate of addedSports) expect(screen.getByRole('option', { name: candidate.name })).toHaveValue(String(candidate.id));
    if (sport.outdoor) {
      expect(screen.getByLabelText('Distance (km)')).toHaveValue(5.5);
      expect(screen.getByLabelText('Pace notes')).toHaveValue(' Easy pace ');
      expect(screen.getByLabelText('Route notes')).toHaveValue(' Coast route ');
    } else {
      expect(screen.queryByLabelText('Distance (km)')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Pace notes')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Route notes')).not.toBeInTheDocument();
    }
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const body = onSubmit.mock.calls[0][0];
    expect(body).toMatchObject({ sport_id: sport.id, capacity: 8, revision: 3 });
    if (sport.outdoor) expect(body).toMatchObject({ distance_km: 5.5, pace_notes: 'Easy pace', route_notes: 'Coast route' });
    else for (const key of ['distance_km', 'pace_notes', 'route_notes']) expect(body).not.toHaveProperty(key);
    expect(body).not.toHaveProperty('formats');
  });
});

describe('room cancellation review', () => {
  it('rejects an empty reason before opening a confirmation or cancelling', () => {
    const onConfirm = vi.fn();
    render(<CancelRoomForm title={room.title} onConfirm={onConfirm} pending={false} />);
    fireEvent.change(screen.getByLabelText('Cancellation reason'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel room' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Write a reason');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it('retains the typed reason when the user keeps the room or dismisses review', () => {
    const onConfirm = vi.fn();
    render(<CancelRoomForm title={room.title} onConfirm={onConfirm} pending={false} />);
    fireEvent.change(screen.getByLabelText('Cancellation reason'), { target: { value: ' Weather ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel room' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Reason: Weather');
    fireEvent.click(screen.getByRole('button', { name: 'Keep the room' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Cancellation reason')).toHaveValue(' Weather ');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel room' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it('sends only a trimmed confirmed reason and keeps the dialog open during a pending cancellation', () => {
    const onConfirm = vi.fn();
    const view = render(<CancelRoomForm title={room.title} onConfirm={onConfirm} pending={false} />);
    fireEvent.change(screen.getByLabelText('Cancellation reason'), { target: { value: '  Bad weather  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel room' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel room' }));
    expect(onConfirm).toHaveBeenCalledWith('Bad weather');
    view.rerender(<CancelRoomForm title={room.title} onConfirm={onConfirm} pending />);
    expect(screen.getByRole('button', { name: 'Cancelling…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep the room' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
