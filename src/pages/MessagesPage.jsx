import { useParams } from 'react-router';
import ChatPane from '../components/messages/ChatPane';
import ConversationList from '../components/messages/ConversationList';
import { peekUser } from '../lib/helpers/userDirectory';
import { chatKey, chatTitle, NO_UNREAD, parseChatTarget } from '../lib/helpers/messages';
import useConversations from '../lib/helpers/useConversations';
import useMarkChatRead from '../lib/helpers/useMarkChatRead';

export default function MessagesPage({ session, unread = NO_UNREAD }) {
  const params = useParams();
  const viewerId = session.user?.id;
  const target = parseChatTarget(params);
  const valid = target && !target.invalid;
  const activeKey = valid ? chatKey(target.type, target.id) : null;
  const inbox = useConversations(viewerId);
  // Read from the shared by-id user cache; the inbox and the open thread each load the names they show.
  const nameOf = (id) => peekUser(id)?.user_name || `Player ${id}`;
  useMarkChatRead(activeKey, unread.ids[activeKey] ?? []);

  return <main className="messages-page">
    <h1 className="visually-hidden">Messages</h1>
    <div className="messages-layout" data-open={target ? 'chat' : 'list'}>
      <aside className="messages-sidebar" aria-label="Chats">
        <ConversationList viewerId={viewerId} activeKey={activeKey} unreadCounts={unread.counts} {...inbox} />
      </aside>
      <section className="messages-chat" aria-label="Open chat">
        <ChatPane
          target={target}
          title={valid ? chatTitle(target, inbox.conversations, nameOf) : ''}
          viewerId={viewerId}
          nameOf={nameOf}
        />
      </section>
    </div>
  </main>;
}
