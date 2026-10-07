import { Link } from 'react-router';
import { chatKey } from '../../lib/helpers/messages';
import ChatThread from './ChatThread';

export default function ChatPane({ target, title, viewerId, nameOf }) {
  if (!target) {
    return <div className="chat-empty">
      <svg className="chat-empty-art" width="240" height="160" viewBox="0 0 240 160" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <circle cx="120" cy="84" r="66" fill="var(--empty-art-bg)" />
        <path d="M52 40h74a9 9 0 0 1 9 9v30a9 9 0 0 1-9 9H84l-16 14V88H52a9 9 0 0 1-9-9V49a9 9 0 0 1 9-9z" fill="var(--empty-art-surface)" stroke="var(--empty-art-line)" strokeWidth="2.4" />
        <circle cx="62" cy="64" r="4.5" fill="var(--empty-art-line)" />
        <circle cx="80" cy="64" r="4.5" fill="var(--empty-art-line)" />
        <circle cx="98" cy="64" r="4.5" fill="var(--empty-art-line)" />
        <path d="M122 78h74a9 9 0 0 1 9 9v26a9 9 0 0 1-9 9h-8v13l-15-13h-51a9 9 0 0 1-9-9V87a9 9 0 0 1 9-9z" fill="#14594a" />
        <path d="M134 94h46M134 106h28" stroke="var(--chat-own-fg)" strokeWidth="2.4" />
        <path d="M184 34l40-16-18 34-8-12z" fill="var(--empty-art-surface)" stroke="var(--empty-art-line)" strokeWidth="2.2" />
        <path d="M198 40l26-22" stroke="var(--empty-art-line)" strokeWidth="2.2" />
        <path d="M148 62c8-18 20-24 32-26" stroke="var(--empty-art-line)" strokeWidth="2.2" strokeDasharray="2 7" />
        <circle cx="38" cy="126" r="13" fill="var(--empty-art-surface)" stroke="var(--empty-art-line)" strokeWidth="2.2" />
        <path d="M38 118l6 4.400-2.300 7h-7.400l-2.300-7z" stroke="var(--empty-art-line)" strokeWidth="1.800" />
        <path d="M28 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM214 96l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" stroke="var(--empty-art-line)" strokeWidth="1.400" />
      </svg>
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
