import { Navigate } from 'react-router';

export default function RequireAuth({ session, children }) {
  // Wait for the stored token to be checked, otherwise a refresh would bounce signed-in users to /sign-in.
  if (session.loading) return <main><p role="status">Restoring session…</p></main>;
  // Signing out from a guarded page goes home; a visitor without a session is sent to sign in (and sign-in always ends at home).
  if (!session.user) return <Navigate to={session.leaving ? '/' : '/sign-in'} replace />;
  return children;
}
