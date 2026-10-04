import SignUpForm from '../components/auth/SignUpForm';
import AuthIntro from '../components/auth/AuthIntro';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';

export default function SignUpPage({ session }) {
  // AuthForm owns <main>, loading and the signed-in redirect, so the extra sections only show to guests.
  const guest = !session.loading && !session.user;
  return <>
    {guest && <div className="auth-section"><AuthIntro title="Join Modeer Almalaaeb" text="Create an account to find players, teams and cups in Bahrain." /></div>}
    <SignUpForm session={session} />
    {guest && <section className="auth-section" aria-label="Other sign-up options">
      {/* /auth/google creates the account on first use, so the same button signs up. */}
      <GoogleSignInButton text="signup_with" onCredential={session.signInWithGoogle} />
    </section>}
  </>;
}
