import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RoomPreviewDialog from '../../src/components/activities/RoomPreviewDialog';
import Dialog from '../../src/components/common/Dialog';
import roomService from '../../src/services/roomService';
import roomMemberService from '../../src/services/roomMemberService';

vi.mock('../../src/services/roomService', () => ({ default: { get: vi.fn() } }));
vi.mock('../../src/services/roomMemberService', () => ({ default: { list: vi.fn(), request: vi.fn(), leave: vi.fn() } }));
const live = vi.hoisted(() => ({ listeners: new Set() }));
vi.mock('../../src/services/websocketService', () => ({ listen: callback => { live.listeners.add(callback); return () => live.listeners.delete(callback); } }));

let room;
const player = { id: 2, user_name: 'Player' };

function RouteProbe() {
  const location = useLocation();
  return <output aria-label="Return location">{location.state?.from || ''}</output>;
}

function renderPreview(props = {}) {
  return render(<MemoryRouter initialEntries={['/sports?district=capital']}><RoomPreviewDialog room={room} sportName="Football" onClose={vi.fn()} session={{ user: player, loading: false }} {...props} /><RouteProbe /></MemoryRouter>);
}

beforeEach(() => {
  live.listeners.clear();
  room = {
    id: 11, host_id: 1, sport_id: 1, title: 'Friday football', starts_at: new Date(Date.now() + 120 * 60_000).toISOString(),
    ends_at: new Date(Date.now() + 180 * 60_000).toISOString(), district: 'capital', area: 'Manama',
    status: 'open', difficulty: 'medium', capacity: 2, description: 'A friendly match.',
  };
  roomService.get.mockReset().mockResolvedValue(room);
  roomMemberService.list.mockReset().mockResolvedValue([]);
  roomMemberService.request.mockReset().mockResolvedValue({ id: 21, user_id: 2, status: 'pending' });
  roomMemberService.leave.mockReset().mockResolvedValue(null);
});

describe('public activity previews', () => {
  it('loads current details and exposes safe location and accepted-player count', async () => {
    roomMemberService.list.mockResolvedValue([{ user_id: 3, status: 'accepted' }, { user_id: 4, status: 'pending' }]);
    renderPreview();
    expect(await screen.findByRole('button', { name: 'Request to join' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Friday football' })).toHaveAttribute('open');
    expect(screen.getByText('Manama · Capital')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.queryByText('Venue details')).not.toBeInTheDocument();
    expect(roomService.get).toHaveBeenCalledWith(11, expect.objectContaining({ signal: expect.any(AbortSignal), auth: 'optional' }));
  });

  it('keeps the dialog named and announces loading before details are available', async () => {
    let resolveRoom;
    roomService.get.mockImplementation(() => new Promise((resolve) => { resolveRoom = resolve; }));
    renderPreview();
    expect(screen.getByRole('dialog', { name: 'Friday football' })).toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    await waitFor(() => expect(roomService.get).toHaveBeenCalledTimes(1));
    await act(async () => resolveRoom(room));
    expect(await screen.findByRole('button', { name: 'Request to join' })).toBeInTheDocument();
  });

  it('prevents membership actions when loading fails and allows recovery', async () => {
    const user = userEvent.setup();
    roomMemberService.list.mockRejectedValueOnce(new Error('Could not load current players.'));
    renderPreview();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load current players.');
    expect(screen.queryByRole('button', { name: 'Request to join' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Request to join' })).toBeInTheDocument();
    expect(roomMemberService.request).not.toHaveBeenCalled();
  });

  it('sends guests to sign in without a return destination', async () => {
    const user = userEvent.setup();
    renderPreview({ session: { user: null, loading: false } });
    const signIn = await screen.findByRole('link', { name: 'Sign in to request a place' });
    expect(screen.queryByRole('button', { name: 'Request to join' })).not.toBeInTheDocument();
    await user.click(signIn);
    // Sign-in always lands on home now, so no return location is passed.
    expect(screen.getByLabelText('Return location')).toBeEmptyDOMElement();
    expect(roomMemberService.request).not.toHaveBeenCalled();
  });

  it('uses server availability and updates eligibility when the last place disappears live', async () => {
    roomService.get.mockResolvedValue({ ...room, slots_left: 1 });
    renderPreview();
    await screen.findByRole('button', { name: 'Request to join' });
    expect(screen.getByText('Available places')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open room lobby' })).toHaveAttribute('href', '/rooms/11');
    roomService.get.mockResolvedValue({ ...room, slots_left: 0 });
    await act(async () => { for (const callback of live.listeners) callback({ type: 'room.updated', room_id: 11 }); });
    expect(await screen.findByText('This activity is full.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request to join' })).not.toBeInTheDocument();
  });
});

describe('fresh membership decisions', () => {
  it('requests a pending place, refreshes the UI and notifies the parent list', async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    roomMemberService.request.mockImplementation(async () => {
      roomMemberService.list.mockResolvedValue([{ user_id: 2, status: 'pending', requested: true }]);
      return { user_id: 2, status: 'pending' };
    });
    renderPreview({ onUpdated });
    await user.click(await screen.findByRole('button', { name: 'Request to join' }));
    expect(await screen.findByText('Request pending. The host must approve your place.')).toBeInTheDocument();
    expect(roomMemberService.request).toHaveBeenCalledExactlyOnceWith(11);
    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Request to join' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdraw request' })).toBeInTheDocument();
    expect(roomService.get.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('withdraws a pending request and respects the retained terminal membership', async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    roomMemberService.list.mockResolvedValue([{ user_id: 2, status: 'pending', requested: true }]);
    roomMemberService.leave.mockImplementation(async () => {
      roomMemberService.list.mockResolvedValue([{ user_id: 2, status: 'left' }]);
      return null;
    });
    renderPreview({ onUpdated });
    await user.click(await screen.findByRole('button', { name: 'Withdraw request' }));
    expect(await screen.findByText('You left this activity. Another request is unavailable.')).toBeInTheDocument();
    expect(roomMemberService.leave).toHaveBeenCalledExactlyOnceWith(11);
    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Request to join' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Withdraw request' })).not.toBeInTheDocument();
  });

  it('refuses a stale request when the refreshed start is already inside the cutoff', async () => {
    const user = userEvent.setup();
    const unavailableRoom = { ...room, starts_at: new Date(Date.now() + 10 * 60_000).toISOString() };
    roomService.get.mockResolvedValue(unavailableRoom).mockResolvedValueOnce(room);
    renderPreview();
    await user.click(await screen.findByRole('button', { name: 'Request to join' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Requests close 15 minutes before the activity starts.');
    expect(roomMemberService.request).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Request to join' })).not.toBeInTheDocument());
  });

  it('refuses a stale request when other players filled the last places', async () => {
    const user = userEvent.setup();
    roomMemberService.list.mockResolvedValue([{ user_id: 3, status: 'accepted' }, { user_id: 4, status: 'accepted' }]).mockResolvedValueOnce([]);
    renderPreview();
    await user.click(await screen.findByRole('button', { name: 'Request to join' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This activity is full.');
    expect(roomMemberService.request).not.toHaveBeenCalled();
    expect(await screen.findByText('2 / 2')).toBeInTheDocument();
  });

  it('reports backend mutation failures and refreshes changed membership state', async () => {
    const user = userEvent.setup();
    roomMemberService.request.mockRejectedValue(new Error('Already requested or a member'));
    renderPreview();
    await user.click(await screen.findByRole('button', { name: 'Request to join' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Already requested or a member');
    await waitFor(() => expect(roomService.get).toHaveBeenCalledTimes(3));
  });

  it.each([
    ['accepted', 'You are admitted to this activity.'],
    ['left', 'You left this activity. Another request is unavailable.'],
    ['declined', 'Your request was declined. Another request is unavailable.'],
    ['removed', 'You were removed from this activity. Another request is unavailable.'],
  ])('keeps existing %s members from requesting again', async (status, message) => {
    roomMemberService.list.mockResolvedValue([{ user_id: 2, status }]);
    renderPreview();
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request to join' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Withdraw request' })).not.toBeInTheDocument();
  });

  it('shows hosting context rather than asking the host to request a place', async () => {
    roomService.get.mockResolvedValue({ ...room, venue_notes: 'Court gate 2' });
    renderPreview({ session: { user: { id: 1 }, loading: false } });
    expect(await screen.findByText("You're hosting this activity.")).toBeInTheDocument();
    expect(screen.getByText('Court gate 2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request to join' })).not.toBeInTheDocument();
  });
});

describe('native modal dismissal', () => {
  it('uses the native Escape cancel event to notify the owner without leaving stale open state', () => {
    const onClose = vi.fn();
    const { unmount } = render(<Dialog title="Activity details" onClose={onClose}><p>Preview</p></Dialog>);
    const dialog = screen.getByRole('dialog', { name: 'Activity details' });
    expect(dialog).toHaveAttribute('open');
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(dialog).not.toHaveAttribute('open');
  });

  it('preserves interior clicks and closes only when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<Dialog title="Activity details" onClose={onClose}><button type="button">Inside action</button></Dialog>);
    const dialog = screen.getByRole('dialog', { name: 'Activity details' });
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 100, right: 500, bottom: 400 });
    fireEvent.click(screen.getByRole('button', { name: 'Inside action' }));
    fireEvent.click(dialog, { clientX: 150, clientY: 150 });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(dialog, { clientX: 50, clientY: 50 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
