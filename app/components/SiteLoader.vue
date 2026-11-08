<script setup lang="ts">
/**
 * First-load screen: the signature writes itself, then glides into its place
 * in the hero as the page animates in.
 *
 *   1. SSR paints a blank paper screen. The app hydrates behind it.
 *   2. Once hydrated (ready.client plugin), the pen writes (SignatureInk).
 *      Dash animations paint on the main thread, which is why writing waits
 *      for hydration: it plays on an idle thread instead of stuttering.
 *   3. Open the load gate (utils/appReady.ts), fly the mark into
 *      [data-signature-target] (FLIP, transform only), fade the paper, unmount.
 *      Pages without a target just fade out.
 */
const done = ref(false)
const writing = ref(false)
const backdrop = ref<HTMLElement>()
const mark = ref<HTMLElement>()
const ink = ref<{ total: number }>()

const FLY_MS = 750

type LoaderWindow = Window & { __appReady?: () => void, __hydrated?: boolean }

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const whenHydrated = () => (window as LoaderWindow).__hydrated
  ? Promise.resolve()
  : new Promise<void>(r => window.addEventListener('app:hydrated', () => r(), { once: true }))

function inView(el: HTMLElement) {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.bottom > 0 && r.top < innerHeight
}

onMounted(async () => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  await whenHydrated()
  if (!reduced) {
    writing.value = true
    await wait((ink.value?.total ?? 0) + 150)
  }

  const target = document.querySelector<HTMLElement>('[data-signature-target]')
  const m = mark.value
  const b = backdrop.value
  ;(window as LoaderWindow).__appReady?.() // the page starts animating in, under the fading paper

  if (reduced || !m || !b) {
    target?.setAttribute('data-landed', '')
    done.value = true
    return
  }

  const fade = b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: 120, easing: 'ease-out', fill: 'forwards' })

  if (target && inView(target)) {
    // FLIP: from the centred mark to the hero slot, as one transform
    const from = m.getBoundingClientRect()
    const to = target.getBoundingClientRect()
    const s = to.width / from.width
    await m.animate(
      [{ transform: 'none' }, { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${s})` }],
      { duration: FLY_MS, easing: 'cubic-bezier(0.5, 0, 0.15, 1)', fill: 'forwards' },
    ).finished
    target.setAttribute('data-landed', '')
  }
  else {
    target?.setAttribute('data-landed', '')
    await m.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-out', fill: 'forwards' }).finished
  }
  await fade.finished
  done.value = true
})
</script>

<template>
  <div v-if="!done" class="site-loader" aria-hidden="true">
    <div ref="backdrop" class="backdrop" />
    <div ref="mark" class="mark">
      <SignatureInk ref="ink" :play="writing" />
    </div>
  </div>
</template>

<style scoped>
.site-loader {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  pointer-events: none;
}
.backdrop {
  position: absolute;
  inset: 0;
  background: var(--bg);
}
.mark {
  position: relative;
  width: min(170px, 50vw);
  aspect-ratio: 2 / 1;
  transform-origin: 0 0; /* FLIP maths assume top-left */
  will-change: transform;
}

/* no-JS: hidden, see "Loader" in main.css */
@media (prefers-reduced-motion: reduce) {
  .site-loader { display: none; }
}
@media print {
  .site-loader { display: none; }
}
</style>
