import { act, render, screen, waitFor, within } from '@testing-library/react';
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

const list = vi.fn();
const create = vi.fn();
const recover = vi.fn();
const listeners = new Set();
const emit = (event) => act(async () => { for (const listener of [...listeners]) listener(event); });

vi.mock('../../src/services/messageService', () => ({
  default: {
    conversations: async () => [{ type: 'room', room_id: 4, title: 'Sunday run', last_message: null }],
    list: (...args) => list(...args),
    create: (...args) => create(...args),
    targetQuery: ({ type, id }) => ({ [type === 'direct' ? 'user_id' : `${type}_id`]: Number(id) }),
    targetBody: (target, body, clientRequestId) => ({ [`${target.type}_id`]: target.id, body, client_request_id: clientRequestId }),
  },
}));
vi.mock('../../src/services/userService', () => ({ default: { list: async () => users } }));
vi.mock('../../src/services/roomService', () => ({ default: { get: async (id) => ({ id, status: 'open' }) } }));
vi.mock('../../src/services/websocketService', () => ({
  listen: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
  recoverMessages: (...args) => recover(...args),
  mergeMessages: (existing, incoming) => {
    const merged = new Map(existing.map((item) => [item.id, item]));
    for (const item of incoming) merged.set(item.id, item);
    return [...merged.values()].sort((first, second) => first.id - second.id);
  },
}));
const { default: MessagesPage } = await import('../../src/pages/MessagesPage');

const mount = () => render(
  <MemoryRouter initialEntries={['/messages/room/4']}>
    <Routes>
      <Route path="/messages/:type/:id" element={<MessagesPage session={{ user: { id: ME } }} />} />
    </Routes>
  </MemoryRouter>,
);

const thread = () => screen.getByRole('region', { name: 'Open chat' });
const ready = () => within(thread()).findByText('Message 2');
const log = () => within(thread()).getByRole('log', { name: 'Messages' });

beforeEach(() => {
  listeners.clear();
  list.mockReset().mockResolvedValue([message(2), message(1)]);
  create.mockReset();
  recover.mockReset();
});

describe('live updates in the open thread', () => {
  it('appends a message created in this chat', async () => {
    mount();
    await ready();
    await emit({ type: 'message.created', message: message(3, { body: 'Just arrived' }) });
    expect(within(log()).getByText('Just arrived')).toBeInTheDocument();
  });

  it('ignores messages that belong to another chat', async () => {
    mount();
    await ready();
    await emit({ type: 'message.created', message: message(3, { room_id: 9, body: 'Elsewhere' }) });
    expect(within(log()).queryByText('Elsewhere')).not.toBeInTheDocument();
  });

  it('does not duplicate a message already shown', async () => {
    mount();
    await ready();
    await emit({ type: 'message.created', message: message(2) });
    expect(within(log()).getAllByText('Message 2')).toHaveLength(1);
  });

  it('replaces the sending bubble with the echo of the own message', async () => {
    let finish;
    create.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    mount();
    await ready();
    await userEvent.type(within(thread()).getByPlaceholderText('Type a message'), 'Mine{Enter}');
    const clientRequestId = create.mock.calls[0][0].client_request_id;
    expect(within(log()).getByText('Sending…')).toBeInTheDocument();

    const saved = message(3, { sender_id: ME, body: 'Mine', client_request_id: clientRequestId });
    await emit({ type: 'message.created', message: saved });
    expect(within(log()).queryByText('Sending…')).not.toBeInTheDocument();
    expect(within(log()).getAllByText('Mine')).toHaveLength(1);

    await act(async () => finish(saved));
    expect(within(log()).getAllByText('Mine')).toHaveLength(1);
  });

  it('recovers missed messages when the connection comes back', async () => {
    recover.mockResolvedValue([message(1), message(2), message(3, { body: 'Missed while offline' })]);
    mount();
    await ready();
    await emit({ type: 'connection.ready' });
    await waitFor(() => expect(within(log()).getByText('Missed while offline')).toBeInTheDocument());
    expect(recover.mock.calls[0][0]).toEqual({ type: 'room', id: 4 });
  });

  it('reauthorizes and reloads when this room is updated, but ignores another room', async () => {
    mount();
    await ready();
    const requests = list.mock.calls.length;
    list.mockResolvedValueOnce([message(1), message(2), message(3, { type: 'system', sender_id: null, body: 'Room cancelled: Rain' })]);
    await emit({ type: 'room.updated', room_id: 9 });
    expect(list).toHaveBeenCalledTimes(requests);
    expect(recover).not.toHaveBeenCalled();
    await emit({ type: 'room.updated', room_id: 4 });
    await waitFor(() => expect(within(log()).getByText('Room cancelled: Rain')).toBeInTheDocument());
    expect(list).toHaveBeenCalledTimes(requests + 1);
    expect(list).toHaveBeenLastCalledWith({ room_id: 4, limit: 50 }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(recover).not.toHaveBeenCalled();
  });

  it('stops listening when the chat is closed', async () => {
    const view = mount();
    await ready();
    const open = listeners.size;
    view.unmount();
    expect(listeners.size).toBeLessThan(open);
  });
});
