import { useLayoutEffect, useRef } from 'react';
import { formatDayLabel, groupMessagesByDay } from '../../lib/helpers/messages';
import MessageBubble from './MessageBubble';

export default function MessageList({
  messages,
  pending = [],
  viewerId,
  chatType,
  nameOf,
  hasMore,
  loadingEarlier,
  earlierError,
  onLoadEarlier,
  onRetrySend,
  onDiscard,
}) {
  const containerRef = useRef(null);
  const distance = useRef(0);
  const seen = useRef({ first: undefined, last: undefined });
  const firstId = messages[0]?.id;
  const lastId = messages.at(-1)?.id;
  const pendingCount = pending.length;

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const prepended = seen.current.first !== undefined && firstId !== seen.current.first && lastId === seen.current.last;
    element.scrollTop = prepended ? element.scrollHeight - distance.current : element.scrollHeight;
    seen.current = { first: firstId, last: lastId };
    distance.current = element.scrollHeight - element.scrollTop;
  }, [firstId, lastId, pendingCount]);

  function remember() {
    const element = containerRef.current;
    distance.current = element.scrollHeight - element.scrollTop;
  }

  const showSender = chatType !== 'direct';

  return <div className="chat-messages" ref={containerRef} onScroll={remember} role="log" aria-label="Messages">
    {hasMore && <div className="chat-earlier">
      <button type="button" className="button-secondary" disabled={loadingEarlier} onClick={onLoadEarlier}>
        {loadingEarlier ? 'Loading…' : 'Load earlier messages'}
      </button>
      {earlierError && <p role="alert" className="error-message">{earlierError}</p>}
    </div>}
    {groupMessagesByDay(messages).map((group) => {
      const label = formatDayLabel(group.day);
      return <section key={group.day} aria-label={label}>
        <p className="day-divider"><span>{label}</span></p>
        <ul className="message-list">
          {group.messages.map((message) => {
            const own = String(message.sender_id) === String(viewerId);
            return <MessageBubble
              key={message.id}
              message={message}
              own={own}
              senderName={showSender && !own && message.sender_id != null ? nameOf(message.sender_id) : null}
            />;
          })}
        </ul>
      </section>;
    })}
    {pending.length > 0 && <ul className="message-list pending-list" aria-label="Sending">
      {pending.map((item) => (
        <li key={item.id} className={item.status === 'failed' ? 'message is-own is-pending is-failed' : 'message is-own is-pending'}>
          <span className="message-body">{item.body}</span>
          <span className="message-time">{item.status === 'failed' ? 'Failed to send' : 'Sending…'}</span>
          {item.status === 'failed' && <>
            {item.error && <span role="alert" className="error-message">{item.error}</span>}
            <span className="button-row">
              {!item.blocked && <button type="button" className="button-secondary" onClick={() => onRetrySend(item.id)}>Retry</button>}
              <button type="button" className="button-secondary" onClick={() => onDiscard(item.id)}>Discard</button>
            </span>
          </>}
        </li>
      ))}
    </ul>}
  </div>;
}
