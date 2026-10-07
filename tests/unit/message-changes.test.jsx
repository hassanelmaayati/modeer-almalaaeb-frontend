import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMessageChange, applyMessageChangeToConversations, messagePreview } from '../../src/lib/helpers/messages';

const ME = 1;
const live = vi.hoisted(() => ({ listeners: new Set() }));
const hoursAgo = hours => new Date(Date.now() - hours * 3600e3).toISOString();
const message = (id, extra = {}) => ({ id, sender_id: 8, recipient_id: ME, room_id: null, group_id: null, type: 'direct', body: `Message ${id}`, client_request_id: null, created_at: hoursAgo(1), edited_at: null, deleted: false, ...extra });
const mine = (id, extra = {}) => message(id, { sender_id: ME, recipient_id: 8, ...extra });
const users = [{ id: 1, user_name: 'Me' }, { id: 8, user_name: 'Sara' }];

const list = vi.fn();
const conversations = vi.fn();
const update = vi.fn();
const remove = vi.fn();
vi.mock('../../src/services/messageService', () => ({
  default: {
    conversations: (...args) => conversations(...args),
    list: (...args) => list(...args),
    update: (...args) => update(...args),
    remove: (...args) => remove(...args),
    targetQuery: ({ type, id }) => ({ [type === 'direct' ? 'user_id' : `${type}_id`]: Number(id) }),
  },
}));
vi.mock('../../src/services/userService', () => ({ default: { listByIds: async ids => users.filter(user => ids.includes(user.id)) } }));
vi.mock('../../src/services/websocketService', () => ({
  listen: callback => { live.listeners.add(callback); return () => live.listeners.delete(callback); },
  mergeMessages: (existing, incoming) => {
    const merged = new Map(existing.map(item => [item.id, item]));
    for (const item of incoming) merged.set(item.id, item);
    return [...merged.values()].sort((first, second) => first.id - second.id);
  },
}));
const { default: MessagesPage } = await import('../../src/pages/MessagesPage');

const mount = () => render(
  <MemoryRouter initialEntries={['/messages/direct/8']}>
    <Routes><Route path="/messages/:type/:id" element={<MessagesPage session={{ user: { id: ME } }} />} /></Routes>
  </MemoryRouter>,
);
const thread = () => screen.getByRole('region', { name: 'Open chat' });
const emit = event => act(async () => { for (const callback of live.listeners) callback(event); });
const bubble = text => within(thread()).getByText(text).closest('li');

beforeEach(() => {
  live.listeners.clear();
  list.mockReset().mockResolvedValue([mine(3), message(2), mine(1, { body: 'First' })]);
  conversations.mockReset().mockResolvedValue([{ type: 'direct', user_id: 8, title: 'Sara', last_message: mine(3) }]);
  update.mockReset().mockImplementation(async (id, body) => mine(id, { body, edited_at: new Date().toISOString() }));
  remove.mockReset().mockImplementation(async id => mine(id, { body: '', deleted: true }));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('editing and deleting your own messages', () => {
  it('offers Edit and Delete on your own messages only', async () => {
    mount();
    await screen.findByText('Message 2');
    expect(within(bubble('Message 3')).getByRole('button', { name: 'Edit message' })).toBeVisible();
    expect(within(bubble('Message 3')).getByRole('button', { name: 'Delete message' })).toBeVisible();
    expect(within(bubble('Message 2')).queryByRole('button', { name: 'Edit message' })).not.toBeInTheDocument();
    expect(within(bubble('Message 2')).queryByRole('button', { name: 'Delete message' })).not.toBeInTheDocument();
  });

  it('edits inline, saves the trimmed text and marks the message "(edited)"', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText('Message 3');
    await user.click(within(bubble('Message 3')).getByRole('button', { name: 'Edit message' }));
    const box = screen.getByRole('textbox', { name: 'Edit your message' });
    expect(box).toHaveValue('Message 3');
    await user.clear(box);
    await user.type(box, '  Better words  ');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(update).toHaveBeenCalledExactlyOnceWith(3, 'Better words');
    expect(await within(thread()).findByText('Better words')).toBeVisible();
    expect(within(bubble('Better words')).getByText('(edited)')).toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'Edit your message' })).not.toBeInTheDocument();
  });

  it('closes without a request when nothing changed, and cancels without saving', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText('Message 3');
    await user.click(within(bubble('Message 3')).getByRole('button', { name: 'Edit message' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(update).not.toHaveBeenCalled();
    await user.click(within(bubble('Message 3')).getByRole('button', { name: 'Edit message' }));
    await user.type(screen.getByRole('textbox', { name: 'Edit your message' }), ' more');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByText('Message 3')).toBeVisible();
  });

  it('rejects an empty edit and keeps the editor open', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText('Message 3');
    await user.click(within(bubble('Message 3')).getByRole('button', { name: 'Edit message' }));
    await user.clear(screen.getByRole('textbox', { name: 'Edit your message' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Write a message first.');
    expect(update).not.toHaveBeenCalled();
  });

  it('shows the backend message when an edit fails, and keeps what was typed', async () => {
    const user = userEvent.setup();
    update.mockRejectedValue({ status: 403, message: 'Messages can no longer be edited' });
    mount();
    await screen.findByText('Message 3');
    await user.click(within(bubble('Message 3')).getByRole('button', { name: 'Edit message' }));
    await user.type(screen.getByRole('textbox', { name: 'Edit your message' }), '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Messages can no longer be edited');
    expect(screen.getByRole('textbox', { name: 'Edit your message' })).toHaveValue('Message 3!');
  });

  it('asks before deleting, and does nothing when declined', async () => {
    const user = userEvent.setup();
    window.confirm.mockReturnValue(false);
    mount();
    await screen.findByText('Message 3');
    await user.click(within(bubble('Message 3')).getByRole('button', { name: 'Delete message' }));
    expect(window.confirm).toHaveBeenCalledWith('Delete this message? It will be removed for everyone and cannot be restored.');
    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByText('Message 3')).toBeVisible();
  });

  it('replaces a deleted message with "This message was deleted" and removes its actions', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText('Message 3');
    await user.click(within(bubble('Message 3')).getByRole('button', { name: 'Delete message' }));
    expect(remove).toHaveBeenCalledExactlyOnceWith(3);
    await waitFor(() => expect(screen.queryByText('Message 3')).not.toBeInTheDocument());
    const tombstone = within(thread()).getByText('This message was deleted').closest('li');
    expect(within(tombstone).queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the backend message when a delete fails and keeps the message', async () => {
    const user = userEvent.setup();
    remove.mockRejectedValue({ status: 404, message: 'Message not found' });
    mount();
    await screen.findByText('Message 3');
    await user.click(within(bubble('Message 3')).getByRole('button', { name: 'Delete message' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Message not found');
    expect(screen.getByText('Message 3')).toBeVisible();
  });
});

describe('live message changes', () => {
  it('shows another person\'s edit as "(edited)" and their deletion as a tombstone, without a reload', async () => {
    mount();
    await screen.findByText('Message 2');
    await emit({ type: 'message.updated', message: message(2, { body: 'Corrected', edited_at: new Date().toISOString() }) });
    expect(await within(thread()).findByText('Corrected')).toBeVisible();
    expect(within(bubble('Corrected')).getByText('(edited)')).toBeVisible();
    await emit({ type: 'message.deleted', message: message(2, { body: '', deleted: true }) });
    await waitFor(() => expect(screen.queryByText('Corrected')).not.toBeInTheDocument());
    expect(within(thread()).getByText('This message was deleted')).toBeVisible();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('marks a deleted message from just its id, and ignores messages that are not on screen', async () => {
    mount();
    await screen.findByText('Message 2');
    await emit({ type: 'message.deleted', message_id: 2 });
    await emit({ type: 'message.deleted', message: message(999, { deleted: true }) });
    expect(await within(thread()).findByText('This message was deleted')).toBeVisible();
    expect(screen.getByText('Message 3')).toBeVisible();
  });

  it('updates the chat list preview when the last message is edited or deleted', async () => {
    mount();
    const sidebar = await screen.findByRole('complementary', { name: 'Chats' });
    expect(await within(sidebar).findByText('You: Message 3')).toBeVisible();
    await emit({ type: 'message.updated', message: mine(3, { body: 'Reworded', edited_at: new Date().toISOString() }) });
    expect(await within(sidebar).findByText('You: Reworded')).toBeVisible();
    await emit({ type: 'message.deleted', message: mine(3, { body: '', deleted: true }) });
    expect(await within(sidebar).findByText('This message was deleted')).toBeVisible();
  });
});

describe('message change helpers', () => {
  const messages = [message(1), message(2)];

  it('replaces the changed message and keeps every other one, returning the same list when nothing matches', () => {
    const changed = applyMessageChange(messages, { type: 'message.updated', message: { id: 2, body: 'New', edited_at: 'now' } });
    expect(changed).toHaveLength(2);
    expect(changed[0]).toBe(messages[0]);
    expect(changed[1]).toMatchObject({ id: 2, body: 'New', edited_at: 'now', sender_id: 8 });
    expect(applyMessageChange(messages, { type: 'message.updated', message: { id: 99 } })).toBe(messages);
    expect(applyMessageChange(messages, { type: 'message.updated' })).toBe(messages);
  });

  it('marks a message deleted even when the event only carries an id', () => {
    expect(applyMessageChange(messages, { type: 'message.deleted', message_id: 1 })[0]).toMatchObject({ id: 1, deleted: true });
  });

  it('only touches conversations whose last message changed', () => {
    const chats = [{ type: 'direct', user_id: 8, last_message: message(2) }, { type: 'direct', user_id: 9, last_message: message(5) }, { type: 'direct', user_id: 10, last_message: null }];
    const next = applyMessageChangeToConversations(chats, { type: 'message.deleted', message: { id: 2, deleted: true } });
    expect(next[0].last_message.deleted).toBe(true);
    expect(next[1]).toBe(chats[1]);
    expect(applyMessageChangeToConversations(chats, { type: 'message.updated', message: { id: 404 } })).toBe(chats);
  });

  it('previews a deleted last message as a system-style line, for every chat type', () => {
    const nameOf = () => 'Sara';
    for (const type of ['direct', 'room', 'group']) {
      expect(messagePreview({ type, last_message: message(2, { deleted: true }) }, ME, nameOf)).toEqual({ text: 'This message was deleted', system: true });
    }
  });
});
