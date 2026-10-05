import { useState } from 'react';
import { searchPeople } from '../../lib/helpers/friends';

export default function AddFriend({ candidates, disabled, onAdd }) {
  const [query, setQuery] = useState('');
  const matches = searchPeople(candidates, query);

  async function add(user) {
    const added = await onAdd(user);
    if (added) setQuery('');
  }

  return <section className="panel" aria-label="Add a friend">
    <h2>Add a friend</h2>
    <label className="form-field">Search people
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a name" />
    </label>
    {query.trim() && matches.length === 0 && <p className="muted">No people found. People you already have a friend record with are not listed.</p>}
    {matches.length > 0 && <ul className="friend-list">
      {matches.map((user) => (
        <li key={user.id} className="friend-row">
          <span>{user.user_name}</span>
          <button type="button" className="button-secondary" disabled={disabled} onClick={() => add(user)}>Add friend</button>
        </li>
      ))}
    </ul>}
  </section>;
}
