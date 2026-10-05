import { useState } from 'react';

/** Pending/error state for one button or form; errors show next to the control that failed. */
export default function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function run(action) {
    if (pending) return false;
    setPending(true);
    setError('');
    try { await action(); return true; }
    catch (failure) { setError(failure.message); return false; }
    finally { setPending(false); }
  }

  return { pending, error, setError, run };
}
