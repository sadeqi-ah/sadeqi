<script setup lang="ts">
/**
 * The tune on a letter: MELODY_STEPS columns × MELODY_SCALE rows of dots, one
 * note per column. Editable: tap a dot, or drag across to paint a line of
 * notes; tapping a column's note again clears it. Sized from LETTER.cell so
 * it lines up with the canvas drawing of the letter (utils/sea/letter.ts).
 */
import { MELODY_SCALE, MELODY_STEPS, type MelodyStep } from '#shared/utils/bottles'
import { LETTER } from '~/utils/sea/letter'

const props = defineProps<{ editable?: boolean, playing?: number }>()
const melody = defineModel<MelodyStep[]>({ required: true })
const emit = defineEmits<{ note: [row: number] }>()

const rows = [...MELODY_SCALE.keys()].reverse() // high notes on top
const NAMES = ['C', 'D', 'E', 'G', 'A', 'C′', 'D′']
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
  <div
    class="melody"
    :class="{ editable }"
    :style="{ '--cell': `${LETTER.cell}px` }"
    :role="editable ? 'grid' : 'img'"
    :aria-label="editable ? 'Compose a tune: one note per step' : 'The tune on this letter'"
  >
    <div v-for="s in MELODY_STEPS" :key="s" class="col" :class="{ now: playing === s - 1 }" role="row">
      <component
        :is="editable ? 'button' : 'span'"
        v-for="r in rows"
        :key="r"
        class="dot"
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
</template>

<style scoped>
.melody { display: flex; touch-action: none; user-select: none; }
.col { display: flex; flex-direction: column; border-radius: 3px; transition: background 0.12s; }
.col.now { background: rgba(42, 38, 34, 0.08); }
.dot {
  position: relative;
  width: var(--cell);
  height: var(--cell);
  padding: 0;
  border-radius: 50%;
}
.dot::after {
  content: '';
  position: absolute;
  inset: 50% auto auto 50%;
  width: 2.4px;
  height: 2.4px;
  border-radius: 50%;
  background: rgba(42, 38, 34, 0.2);
  transform: translate(-50%, -50%);
  transition: width 0.18s var(--ease-spring), height 0.18s var(--ease-spring), background 0.15s;
}
.dot.on::after { width: 7px; height: 7px; background: #2a2622; }
.col.now .dot.on::after { width: 9px; height: 9px; background: #b5562f; }
.editable .dot { cursor: pointer; }
.editable .dot:hover::after { width: 6px; height: 6px; background: rgba(42, 38, 34, 0.45); }
.editable .dot.on:hover::after { width: 7px; height: 7px; background: #2a2622; }
.dot:focus-visible { outline: 1.5px solid #2a2622; outline-offset: -1px; }
</style>
