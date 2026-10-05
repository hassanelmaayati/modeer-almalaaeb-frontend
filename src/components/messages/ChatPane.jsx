import { Link } from 'react-router';
import { chatKey } from '../../lib/helpers/messages';
import ChatThread from './ChatThread';

export default function ChatPane({ target, title, viewerId, nameOf }) {
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

  return <ChatThread key={chatKey(target.type, target.id)} target={target} title={title} viewerId={viewerId} nameOf={nameOf} />;
}
