/** The backend accepts only http(s) photo URLs, "" or null; anything else is a 422. Returns '' when valid. */
export function photoUrlError(value) {
  if (!value) return '';
  try {
    const { protocol } = new URL(value);
    if (protocol === 'http:' || protocol === 'https:') return '';
  } catch { /* not a URL at all */ }
  return 'Photo URL must be a web address starting with http:// or https://.';
}
