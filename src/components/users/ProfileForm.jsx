import { useState } from 'react';
import Field from '../common/Field';

export default function ProfileForm({ user, onSubmit }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(''), [saved, setSaved] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    // Blank optional fields are sent as null so the backend clears them instead of storing "".
    const body = {
      user_name: form.get('user_name').trim(),
      photo_url: form.get('photo_url').trim() || null,
      bio: form.get('bio').trim() || null,
    };
    setPending(true);
    setError('');
    setSaved(false);
    try { await onSubmit(body); setSaved(true); }
    catch (failure) { setError(failure.message); }
    finally { setPending(false); }
  }

  return <form className="form-stack" onSubmit={submit}>
    {error && <p role="alert">{error}</p>}
    {saved && <p role="status">Profile saved.</p>}
    <Field label="User name"><input name="user_name" defaultValue={user.user_name} autoComplete="username" minLength={3} maxLength={60} required /></Field>
    <Field label="Photo URL"><input name="photo_url" type="url" defaultValue={user.photo_url || ''} /></Field>
    <Field label="Bio"><textarea name="bio" defaultValue={user.bio || ''} /></Field>
    <div className="actions"><button disabled={pending}>{pending ? 'Saving…' : 'Save profile'}</button></div>
  </form>;
}
