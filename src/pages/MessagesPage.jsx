import { useParams } from 'react-router';
import ChatPane from '../components/messages/ChatPane';
import ConversationList from '../components/messages/ConversationList';
import { chatKey, parseChatTarget } from '../lib/helpers/messages';

export default function MessagesPage({ session }) {
  const params = useParams();
  const target = parseChatTarget(params);
  const activeKey = target && !target.invalid ? chatKey(target.type, target.id) : null;

  return <main className="messages-page">
    <div className="messages-layout" data-open={target ? 'chat' : 'list'}>
      <aside className="messages-sidebar" aria-label="Chats">
        <ConversationList viewerId={session.user?.id} activeKey={activeKey} />
      </aside>
      <section className="messages-chat" aria-label="Open chat">
        <ChatPane target={target} />
      </section>
    </div>
  </main>;
}
