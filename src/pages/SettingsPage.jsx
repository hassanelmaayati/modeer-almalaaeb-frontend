import { useEffect, useState } from 'react';
import { emptyResource, startRequest } from '../lib/helpers/request';
import userService from '../services/userService';
import googleAuthService from '../services/googleAuthService';
import AsyncState from '../components/common/AsyncState';
import PlayerProfile from '../components/users/PlayerProfile';
import ProfileForm from '../components/users/ProfileForm';
import GoogleLinkControls from '../components/users/GoogleLinkControls';
import { ProfileArt } from '../components/home/HeroArt';

// One page for the signed-in player: their profile on top, the settings that change it underneath.
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

  return <main className="home account-scope">
    <div className="home-content">
      <AsyncState loading={me.loading && !me.data} error={me.error} onRetry={reload}>
        {me.data && <>
          <section className="sports-banner profile-banner" aria-label="Your profile">
            <ProfileArt />
            <PlayerProfile user={me.data} />
          </section>
          <section className="home-section account-settings" aria-labelledby="settings-title">
            <h2 id="settings-title">Settings</h2>
            <p className="home-subtitle">Update how other players see you and manage how you sign in.</p>
            <div className="account-grid">
              <section className="account-card" aria-labelledby="settings-profile-title">
                <h3 id="settings-profile-title">Edit profile</h3>
                <ProfileForm user={me.data} onSubmit={saveProfile} />
              </section>
              <GoogleLinkControls me={me.data} onLink={linkGoogle} />
            </div>
          </section>
        </>}
      </AsyncState>
    </div>
  </main>;
}
