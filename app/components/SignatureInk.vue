<script setup lang="ts">
/**
 * The signature, written by a pen.
 *
 * Each glyph (A → m → i → r, see utils/signaturePaths.ts) is shown through a
 * mask of thick round strokes running along its outline; animating their
 * stroke-dashoffset reveals the ink exactly where the pen passes. Durations
 * come from each outline's real length, so long letters take longer.
 *
 * Dash animations paint on the main thread, so only start writing when the
 * page is idle (the loader waits for hydration; elsewhere it's on scroll).
 *
 *   play    start writing (false → hidden, nothing drawn yet)
 *   written show it fully written, no animation
 *   @done   fired once the last glyph is down
 */
const props = withDefaults(defineProps<{
  play?: boolean
  written?: boolean
  /** pen speed in viewBox units per ms */
  speed?: number
}>(), { play: false, written: false, speed: 3.3 })

const emit = defineEmits<{ done: [] }>()

const LIFT_MS = 60
const maskId = `pen-${useId()}`
const inks = ref<SVGPathElement[]>([])
const total = ref(0)

/** Give each glyph a duration from its outline length and chain the delays. */
function schedule() {
  let t = 0
  for (const p of inks.value) {
    // the outline runs up one side of a stroke and back down the other; the
    // thick mask reveals the stroke on the way up, so the way back reads as
    // the pen lifting before the next glyph
    const dur = p.getTotalLength() / props.speed
    p.style.setProperty('--delay', `${t}ms`)
    p.style.setProperty('--dur', `${dur}ms`)
    t += dur * 0.62 + LIFT_MS
  }
  const last = inks.value.at(-1)
  total.value = last ? t - LIFT_MS + (last.getTotalLength() / props.speed) * 0.38 : 0
}

let timer: ReturnType<typeof setTimeout> | undefined
onMounted(() => {
  schedule()
  if (props.play) start()
})
watch(() => props.play, (on) => { if (on) start() })
function start() {
  clearTimeout(timer)
  timer = setTimeout(() => emit('done'), total.value)
}
onBeforeUnmount(() => clearTimeout(timer))

/** how long writing takes, in ms (known after mount) */
defineExpose({ total })
</script>

<template>
  <svg class="ink-sig" :class="{ play, written }" :viewBox="SIGNATURE_VIEWBOX" aria-hidden="true">
    <defs>
      <mask :id="maskId" maskUnits="userSpaceOnUse">
        <path
          v-for="g in SIGNATURE_GLYPHS"
          :key="g.name"
          ref="inks"
          class="pen"
          :d="g.d"
          pathLength="1"
        />
      </mask>
    </defs>
    <g :mask="`url(#${maskId})`">
      <path v-for="g in SIGNATURE_GLYPHS" :key="g.name" :d="g.d" class="glyph" />
    </g>
  </svg>
</template>

<style scoped>
.ink-sig { display: block; width: 100%; height: 100%; overflow: visible; }
.glyph { fill: var(--text); }

/* The pen: a thick round stroke along each glyph's outline, wide enough to
   cover the whole stroke width from one edge. pathLength="1" makes the dash
   maths work before JS has measured anything: dash 1, gap 1, offset 1 =
   nothing drawn yet. */
.pen {
  fill: none;
  stroke: #fff;
  stroke-width: 34;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1 1;
  stroke-dashoffset: 1;
}
.play .pen {
  animation: pen var(--dur, 400ms) cubic-bezier(0.35, 0, 0.55, 1) var(--delay, 0ms) forwards;
}
.written .pen { stroke-dashoffset: 0; animation: none; }
@keyframes pen { to { stroke-dashoffset: 0; } }

@media (prefers-reduced-motion: reduce) {
  .pen { stroke-dashoffset: 0; animation: none !important; }
}
@media print {
  .pen { stroke-dashoffset: 0; animation: none !important; }
}
</style>
