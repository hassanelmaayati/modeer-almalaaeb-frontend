import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ME = 1;
const hoursAgo = (hours) => new Date(Date.now() - hours * 3600e3).toISOString();
const message = (id, extra = {}) => ({
  id,
  sender_id: 7,
  recipient_id: null,
  room_id: 4,
  group_id: null,
  type: 'room',
  body: `Message ${id}`,
  client_request_id: null,
  created_at: hoursAgo(1),
  ...extra,
});
const users = [{ id: 1, user_name: 'Me' }, { id: 7, user_name: 'Layla' }, { id: 8, user_name: 'Sara' }];
const conversationList = () => [
  { type: 'room', room_id: 4, title: 'Sunday run', last_message: message(60, { body: 'See you at 6' }) },
  { type: 'group', group_id: 2, title: 'Runners', last_message: message(40, { group_id: 2, room_id: null, type: 'group' }) },
  { type: 'direct', user_id: 8, title: 'Sara', last_message: message(70, { sender_id: 8, recipient_id: ME, room_id: null, type: 'direct' }) },
];

const list = vi.fn();
const conversations = vi.fn();
vi.mock('../../src/services/messageService', () => ({
  default: {
    conversations: (...args) => conversations(...args),
    list: (...args) => list(...args),
    targetQuery: ({ type, id }) => ({ [type === 'direct' ? 'user_id' : `${type}_id`]: Number(id) }),
  },
}));
vi.mock('../../src/services/userService', () => ({ default: { list: async () => users } }));
vi.mock('../../src/services/websocketService', () => ({
  listen: () => () => {},
  mergeMessages: (existing, incoming) => {
    const merged = new Map(existing.map((item) => [item.id, item]));
    for (const item of incoming) merged.set(item.id, item);
    return [...merged.values()].sort((first, second) => first.id - second.id);
  },
}));
const { default: MessagesPage } = await import('../../src/pages/MessagesPage');

const mount = (start) => render(
  <MemoryRouter initialEntries={[start]}>
    <Routes>
      <Route path="/messages" element={<MessagesPage session={{ user: { id: ME } }} />} />
      <Route path="/messages/:type/:id" element={<MessagesPage session={{ user: { id: ME } }} />} />
    </Routes>
  </MemoryRouter>,
);

const thread = () => screen.getByRole('region', { name: 'Open chat' });
const bubbles = () => [...thread().querySelectorAll('.message')].map((item) => ({
  body: item.querySelector('.message-body').textContent,
  sender: item.querySelector('.message-sender')?.textContent ?? null,
  own: item.classList.contains('is-own'),
  system: item.classList.contains('message-system'),
  time: item.querySelector('.message-time').textContent,
}));
const dividers = () => [...thread().querySelectorAll('.day-divider')].map((item) => item.textContent);

beforeEach(() => {
  conversations.mockReset();
  conversations.mockResolvedValue(conversationList());
  list.mockReset();
  list.mockResolvedValue([]);
});

describe('Chat thread', () => {
  it('asks for the latest 50 messages of the open chat', async () => {
    list.mockResolvedValue([message(2), message(1)]);
    mount('/messages/room/4');
    await screen.findByText('Message 1');
    expect(list).toHaveBeenCalledWith({ room_id: 4, limit: 50 }, expect.anything());
  });

  it('shows messages oldest first although the backend sends the newest first', async () => {
    list.mockResolvedValue([message(3), message(2), message(1)]);
    mount('/messages/room/4');
    await screen.findByText('Message 1');
    expect(bubbles().map((item) => item.body)).toEqual(['Message 1', 'Message 2', 'Message 3']);
  });

  it('puts your own messages on your side and names everyone else in a room', async () => {
    list.mockResolvedValue([message(2, { sender_id: ME, body: 'Mine' }), message(1, { sender_id: 7, body: 'Theirs' })]);
    mount('/messages/room/4');
    await screen.findByText('Theirs');
    const [theirs, mine] = bubbles();
    expect(theirs).toMatchObject({ body: 'Theirs', sender: 'Layla', own: false });
    expect(mine).toMatchObject({ body: 'Mine', sender: null, own: true });
  });

  it('names senders in a group too, but not in a direct chat', async () => {
    list.mockResolvedValue([message(1, { sender_id: 7, group_id: 2, room_id: null, type: 'group', body: 'Group hello' })]);
    const group = mount('/messages/group/2');
    await screen.findByText('Group hello');
    expect(bubbles()[0].sender).toBe('Layla');
    group.unmount();
    list.mockResolvedValue([message(2, { sender_id: 8, recipient_id: ME, room_id: null, type: 'direct', body: 'Direct hello' })]);
    mount('/messages/direct/8');
    await screen.findByText('Direct hello');
    expect(bubbles()[0]).toMatchObject({ sender: null, own: false });
  });

  it('shows system messages apart, with no sender', async () => {
    list.mockResolvedValue([message(2, { sender_id: null, type: 'system', body: 'Room cancelled: Rain' }), message(1)]);
    mount('/messages/room/4');
    await screen.findByText('Room cancelled: Rain');
    expect(bubbles()[1]).toMatchObject({ body: 'Room cancelled: Rain', system: true, sender: null });
    expect(bubbles()[0].system).toBe(false);
  });

  it('shows text as text, never as HTML, and keeps line breaks', async () => {
    list.mockResolvedValue([message(1, { body: '<b>bold</b> <img src=x onerror=alert(1)>\nsecond line' })]);
    mount('/messages/room/4');
    await screen.findByText(/second line/);
    expect(thread().querySelector('b')).toBeNull();
    expect(thread().querySelector('img')).toBeNull();
    expect(bubbles()[0].body).toBe('<b>bold</b> <img src=x onerror=alert(1)>\nsecond line');
  });

  it('shows a time on each message and a divider for each day', async () => {
    list.mockResolvedValue([message(3, { created_at: hoursAgo(0.1) }), message(2, { created_at: '2024-01-05T10:00:00+03:00' }), message(1, { created_at: '2024-01-04T09:30:00+03:00' })]);
    mount('/messages/room/4');
    await screen.findByText('Message 1');
    expect(dividers()).toEqual(['4 Jan 2024', '5 Jan 2024', 'Today']);
    expect(bubbles().map((item) => item.time).slice(0, 2)).toEqual(['09:30', '10:00']);
    expect(bubbles()[2].time).toMatch(/^\d\d:\d\d$/);
  });

  it('says when a chat has no messages yet', async () => {
    mount('/messages/room/4');
    await screen.findByRole('heading', { name: 'No messages yet' });
  });

  it('shows a loading state, then the messages', async () => {
    list.mockResolvedValue([message(1)]);
    mount('/messages/room/4');
    expect(within(thread()).getByText('Loading…')).toBeInTheDocument();
    await screen.findByText('Message 1');
    expect(within(thread()).queryByText('Loading…')).not.toBeInTheDocument();
  });
});

describe('Chat header', () => {
  it('shows the chat title from the inbox and its type, with a link to the room', async () => {
    mount('/messages/room/4');
    await screen.findByRole('heading', { name: 'Sunday run' });
    expect(within(thread()).getByText('Room chat')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View room' })).toHaveAttribute('href', '/rooms/4');
  });

  it('links a group chat to the group and a direct chat to the profile', async () => {
    const group = mount('/messages/group/2');
    await screen.findByRole('heading', { name: 'Runners' });
    expect(screen.getByRole('link', { name: 'View group' })).toHaveAttribute('href', '/groups?group_id=2');
    group.unmount();
    mount('/messages/direct/8');
    await screen.findByRole('heading', { name: 'Sara' });
    expect(screen.getByRole('link', { name: 'View profile' })).toHaveAttribute('href', '/users/8');
  });

  it('names a direct chat from the users list when it is not in the inbox', async () => {
    conversations.mockResolvedValue([]);
    mount('/messages/direct/7');
    await screen.findByRole('heading', { name: 'Layla' });
  });
});

describe('Earlier messages', () => {
  const page = (from, to) => Array.from({ length: from - to + 1 }, (_, index) => message(from - index));

  it('offers to load earlier messages only when a full page came back', async () => {
    list.mockResolvedValue(page(60, 11));
    mount('/messages/room/4');
    await screen.findByText('Message 60');
    expect(screen.getByRole('button', { name: 'Load earlier messages' })).toBeInTheDocument();
  });

  it('does not offer it for a short page', async () => {
    list.mockResolvedValue(page(5, 1));
    mount('/messages/room/4');
    await screen.findByText('Message 5');
    expect(screen.queryByRole('button', { name: 'Load earlier messages' })).not.toBeInTheDocument();
  });

  it('loads the page before the oldest message and puts it first', async () => {
    list.mockResolvedValueOnce(page(60, 11)).mockResolvedValueOnce(page(10, 1));
    mount('/messages/room/4');
    await screen.findByText('Message 60');
    await userEvent.click(screen.getByRole('button', { name: 'Load earlier messages' }));
    await screen.findByText('Message 1');
    expect(list).toHaveBeenLastCalledWith({ room_id: 4, before: 11, limit: 50 });
    expect(bubbles()).toHaveLength(60);
    expect(bubbles()[0].body).toBe('Message 1');
    expect(bubbles().at(-1).body).toBe('Message 60');
    expect(screen.queryByRole('button', { name: 'Load earlier messages' })).not.toBeInTheDocument();
  });

  it('keeps going while full pages come back', async () => {
    list.mockResolvedValueOnce(page(150, 101)).mockResolvedValueOnce(page(100, 51)).mockResolvedValueOnce(page(50, 1));
    mount('/messages/room/4');
    await screen.findByText('Message 150');
    await userEvent.click(screen.getByRole('button', { name: 'Load earlier messages' }));
    await screen.findByText('Message 51');
    expect(screen.getByRole('button', { name: 'Load earlier messages' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load earlier messages' }));
    await screen.findByText('Message 1');
    expect(list).toHaveBeenLastCalledWith({ room_id: 4, before: 51, limit: 50 });
    expect(bubbles()).toHaveLength(150);
  });

  it('shows a failure to load earlier messages and keeps what is there', async () => {
    list.mockResolvedValueOnce(page(60, 11)).mockRejectedValueOnce(new Error('Unable to reach the server.'));
    mount('/messages/room/4');
    await screen.findByText('Message 60');
    await userEvent.click(screen.getByRole('button', { name: 'Load earlier messages' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the server.');
    expect(bubbles()).toHaveLength(50);
    expect(screen.getByRole('button', { name: 'Load earlier messages' })).toBeEnabled();
  });
});

describe('Chat thread errors', () => {
  const failure = (status, text) => Object.assign(new Error(text), { status });

  it("says the user has no access, with no retry", async () => {
    list.mockRejectedValue(failure(403, 'You do not have access to this chat'));
    mount('/messages/room/4');
    await screen.findByText("You don't have access to this chat.");
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to your chats' })).toHaveAttribute('href', '/messages');
  });

  it('says a chat no longer exists, with no retry', async () => {
    list.mockRejectedValue(failure(404, 'Room not found'));
    mount('/messages/room/4');
    await screen.findByText('This chat no longer exists.');
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('shows other failures with a retry', async () => {
    list.mockRejectedValueOnce(failure(0, 'Unable to reach the server. Please try again.'));
    list.mockResolvedValueOnce([message(1)]);
    mount('/messages/room/4');
    await screen.findByText('Unable to reach the server. Please try again.');
    await userEvent.click(within(thread()).getByRole('button', { name: 'Try again' }));
    await screen.findByText('Message 1');
  });
});

describe('Switching chats', () => {
  it('loads the other chat and drops the messages of the first', async () => {
    list.mockImplementation(async (query) => (query.room_id ? [message(1, { body: 'In the room' })] : [message(2, { sender_id: 8, recipient_id: ME, room_id: null, type: 'direct', body: 'In the direct chat' })]));
    mount('/messages/room/4');
    await screen.findByText('In the room');
    await userEvent.click(screen.getByRole('link', { name: /Sara/ }));
    await screen.findByText('In the direct chat');
    expect(screen.queryByText('In the room')).not.toBeInTheDocument();
    expect(list).toHaveBeenLastCalledWith({ user_id: 8, limit: 50 }, expect.anything());
  });
});
