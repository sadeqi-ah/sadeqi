<script setup lang="ts">
/**
 * The hand-drawn signature, written by a pen (SignatureInk) — the same
 * writing the loader does.
 *
 * trigger:
 *  - 'view'   written when scrolled into view (footer, end of a post)
 *  - 'loader' the loader writes it and flies it here; this copy is shown
 *             already written once the loader marks it `data-landed`
 */
const props = withDefaults(defineProps<{
  size?: 'hero' | 'footer'
  trigger?: 'view' | 'loader'
}>(), { size: 'hero', trigger: 'view' })

const el = ref<HTMLElement>()
const drawn = ref(false)

onMounted(() => {
  if (props.trigger !== 'view' || !el.value) return
  const io = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting) {
      drawn.value = true
      io.disconnect()
    }
  }, { threshold: 0.6 })
  io.observe(el.value)
})

// artwork is ~2:1 (public/svg/signature.svg)
const dims = computed(() => props.size === 'hero' ? { w: 112, h: 56 } : { w: 80, h: 40 })
</script>

<template>
  <span
    ref="el"
    class="signature"
    :class="[`trigger-${trigger}`, { drawn }]"
    :data-signature-target="trigger === 'loader' ? '' : undefined"
    :style="{ width: `${dims.w}px`, height: `${dims.h}px` }"
    role="img"
    aria-label="Amir — signature"
  >
    <SignatureInk :play="drawn" :written="trigger === 'loader'" />
  </span>
</template>

<style scoped>
.signature { display: inline-block; flex-shrink: 0; }
/* hidden while the loader's copy flies in: see "Loader" in main.css */

@media print {
  .signature { visibility: visible !important; }
}
</style>
