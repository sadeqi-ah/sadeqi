/**
 * "Ready" = the app has hydrated and the loader has finished writing the
 * signature. Until then every load animation is held on its first frame (see
 * main.css), so nothing animates while hydration is busy on the main thread.
 *
 * The flag is the `ready` class on <html>, set by `window.__appReady()`
 * (defined by the inline head script in nuxt.config; SiteLoader calls it, and
 * the head script does too after a fallback timeout).
 */
export function isAppReady(): boolean {
  return document.documentElement.classList.contains('ready')
}

export function whenAppReady(): Promise<void> {
  if (isAppReady()) return Promise.resolve()
  return new Promise(resolve => window.addEventListener('app:ready', () => resolve(), { once: true }))
}
