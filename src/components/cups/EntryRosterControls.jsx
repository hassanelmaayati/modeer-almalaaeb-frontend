import { Link } from 'react-router';
import useAction from '../../lib/helpers/useAction';
import Field from '../common/Field';
import { registrationClosed } from '../../lib/helpers/cups';

/** Group-owner controls during registration: enter an owned group, or withdraw one already entered. */
export default function EntryRosterControls({ cup, user, groups, ownEntries, onEnter, onWithdraw }) {
  const { pending, error, run } = useAction();
  if (!user) return <p><Link to="/sign-in" state={{ from: `/cups/${cup.id}` }}>Sign in</Link> to enter your team.</p>;
  const closed = registrationClosed(cup);

  function enter(event) {
    event.preventDefault();
    const groupId = Number(new FormData(event.currentTarget).get('group_id'));
    if (groupId) run(() => onEnter(groupId));
  }

  return <div className="entry-controls">
    {error && <p role="alert">{error}</p>}
    {ownEntries.length > 0 && <ul className="entry-list">
      {ownEntries.map(entry => <li key={entry.group_id}>
        Your team <strong>{entry.group_name}</strong> is {entry.status}.{' '}
        <button type="button" className="button-secondary" disabled={pending} onClick={() => run(() => onWithdraw(entry.group_id))}>Withdraw</button>
      </li>)}
    </ul>}
    {/* The backend rejects new entries after registration_closes_at. */}
    {closed ? <p>Registration has closed.</p>
      : groups.loading ? <p role="status">Loading your groups…</p>
      : groups.error ? <p role="alert">Your groups could not be loaded.</p>
      : groups.data.length ? <form className="actions" onSubmit={enter}>
        <Field label="Enter one of your groups">
          <select name="group_id" defaultValue="" required>
            <option value="" disabled>Select a group</option>
            {groups.data.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </Field>
        <button disabled={pending}>{pending ? 'Entering…' : 'Enter cup'}</button>
      </form>
      // Only groups the user owns for this cup's sport can enter.
      : <p className="muted">To enter, you need to own a group for this sport that isn't already entered. <Link to="/groups">Go to groups</Link></p>}
  </div>;
}
