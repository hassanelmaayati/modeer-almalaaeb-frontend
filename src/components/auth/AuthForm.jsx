import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import Field from '../common/Field';
import { DISTRICTS } from '../../lib/helpers/filters';
import Select from '../common/Select';

export default function AuthForm({ session, signup = false }) {
  const navigate = useNavigate();
  const [error, setError] = useState(''), [pending, setPending] = useState(false);
  // Always home after auth (no return to state.from), so Back can't reopen the previous account's page.
  const destination = '/', title = signup ? 'Sign up' : 'Sign in';

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    if (signup && form.get('password') !== form.get('confirmation')) return setError('Passwords must match.');
    const body = { email: form.get('email').trim(), password: form.get('password') };
    if (signup) {
      body.user_name = form.get('user_name').trim();
      // The home governorate becomes the default room filter.
      body.district = form.get('district');
    }
    setPending(true);
    setError('');
    try {
      await (signup ? session.signUp : session.signIn)(body);
      navigate(destination, { replace: true });
    } catch (failure) {
      // Wrong login credentials are a 401. It never clears a session: the login request is sent without a token.
      setError(!signup && failure.status === 401 ? 'Invalid credentials' : failure.message);
    }
    finally { setPending(false); }
  }

  if (session.loading) return <main className="auth-main"><p className="status-message" role="status">Restoring session…</p></main>;
  if (session.user) return <Navigate to={destination} replace />;
  return <main className="auth-main">
    <h1>{title}</h1>
    <p className="auth-sub">{signup ? 'It only takes a minute.' : 'Good to see you again.'}</p>
    <form className="form-stack" onSubmit={submit}>
      {error && <p role="alert">{error}</p>}
      {signup && <Field label="User name"><input name="user_name" autoComplete="username" minLength={3} maxLength={60} required /></Field>}
      <Field label="Email"><input name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password"><input name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 8 : undefined} required /></Field>
      {signup && <Field label="Confirm password"><input name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></Field>}
      {signup && <Field label="Governorate">
        <Select name="district" defaultValue="" required>
          <option value="" disabled>Select your governorate</option>
          {DISTRICTS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </Field>}
      <div className="actions"><button disabled={pending}>{pending ? signup ? 'Creating account…' : 'Signing in…' : title}</button><Link className="auth-cancel" to={destination}>Cancel</Link></div>
    </form>
    <p className="auth-switch">{signup ? 'Already registered? ' : 'Need an account? '}<Link to={signup ? '/sign-in' : '/sign-up'}>{signup ? 'Sign in' : 'Sign up'}</Link></p>
  </main>;
}
