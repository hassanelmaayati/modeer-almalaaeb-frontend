import { Navigate } from 'react-router';

export default function RequireAuth({ session, children }) {
  // Wait for the stored token to be checked, otherwise a refresh would bounce signed-in users to /sign-in.
  if (session.loading) return <main><p className="status-message" role="status">Restoring session…</p></main>;
  // No state.from: sign-in always goes home.
  if (!session.user) return <Navigate to="/sign-in" replace />;
  return children;
}
