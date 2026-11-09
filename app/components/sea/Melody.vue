<script setup lang="ts">
/**
 * The tune on a letter, as a music-box paper strip: MELODY_STEPS columns ×
 * MELODY_SCALE rows, one punched hole per column, and a little crank beside
 * it that plays the strip. Editable: tap a slot, or drag across to punch a
 * line of notes; tapping a column's hole again patches it. Sized from
 * LETTER.cell so it lines up with the canvas drawing of the letter
 * (utils/sea/letter.ts, drawStrip).
 */
import { MELODY_SCALE, MELODY_STEPS, hasNotes, type MelodyStep } from '#shared/utils/bottles'
import { LETTER, STRIP } from '~/utils/sea/letter'

const props = defineProps<{ editable?: boolean, playing?: number }>()
const melody = defineModel<MelodyStep[]>({ required: true })
const emit = defineEmits<{ note: [row: number], crank: [] }>()

const rows = [...MELODY_SCALE.keys()].reverse() // high notes on top
const NAMES = ['C', 'D', 'E', 'G', 'A', 'C′', 'D′']
const spinning = computed(() => props.playing !== undefined && props.playing >= 0)
const canPlay = computed(() => hasNotes(melody.value))
let painting: number | null = null

function set(step: number, row: number, toggle: boolean) {
  const next = [...melody.value]
  next[step] = toggle && next[step] === row ? -1 : row
  if (next[step] === melody.value[step]) return
  melody.value = next
  if (next[step]! >= 0) emit('note', row)
}

function down(e: PointerEvent, step: number, row: number) {
  if (!props.editable) return
  ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
  painting = melody.value[step] === row ? -1 : row
  set(step, row, true)
}
function enter(step: number, row: number) {
  if (painting === null) return
  if (painting === -1) {
    if (melody.value[step] === row) set(step, row, true)
  }
  else set(step, row, false)
}
const stop = () => { painting = null }
onMounted(() => window.addEventListener('pointerup', stop))
onBeforeUnmount(() => window.removeEventListener('pointerup', stop))
</script>

<template>
  <div class="melody" :style="{ '--cell': `${LETTER.cell}px`, '--gap': `${STRIP.crankGap}px`, '--crank': `${STRIP.crank}px` }">
    <div
      class="strip"
      :class="{ editable, rolling: spinning }"
      :role="editable ? 'grid' : 'img'"
      :aria-label="editable ? 'Punch a tune: one note per step' : 'The tune on this letter'"
    >
      <div v-for="s in MELODY_STEPS" :key="s" class="col" :class="{ now: playing === s - 1 }" role="row">
        <component
          :is="editable ? 'button' : 'span'"
          v-for="r in rows"
          :key="r"
          class="slot"
          :class="{ on: melody[s - 1] === r }"
          :type="editable ? 'button' : undefined"
          :aria-label="editable ? `Step ${s}, ${NAMES[r]}` : undefined"
          :aria-pressed="editable ? melody[s - 1] === r : undefined"
          :tabindex="editable ? 0 : undefined"
          @pointerdown.prevent="down($event, s - 1, r)"
          @pointerenter="enter(s - 1, r)"
          @keydown.enter.space.prevent="editable && set(s - 1, r, true)"
        />
      </div>
    </div>

    <button
      class="crank"
      :class="{ spinning, idle: !canPlay }"
      type="button"
      :disabled="!canPlay"
      :aria-label="spinning ? 'Stop the music box' : 'Turn the crank to play the tune'"
      :title="canPlay ? (spinning ? 'Stop' : 'Play') : 'Punch a few notes first'"
      @click="emit('crank')"
    >
      <svg :viewBox="`0 0 ${STRIP.crank} ${STRIP.crank}`" aria-hidden="true">
        <circle class="drum" :cx="STRIP.crank / 2" :cy="STRIP.crank / 2" :r="STRIP.drum" />
        <g class="arm">
          <line :x1="STRIP.crank / 2" :y1="STRIP.crank / 2" :x2="STRIP.crank / 2" :y2="STRIP.knob + 0.5" />
          <circle class="knob" :cx="STRIP.crank / 2" :cy="STRIP.knob" r="2.4" />
        </g>
        <circle class="axle" :cx="STRIP.crank / 2" :cy="STRIP.crank / 2" r="1.3" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.melody { display: flex; align-items: center; gap: var(--gap); touch-action: none; user-select: none; }

/* the punched paper strip */
.strip {
  position: relative;
  display: flex;
  border-radius: 2px;
  background:
    repeating-linear-gradient(
      to bottom,
      transparent 0 calc(var(--cell) / 2 - 0.5px),
      rgba(120, 96, 70, 0.2) calc(var(--cell) / 2 - 0.5px) calc(var(--cell) / 2 + 0.5px),
      transparent calc(var(--cell) / 2 + 0.5px) var(--cell)
    ),
    #ece2cb;
  box-shadow: 0 0 0 3px #ece2cb, 0 0 0 3.5px rgba(120, 96, 70, 0.22);
}
.col { position: relative; display: flex; flex-direction: column; }
/* the comb: a line of light across the column being played */
.col::before {
  content: '';
  position: absolute;
  inset: -3px auto -3px 50%;
  width: 1.5px;
  border-radius: 1px;
  background: #b5562f;
  opacity: 0;
  transform: translateX(-50%) scaleY(0.6);
  transition: opacity 0.12s, transform 0.2s var(--ease-out);
}
.col.now::before { opacity: 0.55; transform: translateX(-50%) scaleY(1); }

.slot {
  position: relative;
  width: var(--cell);
  height: var(--cell);
  padding: 0;
}
.slot::after {
  content: '';
  position: absolute;
  inset: 50% auto auto 50%;
  width: 0;
  height: 0;
  border-radius: 1.5px;
  background: #3a322a;
  transform: translate(-50%, -50%);
  transition: width 0.18s var(--ease-spring), height 0.18s var(--ease-spring), background 0.15s, box-shadow 0.15s;
}
/* a punched hole: dark, with a lit lower lip */
.slot.on::after { width: 7px; height: 5px; box-shadow: 0 1px 0 rgba(255, 255, 255, 0.75); }
.col.now .slot.on::after { width: 8px; height: 6px; background: #b5562f; box-shadow: 0 0 0 2px rgba(181, 86, 47, 0.18); }
.editable .slot { cursor: pointer; }
.editable .slot::after { width: 2px; height: 2px; background: rgba(42, 38, 34, 0.22); }
.editable .slot.on::after { width: 7px; height: 5px; background: #3a322a; }
.editable .slot:hover::after { width: 6px; height: 4px; background: rgba(42, 38, 34, 0.4); }
.editable .slot.on:hover::after { width: 7px; height: 5px; background: #3a322a; }
.slot:focus-visible { outline: 1.5px solid #2a2622; outline-offset: -1px; border-radius: 2px; }

/* the crank */
.crank {
  width: var(--crank);
  height: var(--crank);
  padding: 0;
  border-radius: 50%;
  color: #2a2622;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s var(--ease-spring);
}
.crank svg { display: block; width: 100%; height: 100%; overflow: visible; }
.drum { fill: #d8c49b; stroke: currentColor; stroke-width: 1.1; }
.arm line { stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }
.knob { fill: #b5562f; stroke: currentColor; stroke-width: 1; }
.axle { fill: currentColor; }
.arm { transform-origin: 50% 50%; transform-box: view-box; transition: transform 0.4s var(--ease-spring); }
.crank:hover:not(:disabled) .arm { transform: rotate(40deg); }
.crank.spinning .arm { animation: turn 1.04s linear infinite; }
.crank:active:not(:disabled) { transform: scale(0.92); }
.crank.idle { opacity: 0.35; cursor: default; }
.crank:focus-visible { outline: 1.5px solid #2a2622; outline-offset: 2px; }
@keyframes turn { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .crank.spinning .arm { animation: none; } }
</style>
