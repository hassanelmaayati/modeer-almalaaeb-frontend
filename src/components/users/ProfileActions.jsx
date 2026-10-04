import { Link } from 'react-router';

export default function ProfileActions({ user, session }) {
  // Only the owner can edit; other users get actions (friend, message) from the membership features later.
  if (session.user?.id !== user.id) return null;
  return <div className="actions"><Link to="/settings">Edit profile</Link></div>;
}
