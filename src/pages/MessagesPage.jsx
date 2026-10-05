import { useParams } from 'react-router';
import ChatPane from '../components/messages/ChatPane';
import ConversationList from '../components/messages/ConversationList';
import { playerName } from '../lib/helpers/groups';
import { chatKey, chatTitle, parseChatTarget } from '../lib/helpers/messages';
import useConversations from '../lib/helpers/useConversations';

export default function MessagesPage({ session }) {
  const params = useParams();
  const viewerId = session.user?.id;
  const target = parseChatTarget(params);
  const valid = target && !target.invalid;
  const activeKey = valid ? chatKey(target.type, target.id) : null;
  const inbox = useConversations(viewerId);
  const nameOf = (id) => playerName(inbox.users, id);

  return <main className="messages-page">
    <div className="messages-layout" data-open={target ? 'chat' : 'list'}>
      <aside className="messages-sidebar" aria-label="Chats">
        <ConversationList viewerId={viewerId} activeKey={activeKey} {...inbox} />
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
