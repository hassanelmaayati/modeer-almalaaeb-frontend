import { Link } from 'react-router';
import FriendProfileActions from './FriendProfileActions';

export default function ProfileActions({ user, session }) {
  const viewerId = session.user?.id;
  if (viewerId == null) return null;
  if (viewerId === user.id) return <div className="actions"><Link to="/settings">Edit profile</Link></div>;
  return <FriendProfileActions viewerId={viewerId} user={user} />;
}
