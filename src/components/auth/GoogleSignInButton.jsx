import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { GOOGLE_CLIENT_ID, googleErrorMessage } from '../../lib/helpers/google';

export default function GoogleSignInButton({ onCredential, text = 'signin_with', describeError = googleErrorMessage }) {
  const [error, setError] = useState(''), [pending, setPending] = useState(false);
  // Without a client ID GoogleOAuthProvider is not mounted, so rendering GoogleLogin would throw.
  if (!GOOGLE_CLIENT_ID) return null;

  async function handleSuccess({ credential }) {
    if (pending) return;
    setPending(true);
    setError('');
    try { await onCredential(credential); }
    catch (failure) { setError(describeError(failure)); }
    finally { setPending(false); }
  }

  return <div className="google-button">
    {error && <p role="alert">{error}</p>}
    {pending ? <p role="status">Contacting Google…</p> :
      <GoogleLogin text={text} onSuccess={handleSuccess} onError={() => setError('Google sign-in was cancelled or failed.')} />}
  </div>;
}
