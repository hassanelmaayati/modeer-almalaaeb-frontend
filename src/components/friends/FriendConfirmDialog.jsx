import Dialog from '../common/Dialog';
import { FRIEND_CONFIRMATIONS } from '../../lib/helpers/friends';

export default function FriendConfirmDialog({ request, name, pending, onConfirm, onClose }) {
  const { title, text, confirm } = FRIEND_CONFIRMATIONS[request.kind](name);
  const close = () => { if (!pending) onClose(); };

  return <Dialog
    title={title}
    className="groups-scope friends-dialog"
    onClose={close}
    actions={<>
      <button type="button" disabled={pending} onClick={onConfirm}>{pending ? 'Saving…' : confirm}</button>
      <button type="button" className="button-secondary" disabled={pending} onClick={close}>Go back</button>
    </>}
  >
    <p>{text}</p>
  </Dialog>;
}
