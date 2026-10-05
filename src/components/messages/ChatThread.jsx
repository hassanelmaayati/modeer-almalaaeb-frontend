import { Link } from 'react-router';
import AsyncState from '../common/AsyncState';
import { threadErrorMessage } from '../../lib/helpers/messages';
import useChatThread from '../../lib/helpers/useChatThread';
import ChatHeader from './ChatHeader';
import MessageComposer from './MessageComposer';
import MessageList from './MessageList';

export default function ChatThread({ target, title, viewerId, nameOf }) {
  const thread = useChatThread(target.type, target.id);
  const final = Boolean(thread.error) && [403, 404].includes(thread.error.status);
  const ready = !thread.loading && !thread.error;

  return <div className="chat-thread">
    <ChatHeader target={target} title={title} />
    <AsyncState
      loading={thread.loading}
      error={thread.error ? { message: threadErrorMessage(thread.error) } : null}
      onRetry={final ? undefined : thread.reload}
      isEmpty={thread.messages.length === 0 && thread.pending.length === 0}
      emptyTitle="No messages yet"
      emptyDescription="Messages in this chat will show up here."
    >
      <MessageList
        messages={thread.messages}
        pending={thread.pending}
        viewerId={viewerId}
        chatType={target.type}
        nameOf={nameOf}
        hasMore={thread.hasMore}
        loadingEarlier={thread.loadingEarlier}
        earlierError={thread.earlierError}
        onLoadEarlier={thread.loadEarlier}
        onRetrySend={thread.retrySend}
        onDiscard={thread.discard}
      />
    </AsyncState>
    {final && <p><Link to="/messages">Back to your chats</Link></p>}
    {ready && <MessageComposer disabledReason={thread.blockedReason} onSend={thread.send} />}
  </div>;
}
