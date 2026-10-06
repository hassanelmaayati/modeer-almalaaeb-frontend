import { GOOGLE_CLIENT_ID } from '../../lib/helpers/google';
import GoogleSignInButton from '../auth/GoogleSignInButton';

// While linking, a 409 means this Google account already belongs to another user; the backend's detail says so.
// (Unlike the sign-in 409, which tells the user to link Google from Settings.)
const linkError = error => error?.message || 'Linking Google failed.';

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
