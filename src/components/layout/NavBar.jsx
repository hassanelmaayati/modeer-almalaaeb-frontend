import { useState } from 'react';
import { Link, NavLink } from 'react-router';

export default function NavBar({ session }) {
  const { user, loading, signOut } = session;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSignOut() {
    setPending(true);
    setError('');
    try { await signOut(); }
    catch { setError('Signed out on this device. The server could not confirm logout.'); }
    finally { setPending(false); }
  }

  return <header className="site-header">
    <Link to="/">Modeer Almalaaeb</Link>
    <nav aria-label="Main navigation">
      <NavLink to="/" end>Home</NavLink>
      <NavLink to="/groups">Groups</NavLink>
      <NavLink to="/sports">Sports</NavLink>
      {loading ? <span role="status">Restoring session…</span> : user ? <>
        <span>Signed in as {user.user_name}</span>
        <button type="button" onClick={handleSignOut} disabled={pending}>{pending ? 'Signing out…' : 'Sign out'}</button>
      </> : <>
        <NavLink to="/sign-in">Sign in</NavLink>
        <NavLink to="/sign-up">Sign up</NavLink>
      </>}
    </nav>
    {error && <p role="alert">{error}</p>}
  </header>;
}
