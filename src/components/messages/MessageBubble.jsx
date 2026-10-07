import { useState } from 'react';
import useAction from '../../lib/helpers/useAction';
import { DELETED_MESSAGE_TEXT, formatMessageTime, isSystemMessage } from '../../lib/helpers/messages';

export default function MessageBubble({ message, own, senderName, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const { pending, error, setError, run } = useAction();
  const time = formatMessageTime(message.created_at);

  if (message.deleted) {
    return <li className="message message-deleted">
      <span className="message-body">{DELETED_MESSAGE_TEXT}</span>
      <time className="message-time" dateTime={message.created_at}>{time}</time>
    </li>;
  }

  if (isSystemMessage(message)) {
    return <li className="message message-system">
      <span className="message-body">{message.body}</span>
      <time className="message-time" dateTime={message.created_at}>{time}</time>
    </li>;
  }

  function startEdit() { setDraft(message.body); setError(''); setEditing(true); }

  async function save(event) {
    event.preventDefault();
    if (draft.trim() === message.body.trim()) { setEditing(false); return; }
    if (await run(() => onEdit(message.id, draft))) setEditing(false);
  }

  function confirmDelete() {
    // A deleted message disappears for everyone and can't be brought back, so ask first.
    if (window.confirm('Delete this message? It will be removed for everyone and cannot be restored.')) run(() => onDelete(message.id));
  }

  // Deleted and system messages returned above, so a visible own message can always be changed.
  const canChange = own && onEdit && onDelete;
  return <li className={own ? 'message is-own' : 'message'}>
    {senderName && <span className="message-sender">{senderName}</span>}
    {editing
      ? <form className="message-edit" onSubmit={save}>
        <label className="visually-hidden" htmlFor={`edit-message-${message.id}`}>Edit your message</label>
        <textarea id={`edit-message-${message.id}`} rows={2} value={draft} onChange={event => { setDraft(event.target.value); setError(''); }} autoFocus />
        <span className="button-row">
          <button disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
          <button type="button" className="button-secondary" disabled={pending} onClick={() => setEditing(false)}>Cancel</button>
        </span>
      </form>
      : <span className="message-body">{message.body}</span>}
    <time className="message-time" dateTime={message.created_at}>{time}{message.edited_at && <span className="message-edited"> (edited)</span>}</time>
    {canChange && !editing && <span className="message-actions">
      <button type="button" disabled={pending} onClick={startEdit}>Edit<span className="visually-hidden"> message</span></button>
      <button type="button" disabled={pending} onClick={confirmDelete}>Delete<span className="visually-hidden"> message</span></button>
    </span>}
    {error && <span role="alert" className="error-message">{error}</span>}
  </li>;
}
