import { GOOGLE_CLIENT_ID } from '../../lib/helpers/google';
import GoogleSignInButton from '../auth/GoogleSignInButton';

// While linking, 409 means this Google account already belongs to another user (not the sign-in 409).
const linkError = error => error?.status === 409 ? 'This Google account is already linked to another user.' : error?.message || 'Linking Google failed.';

/** @param {{ me: { email: string, google_linked: boolean }, onLink: (credential: string) => Promise<void> }} props */
export default function GoogleLinkControls({ me, onLink }) {
  return <section className="page-section">
    <h2>Google account</h2>
    <p>Email: {me.email}</p>
    {me.google_linked ? <p>Google is linked. You can sign in with Google.</p> : <>
      <p>Link Google to sign in without your password.</p>
      {GOOGLE_CLIENT_ID ? <GoogleSignInButton text="continue_with" onCredential={onLink} describeError={linkError} /> : <p className="muted">Google sign-in is not configured.</p>}
    </>}
  </section>;
}
