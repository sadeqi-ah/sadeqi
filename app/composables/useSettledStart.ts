/**
 * Run a load-time effect (a scramble, a pixel resolve…) `atMs` after the load
 * gate opens (see utils/appReady.ts) — the same moment the CSS load
 * animations start — and only once the main thread is idle.
 *
 * @param fn       the effect to start
 * @param atMs     delay after the page is ready, in ms
 * @returns        a cancel function (call it in onBeforeUnmount)
 */
export function useSettledStart(fn: () => void, atMs: number): () => void {
  let cancelled = false
  const run = () => { if (!cancelled) fn() }

  // wait for the load gate, then `atMs`, then an idle moment (capped so a busy
  // page can't postpone it forever)
  whenAppReady().then(() => setTimeout(() => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 400 })
    else setTimeout(run, 50)
  }, atMs))

  return () => { cancelled = true }
}
