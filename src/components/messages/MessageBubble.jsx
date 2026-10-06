import { formatMessageTime, isSystemMessage } from '../../lib/helpers/messages';

export default function MessageBubble({ message, own, senderName }) {
  const time = formatMessageTime(message.created_at);

  if (isSystemMessage(message)) {
    return <li className="message message-system">
      <span className="message-body">{message.body}</span>
      <time className="message-time" dateTime={message.created_at}>{time}</time>
    </li>;
  }

  return <li className={own ? 'message is-own' : 'message'}>
    {senderName && <span className="message-avatar" aria-hidden="true">{senderName.charAt(0).toUpperCase()}</span>}
    {senderName && <span className="message-sender">{senderName}</span>}
    <span className="message-body">{message.body}</span>
    <time className="message-time" dateTime={message.created_at}>{time}</time>
  </li>;
}
