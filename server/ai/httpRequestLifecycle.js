export function createHttpRequestLifecycle(request, response) {
  const controller = new AbortController();
  const abort = () => {
    if (!controller.signal.aborted) controller.abort(new DOMException('The client disconnected.', 'AbortError'));
  };
  const close = () => {
    if (!response?.writableEnded) abort();
  };

  request?.once?.('aborted', abort);
  response?.once?.('close', close);

  return Object.freeze({
    signal: controller.signal,
    cleanup() {
      request?.removeListener?.('aborted', abort);
      response?.removeListener?.('close', close);
    },
  });
}
