import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ME = 1;
const OTHER = { id: 5, user_name: 'Sara' };
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

const list = vi.fn();
const create = vi.fn();
const update = vi.fn();
vi.mock('../../src/services/friendService', () => ({
  default: { list: (...args) => list(...args), create: (...args) => create(...args), update: (...args) => update(...args) },
}));
let socketHandler = null;
vi.mock('../../src/services/websocketService', () => ({
  listen: (callback) => {
    socketHandler = callback;
    return () => { socketHandler = null; };
  },
}));
const { default: ProfileActions } = await import('../../src/components/users/ProfileActions');

const mount = (viewer = { id: ME }, user = OTHER) => render(
  <MemoryRouter>
    <ProfileActions user={user} session={{ user: viewer, loading: false }} />
  </MemoryRouter>,
);
const buttons = () => [...document.querySelectorAll('button, a')].map((control) => control.textContent);
const badge = () => document.querySelector('.status-badge')?.textContent;

beforeEach(() => {
  list.mockReset();
  create.mockReset();
  update.mockReset();
  list.mockResolvedValue([]);
});

describe('Profile actions', () => {
  it('shows nothing to a visitor who is not signed in', () => {
    const { container } = mount(null);
    expect(container).toBeEmptyDOMElement();
    expect(list).not.toHaveBeenCalled();
  });

  it('offers editing, and nothing about friends, on your own profile', () => {
    mount({ id: ME }, { id: ME, user_name: 'Me' });
    expect(screen.getByRole('link', { name: 'Edit profile' })).toHaveAttribute('href', '/settings');
    expect(list).not.toHaveBeenCalled();
  });

  it('offers Add friend when there is no record, and shows Request sent after it is sent', async () => {
    create.mockResolvedValue(row(9, ME, 5, 'pending'));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Add friend' }));
    expect(create).toHaveBeenCalledWith({ other_user_id: 5 });
    await screen.findByText('Request sent');
    expect(buttons()).toEqual(['Cancel request']);
  });

  it('shows Request sent with a confirmed Cancel request for a request you sent', async () => {
    list.mockResolvedValue([row(1, ME, 5, 'pending')]);
    update.mockResolvedValue(row(1, ME, 5, 'left'));
    mount();
    await screen.findByText('Request sent');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
    expect(screen.getByRole('dialog', { name: 'Cancel your request to Sara?' })).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel request' }));
    expect(update).toHaveBeenCalledWith(5, { status: 'left' });
    await screen.findByText("You can't send a friend request to this person.");
  });

  it('accepts a request you received straight away and then offers Message', async () => {
    list.mockResolvedValue([row(1, 5, ME, 'pending')]);
    update.mockResolvedValue(row(1, 5, ME, 'accepted'));
    mount();
    await screen.findByText('Wants to be your friend');
    expect(buttons()).toEqual(['Accept request', 'Decline']);
    await userEvent.click(screen.getByRole('button', { name: 'Accept request' }));
    expect(update).toHaveBeenCalledWith(5, { status: 'accepted' });
    await screen.findByRole('link', { name: 'Message' });
    expect(badge()).toBe('Friends');
    expect(screen.getByRole('link', { name: 'Message' })).toHaveAttribute('href', '/messages/direct/5');
  });

  it('declines a received request only after confirmation', async () => {
    list.mockResolvedValue([row(1, 5, ME, 'pending')]);
    update.mockResolvedValue(row(1, 5, ME, 'declined'));
    mount();
    await screen.findByText('Wants to be your friend');
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(screen.getByRole('dialog', { name: 'Decline the request from Sara?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(update).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, decline' }));
    expect(update).toHaveBeenCalledWith(5, { status: 'declined' });
    await screen.findByText("You can't send a friend request to this person.");
  });

  it('offers Message for a friend, whichever side sent the request', async () => {
    list.mockResolvedValue([row(1, 5, ME, 'accepted')]);
    mount();
    await screen.findByRole('link', { name: 'Message' });
    expect(badge()).toBe('Friends');
  });

  it('shows Blocked with Unblock for someone you blocked, and unblocks with your own flag', async () => {
    list.mockResolvedValue([row(1, 5, ME, 'accepted', { other_blocked_user: 'true' })]);
    update.mockResolvedValue(row(1, 5, ME, 'accepted', { other_blocked_user: 'false' }));
    mount();
    await screen.findByText('Blocked');
    expect(buttons()).toEqual(['Unblock']);
    await userEvent.click(screen.getByRole('button', { name: 'Unblock' }));
    expect(update).toHaveBeenCalledWith(5, { other_blocked_user: 'false' });
    await screen.findByRole('link', { name: 'Message' });
  });

  it('does not reveal that the other person blocked you', async () => {
    list.mockResolvedValue([row(1, ME, 5, 'accepted', { other_blocked_user: 'true' })]);
    mount();
    await screen.findByRole('link', { name: 'Message' });
    expect(badge()).toBe('Friends');
  });

  it('says a request is not possible after a declined or ended friendship', async () => {
    list.mockResolvedValue([row(1, 5, ME, 'left')]);
    mount();
    await screen.findByText("You can't send a friend request to this person.");
    expect(buttons()).toEqual([]);
  });

  it('explains a refused request and reloads the friendship state', async () => {
    create.mockRejectedValue(Object.assign(new Error('Friendship already exists'), { status: 409 }));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Add friend' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/already have a friend record/);
    await screen.findByRole('button', { name: 'Add friend' });
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('shows another failure and keeps the button', async () => {
    create.mockRejectedValue(new Error('Unable to reach the server. Please try again.'));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Add friend' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the server. Please try again.');
    expect(screen.getByRole('button', { name: 'Add friend' })).toBeEnabled();
  });

  it('shows a failed load with a retry', async () => {
    list.mockRejectedValueOnce(new Error('Unable to reach the server. Please try again.'));
    mount();
    await screen.findByText('Unable to reach the server. Please try again.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('button', { name: 'Add friend' });
  });
});

describe('Profile actions live updates', () => {
  const send = (event) => act(async () => { socketHandler(event); });

  it('switches from Request sent to Message when the other person accepts', async () => {
    list.mockResolvedValue([row(1, ME, 5, 'pending')]);
    mount();
    await screen.findByText('Request sent');
    list.mockResolvedValue([row(1, ME, 5, 'accepted')]);
    await send({ type: 'friend.updated', direct_id: 5 });
    await screen.findByRole('link', { name: 'Message' });
    expect(badge()).toBe('Friends');
  });

  it('shows Accept request when the other person sends a request while the page is open', async () => {
    mount();
    await screen.findByRole('button', { name: 'Add friend' });
    list.mockResolvedValue([row(1, 5, ME, 'pending')]);
    await send({ type: 'connection.ready' });
    await screen.findByRole('button', { name: 'Accept request' });
  });

  it('ignores events that are not about friends and keeps the state when a refresh fails', async () => {
    list.mockResolvedValue([row(1, ME, 5, 'pending')]);
    mount();
    await screen.findByText('Request sent');
    const calls = list.mock.calls.length;
    await send({ type: 'room.updated', room_id: 1 });
    await send({ type: 'message.created', message: { id: 1 } });
    expect(list.mock.calls.length).toBe(calls);
    list.mockRejectedValue(new Error('Unable to reach the server.'));
    await send({ type: 'friend.updated', direct_id: 5 });
    expect(screen.getByText('Request sent')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
