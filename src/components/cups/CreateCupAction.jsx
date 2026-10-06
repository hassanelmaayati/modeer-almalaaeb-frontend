import { Link } from 'react-router';

export default function CreateCupAction({ session, className }) {
  // Any signed-in user can organize a cup (there is no global organizer role); guests are sent to sign in first.
  if (session.loading) return null;
  return session.user
    ? <Link className={className} to="/cups/new">Create a cup</Link>
    : <Link className={className} to="/sign-in" state={{ from: '/cups/new' }}>Sign in to create a cup</Link>;
}
