import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StarPicker from '../../src/components/common/StarPicker';
import AttendanceRatingSummary from '../../src/components/ratings/AttendanceRatingSummary';
import RatePlayers from '../../src/components/ratings/RatePlayers';
import RoomPage from '../../src/pages/RoomPage';
import ProfilePage from '../../src/pages/ProfilePage';
import ratingService from '../../src/services/ratingService';
import { ratablePlayerIds } from '../../src/lib/helpers/ratings';

let room;
let members = [];
vi.mock('../../src/services/ratingService', () => ({ default: { give: vi.fn(), listMine: vi.fn(), getForUser: vi.fn() } }));
vi.mock('../../src/services/roomService', () => ({ default: { get: async () => room, cancel: vi.fn() } }));
vi.mock('../../src/services/roomMemberService', () => ({ default: { list: async () => members, request: vi.fn(), update: vi.fn(), invite: vi.fn(), leave: vi.fn() } }));
vi.mock('../../src/services/userService', () => ({ default: { listByIds: async (ids) => users.filter((user) => ids.includes(user.id)), get: async id => users.find(user => user.id === id) || { id: Number(id), user_name: 'Bob', created_at: '2030-01-01T00:00:00Z' } } }));
vi.mock('../../src/services/sportService', () => ({ default: { list: async () => [{ id: 1, name: 'Football' }] } }));
vi.mock('../../src/services/websocketService', () => ({ listen: () => () => {} }));

const users = [{ id: 7, user_name: 'Fatema' }, { id: 1, user_name: 'Alice' }, { id: 2, user_name: 'Bob' }, { id: 3, user_name: 'Carl' }];
const completed = { id: 5, host_id: 7, sport_id: 1, title: 'Friday match', description: null, notes: null, difficulty: 'beginners', starts_at: '2030-01-01T10:00:00Z', ends_at: '2030-01-01T11:00:00Z', capacity: 10, slots_left: 4, status: 'completed', visibility: 'public', admission_policy: 'approval', district: 'capital', area: 'Manama', revision: 1 };
const roster = [
  { id: 1, user_id: 1, room_id: 5, status: 'accepted', attendance: 'present' },
  { id: 2, user_id: 2, room_id: 5, status: 'accepted', attendance: 'present' },
  { id: 3, user_id: 3, room_id: 5, status: 'accepted', attendance: 'no_show' },
  { id: 4, user_id: 4, room_id: 5, status: 'pending', attendance: null },
];
const alice = { id: 1, user_name: 'Alice' };
const names = () => screen.getAllByRole('group').map(group => group.querySelector('legend').textContent);

beforeEach(() => {
  room = completed;
  members = roster;
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  ratingService.give.mockReset().mockImplementation(async (_room, body) => body);
  ratingService.listMine.mockReset().mockResolvedValue([]);
  ratingService.getForUser.mockReset().mockResolvedValue({ user_id: 2, average_rating: null, rating_count: 0 });
});

describe('StarPicker', () => {
  function Controlled(props) {
    const [value, setValue] = useState(0);
    return <StarPicker name="stars" label="Rating for Sara" value={value} onChange={setValue} {...props} />;
  }
  it('is a labelled group of five text-labelled radios using shapes, not colour, for the value', () => {
    render(<Controlled />);
    const group = screen.getByRole('group', { name: 'Rating for Sara' });
    expect(within(group).getAllByRole('radio').map(radio => radio.getAttribute('aria-label') || radio.closest('label').textContent.replace(/[★☆]/g, ''))).toEqual(['1 star', '2 stars', '3 stars', '4 stars', '5 stars']);
    fireEvent.click(screen.getByRole('radio', { name: '3 stars' }));
    expect(screen.getByRole('radio', { name: '3 stars' })).toBeChecked();
    expect(group.textContent.match(/★/g)).toHaveLength(3);
    expect(group.textContent.match(/☆/g)).toHaveLength(2);
  });
  it('can be operated with the keyboard alone', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.tab();
    expect(screen.getByRole('radio', { name: '1 star' })).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('radio', { name: '3 stars' })).toBeChecked();
  });
  it('shows a locked value that cannot be changed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StarPicker name="stars" label="Locked" value={4} onChange={onChange} disabled />);
    expect(screen.getByRole('radio', { name: '4 stars' })).toBeChecked();
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    // user-event behaves like a real user: disabled controls receive no clicks or key presses.
    await user.click(screen.getByRole('radio', { name: '2 stars' }));
    await user.keyboard('{Tab}{ArrowRight}');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: '4 stars' })).toBeChecked();
  });
});

describe('who may rate whom', () => {
  it('lists the host and other participants, without yourself, no-shows or people who never joined', () => {
    expect(ratablePlayerIds(completed, roster, 1)).toEqual([7, 2]);
  });
  it('does not list the host twice when the host also has a member row', () => {
    expect(ratablePlayerIds(completed, [...roster, { id: 9, user_id: 7, status: 'accepted' }], 1)).toEqual([7, 2]);
  });
  it('stays hidden unless the room is completed and you took part as a non-host', () => {
    expect(ratablePlayerIds({ ...completed, status: 'started' }, roster, 1)).toBeNull();
    expect(ratablePlayerIds({ ...completed, status: 'open' }, roster, 1)).toBeNull();
    expect(ratablePlayerIds(completed, roster, null)).toBeNull();
    expect(ratablePlayerIds(completed, roster, 7)).toBeNull();
    expect(ratablePlayerIds(completed, roster, 3)).toBeNull();
    expect(ratablePlayerIds(completed, roster, 4)).toBeNull();
    expect(ratablePlayerIds(completed, roster, 99)).toBeNull();
  });
});

describe('AttendanceRatingSummary', () => {
  it.each([[4.3, 12, '4.3', '12 ratings'], [4, 1, '4.0', '1 rating']])('shows %s average from %s ratings', async (average, count, number, label) => {
    ratingService.getForUser.mockResolvedValue({ user_id: 2, average_rating: average, rating_count: count });
    render(<AttendanceRatingSummary userId={2} />);
    expect(await screen.findByText(number, { exact: false })).toBeVisible();
    expect(screen.getByText(label, { exact: false })).toBeVisible();
    expect(screen.getByText('out of 5 stars', { exact: false })).toBeInTheDocument();
    expect(ratingService.getForUser).toHaveBeenCalledWith(2, expect.anything());
  });
  it('says there are no ratings yet instead of showing null', async () => {
    render(<AttendanceRatingSummary userId={2} />);
    expect(await screen.findByText('No ratings yet')).toBeVisible();
    expect(document.body).not.toHaveTextContent(/null|NaN/);
  });
  it('recovers from a failed load through Try again', async () => {
    ratingService.getForUser.mockRejectedValueOnce(new Error('Ratings unavailable')).mockResolvedValue({ user_id: 2, average_rating: 5, rating_count: 2 });
    render(<AttendanceRatingSummary userId={2} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Ratings unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('5.0', { exact: false })).toBeVisible();
  });
});

describe('RatePlayers', () => {
  const show = (props = {}) => render(<RatePlayers room={completed} members={roster} users={users} user={alice} {...props} />);

  it('lists the host and the other participants with a picker each', async () => {
    show();
    await screen.findByRole('group', { name: 'Rating for Fatema (host)' });
    expect(names()).toEqual(['Rating for Fatema (host)', 'Rating for Bob']);
    expect(screen.getByText('Ratings are final', { exact: false })).toBeVisible();
  });
  it.each([
    ['room is not completed', { room: { ...completed, status: 'started' } }],
    ['viewer is a guest', { user: null }],
    ['viewer is the host', { user: { id: 7 } }],
    ['viewer was a no-show', { user: { id: 3 } }],
    ['viewer never joined', { user: { id: 4 } }],
  ])('renders nothing and makes no request when the %s', (_name, props) => {
    const { container } = show(props);
    expect(container).toBeEmptyDOMElement();
    expect(ratingService.listMine).not.toHaveBeenCalled();
  });
  it('locks ratings already given and keeps the others open', async () => {
    ratingService.listMine.mockResolvedValue([{ user_id: 2, stars: 4 }]);
    show();
    expect(await screen.findByText('You rated Bob 4 out of 5. Ratings are final.')).toBeVisible();
    const bob = screen.getByRole('group', { name: 'Rating for Bob' });
    expect(within(bob).getByRole('radio', { name: '4 stars' })).toBeChecked();
    for (const radio of within(bob).getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Submit rating for Bob' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit rating for Fatema' })).toBeDisabled();
    expect(within(screen.getByRole('group', { name: 'Rating for Fatema (host)' })).getAllByRole('radio')[0]).toBeEnabled();
  });
  it('asks for confirmation and sends nothing when it is declined', async () => {
    window.confirm.mockReturnValue(false);
    show();
    const bob = await screen.findByRole('group', { name: 'Rating for Bob' });
    fireEvent.click(within(bob).getByRole('radio', { name: '3 stars' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit rating for Bob' }));
    expect(window.confirm).toHaveBeenCalledWith('Ratings are final. Give Bob 3 stars?');
    expect(ratingService.give).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Submit rating for Bob' })).toBeEnabled();
  });
  it('submits user_id and stars once confirmed, then locks that row only', async () => {
    show();
    const bob = await screen.findByRole('group', { name: 'Rating for Bob' });
    fireEvent.click(within(bob).getByRole('radio', { name: '1 star' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit rating for Bob' }));
    expect(window.confirm).toHaveBeenCalledWith('Ratings are final. Give Bob 1 star?');
    await waitFor(() => expect(ratingService.give).toHaveBeenCalledExactlyOnceWith(5, { user_id: 2, stars: 1 }));
    expect(await screen.findByText('You rated Bob 1 out of 5. Ratings are final.')).toBeVisible();
    for (const radio of within(bob).getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit rating for Fatema' })).toBeDisabled();
    expect(within(screen.getByRole('group', { name: 'Rating for Fatema (host)' })).getAllByRole('radio')[0]).toBeEnabled();
  });
  it('shows the backend detail on failure and leaves the row open to retry', async () => {
    ratingService.give.mockRejectedValue({ status: 403, message: 'You did not take part in this room' });
    show();
    const bob = await screen.findByRole('group', { name: 'Rating for Bob' });
    fireEvent.click(within(bob).getByRole('radio', { name: '5 stars' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit rating for Bob' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You did not take part in this room');
    expect(screen.getByRole('button', { name: 'Submit rating for Bob' })).toBeEnabled();
    expect(within(bob).getAllByRole('radio')[0]).toBeEnabled();
  });
  it('reloads your ratings after a 409 so an already-rated player locks, keeping the message', async () => {
    ratingService.give.mockRejectedValue({ status: 409, message: 'You already rated this player' });
    show();
    const bob = await screen.findByRole('group', { name: 'Rating for Bob' });
    ratingService.listMine.mockResolvedValue([{ user_id: 2, stars: 5 }]);
    fireEvent.click(within(bob).getByRole('radio', { name: '2 stars' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit rating for Bob' }));
    expect(await screen.findByText('You rated Bob 5 out of 5. Ratings are final.')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('You already rated this player');
    expect(ratingService.listMine).toHaveBeenCalledTimes(2);
  });
  it('explains a failed ratings load and retries on request', async () => {
    ratingService.listMine.mockRejectedValueOnce(new Error('Ratings unavailable')).mockResolvedValue([]);
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('Ratings unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('group', { name: 'Rating for Bob' })).toBeVisible();
  });
});

describe('pages', () => {
  const openRoom = session => render(<MemoryRouter initialEntries={['/rooms/5']}><Routes><Route path="/rooms/:roomId" element={<RoomPage session={session} />} /></Routes></MemoryRouter>);

  it('shows Rate players on a completed room to a participant', async () => {
    openRoom({ user: alice });
    expect(await screen.findByRole('heading', { name: 'Rate players' })).toBeVisible();
    expect(ratingService.listMine).toHaveBeenCalledWith(5, expect.anything());
  });
  it('does not show Rate players to the host, and a null host rating never renders as "null"', async () => {
    members = roster.map(member => ({ ...member, rating: null }));
    openRoom({ user: { id: 7 } });
    await screen.findByRole('heading', { name: 'Friday match' });
    expect(screen.queryByRole('heading', { name: 'Rate players' })).not.toBeInTheDocument();
    // The host rates only players who were present, with the same final, accessible star picker.
    expect(screen.getByRole('group', { name: 'Rating for Alice' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Rating for Bob' })).toBeVisible();
    expect(screen.queryByRole('group', { name: 'Rating for Carl' })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('null');
  });
  it('shows the public rating summary on a profile', async () => {
    ratingService.getForUser.mockResolvedValue({ user_id: 2, average_rating: 4.3, rating_count: 12 });
    render(<MemoryRouter initialEntries={['/users/2']}><Routes><Route path="/users/:userId" element={<ProfilePage session={{ user: { id: 1 } }} />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('12 ratings', { exact: false })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Player rating' })).toBeVisible();
    expect(ratingService.getForUser).toHaveBeenCalledWith(2, expect.anything());
  });
});
