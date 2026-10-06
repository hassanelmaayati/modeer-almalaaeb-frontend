import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

const LINKS = [
  { to: '/my-rooms', label: 'My rooms' },
  { to: '/joined-rooms', label: 'Joined rooms' },
  { to: '/friends', label: 'Friends' },
  { to: '/settings', label: 'Settings' },
];

export default function UserMenu({ user, pending, onSignOut }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const initial = (user.user_name || '?').charAt(0).toUpperCase();

  return <div className="user-menu" ref={root}>
    <button type="button" className="user-menu-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <span className="avatar-initial" aria-hidden="true">{initial}</span>
      <span className="user-menu-name">{user.user_name}</span>
      <span className="user-menu-caret" aria-hidden="true">▾</span>
    </button>
    {open && <ul className="user-menu-list" role="menu" aria-label="Account">
      {LINKS.map((item) => <li key={item.to} role="none">
        <Link role="menuitem" to={item.to} onClick={() => setOpen(false)}>{item.label}</Link>
      </li>)}
      <li role="none">
        <button type="button" role="menuitem" disabled={pending} onClick={() => { setOpen(false); onSignOut(); }}>{pending ? 'Signing out…' : 'Sign out'}</button>
      </li>
    </ul>}
  </div>;
}
