import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PeoplePicker from '../../src/components/common/PeoplePicker';
import useUsers, { ensureUsers, peekUser, rememberUsers, resetUserDirectory } from '../../src/lib/helpers/userDirectory';
import userService from '../../src/services/userService';

vi.mock('../../src/services/userService', () => ({ default: { listByIds: vi.fn(), search: vi.fn() } }));
const everyone = [1, 2, 3, 4].map(id => ({ id, user_name: `Person ${id}` }));

beforeEach(() => {
  resetUserDirectory();
  userService.listByIds.mockReset().mockImplementation(async ids => everyone.filter(user => ids.includes(user.id)));
  userService.search.mockReset().mockImplementation(async text => everyone.filter(user => user.user_name.toLowerCase().includes(text.toLowerCase())));
});
afterEach(() => vi.useRealTimers());

describe('user directory', () => {
  it('loads only the missing ids, once, and remembers them', async () => {
    await ensureUsers([1, 2, 2, '3']);
    expect(userService.listByIds).toHaveBeenCalledExactlyOnceWith([1, 2, 3], {});
    expect(peekUser(2).user_name).toBe('Person 2');
    await ensureUsers([1, 2, 3]);
    expect(userService.listByIds).toHaveBeenCalledTimes(1);
    await ensureUsers([3, 4]);
    expect(userService.listByIds).toHaveBeenLastCalledWith([4], {});
  });

  it('shares one request between callers that ask for the same ids at the same time', async () => {
    await Promise.all([ensureUsers([1, 2]), ensureUsers([2, 1])]);
    expect(userService.listByIds).toHaveBeenCalledTimes(1);
  });

  it('does not ask again for an id the server did not return, until it is stale', async () => {
    vi.useFakeTimers();
    await ensureUsers([99]);
    expect(peekUser(99)).toBeNull();
    await ensureUsers([99]);
    expect(userService.listByIds).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 6 * 60_000);
    await ensureUsers([99]);
    expect(userService.listByIds).toHaveBeenCalledTimes(2);
  });

  it('keeps names it already has when a refresh fails, and tries again later', async () => {
    await ensureUsers([1]);
    userService.listByIds.mockRejectedValueOnce(new Error('offline'));
    await expect(ensureUsers([2])).resolves.toBeUndefined();
    expect(peekUser(1).user_name).toBe('Person 1');
    expect(peekUser(2)).toBeNull();
    await ensureUsers([2]);
    expect(peekUser(2).user_name).toBe('Person 2');
  });

  it('accepts profiles from search results so they are not fetched again', async () => {
    rememberUsers([{ id: 4, user_name: 'Searched' }]);
    await ensureUsers([4]);
    expect(userService.listByIds).not.toHaveBeenCalled();
    expect(peekUser(4).user_name).toBe('Searched');
  });

  it('useUsers returns the loaded profiles, and makes no request for no ids', async () => {
    const { result, rerender } = renderHook(({ ids }) => useUsers(ids), { initialProps: { ids: [] } });
    expect(result.current).toEqual([]);
    expect(userService.listByIds).not.toHaveBeenCalled();
    rerender({ ids: [2, 3] });
    await waitFor(() => expect(result.current.map(user => user.user_name)).toEqual(['Person 2', 'Person 3']));
    rerender({ ids: [3, 2] });
    expect(userService.listByIds).toHaveBeenCalledTimes(1);
  });
});

describe('PeoplePicker', () => {
  const show = (props = {}) => {
    const onPick = props.onPick ?? vi.fn();
    render(<PeoplePicker label="Find people" actionLabel="Invite" onPick={onPick} {...props} />);
    return { onPick, input: screen.getByLabelText('Find people') };
  };

  it('searches once after a pause in typing, not on every key', async () => {
    const { input } = show();
    await userEvent.type(input, 'Person');
    expect(await screen.findByRole('button', { name: 'Invite Person 1' })).toBeVisible();
    expect(userService.search).toHaveBeenCalledTimes(1);
    expect(userService.search).toHaveBeenCalledWith('Person', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('shows nobody until something is typed, hides excluded people, and says when nothing matches', async () => {
    const { input } = show({ exclude: [2] });
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    await userEvent.type(input, 'Person');
    await screen.findByRole('button', { name: 'Invite Person 1' });
    expect(screen.queryByRole('button', { name: 'Invite Person 2' })).not.toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, 'zzz');
    expect(await screen.findByText('No people found.')).toBeVisible();
  });

  it('shows at most eight people', async () => {
    const many = Array.from({ length: 12 }, (_, index) => ({ id: 100 + index, user_name: `Match ${index}` }));
    userService.search.mockResolvedValue(many);
    const { input } = show();
    await userEvent.type(input, 'Match');
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Invite/ })).toHaveLength(8));
  });

  it('clears the search after a pick, but keeps it when the pick fails (onPick returns false)', async () => {
    const onPick = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { input } = show({ onPick });
    await userEvent.type(input, 'Person 3');
    await userEvent.click(await screen.findByRole('button', { name: 'Invite Person 3' }));
    expect(onPick).toHaveBeenCalledWith(everyone[2]);
    expect(input).toHaveValue('Person 3');
    await userEvent.click(screen.getByRole('button', { name: 'Invite Person 3' }));
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('shows a failed search and recovers on the next one', async () => {
    userService.search.mockRejectedValueOnce(new Error('Search is down'));
    const { input } = show();
    await userEvent.type(input, 'Per');
    expect(await screen.findByRole('alert')).toHaveTextContent('Search is down');
    await userEvent.type(input, 's');
    expect(await screen.findByRole('button', { name: 'Invite Person 1' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('disables the search field and the buttons while disabled', async () => {
    const { input } = show({ disabled: true });
    expect(input).toBeDisabled();
  });

  it('remembers found people in the directory for later name lookups', async () => {
    const { input } = show();
    await userEvent.type(input, 'Person 4');
    await screen.findByRole('button', { name: 'Invite Person 4' });
    expect(peekUser(4).user_name).toBe('Person 4');
    fireEvent.change(input, { target: { value: '' } });
    await act(async () => {});
  });
});
