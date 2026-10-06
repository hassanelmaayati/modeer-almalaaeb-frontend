import SignUpForm from '../components/auth/SignUpForm';
import AuthIntro from '../components/auth/AuthIntro';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import { AuthArt } from '../components/home/HeroArt';

export default function SignUpPage({ session }) {
  // AuthForm owns <main>, loading and the signed-in redirect, so the extra sections only show to guests.
  const guest = !session.loading && !session.user;
  return <div className="home auth-scope auth-page">
    {guest && <aside className="auth-aside">
      <AuthIntro title="Join Modeer Almalaaeb" text="Create an account to find players, teams and cups in Bahrain." />
      <AuthArt />
    </aside>}
    <div className="auth-panel">
      <SignUpForm session={session} />
      {guest && <section className="auth-alt" aria-label="Other sign-up options">
        <p className="auth-or"><span>or continue with</span></p>
        {/* /auth/google creates the account on first use, so the same button signs up. */}
        <GoogleSignInButton text="signup_with" onCredential={session.signInWithGoogle} />
      </section>}
    </div>
  </div>;
}
