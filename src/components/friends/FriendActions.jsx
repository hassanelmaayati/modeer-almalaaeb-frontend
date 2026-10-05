import { Link } from 'react-router';

export default function FriendActions({ tab, friendship, disabled, onAction }) {
  const button = (kind, label, secondary = true) => (
    <button type="button" className={secondary ? 'button-secondary' : 'button'} disabled={disabled} onClick={() => onAction(kind, friendship)}>{label}</button>
  );

  if (tab === 'friends') {
    return <div className="button-row">
      <Link className="button" to={`/messages/direct/${friendship.otherUserId}`}>Message</Link>
      {button('unfriend', 'Unfriend')}
      {button('block', 'Block')}
    </div>;
  }
  if (tab === 'requests') {
    return <div className="button-row">
      {button('accept', 'Accept', false)}
      {button('decline', 'Decline')}
    </div>;
  }
  if (tab === 'sent') {
    return <div className="button-row">{button('cancel', 'Cancel request')}</div>;
  }
  return <div className="button-row">{button('unblock', 'Unblock')}</div>;
}
