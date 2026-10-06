import { formatActivityDate } from '../../lib/helpers/date';
import { DISTRICTS, optionLabel } from '../../lib/helpers/filters';

export default function PlayerProfile({ user }) {
  return <article className="player-profile">
    {user.photo_url ? <img className="avatar avatar-large" src={user.photo_url} alt="" /> : <span className="avatar avatar-large" aria-hidden="true">{user.user_name.charAt(0).toUpperCase()}</span>}
    <div className="player-profile-body">
      <h1>{user.user_name}</h1>
      {user.created_at && <p className="muted">Member since {formatActivityDate(user.created_at)}</p>}
      {user.district && <p className="player-district">Based in {optionLabel(DISTRICTS, user.district)}</p>}
      <p className="player-bio">{user.bio || 'No bio yet.'}</p>
    </div>
  </article>;
}
