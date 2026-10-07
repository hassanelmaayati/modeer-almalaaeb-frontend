import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { emptyResource, startRequest } from '../lib/helpers/request';
import userService from '../services/userService';
import AsyncState from '../components/common/AsyncState';
import PlayerProfile from '../components/users/PlayerProfile';
import ProfileActions from '../components/users/ProfileActions';
import { ProfileArt } from '../components/home/HeroArt';
import AttendanceRatingSummary from '../components/ratings/AttendanceRatingSummary';

export default function ProfilePage({ session }) {
  const { userId } = useParams();
  const [profile, setProfile] = useState(() => emptyResource());
  const [retry, setRetry] = useState(0);
  // Your own profile lives on the Profile page (with your settings), so there is no separate public view of it.
  const isOwn = session.user?.id != null && String(session.user.id) === String(userId);
  useEffect(() => isOwn ? undefined : startRequest(signal => userService.get(userId, { signal }), setProfile), [userId, retry, isOwn]);

  if (isOwn) return <Navigate to="/settings" replace />;

  return <main className="home account-scope">
    <div className="home-content">
      <AsyncState loading={profile.loading} error={profile.error} onRetry={() => setRetry(count => count + 1)}>
        {profile.data && <>
          <section className="sports-banner profile-banner" aria-label="Player profile">
            <ProfileArt tag={profile.data.user_name.slice(0, 5).toUpperCase()} />
            <PlayerProfile user={profile.data} />
          </section>
          <div className="profile-actions"><ProfileActions user={profile.data} session={session} /></div>
          <AttendanceRatingSummary userId={profile.data.id} />
        </>}
      </AsyncState>
    </div>
  </main>;
}
