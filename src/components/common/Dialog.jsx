function openDialog(dialog) {
  if (!dialog) return;
  if (!dialog.open) dialog.showModal();
  return () => dialog.close();
}

export default function Dialog({ title, onClose, children, actions, className = '' }) {
  return (
    <dialog
      ref={openDialog}
      className={`dialog-panel ${className}`.trim()}
      aria-label={title}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
    >
      <header className="dialog-header">
        <h2>{title}</h2>
        <button type="button" className="button-secondary" onClick={onClose} aria-label="Close dialog">Close</button>
      </header>
      <div className="dialog-body">{children}</div>
      {actions && <footer className="dialog-actions">{actions}</footer>}
    </dialog>
  );
}
