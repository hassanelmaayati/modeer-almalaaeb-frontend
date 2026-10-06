import SignInForm from '../components/auth/SignInForm';
import AuthIntro from '../components/auth/AuthIntro';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import { AuthArt } from '../components/home/HeroArt';

export default function SignInPage({ session }) {
  // AuthForm owns <main>, loading and the signed-in redirect, so the extra sections only show to guests.
  const guest = !session.loading && !session.user;
  return <div className="home auth-scope auth-page">
    {guest && <aside className="auth-aside">
      <AuthIntro title="Welcome back" text="Sign in to host or join rooms, groups and cups." />
      <AuthArt />
    </aside>}
    <div className="auth-panel">
      <SignInForm session={session} />
      {guest && <section className="auth-alt" aria-label="Other sign-in options">
        <p className="auth-or"><span>or continue with</span></p>
        <GoogleSignInButton onCredential={session.signInWithGoogle} />
      </section>}
    </div>
  </div>;
}
