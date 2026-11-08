<script setup lang="ts">
/**
 * The hand-drawn signature. It is made of filled paths, so instead of a
 * stroke-dash "draw" we reveal it with a left→right clip-path wipe, which
 * reads like the pen moving across the page.
 */
const props = withDefaults(defineProps<{
  size?: 'hero' | 'footer'
  delay?: number
  /** Reveal on load (hero) vs. when scrolled into view (footer/post). */
  trigger?: 'load' | 'view'
}>(), { size: 'hero', delay: 0, trigger: 'view' })

const el = ref<HTMLElement>()
const drawn = ref(props.trigger === 'load')

onMounted(() => {
  if (props.trigger === 'load' || !el.value) return
  const io = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting) {
      drawn.value = true
      io.disconnect()
    }
  }, { threshold: 0.6 })
  io.observe(el.value)
})

const src = computed(() => props.size === 'hero' ? '/svg/signature.svg' : '/svg/signature-footer.svg')
const dims = computed(() => props.size === 'hero' ? { w: 63.875, h: 56.018 } : { w: 54.75, h: 48.015 })
</script>

<template>
  <span
    ref="el"
    class="signature"
    :class="{ drawn }"
    :style="{ '--delay': `${delay}ms`, width: `${dims.w}px`, height: `${dims.h}px` }"
    role="img"
    aria-label="Amir — signature"
  >
    <img :src="src" alt="" :width="dims.w" :height="dims.h">
  </span>
</template>

<style scoped>
.signature { display: inline-block; flex-shrink: 0; }
.signature img {
  width: 100%;
  height: 100%;
  clip-path: inset(-10% 100% -10% 0);
}
.signature.drawn img {
  animation: sign 1.4s var(--ease-in-out) var(--delay) forwards;
}
@keyframes sign {
  to { clip-path: inset(-10% -10% -10% 0); }
}
@media (prefers-reduced-motion: reduce) {
  .signature img { clip-path: none; }
}
@media print {
  .signature img { clip-path: none; animation: none; }
}
</style>
