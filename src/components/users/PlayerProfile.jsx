import { formatActivityDate } from '../../lib/helpers/date';

export default function PlayerProfile({ user }) {
  return <article className="player-profile">
    {user.photo_url ? <img className="avatar avatar-large" src={user.photo_url} alt="" /> : <span className="avatar avatar-large" aria-hidden="true">{user.user_name.charAt(0).toUpperCase()}</span>}
    <div>
      <h1>{user.user_name}</h1>
      {user.created_at && <p className="muted">Member since {formatActivityDate(user.created_at)}</p>}
      <p>{user.bio || 'No bio yet.'}</p>
    </div>
  </article>;
}
