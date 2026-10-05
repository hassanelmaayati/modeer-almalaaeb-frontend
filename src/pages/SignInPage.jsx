import SignInForm from '../components/auth/SignInForm';
import AuthIntro from '../components/auth/AuthIntro';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';

export default function SignInPage({ session }) {
  // AuthForm owns <main>, loading and the signed-in redirect, so the extra sections only show to guests.
  const guest = !session.loading && !session.user;
  return <>
    {guest && <div className="auth-section"><AuthIntro title="Welcome back" text="Sign in to host or join rooms, groups and cups." /></div>}
    <SignInForm session={session} />
    {guest && <section className="auth-section" aria-label="Other sign-in options">
      <GoogleSignInButton onCredential={session.signInWithGoogle} />
    </section>}
  </>;
}
