export default function AsyncState({ loading, error, isEmpty = false, emptyTitle = 'Nothing here yet', emptyDescription, emptyAction, onRetry, children }) {
  if (loading) return <p className="status-message" role="status">Loading…</p>;
  if (error) return (
    <div className="status-message error-message" role="alert">
      <p>{error.message || 'Something went wrong. Please try again.'}</p>
      {onRetry && <button type="button" className="button-secondary" onClick={onRetry}>Try again</button>}
    </div>
  );
  if (isEmpty) return (
    <div className="empty-state">
      <h3>{emptyTitle}</h3>
      {emptyDescription && <p>{emptyDescription}</p>}
      {emptyAction}
    </div>
  );
  return children;
}
