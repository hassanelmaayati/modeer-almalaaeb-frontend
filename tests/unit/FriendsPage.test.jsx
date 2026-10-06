import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ME = 1;
const row = (id, userId, otherUserId, status, extra = {}) => ({
  id,
  user_id: userId,
  other_user_id: otherUserId,
  status,
  requested: true,
  accepted: status === 'accepted',
  user_blocked_other: null,
  other_blocked_user: null,
  ...extra,
});
const users = [
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id, user_name: `Player${id}` })),
  { id: 9, user_name: 'Sara' },
  { id: 10, user_name: 'Omar' },
  { id: 11, user_name: 'Sarah Ali' },
];

const list = vi.fn();
const update = vi.fn();
const create = vi.fn();
vi.mock('../../src/services/friendService', () => ({
  default: { list: (...args) => list(...args), update: (...args) => update(...args), create: (...args) => create(...args) },
}));
vi.mock('../../src/services/userService', () => ({ default: { list: async () => users } }));
let socketHandler = null;
vi.mock('../../src/services/websocketService', () => ({
  listen: (callback) => {
    socketHandler = callback;
    return () => { socketHandler = null; };
  },
}));
const { default: FriendsPage } = await import('../../src/pages/FriendsPage');

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

const mount = (start = '/friends') => render(
  <MemoryRouter initialEntries={[start]}>
    <Routes>
      <Route path="/friends" element={<><FriendsPage session={{ user: { id: ME }, loading: false }} /><Where /></>} />
    </Routes>
  </MemoryRouter>,
);

const people = () => [...document.querySelectorAll('li.panel')].map((item) => ({
  name: item.querySelector('a').textContent,
  label: item.querySelector('.status-badge').textContent,
  actions: [...item.querySelectorAll('.button-row > a, .button-row > button')].map((control) => control.textContent),
}));
const tabLinks = () => [...screen.getByRole('navigation', { name: 'Friend lists' }).querySelectorAll('a')].map((link) => link.textContent);
const currentTab = () => screen.getByRole('navigation', { name: 'Friend lists' }).querySelector('[aria-current="page"]').textContent;
const rowFor = (name) => screen.getByRole('link', { name }).closest('li');
const inRow = (name, button) => rowFor(name).querySelectorAll('button, a').values().find((control) => control.textContent === button);

beforeEach(() => {
  list.mockReset();
  update.mockReset();
  create.mockReset();
  list.mockResolvedValue([
    row(1, ME, 2, 'accepted'),
    row(2, 3, ME, 'accepted'),
    row(3, 4, ME, 'pending'),
    row(4, 5, ME, 'pending'),
    row(5, ME, 6, 'pending'),
    row(6, ME, 7, 'declined'),
    row(7, ME, 8, 'accepted', { user_blocked_other: 'true' }),
  ]);
});

describe('Friends page lists', () => {
  it('opens on the friends tab and shows the counts of every tab', async () => {
    mount();
    await screen.findByText('Player2');
    expect(tabLinks()).toEqual(['Friends (2)', 'Requests (2)', 'Sent (1)', 'Blocked (1)']);
    expect(currentTab()).toBe('Friends (2)');
    expect(people().map((person) => [person.name, person.label])).toEqual([['Player2', 'Friend'], ['Player3', 'Friend']]);
  });

  it('links each person to their profile', async () => {
    mount();
    await screen.findByText('Player2');
    expect(screen.getByRole('link', { name: 'Player2' })).toHaveAttribute('href', '/users/2');
    expect(screen.getByRole('link', { name: 'Player3' })).toHaveAttribute('href', '/users/3');
  });

  it('shows received requests, sent requests and blocked people on their own tabs', async () => {
    mount();
    await screen.findByText('Player2');
    const expectations = [
      ['Requests (2)', '/friends?tab=requests', [['Player4', 'Wants to be your friend'], ['Player5', 'Wants to be your friend']]],
      ['Sent (1)', '/friends?tab=sent', [['Player6', 'Waiting for a reply']]],
      ['Blocked (1)', '/friends?tab=blocked', [['Player8', 'Blocked']]],
      ['Friends (2)', '/friends', [['Player2', 'Friend'], ['Player3', 'Friend']]],
    ];
    for (const [tab, path, expected] of expectations) {
      await userEvent.click(screen.getByRole('link', { name: tab }));
      expect(screen.getByTestId('where')).toHaveTextContent(path);
      expect(people().map((person) => [person.name, person.label])).toEqual(expected);
      expect(currentTab()).toBe(tab);
    }
  });

  it('keeps declined and left records out of every list', async () => {
    mount();
    await screen.findByText('Player2');
    expect(screen.queryByText('Player7')).not.toBeInTheDocument();
  });

  it('falls back to the friends tab for an unknown tab in the URL', async () => {
    mount('/friends?tab=nonsense');
    await screen.findByText('Player2');
    expect(currentTab()).toBe('Friends (2)');
  });

  it('shows a message for each empty tab', async () => {
    list.mockResolvedValue([]);
    const cases = [
      ['/friends', 'No friends yet'],
      ['/friends?tab=requests', 'No friend requests'],
      ['/friends?tab=sent', 'No sent requests'],
      ['/friends?tab=blocked', 'No blocked people'],
    ];
    for (const [path, title] of cases) {
      const { unmount } = mount(path);
      await screen.findByRole('heading', { name: title });
      unmount();
    }
  });

  it('shows a failed request with a retry button', async () => {
    list.mockRejectedValueOnce(new Error('Unable to reach the server. Please try again.'));
    mount();
    await screen.findByText('Unable to reach the server. Please try again.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Player2');
  });

  it('names a person who is missing from the users list', async () => {
    list.mockResolvedValue([row(1, ME, 99, 'accepted')]);
    mount();
    await screen.findByText('Player 99');
  });
});

describe('Friends page actions', () => {
  it('offers the right buttons on each tab', async () => {
    mount();
    await screen.findByText('Player2');
    expect(people()[0].actions).toEqual(['Message', 'Unfriend', 'Block']);
    await userEvent.click(screen.getByRole('link', { name: 'Requests (2)' }));
    expect(people()[0].actions).toEqual(['Accept', 'Decline']);
    await userEvent.click(screen.getByRole('link', { name: 'Sent (1)' }));
    expect(people()[0].actions).toEqual(['Cancel request']);
    await userEvent.click(screen.getByRole('link', { name: 'Blocked (1)' }));
    expect(people()[0].actions).toEqual(['Unblock']);
  });

  it('links Message to the direct chat with that friend', async () => {
    mount();
    await screen.findByText('Player2');
    expect(inRow('Player2', 'Message')).toHaveAttribute('href', '/messages/direct/2');
  });

  it('accepts a request straight away and moves the person to the friends tab', async () => {
    update.mockResolvedValue(row(3, 4, ME, 'accepted'));
    mount('/friends?tab=requests');
    await screen.findByText('Player4');
    await userEvent.click(inRow('Player4', 'Accept'));
    expect(update).toHaveBeenCalledWith(4, { status: 'accepted' });
    await screen.findByRole('link', { name: 'Requests (1)' });
    expect(tabLinks()).toEqual(['Friends (3)', 'Requests (1)', 'Sent (1)', 'Blocked (1)']);
    expect(screen.queryByText('Player4')).not.toBeInTheDocument();
  });

  it('unblocks straight away with the flag that belongs to the user', async () => {
    update.mockResolvedValue(row(7, ME, 8, 'accepted', { user_blocked_other: 'false' }));
    mount('/friends?tab=blocked');
    await screen.findByText('Player8');
    await userEvent.click(inRow('Player8', 'Unblock'));
    expect(update).toHaveBeenCalledWith(8, { user_blocked_other: 'false' });
    await screen.findByRole('link', { name: 'Blocked (0)' });
    expect(tabLinks()[0]).toBe('Friends (3)');
  });

  it('asks before unfriending and unfriends only after confirmation', async () => {
    update.mockResolvedValue(row(1, ME, 2, 'left'));
    mount();
    await screen.findByText('Player2');
    await userEvent.click(inRow('Player2', 'Unfriend'));
    const dialog = screen.getByRole('dialog', { name: 'Unfriend Player2?' });
    expect(dialog).toHaveTextContent('Neither of you can send a new friend request afterwards.');
    expect(update).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, unfriend' }));
    expect(update).toHaveBeenCalledWith(2, { status: 'left' });
    await screen.findByRole('link', { name: 'Friends (1)' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Player2')).not.toBeInTheDocument();
  });

  it('blocks after confirmation, using the receiver flag when the other person sent the request', async () => {
    update.mockResolvedValue(row(2, 3, ME, 'accepted', { other_blocked_user: 'true' }));
    mount();
    await screen.findByText('Player3');
    await userEvent.click(inRow('Player3', 'Block'));
    expect(screen.getByRole('dialog', { name: 'Block Player3?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, block' }));
    expect(update).toHaveBeenCalledWith(3, { other_blocked_user: 'true' });
    await screen.findByRole('link', { name: 'Blocked (2)' });
  });

  it('declines a request and cancels a sent request only after confirmation', async () => {
    update.mockResolvedValueOnce(row(3, 4, ME, 'declined')).mockResolvedValueOnce(row(5, ME, 6, 'left'));
    mount('/friends?tab=requests');
    await screen.findByText('Player4');
    await userEvent.click(inRow('Player4', 'Decline'));
    expect(screen.getByRole('dialog', { name: 'Decline the request from Player4?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, decline' }));
    expect(update).toHaveBeenLastCalledWith(4, { status: 'declined' });
    await screen.findByRole('link', { name: 'Requests (1)' });
    await userEvent.click(screen.getByRole('link', { name: 'Sent (1)' }));
    await userEvent.click(inRow('Player6', 'Cancel request'));
    expect(screen.getByRole('dialog', { name: 'Cancel your request to Player6?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel request' }));
    expect(update).toHaveBeenLastCalledWith(6, { status: 'left' });
    await screen.findByRole('link', { name: 'Sent (0)' });
  });

  it('does nothing when the user goes back from a confirmation', async () => {
    mount();
    await screen.findByText('Player2');
    await userEvent.click(inRow('Player2', 'Block'));
    await userEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    expect(tabLinks()[0]).toBe('Friends (2)');
  });

  it('shows the backend message and keeps the list when an update fails', async () => {
    update.mockRejectedValue(new Error('This friendship transition is not allowed'));
    mount('/friends?tab=requests');
    await screen.findByText('Player4');
    await userEvent.click(inRow('Player4', 'Accept'));
    expect(await screen.findByRole('alert')).toHaveTextContent('This friendship transition is not allowed');
    expect(tabLinks()[1]).toBe('Requests (2)');
    expect(screen.getByText('Player4')).toBeInTheDocument();
  });

  it('keeps the confirmation open and the buttons disabled while the update is sent', async () => {
    let finish;
    update.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    mount();
    await screen.findByText('Player2');
    await userEvent.click(inRow('Player2', 'Unfriend'));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, unfriend' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go back' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(inRow('Player3', 'Block')).toBeDisabled();
    finish(row(1, ME, 2, 'left'));
    await screen.findByRole('link', { name: 'Friends (1)' });
  });
});

describe('Adding a friend', () => {
  const search = () => screen.getByLabelText('Search people');
  const section = () => screen.getByRole('region', { name: 'Add a friend' });
  const resultNames = () => [...section().querySelectorAll('li span')].map((span) => span.textContent);
  const type = async (text) => { await userEvent.clear(search()); await userEvent.type(search(), text); };

  it('lists nobody until the user types', async () => {
    mount();
    await screen.findByText('Player2');
    expect(resultNames()).toEqual([]);
    expect(section()).not.toHaveTextContent('No people found');
  });

  it('finds people by part of their name in any letter case', async () => {
    mount();
    await screen.findByText('Player2');
    await type('sara');
    expect(resultNames()).toEqual(['Sara', 'Sarah Ali']);
    await type('OMAR');
    expect(resultNames()).toEqual(['Omar']);
  });

  it('never offers yourself or people who already have a friend record, even a declined one', async () => {
    mount();
    await screen.findByText('Player2');
    await type('player');
    expect(resultNames()).toEqual([]);
    expect(section()).toHaveTextContent('No people found');
  });

  it('shows at most eight matches', async () => {
    list.mockResolvedValue([]);
    const many = Array.from({ length: 12 }, (_, index) => ({ id: 100 + index, user_name: `Match${index}` }));
    users.push(...many);
    mount();
    await screen.findByText('No friends yet');
    await type('match');
    expect(resultNames()).toHaveLength(8);
    users.splice(users.length - many.length, many.length);
  });

  it('sends the request, confirms it, lists it under Sent and stops offering the person', async () => {
    create.mockResolvedValue(row(20, ME, 9, 'pending'));
    mount();
    await screen.findByText('Player2');
    await type('sara');
    await userEvent.click(within(section()).getAllByRole('button', { name: 'Add friend' })[0]);
    expect(create).toHaveBeenCalledWith({ other_user_id: 9 });
    expect(await screen.findByRole('status')).toHaveTextContent('Friend request sent to Sara.');
    expect(tabLinks()).toEqual(['Friends (2)', 'Requests (2)', 'Sent (2)', 'Blocked (1)']);
    expect(search()).toHaveValue('');
    await type('sara');
    expect(resultNames()).toEqual(['Sarah Ali']);
    await userEvent.click(screen.getByRole('link', { name: 'Sent (2)' }));
    expect(people().map((person) => person.name)).toEqual(['Player6', 'Sara']);
  });

  it('explains a refusal because a record already exists and reloads the list', async () => {
    create.mockRejectedValue(Object.assign(new Error('Friendship already exists'), { status: 409 }));
    mount();
    await screen.findByText('Player2');
    await type('omar');
    const lists = list.mock.calls.length;
    await userEvent.click(within(section()).getByRole('button', { name: 'Add friend' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("You already have a friend record with this person. A new request can't be sent after one was declined, cancelled or the friendship ended.");
    await screen.findByText('Player2');
    expect(list.mock.calls.length).toBe(lists + 1);
  });

  it('shows the backend message for any other failure and keeps the search', async () => {
    create.mockRejectedValue(new Error('Unable to reach the server. Please try again.'));
    mount();
    await screen.findByText('Player2');
    await type('omar');
    await userEvent.click(within(section()).getByRole('button', { name: 'Add friend' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the server. Please try again.');
    expect(search()).toHaveValue('omar');
    expect(resultNames()).toEqual(['Omar']);
  });
});

describe('Friends page live updates', () => {
  const send = (event) => act(async () => { socketHandler(event); });

  it('refreshes the lists when a friendship changes, without a loading flash', async () => {
    mount();
    await screen.findByText('Player2');
    const calls = list.mock.calls.length;
    list.mockResolvedValue([row(1, ME, 2, 'accepted'), row(2, 9, ME, 'pending')]);
    await send({ type: 'friend.updated', direct_id: 9 });
    await screen.findByRole('link', { name: 'Requests (1)' });
    expect(list.mock.calls.length).toBe(calls + 1);
    expect(tabLinks()).toEqual(['Friends (1)', 'Requests (1)', 'Sent (0)', 'Blocked (0)']);
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('shows the name of a person who sent a request while the page was open', async () => {
    mount('/friends?tab=requests');
    await screen.findByText('Player4');
    list.mockResolvedValue([row(1, 11, ME, 'pending')]);
    await send({ type: 'friend.updated', direct_id: 11 });
    await screen.findByText('Sarah Ali');
  });

  it('refreshes after the connection comes back', async () => {
    mount();
    await screen.findByText('Player2');
    const calls = list.mock.calls.length;
    await send({ type: 'connection.ready' });
    await screen.findByText('Player2');
    expect(list.mock.calls.length).toBe(calls + 1);
  });

  it('ignores events that are not about friends', async () => {
    mount();
    await screen.findByText('Player2');
    const calls = list.mock.calls.length;
    for (const event of [{ type: 'room.updated', room_id: 1 }, { type: 'message.created', message: { id: 1 } }, { type: 'room_created', room: { id: 2 } }, { type: 'lobby.ready' }, { type: 'notification.created' }]) await send(event);
    expect(list.mock.calls.length).toBe(calls);
  });

  it('keeps the current lists when the refresh fails', async () => {
    mount();
    await screen.findByText('Player2');
    list.mockRejectedValue(new Error('Unable to reach the server.'));
    await send({ type: 'friend.updated', direct_id: 2 });
    expect(screen.getByText('Player2')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Friends page empty states', () => {
  it('offers to find people on an empty friends tab and moves the focus to the search', async () => {
    list.mockResolvedValue([]);
    mount();
    await screen.findByRole('heading', { name: 'No friends yet' });
    await userEvent.click(screen.getByRole('button', { name: 'Find people to add' }));
    expect(screen.getByLabelText('Search people')).toHaveFocus();
  });

  it('offers the same on an empty sent tab', async () => {
    list.mockResolvedValue([]);
    mount('/friends?tab=sent');
    await screen.findByRole('heading', { name: 'No sent requests' });
    await userEvent.click(screen.getByRole('button', { name: 'Find people to add' }));
    expect(screen.getByLabelText('Search people')).toHaveFocus();
  });

  it('has no button on the empty requests and blocked tabs', async () => {
    list.mockResolvedValue([]);
    for (const [path, title] of [['/friends?tab=requests', 'No friend requests'], ['/friends?tab=blocked', 'No blocked people']]) {
      const { unmount } = mount(path);
      await screen.findByRole('heading', { name: title });
      expect(screen.queryByRole('button', { name: 'Find people to add' })).not.toBeInTheDocument();
      unmount();
    }
  });

  it('says nobody is left to add and disables the search when there is nobody to offer', async () => {
    const everyone = users.splice(8, 3);
    list.mockResolvedValue([]);
    users.splice(1, users.length - 1);
    mount();
    await screen.findByRole('heading', { name: 'No friends yet' });
    expect(screen.getByRole('region', { name: 'Add a friend' })).toHaveTextContent('There is nobody left to add.');
    expect(screen.getByLabelText('Search people')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Find people to add' })).not.toBeInTheDocument();
    users.splice(0, users.length, ...[1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id, user_name: `Player${id}` })), ...everyone);
  });
});
