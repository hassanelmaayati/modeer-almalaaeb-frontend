import { Link } from 'react-router';
import Icon from '../common/Icon';
import {
  CONVERSATION_TYPE_BADGES,
  conversationPath,
  formatConversationTime,
  formatUnreadCount,
  messagePreview,
} from '../../lib/helpers/messages';

export default function ConversationRow({ conversation, active, viewerId, nameOf, unread = 0 }) {
  const preview = messagePreview(conversation, viewerId, nameOf);
  const time = conversation.last_message ? formatConversationTime(conversation.last_message.created_at) : '';

  return <li>
    <Link className={[active && 'is-active', unread > 0 && 'has-unread', 'conversation-row'].filter(Boolean).join(' ')} to={conversationPath(conversation)} aria-current={active ? 'page' : undefined}>
      <span className={`avatar conversation-avatar conversation-avatar-${conversation.type}`} aria-hidden="true">
        {conversation.type === 'group' ? <Icon name="people" size={20} /> : conversation.type === 'room' ? <Icon name="bolt" size={20} /> : conversation.title.charAt(0).toUpperCase()}
      </span>
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
          {unread > 0 && <span className="unread-badge" aria-label={`${unread} unread`}>{formatUnreadCount(unread)}</span>}
        </span>
      </span>
    </Link>
  </li>;
}
