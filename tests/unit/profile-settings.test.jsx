import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileForm from '../../src/components/users/ProfileForm';
import PlayerProfile from '../../src/components/users/PlayerProfile';
import GoogleLinkControls from '../../src/components/users/GoogleLinkControls';
import GoogleSignInButton from '../../src/components/auth/GoogleSignInButton';
import SettingsPage from '../../src/pages/SettingsPage';
import userService from '../../src/services/userService';
import googleAuthService from '../../src/services/googleAuthService';

const google = vi.hoisted(() => ({ clientId: 'test-client' }));
vi.mock('../../src/lib/helpers/google', async importOriginal => ({
  ...await importOriginal(), get GOOGLE_CLIENT_ID() { return google.clientId; },
}));
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess, onError }) => <><button onClick={() => onSuccess({ credential: 'test-google-id-token' })}>Google sign in</button><button onClick={onError}>Cancel Google</button></>,
}));
vi.mock('../../src/services/userService', () => ({ default: { getMe: vi.fn(), updateMe: vi.fn() } }));
vi.mock('../../src/services/googleAuthService', () => ({ default: { link: vi.fn() } }));
const me = { id: 1, user_name: 'Alice', email: 'alice@example.test', bio: 'Enjoys football', photo_url: 'https://example.test/alice.png', district: 'capital', google_linked: false };
beforeEach(() => {
  google.clientId = 'test-client';
  userService.getMe.mockReset().mockResolvedValue(me);
  userService.updateMe.mockReset().mockResolvedValue(me);
  googleAuthService.link.mockReset().mockResolvedValue({ ...me, google_linked: true });
});

describe('profile edits and public display', () => {
  it('trims the user name and clears optional fields with null while excluding private account fields', async () => {
    const onSubmit = vi.fn().mockResolvedValue(null);
    render(<ProfileForm user={me} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('User name'), { target: { value: ' Alice updated ' } });
    fireEvent.change(screen.getByLabelText('Photo URL'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Bio'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('Governorate'), { target: { value: '' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save profile' }).closest('form'));
    await screen.findByText('Profile saved.');
    expect(onSubmit).toHaveBeenCalledWith({ user_name: 'Alice updated', photo_url: null, bio: null, district: null });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('email');
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('google_linked');
  });
  it('retains typed values and re-enables the form after a failed profile save', async () => {
    render(<ProfileForm user={me} onSubmit={vi.fn().mockRejectedValue(new Error('Name is already in use'))} />);
    fireEvent.change(screen.getByLabelText('User name'), { target: { value: 'Keep this name' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save profile' }).closest('form'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Name is already in use');
    expect(screen.getByLabelText('User name')).toHaveValue('Keep this name');
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeEnabled();
    expect(screen.queryByText('Profile saved.')).not.toBeInTheDocument();
  });
  it('prevents duplicate profile saves and sends the selected governorate', async () => {
    const onSubmit = vi.fn(() => new Promise(() => {}));
    render(<ProfileForm user={me} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Governorate'), { target: { value: 'southern' } });
    const form = screen.getByRole('button', { name: 'Save profile' }).closest('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0].district).toBe('southern');
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });
  it('renders a public profile without private email, provider state or token', () => {
    render(<PlayerProfile user={{ ...me, token: 'private-token' }} />);
    expect(screen.getByRole('heading', { name: 'Alice' })).toBeVisible();
    expect(screen.getByText('Enjoys football')).toBeVisible();
    expect(screen.queryByText(me.email)).not.toBeInTheDocument();
    expect(screen.queryByText('private-token')).not.toBeInTheDocument();
  });
  it('uses a recognizable empty profile when no photo or bio exists', () => {
    render(<PlayerProfile user={{ id: 1, user_name: 'Alice' }} />);
    expect(screen.getByText('No bio yet.')).toBeVisible();
    expect(screen.getByText('A')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('settings account persistence', () => {
  it('loads the private account, saves via the backend and refreshes account chrome', async () => {
    const refreshUser = vi.fn().mockResolvedValue(null);
    render(<MemoryRouter><SettingsPage session={{ refreshUser }} /></MemoryRouter>);
    await screen.findByLabelText('User name');
    fireEvent.change(screen.getByLabelText('User name'), { target: { value: 'Alice updated' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save profile' }).closest('form'));
    await waitFor(() => expect(refreshUser).toHaveBeenCalledOnce());
    expect(userService.updateMe.mock.calls[0][0].user_name).toBe('Alice updated');
    await waitFor(() => expect(userService.getMe).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('link', { name: 'View my profile' })).toHaveAttribute('href', '/users/1');
  });
  it('recovers an account load failure through an explicit retry', async () => {
    userService.getMe.mockRejectedValueOnce(new Error('Account unavailable'));
    render(<MemoryRouter><SettingsPage session={{ refreshUser: vi.fn() }} /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Account unavailable');
    expect(screen.queryByLabelText('User name')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('User name')).toHaveValue('Alice');
  });
  it('links Google through the private endpoint and immediately displays persisted linked state', async () => {
    render(<MemoryRouter><SettingsPage session={{ refreshUser: vi.fn() }} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Google sign in' }));
    expect(await screen.findByText('Google is linked. You can sign in with Google.')).toBeVisible();
    expect(googleAuthService.link).toHaveBeenCalledWith({ credential: 'test-google-id-token' });
    expect(screen.queryByRole('button', { name: 'Google sign in' })).not.toBeInTheDocument();
  });
});

describe('Google configuration and provider failure boundaries', () => {
  it('omits the provider UI when Google is unconfigured', () => {
    google.clientId = '';
    render(<GoogleLinkControls me={me} onLink={vi.fn()} />);
    expect(screen.getByText('Google sign-in is not configured.')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('shows a linked account without offering another link operation', () => {
    render(<GoogleLinkControls me={{ ...me, google_linked: true }} onLink={vi.fn()} />);
    expect(screen.getByText('Google is linked. You can sign in with Google.')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('distinguishes a link conflict from a password account sign-in conflict', async () => {
    render(<GoogleLinkControls me={me} onLink={vi.fn().mockRejectedValue({ status: 409 })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Google sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This Google account is already linked to another user.');
  });
  it('explains how to recover a sign-in conflict and permits another provider attempt', async () => {
    render(<GoogleSignInButton onCredential={vi.fn().mockRejectedValue({ status: 409 })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Google sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign in with your password, then link Google in Settings.');
    expect(screen.getByRole('button', { name: 'Google sign in' })).toBeEnabled();
  });
  it('shows a pending status without duplicate provider controls until the exchange finishes', async () => {
    let resolve;
    const onCredential = vi.fn(() => new Promise(yes => { resolve = yes; }));
    render(<GoogleSignInButton onCredential={onCredential} />);
    fireEvent.click(screen.getByRole('button', { name: 'Google sign in' }));
    expect(screen.getByRole('status')).toHaveTextContent('Contacting Google…');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    await act(async () => resolve());
    expect(screen.getByRole('button', { name: 'Google sign in' })).toBeEnabled();
    expect(onCredential).toHaveBeenCalledOnce();
  });
  it('reports provider cancellation without attempting a backend credential exchange', () => {
    const onCredential = vi.fn();
    render(<GoogleSignInButton onCredential={onCredential} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Google' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Google sign-in was cancelled or failed.');
    expect(onCredential).not.toHaveBeenCalled();
  });
});
