export const emptyResource = (data = null) => ({ data, loading: true, error: null });

// Use this from an effect; its cleanup cancels the request and ignores late results.
export function startRequest(load, setResource) {
  const controller = new AbortController();
  Promise.resolve().then(() => {
    if (controller.signal.aborted) return;
    setResource(previous => ({ ...previous, loading: true, error: null }));
    return load(controller.signal);
  }).then(data => {
    if (!controller.signal.aborted) setResource({ data, loading: false, error: null });
  }).catch(error => {
    if (!controller.signal.aborted) setResource(previous => ({ ...previous, loading: false, error }));
  });
  return () => controller.abort();
}
