import PeoplePicker from '../common/PeoplePicker';

/** Find people by name and send a friend request. `exclude` holds the user and everyone they already have a record with. */
export default function AddFriend({ exclude, disabled, onAdd, inputRef }) {
  return <section className="panel" aria-label="Add a friend">
    <h2>Add a friend</h2>
    <PeoplePicker
      label="Search people"
      actionLabel="Add friend"
      exclude={exclude}
      onPick={onAdd}
      disabled={disabled}
      inputRef={inputRef}
      emptyHint="No people found. People you already have a friend record with are not listed."
    />
  </section>;
}
