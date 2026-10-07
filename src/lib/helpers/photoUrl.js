/** Photo URLs must be https (the backend allows http too, but the https site would block those images). Returns '' when valid. */
export function photoUrlError(value) {
  if (!value) return '';
  try {
    const { protocol } = new URL(value);
    if (protocol === 'https:') return '';
  } catch { /* not a URL at all */ }
  return 'Photo URL must be a secure web address starting with https://.';
}
