import { useState } from 'react';
import { Link } from 'react-router';
import AsyncState from '../common/AsyncState';
import { CONVERSATION_FILTERS, conversationKey, filterConversations } from '../../lib/helpers/messages';
import { playerName } from '../../lib/helpers/groups';
import useConversations from '../../lib/helpers/useConversations';
import ConversationRow from './ConversationRow';

export default function ConversationList({ viewerId, activeKey }) {
  const { conversations, users, loading, error, reload } = useConversations(viewerId);
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  const visible = filterConversations(conversations, { type, query });
  const nameOf = (id) => playerName(users, id);
  const filtered = type !== 'all' || query.trim() !== '';

  return <div className="conversation-list">
    <h2>Chats</h2>
    <label className="form-field">Search chats
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name" />
    </label>
    <div className="button-row" role="group" aria-label="Chat type">
      {CONVERSATION_FILTERS.map(({ value, label }) => (
        <button key={value} type="button" className={type === value ? 'button' : 'button-secondary'} aria-pressed={type === value} onClick={() => setType(value)}>{label}</button>
      ))}
    </div>
    <AsyncState
      loading={loading}
      error={error}
      onRetry={reload}
      isEmpty={visible.length === 0}
      emptyTitle={filtered ? 'No chats match' : 'No chats yet'}
      emptyDescription={filtered ? 'Try another name or chat type.' : 'Join a room or a group, or add friends, to start chatting.'}
      emptyAction={filtered ? null : <div className="button-row"><Link className="button-secondary" to="/sports">Browse activities</Link><Link className="button-secondary" to="/friends">Find friends</Link></div>}
    >
      <ul className="conversation-items">
        {visible.map((conversation) => (
          <ConversationRow
            key={conversationKey(conversation)}
            conversation={conversation}
            active={conversationKey(conversation) === activeKey}
            viewerId={viewerId}
            nameOf={nameOf}
          />
        ))}
      </ul>
    </AsyncState>
  </div>;
}
