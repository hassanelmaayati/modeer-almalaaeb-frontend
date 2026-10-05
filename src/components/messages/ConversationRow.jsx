import { Link } from 'react-router';
import {
  CONVERSATION_TYPE_BADGES,
  conversationPath,
  formatConversationTime,
  messagePreview,
} from '../../lib/helpers/messages';

export default function ConversationRow({ conversation, active, viewerId, nameOf }) {
  const preview = messagePreview(conversation, viewerId, nameOf);
  const time = conversation.last_message ? formatConversationTime(conversation.last_message.created_at) : '';

  return <li>
    <Link className={active ? 'conversation-row is-active' : 'conversation-row'} to={conversationPath(conversation)} aria-current={active ? 'page' : undefined}>
      <span className="avatar" aria-hidden="true">{conversation.title.charAt(0).toUpperCase()}</span>
      <span className="conversation-main">
        <span className="conversation-top">
          <span className="conversation-title">{conversation.title}</span>
          <span className="muted conversation-time">{time}</span>
        </span>
        <span className="conversation-bottom">
          <span className="status-badge">{CONVERSATION_TYPE_BADGES[conversation.type]}</span>
          <span className={preview?.system ? 'conversation-preview is-system' : 'conversation-preview'}>
            {preview ? preview.text : 'No messages yet'}
          </span>
        </span>
      </span>
    </Link>
  </li>;
}
