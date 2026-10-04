import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { emptyResource, startRequest } from '../lib/helpers/request';
import userService from '../services/userService';
import googleAuthService from '../services/googleAuthService';
import AsyncState from '../components/common/AsyncState';
import ProfileForm from '../components/users/ProfileForm';
import GoogleLinkControls from '../components/users/GoogleLinkControls';

export default function SettingsPage({ session }) {
  // Load /users/me here: only it returns email, has_password and google_linked.
  const [me, setMe] = useState(() => emptyResource());
  const [revision, setRevision] = useState(0);
  const reload = () => setRevision(count => count + 1);
  useEffect(() => startRequest(signal => userService.getMe({ signal }), setMe), [revision]);

  async function saveProfile(body) {
    await userService.updateMe(body);
    reload();
    session.refreshUser();
  }

  async function linkGoogle(credential) {
    await googleAuthService.link({ credential });
    reload();
  }

  return <main>
    <h1>Settings</h1>
    <AsyncState loading={me.loading && !me.data} error={me.error} onRetry={reload}>
      {me.data && <>
        <p><Link to={`/users/${me.data.id}`}>View my profile</Link></p>
        <section className="page-section">
          <h2>Profile</h2>
          <ProfileForm user={me.data} onSubmit={saveProfile} />
        </section>
        <GoogleLinkControls me={me.data} onLink={linkGoogle} />
      </>}
    </AsyncState>
  </main>;
}
