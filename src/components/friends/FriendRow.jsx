import { Link } from 'react-router';

export default function FriendRow({ name, userId, label, children }) {
  return <li className="friend-row panel">
    <div className={`friend-avatar friend-tone-${Math.abs(Number(userId) || 0) % 4}`} aria-hidden="true">{name.charAt(0).toUpperCase()}</div>
    <Link className="friend-name" to={`/users/${userId}`}>{name}</Link>
    <span className="status-badge">{label}</span>
    {children}
  </li>;
}
