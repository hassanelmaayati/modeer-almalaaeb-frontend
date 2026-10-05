import { Link } from 'react-router';
import { CHAT_TYPE_LABELS, chatDestination } from '../../lib/helpers/messages';

export default function ChatHeader({ target, title }) {
  const destination = chatDestination(target);

  return <header className="chat-header">
    <Link className="chat-back" to="/messages">Back to chats</Link>
    <div className="chat-heading">
      <h2>{title}</h2>
      <span className="muted">{CHAT_TYPE_LABELS[target.type]}</span>
    </div>
    <Link className="chat-destination" to={destination.path}>{destination.label}</Link>
  </header>;
}
