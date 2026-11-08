/**
 * Announce that the first render has hydrated and the fonts are in (after two
 * frames, so the hydrated page has painted once). SiteLoader waits for this,
 * then opens the load gate (<html class="ready">). See utils/appReady.ts.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:suspense:resolve', async () => {
    if (isAppReady()) return
    await document.fonts?.ready
    requestAnimationFrame(() => requestAnimationFrame(() => {
      (window as Window & { __appHydrated?: () => void }).__appHydrated?.()
    }))
  })
})
