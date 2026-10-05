import { Link } from 'react-router';

export default function FriendRow({ name, userId, label }) {
  return <li className="friend-row panel">
    <Link to={`/users/${userId}`}>{name}</Link>
    <span className="status-badge">{label}</span>
  </li>;
}
