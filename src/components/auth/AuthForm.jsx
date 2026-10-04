import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import Field from '../common/Field';
import { returnDestination } from '../../lib/helpers/navigation';

export default function AuthForm({ session, signup = false }) {
  const location = useLocation(), navigate = useNavigate();
  const [error, setError] = useState(''), [pending, setPending] = useState(false);
  const destination = returnDestination(location.state), title = signup ? 'Sign up' : 'Sign in';

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    if (signup && form.get('password') !== form.get('confirmation')) return setError('Passwords must match.');
    const body = { email: form.get('email').trim(), password: form.get('password') };
    if (signup) body.user_name = form.get('user_name').trim();
    setPending(true);
    setError('');
    try {
      await (signup ? session.signUp : session.signIn)(body);
      navigate(destination, { replace: true });
    } catch (failure) { setError(failure.message); }
    finally { setPending(false); }
  }

  if (session.loading) return <main><p role="status">Restoring session…</p></main>;
  if (session.user) return <Navigate to={destination} replace />;
  return <main>
    <h1>{title}</h1>
    <form className="form-stack" onSubmit={submit}>
      {error && <p role="alert">{error}</p>}
      {signup && <Field label="User name"><input name="user_name" autoComplete="username" minLength={3} maxLength={60} required /></Field>}
      <Field label="Email"><input name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password"><input name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 8 : undefined} required /></Field>
      {signup && <Field label="Confirm password"><input name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></Field>}
      <div className="actions"><button disabled={pending}>{pending ? signup ? 'Creating account…' : 'Signing in…' : title}</button><Link to={destination}>Cancel</Link></div>
    </form>
    <p>{signup ? 'Already registered? ' : 'Need an account? '}<Link to={signup ? '/sign-in' : '/sign-up'} state={location.state}>{signup ? 'Sign in' : 'Sign up'}</Link></p>
  </main>;
}
