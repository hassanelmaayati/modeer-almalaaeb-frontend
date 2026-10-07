import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ME = 1;
const message = (id, extra = {}) => ({
  id,
  sender_id: 7,
  recipient_id: null,
  room_id: 4,
  group_id: null,
  type: 'room',
  body: `Message ${id}`,
  client_request_id: null,
  created_at: new Date().toISOString(),
  ...extra,
});
const users = [{ id: 1, user_name: 'Me' }, { id: 7, user_name: 'Layla' }, { id: 8, user_name: 'Sara' }];
const failure = (status, text) => Object.assign(new Error(text), { status });

const list = vi.fn();
const create = vi.fn();
vi.mock('../../src/services/messageService', () => ({
  default: {
    conversations: async () => [
      { type: 'room', room_id: 4, title: 'Sunday run', last_message: null },
      { type: 'direct', user_id: 8, title: 'Sara', last_message: null },
    ],
    list: (...args) => list(...args),
    create: (...args) => create(...args),
    targetQuery: ({ type, id }) => ({ [type === 'direct' ? 'user_id' : `${type}_id`]: Number(id) }),
    targetBody: (target, body, clientRequestId) => ({
      ...(target.type === 'direct' ? { recipient_id: target.id } : { [`${target.type}_id`]: target.id }),
      body,
      client_request_id: clientRequestId,
    }),
  },
}));
vi.mock('../../src/services/userService', () => ({ default: { listByIds: async (ids) => users.filter((user) => ids.includes(user.id)) } }));
vi.mock('../../src/services/websocketService', () => ({
  listen: () => () => {},
  mergeMessages: (existing, incoming) => {
    const merged = new Map(existing.map((item) => [item.id, item]));
    for (const item of incoming) merged.set(item.id, item);
    return [...merged.values()].sort((first, second) => first.id - second.id);
  },
}));
const { default: MessagesPage } = await import('../../src/pages/MessagesPage');

const mount = (start = '/messages/room/4') => render(
  <MemoryRouter initialEntries={[start]}>
    <Routes>
      <Route path="/messages/:type/:id" element={<MessagesPage session={{ user: { id: ME } }} />} />
    </Routes>
  </MemoryRouter>,
);

const thread = () => screen.getByRole('region', { name: 'Open chat' });
const box = () => within(thread()).getByPlaceholderText('Type a message');
const sendButton = () => within(thread()).getByRole('button', { name: 'Send' });
const bodies = () => [...thread().querySelectorAll('.message .message-body')].map((item) => item.textContent);
const pendingItems = () => [...thread().querySelectorAll('.pending-list .message')];
const saved = (clientRequestId, body, id = 100) => message(id, { sender_id: ME, body, client_request_id: clientRequestId });

beforeEach(() => {
  list.mockReset();
  list.mockResolvedValue([message(1)]);
  create.mockReset();
  create.mockImplementation(async (body) => saved(body.client_request_id, body.body));
});

describe('Composer visibility', () => {
  it('appears once the messages are loaded', async () => {
    mount();
    expect(within(thread()).queryByPlaceholderText('Type a message')).not.toBeInTheDocument();
    await screen.findByText('Message 1');
    expect(box()).toBeEnabled();
  });

  it('does not appear when the chat cannot be opened', async () => {
    list.mockRejectedValue(failure(403, 'no access'));
    mount();
    await screen.findByText("You don't have access to this chat.");
    expect(within(thread()).queryByPlaceholderText('Type a message')).not.toBeInTheDocument();
  });

  it('appears in an empty chat', async () => {
    list.mockResolvedValue([]);
    mount();
    await screen.findByRole('heading', { name: 'No messages yet' });
    expect(box()).toBeInTheDocument();
  });
});

describe('Sending', () => {
  it('sends with the Enter key, trimmed, to the open chat with a request id', async () => {
    mount();
    await screen.findByText('Message 1');
    await userEvent.type(box(), '  Hello everyone  {Enter}');
    expect(create).toHaveBeenCalledTimes(1);
    const sent = create.mock.calls[0][0];
    expect(sent).toMatchObject({ room_id: 4, body: 'Hello everyone' });
    expect(sent.client_request_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sends to a direct chat as a recipient', async () => {
    mount('/messages/direct/8');
    await screen.findByText('Message 1');
    await userEvent.type(box(), 'Hi Sara{Enter}');
    expect(create.mock.calls[0][0]).toMatchObject({ recipient_id: 8, body: 'Hi Sara' });
  });

  it('sends with the Send button', async () => {
    mount();
    await screen.findByText('Message 1');
    await userEvent.type(box(), 'By button');
    await userEvent.click(sendButton());
    expect(create.mock.calls[0][0]).toMatchObject({ body: 'By button' });
  });

  it('keeps a line break with Shift+Enter and sends it', async () => {
    mount();
    await screen.findByText('Message 1');
    await userEvent.type(box(), 'first{Shift>}{Enter}{/Shift}second');
    expect(create).not.toHaveBeenCalled();
    expect(box()).toHaveValue('first\nsecond');
    await userEvent.type(box(), '{Enter}');
    expect(create.mock.calls[0][0].body).toBe('first\nsecond');
  });

  it('shows the message at once as sending, then replaces it with the saved message', async () => {
    let finish;
    create.mockImplementation((body) => new Promise((resolve) => { finish = () => resolve(saved(body.client_request_id, body.body)); }));
    mount();
    await screen.findByText('Message 1');
    await userEvent.type(box(), 'On its way{Enter}');
    expect(pendingItems()).toHaveLength(1);
    expect(pendingItems()[0]).toHaveTextContent('On its way');
    expect(pendingItems()[0]).toHaveTextContent('Sending…');
    finish();
    await screen.findByText('On its way', { selector: '.message-list:not(.pending-list) .message-body' });
    expect(pendingItems()).toHaveLength(0);
    expect(bodies().filter((body) => body === 'On its way')).toHaveLength(1);
  });

  it('shows the first message of an empty chat', async () => {
    list.mockResolvedValue([]);
    mount();
    await screen.findByRole('heading', { name: 'No messages yet' });
    await userEvent.type(box(), 'Anyone here?{Enter}');
    await screen.findByText('Anyone here?');
    expect(screen.queryByRole('heading', { name: 'No messages yet' })).not.toBeInTheDocument();
  });

  it('clears the box after sending and keeps the focus there', async () => {
    mount();
    await screen.findByText('Message 1');
    await userEvent.type(box(), 'One{Enter}');
    expect(box()).toHaveValue('');
    expect(box()).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sends several messages in the order they were written', async () => {
    mount();
    await screen.findByText('Message 1');
    await userEvent.type(box(), 'First{Enter}');
    await userEvent.type(box(), 'Second{Enter}');
    await screen.findByText('Second', { selector: '.message-list:not(.pending-list) .message-body' });
    expect(create.mock.calls.map((call) => call[0].body)).toEqual(['First', 'Second']);
  });
});

describe('Message rules', () => {
  it('keeps Send off for an empty or all-space message', async () => {
    mount();
    await screen.findByText('Message 1');
    expect(sendButton()).toBeDisabled();
    await userEvent.type(box(), '    ');
    expect(sendButton()).toBeDisabled();
  });

  it('explains an empty message sent with Enter and sends nothing', async () => {
    mount();
    await screen.findByText('Message 1');
    await userEvent.type(box(), '   {Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Write a message first.');
    expect(create).not.toHaveBeenCalled();
  });

  it('counts the characters and allows exactly 2000', async () => {
    mount();
    await screen.findByText('Message 1');
    await userEvent.click(box());
    await userEvent.paste('a'.repeat(2000));
    expect(screen.getByLabelText('Characters used')).toHaveTextContent('2000/2000');
    expect(sendButton()).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('refuses more than 2000 characters', async () => {
    mount();
    await screen.findByText('Message 1');
    await userEvent.click(box());
    await userEvent.paste('a'.repeat(2001));
    expect(screen.getByLabelText('Characters used')).toHaveTextContent('2001/2000');
    expect(sendButton()).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Messages can be up to 2000 characters.');
    await userEvent.type(box(), '{Enter}');
    expect(create).not.toHaveBeenCalled();
  });
});

describe('Failed messages', () => {
  it('keeps a failed message with the reason, and retries it with the same request id', async () => {
    create.mockRejectedValueOnce(failure(0, 'Unable to reach the server. Please try again.'));
    mount();
    await screen.findByText('Message 1');
    await userEvent.type(box(), 'Flaky{Enter}');
    await screen.findByText('Failed to send');
    expect(pendingItems()[0]).toHaveTextContent('Unable to reach the server. Please try again.');
    expect(box()).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('Flaky', { selector: '.message-list:not(.pending-list) .message-body' });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].client_request_id).toBe(create.mock.calls[0][0].client_request_id);
    expect(pendingItems()).toHaveLength(0);
  });

  it('removes a failed message with Discard and sends nothing more', async () => {
    create.mockRejectedValue(failure(500, 'Request failed (500).'));
    mount();
    await screen.findByText('Message 1');
    await userEvent.type(box(), 'Drop me{Enter}');
    await screen.findByText('Failed to send');
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(pendingItems()).toHaveLength(0);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('shows the backend reason when the message is rejected, and the composer stays usable', async () => {
    create.mockRejectedValueOnce(failure(422, 'body cannot be empty'));
    mount();
    await screen.findByText('Message 1');
    await userEvent.type(box(), 'Rejected{Enter}');
    await screen.findByText('body cannot be empty');
    expect(box()).toBeEnabled();
  });
});

describe('Chats that are read-only', () => {
  it('turns a cancelled room read-only and keeps the unsent message with only Discard', async () => {
    create.mockRejectedValue(failure(409, 'This room is cancelled'));
    mount();
    await screen.findByText('Message 1');
    await userEvent.type(box(), 'Too late{Enter}');
    expect(await screen.findByText("This room was cancelled, so you can't send messages.", { selector: '.chat-composer p' })).toBeInTheDocument();
    expect(within(thread()).queryByPlaceholderText('Type a message')).not.toBeInTheDocument();
    expect(pendingItems()[0]).toHaveTextContent('Too late');
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
  });

  it('says access was lost when a room or group refuses the message', async () => {
    create.mockRejectedValue(failure(403, 'You do not have access to this chat'));
    mount();
    await screen.findByText('Message 1');
    await userEvent.type(box(), 'Hello{Enter}');
    expect(await screen.findByText(/no longer have access to this chat/, { selector: '.chat-composer p' })).toBeInTheDocument();
    expect(within(thread()).queryByPlaceholderText('Type a message')).not.toBeInTheDocument();
  });

  it('explains a direct chat with someone who is not a friend', async () => {
    create.mockRejectedValue(failure(403, 'You can only message accepted friends'));
    mount('/messages/direct/8');
    await screen.findByText('Message 1');
    await userEvent.type(box(), 'Hello{Enter}');
    expect(await screen.findByText('You can only message accepted friends.', { selector: '.chat-composer p' })).toBeInTheDocument();
  });

  it('explains a blocked direct chat', async () => {
    create.mockRejectedValue(failure(403, 'Messaging is blocked'));
    mount('/messages/direct/8');
    await screen.findByText('Message 1');
    await userEvent.type(box(), 'Hello{Enter}');
    expect(await screen.findByText('Messaging is blocked between you and this person.', { selector: '.chat-composer p' })).toBeInTheDocument();
  });
});
