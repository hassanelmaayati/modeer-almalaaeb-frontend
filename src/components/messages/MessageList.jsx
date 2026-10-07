import { useLayoutEffect, useRef, useState } from 'react';
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
  onEdit,
  onDelete,
  onRetrySend,
  onDiscard,
}) {
  const containerRef = useRef(null);
  const distance = useRef(0);
  const seen = useRef({ first: undefined, last: undefined });
  const firstId = messages[0]?.id;
  const lastId = messages.at(-1)?.id;
  const pendingCount = pending.length;
  const nearBottom = useRef(true);
  const [readId, setReadId] = useState(null);
  const lastSender = messages.at(-1)?.sender_id;

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const prepended = seen.current.first !== undefined && firstId !== seen.current.first && lastId === seen.current.last;
    const appendedAway = seen.current.last !== undefined && lastId !== seen.current.last && !nearBottom.current && String(lastSender) !== String(viewerId);
    if (prepended) element.scrollTop = element.scrollHeight - distance.current;
    else if (!appendedAway) element.scrollTop = element.scrollHeight;
    seen.current = { first: firstId, last: lastId };
    distance.current = element.scrollHeight - element.scrollTop;
  }, [firstId, lastId, pendingCount, lastSender, viewerId]);

  function remember() {
    const element = containerRef.current;
    distance.current = element.scrollHeight - element.scrollTop;
    const near = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    nearBottom.current = near;
    setReadId((current) => {
      if (near) return null;
      return current === null ? lastId ?? null : current;
    });
  }

  function jumpToLatest() {
    const element = containerRef.current;
    element.scrollTop = element.scrollHeight;
  }

  const unseen = readId === null ? 0 : messages.filter((message) => message.id > readId && String(message.sender_id) !== String(viewerId)).length;

  const showSender = chatType !== 'direct';

  return <div className="chat-messages-wrap">
    <div className="chat-messages" ref={containerRef} onScroll={remember} role="log" aria-label="Messages">
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
              onEdit={own ? onEdit : undefined}
              onDelete={own ? onDelete : undefined}
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
    </div>
    {unseen > 0 && <button type="button" className="chat-new-messages" onClick={jumpToLatest}>
      {unseen === 1 ? '1 new message' : `${unseen} new messages`}
    </button>}
  </div>;
}
