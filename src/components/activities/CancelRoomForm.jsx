import { useState } from 'react';
import Dialog from '../common/Dialog';

export default function CancelRoomForm({ title, pending, onConfirm }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const trimmed = reason.trim();

  function review(event) {
    event.preventDefault();
    if (!trimmed) {
      setError('Write a reason so the players know why the room is cancelled.');
      return;
    }
    setError('');
    setConfirming(true);
  }

  function keepRoom() {
    if (!pending) setConfirming(false);
  }

  return <>
    <form className="form-stack" onSubmit={review} noValidate>
      <label>Cancellation reason
        <input name="reason" value={reason} onChange={(event) => { setReason(event.target.value); setError(''); }} aria-invalid={error ? 'true' : undefined} />
      </label>
      {error && <p role="alert" className="error-message">{error}</p>}
      <button disabled={pending}>Cancel room</button>
    </form>
    {confirming && <Dialog
      title={`Cancel "${title}"?`}
      onClose={keepRoom}
      actions={<>
        <button type="button" disabled={pending} onClick={() => onConfirm(trimmed)}>{pending ? 'Cancelling…' : 'Yes, cancel room'}</button>
        <button type="button" className="button-secondary" disabled={pending} onClick={keepRoom}>Keep the room</button>
      </>}
    >
      <p>Everyone who joined or asked to join will be told. This can't be undone.</p>
      <p>Reason: {trimmed}</p>
    </Dialog>}
  </>;
}
