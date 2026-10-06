import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { emptyResource, startRequest } from '../lib/helpers/request';
import userService from '../services/userService';
import googleAuthService from '../services/googleAuthService';
import AsyncState from '../components/common/AsyncState';
import ProfileForm from '../components/users/ProfileForm';
import GoogleLinkControls from '../components/users/GoogleLinkControls';

export default function SettingsPage({ session }) {
  // Load /users/me here: the private user (email, google_linked) only comes from the account endpoints.
  const [me, setMe] = useState(() => emptyResource());
  const [revision, setRevision] = useState(0);
  const reload = () => setRevision(count => count + 1);
  useEffect(() => startRequest(signal => userService.getMe({ signal }), setMe), [revision]);

  async function saveProfile(body) {
    // PUT returns the updated private user, so no refetch is needed.
    setMe({ data: await userService.updateMe(body), loading: false, error: null });
    // The save already succeeded; a failed NavBar refresh shouldn't turn it into an error.
    try { await session.refreshUser(); } catch { /* NavBar keeps the old name until the next load */ }
  }

  async function linkGoogle(credential) {
    // The link response is the updated private user (google_linked: true), so no reload is needed.
    setMe({ data: await googleAuthService.link({ credential }), loading: false, error: null });
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
