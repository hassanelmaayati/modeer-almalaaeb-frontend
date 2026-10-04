import { Link } from 'react-router';

export default function CreateCupAction({ session }) {
  // Any signed-in user can organize a cup (there is no global organizer role); guests are sent to sign in first.
  if (session.loading) return null;
  return session.user
    ? <Link to="/cups/new">Create a cup</Link>
    : <Link to="/sign-in" state={{ from: '/cups/new' }}>Sign in to create a cup</Link>;
}
