import { useState } from 'react';
import { Link, NavLink } from 'react-router';
import { formatUnreadCount } from '../../lib/helpers/messages';
import Logo from '../common/Logo';
import UserMenu from './UserMenu';
import ThemeToggle from './ThemeToggle';

function CountBadge({ count, label }) {
  if (count <= 0) return null;
  return <span className="nav-badge" aria-label={`${count} unread ${label}`}>{formatUnreadCount(count)}</span>;
}

function SignedInAccount({ user, signOut }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSignOut() {
    setPending(true);
    setError('');
    try { await signOut(); }
    catch { setError('Signed out on this device. The server could not confirm logout.'); }
    finally { setPending(false); }
  }

  return <>
    <Link className="button-primary nav-cta" to="/rooms/new">Host a room</Link>
    <UserMenu user={user} pending={pending} onSignOut={handleSignOut} />
    {error && <p className="nav-error" role="alert">{error}</p>}
  </>;
}

export default function NavBar({ session, unreadCount = 0, messageUnread = 0, liveStatus = 'idle' }) {
  const { user, loading, signOut } = session;

  return <header className="site-header">
    <Link className="brand" to="/" aria-label="Modeer Almalaaeb home"><Logo size={44} /></Link>
    <nav aria-label="Main navigation">
      <NavLink to="/sports">Find games</NavLink>
      <NavLink to="/cups">Cups</NavLink>
      <NavLink to="/groups">Groups</NavLink>
      {user && <>
        <NavLink to="/messages">Messages<CountBadge count={messageUnread} label="messages" /></NavLink>
        <NavLink to="/notifications">Notifications<CountBadge count={unreadCount} label="notifications" /></NavLink>
      </>}
    </nav>
    <div className="site-header-account">
      <ThemeToggle />
      {['connecting', 'reconnecting', 'error'].includes(liveStatus) && <span className="nav-status" role="status">Reconnecting…</span>}
      {loading ? <span className="nav-status" role="status">Restoring session…</span> : user ? <SignedInAccount key={user.id} user={user} signOut={signOut} /> : <>
        <Link className="nav-plain" to="/sign-up">Sign up</Link>
        {/* Google sign-in lives only on the sign-in and sign-up pages; the header just links there. */}
        <Link className="nav-plain" to="/sign-in">Sign in</Link>
      </>}
    </div>
  </header>;
}
