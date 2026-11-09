<script setup lang="ts">
/**
 * Single-line text that clips with a soft fade when it doesn't fit and, while
 * its host (`[data-marquee-host]`, or itself) is hovered, scrolls right-to-left
 * in a seamless loop — like subtitles.
 */
const props = defineProps<{ text: string }>()

const GAP = 40 // px between the end of the text and its looping copy
const SPEED = 38 // px per second

const root = ref<HTMLElement>()
const textEl = ref<HTMLElement>()
const overflow = ref(false)
const shift = ref(0)

function measure() {
  if (!root.value || !textEl.value) return
  const w = textEl.value.offsetWidth
  overflow.value = w > root.value.clientWidth + 1
  shift.value = w + GAP
}

onMounted(() => {
  measure()
  const ro = new ResizeObserver(measure)
  if (root.value) ro.observe(root.value)
  document.fonts?.ready.then(measure)
  onScopeDispose(() => ro.disconnect())
})
watch(() => props.text, () => nextTick(measure))
</script>

<template>
  <span
    ref="root"
    class="mq"
    :class="{ overflow }"
    :style="{ '--shift': `${shift}px`, '--dur': `${shift / SPEED}s`, '--gap': `${GAP}px` }"
  >
    <span class="track">
      <span ref="textEl" class="txt">{{ text }}</span>
      <span v-if="overflow" class="txt copy" aria-hidden="true">{{ text }}</span>
    </span>
  </span>
</template>

<style scoped>
.mq { display: block; min-width: 0; overflow: hidden; white-space: nowrap; }
.track { display: inline-flex; gap: var(--gap); will-change: transform; }
@property --fade {
  syntax: '<length>';
  initial-value: 0px;
  inherits: false;
}
/* the end fade's width is animatable, so it eases away instead of snapping */
.mq.overflow {
  --fade: 28px;
  -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - var(--fade)), transparent);
  mask-image: linear-gradient(90deg, #000 calc(100% - var(--fade)), transparent);
  transition: --fade 0.45s var(--ease-out);
}

@media (prefers-reduced-motion: no-preference) {
  .mq.overflow:hover .track,
  :global([data-marquee-host]:hover) .mq.overflow .track {
    animation: mq-scroll var(--dur) linear infinite;
  }
  /* while scrolling, no edge fades: the text just runs through its box */
  .mq.overflow:hover,
  :global([data-marquee-host]:hover) .mq.overflow {
    --fade: 0px;
  }
}
@keyframes mq-scroll { to { transform: translateX(calc(var(--shift) * -1)); } }
</style>
