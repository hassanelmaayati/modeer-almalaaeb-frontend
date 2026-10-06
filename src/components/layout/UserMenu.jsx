import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

const LINKS = [
  { to: '/my-rooms', label: 'My rooms' },
  { to: '/joined-rooms', label: 'Joined rooms' },
  { to: '/friends', label: 'Friends' },
  { to: '/settings', label: 'Profile' },
];

export default function UserMenu({ user, pending, onSignOut }) {
  return <AccountMenu key={user.id} user={user} pending={pending} onSignOut={onSignOut} />;
}

function AccountMenu({ user, pending, onSignOut }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const openingItem = useRef(0);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const items = menu.current?.querySelectorAll('[role="menuitem"]:not(:disabled)');
    items?.[openingItem.current === -1 ? items.length - 1 : 0]?.focus();
    const closeOutside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
    };
  }, [open]);

  function handleKeyDown(event) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (event.target === trigger.current && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      openingItem.current = event.key === 'ArrowUp' ? -1 : 0;
      setOpen(true);
      return;
    }
    if (!open || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = [...menu.current.querySelectorAll('[role="menuitem"]:not(:disabled)')];
    const current = items.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }

  const initial = (user.user_name || '?').charAt(0).toUpperCase();

  return <div className="user-menu" ref={root} onKeyDown={handleKeyDown} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="user-menu-button" aria-label={user.user_name || 'Account'} aria-haspopup="menu" aria-controls={menuId} aria-expanded={open} onClick={() => {
      openingItem.current = 0;
      setOpen((value) => !value);
    }}>
      <span className="avatar-initial" aria-hidden="true">{initial}</span>
      <span className="user-menu-name">{user.user_name}</span>
      <span className="user-menu-caret" aria-hidden="true">▾</span>
    </button>
    {open && <ul ref={menu} id={menuId} className="user-menu-list" role="menu" aria-label="Account">
      {LINKS.map((item) => <li key={item.to} role="none">
        <Link role="menuitem" tabIndex={-1} to={item.to} onClick={() => setOpen(false)}>{item.label}</Link>
      </li>)}
      <li role="none">
        <button type="button" role="menuitem" tabIndex={-1} disabled={pending} onClick={() => { setOpen(false); onSignOut(); }}>{pending ? 'Signing out…' : 'Sign out'}</button>
      </li>
    </ul>}
  </div>;
}
