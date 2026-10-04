import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { emptyResource, startRequest } from '../lib/helpers/request';
import userService from '../services/userService';
import AsyncState from '../components/common/AsyncState';
import PlayerProfile from '../components/users/PlayerProfile';
import ProfileActions from '../components/users/ProfileActions';

export default function ProfilePage({ session }) {
  const { userId } = useParams();
  const [profile, setProfile] = useState(() => emptyResource());
  const [retry, setRetry] = useState(0);
  useEffect(() => startRequest(signal => userService.get(userId, { signal }), setProfile), [userId, retry]);

  return <main>
    <AsyncState loading={profile.loading} error={profile.error} onRetry={() => setRetry(count => count + 1)}>
      {profile.data && <>
        <PlayerProfile user={profile.data} />
        <ProfileActions user={profile.data} session={session} />
      </>}
    </AsyncState>
  </main>;
}
