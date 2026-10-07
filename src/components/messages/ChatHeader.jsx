import { Link } from 'react-router';
import { CHAT_TYPE_LABELS, chatDestination } from '../../lib/helpers/messages';

export default function ChatHeader({ target, title }) {
  const destination = chatDestination(target);

  return <header className="chat-header">
    <Link className="chat-back" to="/messages">Back to chats</Link>
    <span className="avatar chat-avatar" aria-hidden="true">{title.charAt(0).toUpperCase()}</span>
    <div className="chat-heading">
      <h2>{title}</h2>
      <span className="muted">{CHAT_TYPE_LABELS[target.type]}</span>
    </div>
    <Link className="chat-destination" to={destination.path}>{destination.label}</Link>
  </header>;
}
