import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { useLayoutEffect, useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useConversations from '../../src/lib/helpers/useConversations';

const ME = 1;
const recent = () => new Date().toISOString();
const message = (id, extra = {}) => ({ id, sender_id: 7, recipient_id: null, room_id: null, group_id: null, type: 'room', body: 'Hello', client_request_id: null, created_at: recent(), ...extra });

const baseConversations = () => [
  { type: 'room', room_id: 3, title: 'Friday game', last_message: message(50, { room_id: 3, sender_id: null, type: 'system', body: 'Room cancelled: Rain', created_at: '2024-01-05T10:00:00+03:00' }) },
  { type: 'room', room_id: 4, title: 'Sunday run', last_message: message(60, { room_id: 4, sender_id: 7, body: 'See you at 6' }) },
  { type: 'group', group_id: 2, title: 'Runners', last_message: message(40, { group_id: 2, sender_id: ME, type: 'group', body: 'Welcome' }) },
  { type: 'direct', user_id: 8, title: 'Sara', last_message: message(70, { sender_id: 8, recipient_id: ME, type: 'direct', body: 'Hello there' }) },
  { type: 'direct', user_id: 9, title: 'Omar', last_message: null },
];
const users = [{ id: 1, user_name: 'Me' }, { id: 7, user_name: 'Layla' }, { id: 8, user_name: 'Sara' }, { id: 9, user_name: 'Omar' }];

const conversations = vi.fn();
let socketHandler = null;
const list = vi.fn();
vi.mock('../../src/services/messageService', () => ({
  default: {
    conversations: (...args) => conversations(...args),
    list: (...args) => list(...args),
    targetQuery: ({ type, id }) => ({ [type === 'direct' ? 'user_id' : `${type}_id`]: Number(id) }),
  },
}));
vi.mock('../../src/services/userService', () => ({ default: { list: async () => users } }));
vi.mock('../../src/services/roomService', () => ({ default: { get: async (id) => ({ id, status: 'open' }) } }));
vi.mock('../../src/services/websocketService', () => ({
  listen: (callback) => {
    socketHandler = callback;
    return () => { socketHandler = null; };
  },
}));
const { default: MessagesPage } = await import('../../src/pages/MessagesPage');

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname}</div>;
}

const mount = (start = '/messages') => render(
  <MemoryRouter initialEntries={[start]}>
    <Routes>
      <Route path="/messages" element={<><MessagesPage session={{ user: { id: ME } }} /><Where /></>} />
      <Route path="/messages/:type/:id" element={<><MessagesPage session={{ user: { id: ME } }} /><Where /></>} />
    </Routes>
  </MemoryRouter>,
);

const layout = () => document.querySelector('.messages-layout');
const sidebar = () => screen.getByRole('complementary', { name: 'Chats' });
const rows = () => [...sidebar().querySelectorAll('.conversation-row')].map((row) => ({
  title: row.querySelector('.conversation-title').textContent,
  badge: row.querySelector('.status-badge').textContent,
  preview: row.querySelector('.conversation-preview').textContent,
  system: row.querySelector('.conversation-preview').classList.contains('is-system'),
  time: row.querySelector('.conversation-time').textContent,
  href: row.getAttribute('href'),
  current: row.getAttribute('aria-current'),
}));
const titles = () => rows().map((row) => row.title);
const send = (event) => act(async () => { socketHandler(event); });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

beforeEach(() => {
  conversations.mockReset();
  conversations.mockResolvedValue(baseConversations());
  list.mockReset();
  list.mockResolvedValue([]);
});

describe('Messages page layout', () => {
  it('shows the chat list beside an empty chat pane when no chat is open', async () => {
    mount();
    await screen.findByText('Sara');
    expect(screen.getByRole('region', { name: 'Open chat' })).toHaveTextContent('Select a chat to start messaging.');
    expect(layout()).toHaveAttribute('data-open', 'list');
  });

  it('opens a room, group or direct chat from the URL', async () => {
    for (const [path, title] of [
      ['/messages/room/12', 'Room chat 12'],
      ['/messages/group/3', 'Group chat 3'],
      ['/messages/direct/8', 'Sara'],
    ]) {
      const { unmount } = mount(path);
      expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
      expect(layout()).toHaveAttribute('data-open', 'chat');
      await screen.findAllByText('Sara');
      unmount();
    }
  });

  it('says a chat link is not valid and offers a way back', async () => {
    for (const path of ['/messages/channel/1', '/messages/room/0', '/messages/room/abc']) {
      const { unmount } = mount(path);
      expect(screen.getByRole('heading', { name: 'Chat not found' })).toBeInTheDocument();
      await screen.findByText('Sara');
      unmount();
    }
  });

  it('goes back to the chat list with the back link', async () => {
    mount('/messages/room/12');
    await userEvent.click(screen.getByRole('link', { name: 'Back to chats' }));
    expect(screen.getByTestId('where').textContent).toBe('/messages');
    expect(layout()).toHaveAttribute('data-open', 'list');
  });
});

describe('Inbox', () => {
  it('asks for every chat including empty ones', async () => {
    mount();
    await screen.findByText('Sara');
    expect(conversations).toHaveBeenCalledWith({ include_empty: true, limit: 100 }, expect.anything());
  });

  it('lists chats newest first with empty chats last', async () => {
    mount();
    await screen.findByText('Sara');
    expect(titles()).toEqual(['Sara', 'Sunday run', 'Friday game', 'Runners', 'Omar']);
  });

  it('labels each chat type and links it to its chat', async () => {
    mount();
    await screen.findByText('Sara');
    expect(rows().map((row) => [row.title, row.badge, row.href])).toEqual([
      ['Sara', 'Direct', '/messages/direct/8'],
      ['Sunday run', 'Room', '/messages/room/4'],
      ['Friday game', 'Room', '/messages/room/3'],
      ['Runners', 'Group', '/messages/group/2'],
      ['Omar', 'Direct', '/messages/direct/9'],
    ]);
  });

  it('previews the last message with the right prefix', async () => {
    mount();
    await screen.findByText('Sara');
    const previews = Object.fromEntries(rows().map((row) => [row.title, row.preview]));
    expect(previews).toEqual({
      Sara: 'Hello there',
      'Sunday run': 'Layla: See you at 6',
      'Friday game': 'Room cancelled: Rain',
      Runners: 'You: Welcome',
      Omar: 'No messages yet',
    });
  });

  it('shows system messages in the system style and a time for every message', async () => {
    mount();
    await screen.findByText('Sara');
    const byTitle = Object.fromEntries(rows().map((row) => [row.title, row]));
    expect(byTitle['Friday game'].system).toBe(true);
    expect(byTitle['Sunday run'].system).toBe(false);
    expect(byTitle['Sunday run'].time).toMatch(/^\d\d:\d\d$/);
    expect(byTitle['Friday game'].time).toBe('05/01/2024');
    expect(byTitle.Omar.time).toBe('');
  });

  it('marks the open chat as current', async () => {
    mount('/messages/room/4');
    await screen.findByText('Sara');
    expect(rows().filter((row) => row.current === 'page').map((row) => row.title)).toEqual(['Sunday run']);
  });

  it('shows a loading state, then the list', async () => {
    mount();
    expect(within(sidebar()).getByText('Loading…')).toBeInTheDocument();
    await screen.findByText('Sara');
    expect(within(sidebar()).queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('shows a failed load with a retry', async () => {
    conversations.mockRejectedValueOnce(new Error('Unable to reach the server. Please try again.'));
    mount();
    await screen.findByText('Unable to reach the server. Please try again.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Sara');
  });

  it('points a new user to rooms and friends when there are no chats', async () => {
    conversations.mockResolvedValue([]);
    mount();
    await screen.findByRole('heading', { name: 'No chats yet' });
    expect(screen.getByRole('link', { name: 'Browse activities' })).toHaveAttribute('href', '/sports');
    expect(screen.getByRole('link', { name: 'Find friends' })).toHaveAttribute('href', '/friends');
  });
});

describe('Inbox filters', () => {
  it('filters by chat type', async () => {
    mount();
    await screen.findByText('Sara');
    for (const [button, expected] of [
      ['Rooms', ['Sunday run', 'Friday game']],
      ['Groups', ['Runners']],
      ['Direct', ['Sara', 'Omar']],
      ['All', ['Sara', 'Sunday run', 'Friday game', 'Runners', 'Omar']],
    ]) {
      await userEvent.click(screen.getByRole('button', { name: button }));
      expect(titles()).toEqual(expected);
      expect(screen.getByRole('button', { name: button })).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it('searches chat titles in any letter case', async () => {
    mount();
    await screen.findByText('Sara');
    await userEvent.type(screen.getByLabelText('Search chats'), 'RUN');
    expect(titles()).toEqual(['Sunday run', 'Runners']);
  });

  it('combines the type and the search and says when nothing matches', async () => {
    mount();
    await screen.findByText('Sara');
    await userEvent.click(screen.getByRole('button', { name: 'Direct' }));
    await userEvent.type(screen.getByLabelText('Search chats'), 'run');
    expect(screen.getByRole('heading', { name: 'No chats match' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Find friends' })).not.toBeInTheDocument();
  });
});

describe('Inbox live updates', () => {
  it('handles a message immediately after the inbox commits, before passive effects synchronize', async () => {
    function ArrivalOnCommit() {
      const inbox = useConversations(ME);
      const sent = useRef(false);
      useLayoutEffect(() => {
        if (!inbox.conversations.length || sent.current) return;
        sent.current = true;
        socketHandler({ type: 'message.created', message: message(80, { room_id: 3, body: 'Arrived on commit' }) });
      }, [inbox.conversations]);
      return <ul>{inbox.conversations.map((chat) => <li key={chat.title}>{chat.title}: {chat.last_message?.body}</li>)}</ul>;
    }
    render(<ArrivalOnCommit />);
    const updated = await screen.findByText('Friday game: Arrived on commit');
    expect(screen.getAllByRole('listitem')[0]).toBe(updated);
  });

  it('moves a chat to the top with its new preview when a message arrives', async () => {
    mount();
    await screen.findByText('Sara');
    await send({ type: 'message.created', message: message(80, { room_id: 3, sender_id: 7, body: 'Anyone coming?' }) });
    expect(titles()).toEqual(['Friday game', 'Sara', 'Sunday run', 'Runners', 'Omar']);
    expect(rows()[0].preview).toBe('Layla: Anyone coming?');
    expect(rows()[0].system).toBe(false);
  });

  it('preserves both previews when two messages arrive before the next render', async () => {
    mount();
    await screen.findByText('Sara');
    await act(async () => {
      socketHandler({ type: 'message.created', message: message(80, { room_id: 3, body: 'First arrival' }) });
      socketHandler({ type: 'message.created', message: message(90, { group_id: 2, type: 'group', body: 'Second arrival' }) });
    });
    expect(titles().slice(0, 2)).toEqual(['Runners', 'Friday game']);
    expect(rows()[0].preview).toBe('Layla: Second arrival');
    expect(rows()[1].preview).toBe('Layla: First arrival');
  });

  it('puts a first message into an empty direct chat, using the other person as the key', async () => {
    mount();
    await screen.findByText('Sara');
    await send({ type: 'message.created', message: message(90, { room_id: null, sender_id: ME, recipient_id: 9, type: 'direct', body: 'Hi Omar' }) });
    expect(titles()[0]).toBe('Omar');
    expect(rows()[0].preview).toBe('You: Hi Omar');
  });

  it('reloads the list for a message in a chat it does not know yet', async () => {
    mount();
    await screen.findByText('Sara');
    const calls = conversations.mock.calls.length;
    conversations.mockResolvedValue([...baseConversations(), { type: 'room', room_id: 11, title: 'New room', last_message: message(95, { room_id: 11, body: 'Welcome all' }) }]);
    await send({ type: 'message.created', message: message(95, { room_id: 11, body: 'Welcome all' }) });
    await screen.findByText('New room');
    expect(conversations.mock.calls.length).toBe(calls + 1);
    expect(titles()[0]).toBe('New room');
  });

  it('ignores a message older than the one it already shows', async () => {
    mount();
    await screen.findByText('Sara');
    await send({ type: 'message.created', message: message(10, { room_id: 4, body: 'Old news' }) });
    expect(rows().find((row) => row.title === 'Sunday run').preview).toBe('Layla: See you at 6');
  });

  it('reloads after a reconnect, a friendship change or a room change, and ignores other events', async () => {
    mount();
    await screen.findByText('Sara');
    const calls = conversations.mock.calls.length;
    for (const type of ['connection.ready', 'friend.updated', 'room.updated']) await send({ type });
    expect(conversations.mock.calls.length).toBe(calls + 3);
    for (const event of [{ type: 'lobby.ready' }, { type: 'room_created', room: { id: 1 } }, { type: 'notification.created' }, { type: 'message.created' }]) await send(event);
    expect(conversations.mock.calls.length).toBe(calls + 3);
  });

  it('keeps the current list when a refresh fails', async () => {
    mount();
    await screen.findByText('Sara');
    conversations.mockRejectedValue(new Error('Unable to reach the server.'));
    await send({ type: 'connection.ready' });
    expect(titles()).toHaveLength(5);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the current list while a refresh is pending, then displays the new snapshot', async () => {
    const refresh = deferred();
    mount();
    await screen.findByText('Sara');
    conversations.mockReturnValueOnce(refresh.promise);
    await send({ type: 'connection.ready' });
    expect(titles()).toHaveLength(5);
    expect(within(sidebar()).queryByText('Loading…')).not.toBeInTheDocument();
    await act(async () => { refresh.resolve([{ type: 'direct', user_id: 9, title: 'Refreshed chat', last_message: null }]); });
    expect(await screen.findByText('Refreshed chat')).toBeInTheDocument();
    expect(titles()).toEqual(['Refreshed chat']);
  });

  it('recovers the inbox after a transient failed refresh', async () => {
    mount();
    await screen.findByText('Sara');
    conversations.mockRejectedValueOnce(new Error('Temporary connection failure'));
    await send({ type: 'connection.ready' });
    expect(titles()).toHaveLength(5);
    conversations.mockResolvedValueOnce([{ type: 'direct', user_id: 9, title: 'Recovered chat', last_message: null }]);
    await send({ type: 'connection.ready' });
    expect(await screen.findByText('Recovered chat')).toBeInTheDocument();
    expect(titles()).toEqual(['Recovered chat']);
  });

  it.each([401, 403, 404])('clears cached conversations after an access failure with HTTP %i', async (status) => {
    mount();
    await screen.findByText('Sara');
    conversations.mockRejectedValueOnce({ status, message: 'Inbox access no longer available' });
    await send({ type: 'connection.ready' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Inbox access no longer available');
    expect(titles()).toEqual([]);
    expect(screen.queryByText('See you at 6')).not.toBeInTheDocument();
    conversations.mockRejectedValueOnce(new Error('Connection unavailable during retry'));
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection unavailable during retry');
    expect(titles()).toEqual([]);
  });

  it('clears the old account immediately and ignores its late refresh after switching', async () => {
    const oldRefresh = deferred();
    const newInbox = deferred();
    const page = (id) => <MemoryRouter><MessagesPage session={{ user: { id } }} /></MemoryRouter>;
    const view = render(page(ME));
    await screen.findByText('Sara');
    conversations.mockReturnValueOnce(oldRefresh.promise).mockReturnValueOnce(newInbox.promise);
    await send({ type: 'connection.ready' });
    const oldOptions = conversations.mock.calls.at(-1)[1];
    view.rerender(page(2));
    expect(titles()).toEqual([]);
    expect(screen.queryByText('Sara')).not.toBeInTheDocument();
    await waitFor(() => expect(conversations).toHaveBeenCalledTimes(3));
    expect(oldOptions.signal.aborted).toBe(true);
    await act(async () => { oldRefresh.resolve(baseConversations()); });
    expect(titles()).toEqual([]);
    await act(async () => { newInbox.resolve([{ type: 'direct', user_id: 9, title: 'New account private chat', last_message: null }]); });
    expect(await screen.findByText('New account private chat')).toBeInTheDocument();
    expect(titles()).toEqual(['New account private chat']);
  });
});
