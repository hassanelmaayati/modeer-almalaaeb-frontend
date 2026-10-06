import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import MessageComposer from '../../src/components/messages/MessageComposer';
import MessageList from '../../src/components/messages/MessageList';
import ConversationList from '../../src/components/messages/ConversationList';
import ChatPane from '../../src/components/messages/ChatPane';
import { applyMessage, filterConversations, formatConversationTime, formatDayLabel, formatMessageTime, groupMessagesByDay, roomCancellation, summarizeUnread, validateMessageBody } from '../../src/lib/helpers/messages';

const conversations = [
  { type: 'direct', user_id: 2, title: 'Bob', last_message: { id: 2, sender_id: 1, body: 'Hello Bob', created_at: '2030-01-01T12:00:00Z' } },
  { type: 'group', group_id: 3, title: 'Weekend team', last_message: null },
  { type: 'room', room_id: 4, title: 'Football', last_message: { id: 1, sender_id: null, body: 'Room cancelled: Rain', created_at: '2030-01-01T12:00:00Z' } },
];

describe('message composer keyboard and validation', () => {
  it('does not send empty whitespace and disables oversized text without dropping the draft', () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'x'.repeat(2001) } });
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('up to 2000 characters');
    expect(screen.getByLabelText('Message')).toHaveAttribute('aria-invalid', 'true');
    expect(onSend).not.toHaveBeenCalled();
  });
  it('accepts the exact maximum and clears the draft only after send is accepted', () => {
    const onSend = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<MessageComposer onSend={onSend} />);
    const draft = 'x'.repeat(2000);
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: draft } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByLabelText('Message')).toHaveValue(draft);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByLabelText('Message')).toHaveValue('');
    expect(onSend).toHaveBeenCalledTimes(2);
  });
  it.each([
    ['full non-BMP', '🏆'.repeat(2000)],
    ['mixed BMP/non-BMP with surrounding whitespace', ` \n${'أ🏆'.repeat(1000)}\t `],
  ])('allows a %s draft containing exactly 2000 Unicode code points', (_name, draft) => {
    const onSend = vi.fn().mockReturnValue(true);
    render(<MessageComposer onSend={onSend} />);
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: draft } });
    expect(validateMessageBody(draft)).toBe('');
    expect(screen.getByLabelText('Characters used')).toHaveTextContent('2000/2000');
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith(draft);
    expect(screen.getByLabelText('Message')).toHaveValue('');
  });
  it('rejects 2001 non-BMP code points and preserves the draft with an accurate counter', () => {
    const onSend = vi.fn(); const draft = '🏆'.repeat(2001);
    render(<MessageComposer onSend={onSend} />);
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: draft } });
    expect(screen.getByLabelText('Characters used')).toHaveTextContent('2001/2000');
    expect(validateMessageBody(draft)).toContain('up to 2000 characters');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    fireEvent.keyDown(screen.getByLabelText('Message'), { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Message')).toHaveValue(draft);
  });
  it('sends Enter once while Shift+Enter and IME composition preserve the draft', () => {
    const onSend = vi.fn().mockReturnValue(true);
    render(<MessageComposer onSend={onSend} />);
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'مرحبا team' } });
    fireEvent.keyDown(screen.getByLabelText('Message'), { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(screen.getByLabelText('Message'), { key: 'Enter', isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByLabelText('Message'), { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('مرحبا team');
    expect(onSend).toHaveBeenCalledOnce();
  });
  it('shows the permission reason without a writable composer', () => {
    render(<MessageComposer disabledReason="This room was cancelled." onSend={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('This room was cancelled.');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('chat navigation, empty state and unread presentation', () => {
  it('filters conversations by both type and case-insensitive title without hiding empty chats', () => {
    render(<MemoryRouter><ConversationList conversations={conversations} users={[]} loading={false} viewerId={1} activeKey="direct:2" unreadCounts={{ 'direct:2': 101 }} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Bob/ })).toHaveAttribute('href', '/messages/direct/2');
    expect(screen.getByRole('link', { name: /Bob/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByLabelText('101 unread')).toHaveTextContent('99+');
    expect(screen.getByText('You: Hello Bob')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Groups' }));
    expect(screen.getByRole('button', { name: 'Groups' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: /Weekend team/ })).toHaveAttribute('href', '/messages/group/3');
    expect(screen.getByText('No messages yet')).toBeVisible();
    expect(screen.queryByRole('link', { name: /Bob/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search chats'), { target: { value: ' missing ' } });
    expect(screen.getByRole('heading', { name: 'No chats match' })).toBeVisible();
  });
  it('offers discovery and friend navigation for an empty inbox', () => {
    render(<MemoryRouter><ConversationList conversations={[]} users={[]} loading={false} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'No chats yet' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Browse activities' })).toHaveAttribute('href', '/sports');
    expect(screen.getByRole('link', { name: 'Find friends' })).toHaveAttribute('href', '/friends');
  });
  it('reports inbox errors and exposes explicit reload', () => {
    const reload = vi.fn();
    render(<MemoryRouter><ConversationList conversations={[]} users={[]} loading={false} error={{ message: 'Inbox unavailable' }} reload={reload} /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('Inbox unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reload).toHaveBeenCalledOnce();
  });
  it.each([null, { invalid: true }])('does not mount an API-backed thread for invalid or absent target %o', target => {
    render(<MemoryRouter><ChatPane target={target} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: target ? 'Chat not found' : 'Messages' })).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('presents failed sends with correct retry/discard IDs while final permission failures omit retry', () => {
    const retry = vi.fn(), discard = vi.fn();
    render(<MessageList messages={[]} pending={[
      { id: 'retry-id', body: 'Try this', status: 'failed', error: 'Offline' },
      { id: 'blocked-id', body: 'Denied text', status: 'failed', error: 'Denied', blocked: true },
    ]} viewerId={1} chatType="direct" nameOf={vi.fn()} onRetrySend={retry} onDiscard={discard} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledWith('retry-id');
    const blocked = screen.getByText('Denied text').closest('li');
    expect(within(blocked).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    fireEvent.click(within(blocked).getByRole('button', { name: 'Discard' }));
    expect(discard).toHaveBeenCalledWith('blocked-id');
  });
  it('distinguishes system notices, own messages and named group participants', () => {
    render(<MessageList messages={[
      { id: 1, sender_id: null, type: 'system', body: 'Room cancelled: Rain', created_at: '2030-01-01T12:00:00Z' },
      { id: 2, sender_id: 2, body: 'Hello team', created_at: '2030-01-01T12:01:00Z' },
      { id: 3, sender_id: 1, body: 'My reply', created_at: '2030-01-01T12:02:00Z' },
    ]} viewerId={1} chatType="group" nameOf={() => 'Bob'} />);
    expect(screen.getByText('Room cancelled: Rain').closest('li')).toHaveClass('message-system');
    expect(screen.getByText('Hello team').closest('li')).toHaveTextContent('Bob');
    expect(screen.getByText('My reply').closest('li')).toHaveClass('is-own');
  });
});

describe('message dates, scope and unread rules', () => {
  it('uses Bahrain days across midnight and treats naive server timestamps as UTC', () => {
    expect(formatMessageTime('2030-01-01T21:05:00')).toBe('00:05');
    const groups = groupMessagesByDay([{ id: 1, created_at: '2030-01-01T20:59:00Z' }, { id: 2, created_at: '2030-01-01T21:00:00Z' }]);
    expect(groups.map(group => group.day)).toEqual(['2030-01-01', '2030-01-02']);
    expect(formatDayLabel('2030-01-02', new Date('2030-01-01T21:05:00Z'))).toBe('Today');
    expect(formatConversationTime('2030-01-01T12:00:00Z', new Date('2030-01-02T12:00:00Z'))).toBe('Yesterday');
  });
  it('counts only unread message notifications with valid internal chat targets', () => {
    const notices = [
      { id: 1, kind: 'message.created', target: { type: 'direct', id: 2 } },
      { id: 2, kind: 'message.created', target: { type: 'direct', id: 2 } },
      { id: 3, kind: 'message.created', target: { type: 'room', id: 3 }, read_at: '2030-01-01' },
      { id: 4, kind: 'friend.request', target: { type: 'direct', id: 2 } },
      { id: 5, kind: 'message.created', target: { type: 'cup', id: 4 } },
      { id: 6, kind: 'message.created', target: { type: 'group', id: 0 } },
    ];
    expect(summarizeUnread(notices)).toEqual({ total: 2, counts: { 'direct:2': 2 }, ids: { 'direct:2': [1, 2] } });
  });
  it('preserves conversation ordering for duplicate messages and signals unknown conversations for refetch', () => {
    expect(applyMessage(conversations, { id: 2, sender_id: 2, recipient_id: 1 }, 1)).toBe(conversations);
    expect(applyMessage(conversations, { id: 3, sender_id: 8, recipient_id: 1 }, 1)).toBeNull();
    expect(filterConversations(conversations, { type: 'group', query: ' weekend ' })).toEqual([conversations[1]]);
  });
  it('uses authoritative cancellation details, with a persisted system-message fallback', () => {
    const system = { id: 1, sender_id: null, body: 'Room cancelled: Rain', created_at: '2030-01-01T12:00:00Z' };
    expect(roomCancellation(null, [system])).toEqual({ reason: 'Rain', cancelledAt: system.created_at });
    expect(roomCancellation({ status: 'cancelled', cancellation_reason: 'Venue closed', cancelled_at: '2030-01-01T13:00:00Z' }, [system]).reason).toBe('Venue closed');
    expect(roomCancellation({ status: 'open' }, [{ ...system, sender_id: 1, body: 'Normal conversation' }])).toBeNull();
  });
});
