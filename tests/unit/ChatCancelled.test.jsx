import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { roomCancellation } from '../../src/lib/helpers/messages';

const message = (id, extra = {}) => ({
  id, sender_id: 7, recipient_id: null, room_id: 4, group_id: null, type: 'room', body: `Message ${id}`,
  client_request_id: null, created_at: new Date().toISOString(), ...extra,
});
const system = (id, body) => message(id, { type: 'system', sender_id: null, body });

const list = vi.fn();
const getRoom = vi.fn();
const listeners = new Set();
const emit = (event) => act(() => { for (const listener of [...listeners]) listener(event); });

vi.mock('../../src/services/messageService', () => ({
  default: {
    conversations: async () => [{ type: 'room', room_id: 4, title: 'Sunday run', last_message: null }],
    list: (...args) => list(...args),
    create: vi.fn(),
    targetQuery: ({ type, id }) => ({ [`${type}_id`]: Number(id) }),
    targetBody: () => ({}),
  },
}));
vi.mock('../../src/services/roomService', () => ({ default: { get: (...args) => getRoom(...args) } }));
vi.mock('../../src/services/userService', () => ({ default: { listByIds: async (ids) => [{ id: 1, user_name: 'Me' }, { id: 7, user_name: 'Layla' }].filter((user) => ids.includes(user.id)) } }));
vi.mock('../../src/services/websocketService', () => ({
  listen: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
  recoverMessages: async (target, existing) => existing,
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
      <Route path="/messages/:type/:id" element={<MessagesPage session={{ user: { id: 1 } }} />} />
    </Routes>
  </MemoryRouter>,
);
const thread = () => screen.getByRole('region', { name: 'Open chat' });

beforeEach(() => {
  listeners.clear();
  list.mockReset().mockResolvedValue([message(1)]);
  getRoom.mockReset().mockResolvedValue({ id: 4, status: 'open' });
});

describe('roomCancellation', () => {
  it('is null for an open room', () => {
    expect(roomCancellation({ status: 'open' }, [message(1)])).toBeNull();
    expect(roomCancellation(null, [])).toBeNull();
  });

  it('uses the room reason when cancelled', () => {
    expect(roomCancellation({ status: 'cancelled', cancellation_reason: 'Rain', cancelled_at: 'x' }, [])).toEqual({ reason: 'Rain', cancelledAt: 'x' });
  });

  it('falls back to the system message when the room is unknown', () => {
    expect(roomCancellation(null, [system(2, 'Room cancelled: Venue closed')]).reason).toBe('Venue closed');
  });

  it('ignores a normal message that only looks like the announcement', () => {
    expect(roomCancellation(null, [message(2, { body: 'Room cancelled: fake' })])).toBeNull();
  });
});

describe('cancelled room chat', () => {
  it('shows the banner, the reason, the system message and a read-only composer', async () => {
    getRoom.mockResolvedValue({ id: 4, status: 'cancelled', cancellation_reason: 'Rain' });
    list.mockResolvedValue([system(2, 'Room cancelled: Rain'), message(1)]);
    mount();
    expect(await within(thread()).findByText('Room cancelled: Rain')).toBeInTheDocument();
    expect(await within(thread()).findByText('This room was cancelled.')).toBeInTheDocument();
    expect(within(thread()).getByText(/Reason: Rain/)).toBeInTheDocument();
    expect(within(thread()).queryByPlaceholderText('Type a message')).not.toBeInTheDocument();
    expect(within(thread()).getByText("This room was cancelled, so you can't send messages.")).toBeInTheDocument();
  });

  it('keeps an open room writable without a banner', async () => {
    mount();
    expect(await within(thread()).findByPlaceholderText('Type a message')).toBeInTheDocument();
    expect(within(thread()).queryByText('This room was cancelled.')).not.toBeInTheDocument();
  });

  it('switches to read-only when the room is cancelled while open', async () => {
    mount();
    await within(thread()).findByPlaceholderText('Type a message');
    getRoom.mockResolvedValue({ id: 4, status: 'cancelled', cancellation_reason: 'Storm' });
    await emit({ type: 'message.created', message: system(5, 'Room cancelled: Storm') });
    expect(await within(thread()).findByText(/Reason: Storm/)).toBeInTheDocument();
    expect(within(thread()).queryByPlaceholderText('Type a message')).not.toBeInTheDocument();
  });
});
