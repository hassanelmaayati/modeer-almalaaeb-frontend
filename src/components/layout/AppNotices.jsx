/** App-level messages that no single page owns: slow server, unconfirmed sign-in, and a logout the server did not confirm. */
export default function AppNotices({ waking, offline, onRetry, notice, onDismiss }) {
  if (!waking && !offline && !notice) return null;
  return <div className="app-notices">
    {offline
      ? <p role="status" className="app-notice">
        The server is not answering, so we could not check your sign-in yet. Trying again automatically.{' '}
        <button type="button" className="button-secondary" onClick={onRetry}>Try now</button>
      </p>
      : waking && <p role="status" className="app-notice">The server is waking up, this can take up to a minute.</p>}
    {notice && <p role="alert" className="app-notice app-notice-warning">
      {notice}{' '}
      <button type="button" className="button-secondary" onClick={onDismiss}>Dismiss</button>
    </p>}
  </div>;
}
