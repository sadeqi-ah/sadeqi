/**
 * v-reveal — fades an element in the first time it scrolls into view.
 * Usage: v-reveal or v-reveal="120" (delay in ms).
 *
 * On a full page load the inline script in nuxt.config (REVEAL_EARLY) already
 * watches every [data-reveal] element while the HTML is still parsing, so
 * on-screen content doesn't sit hidden until hydration. This directive covers
 * elements created later (client-side navigation, v-if) and anything the early
 * script hasn't revealed yet. Both mark the element with `data-revealed`; an
 * attribute rather than a class, so Vue's class patching can never wipe it.
 */
// keep in sync with REVEAL_EARLY in nuxt.config.ts
const REVEAL_OPTIONS: IntersectionObserverInit = { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }

export default defineNuxtPlugin((nuxtApp) => {
  let observer: IntersectionObserver | undefined

  const getObserver = () => {
    observer ??= new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target
          observer!.unobserve(el)
          // in view during first load → wait for the load gate like everything else
          whenAppReady().then(() => el.setAttribute('data-revealed', ''))
        }
      },
      REVEAL_OPTIONS,
    )
    return observer
  }

  nuxtApp.vueApp.directive<HTMLElement, number | undefined>('reveal', {
    getSSRProps: () => ({ 'data-reveal': '' }),
    mounted(el, binding) {
      el.setAttribute('data-reveal', '')
      if (binding.value) el.style.setProperty('--reveal-delay', String(binding.value))
      if (!el.hasAttribute('data-revealed')) getObserver().observe(el)
    },
    unmounted(el) {
      observer?.unobserve(el)
    },
  })
})
