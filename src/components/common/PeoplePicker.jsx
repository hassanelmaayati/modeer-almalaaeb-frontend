import { useEffect, useMemo, useState } from 'react';
import userService from '../../services/userService';
import { rememberUsers } from '../../lib/helpers/userDirectory';

const MAX_RESULTS = 8;

/** Search people by name (server-side, as you type) and pick one with a button. `exclude` hides people who can't be picked.
 *  The search clears after a pick unless onPick returns (or resolves to) false, e.g. a failed request. */
export default function PeoplePicker({ label, actionLabel = 'Add', exclude = [], onPick, disabled = false, inputRef, emptyHint = 'No people found.' }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ users: [], loading: false, error: '' });
  const excludedKey = exclude.join(',');
  const hidden = useMemo(() => new Set(excludedKey ? excludedKey.split(',').map(Number) : []), [excludedKey]);

  useEffect(() => {
    const text = query.trim();
    if (!text) return undefined;
    const controller = new AbortController();
    // Wait for a pause in typing so each keystroke is not a request.
    const timer = setTimeout(async () => {
      setState(previous => ({ ...previous, loading: true, error: '' }));
      try {
        const users = await userService.search(text, { signal: controller.signal });
        rememberUsers(users);
        setState({ users, loading: false, error: '' });
      } catch (failure) {
        if (!controller.signal.aborted) setState({ users: [], loading: false, error: failure.message });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  const matches = state.users.filter(user => !hidden.has(user.id)).slice(0, MAX_RESULTS);
  const searched = query.trim() && !state.loading && !state.error;

  return <div className="people-picker">
    <label className="form-field">{label}
      <input ref={inputRef} type="search" value={query} onChange={event => { setQuery(event.target.value); if (!event.target.value.trim()) setState({ users: [], loading: false, error: '' }); }} placeholder="Type a name" disabled={disabled} />
    </label>
    {state.loading && <p role="status" className="muted">Searching…</p>}
    {state.error && <p role="alert" className="error-message">{state.error}</p>}
    {searched && matches.length === 0 && <p className="muted">{emptyHint}</p>}
    {matches.length > 0 && <ul className="friend-list">
      {matches.map(user => <li key={user.id} className="friend-row">
        <span>{user.user_name}</span>
        <button type="button" className="button-secondary" disabled={disabled} onClick={async () => { if (await onPick(user) !== false) setQuery(''); }}>{actionLabel}<span className="visually-hidden"> {user.user_name}</span></button>
      </li>)}
    </ul>}
  </div>;
}
