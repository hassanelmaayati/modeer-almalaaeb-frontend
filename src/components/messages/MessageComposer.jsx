import { useState } from 'react';
import { MAX_MESSAGE_LENGTH, messageBodyLength, validateMessageBody } from '../../lib/helpers/messages';

export default function MessageComposer({ disabledReason, onSend }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  function submit() {
    const problem = validateMessageBody(text);
    if (problem) {
      setError(problem);
      return;
    }
    if (onSend(text)) {
      setText('');
      setError('');
    }
  }

  function handleKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  }

  if (disabledReason) {
    return <div className="chat-composer is-disabled">
      <p role="status" className="muted">{disabledReason}</p>
    </div>;
  }

  const length = messageBodyLength(text);
  const tooLong = length > MAX_MESSAGE_LENGTH;

  return <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); submit(); }} noValidate>
    <label className="chat-compose-field">
      <span className="visually-hidden">Message</span>
      <textarea
        value={text}
        rows={2}
        placeholder="Type a message"
        onChange={(event) => { setText(event.target.value); setError(''); }}
        onKeyDown={handleKeyDown}
        aria-invalid={error || tooLong ? 'true' : undefined}
      />
    </label>
    <div className="chat-compose-actions">
      <span className={tooLong ? 'chat-counter is-over' : 'chat-counter muted'} aria-label="Characters used">{length}/{MAX_MESSAGE_LENGTH}</span>
      <button type="submit" disabled={length === 0 || tooLong}>Send</button>
    </div>
    {(error || tooLong) && <p role="alert" className="error-message">{error || `Messages can be up to ${MAX_MESSAGE_LENGTH} characters.`}</p>}
  </form>;
}
