import { Link } from 'react-router';
import { CHAT_TYPE_LABELS } from '../../lib/helpers/messages';

export default function ChatPane({ target }) {
  if (!target) {
    return <div className="chat-empty">
      <h2>Messages</h2>
      <p className="muted">Select a chat to start messaging.</p>
    </div>;
  }

  if (target.invalid) {
    return <div className="chat-empty">
      <Link className="chat-back" to="/messages">Back to chats</Link>
      <h2>Chat not found</h2>
      <p className="muted">This chat link is not valid. Choose a chat from the list.</p>
    </div>;
  }

  return <div className="chat-thread">
    <header className="chat-header">
      <Link className="chat-back" to="/messages">Back to chats</Link>
      <h2>{CHAT_TYPE_LABELS[target.type]} {target.id}</h2>
    </header>
  </div>;
}
