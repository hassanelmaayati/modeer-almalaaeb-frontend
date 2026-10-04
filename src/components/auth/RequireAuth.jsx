import { Navigate, useLocation } from 'react-router';

export default function RequireAuth({ session, children }) {
  const location = useLocation();
  // Wait for the stored token to be checked, otherwise a refresh would bounce signed-in users to /sign-in.
  if (session.loading) return <main><p role="status">Restoring session…</p></main>;
  // AuthForm reads state.from to send the user back here after signing in.
  if (!session.user) return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />;
  return children;
}
