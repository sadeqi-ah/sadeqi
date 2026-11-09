<script setup lang="ts">
/**
 * The letter, as real HTML: written on in 'write' mode, read in 'read' mode.
 * Laid out from LETTER (utils/sea/letter.ts) — the same numbers the canvas
 * copy that rolls into the bottle is drawn with, so swapping one for the
 * other is seamless. `paper` is exposed for the scene to measure.
 */
import { BOTTLE_LIMITS, MELODY_STEPS, hasNotes, type Bottle, type BottleDraft } from '#shared/utils/bottles'
import { FOOTER_H, LETTER, formatLetterDate, isRtl } from '~/utils/sea/letter'

const props = defineProps<{
  mode: 'write' | 'read'
  note?: Bottle
  playing?: number
  busy?: boolean
  error?: string
}>()
const draft = defineModel<BottleDraft & { website: string }>('draft', { required: true })
const emit = defineEmits<{ submit: [], cancel: [], close: [], play: [], note: [row: number] }>()

const paper = ref<HTMLElement>()
const text = ref<HTMLTextAreaElement>()
defineExpose({ paper, focus: () => (props.mode === 'write' ? text.value : paper.value)?.focus({ preventScroll: true }) })

const melody = computed({
  get: () => (props.mode === 'read' ? props.note?.melody : draft.value.melody) ?? Array(MELODY_STEPS).fill(-1),
  set: (m) => { draft.value.melody = m },
})
const message = computed(() => (props.mode === 'read' ? props.note?.message : draft.value.message) ?? '')
const left = computed(() => BOTTLE_LIMITS.message - draft.value.message.length)
const showTune = computed(() => props.mode === 'write' || hasNotes(props.note?.melody))
const vars = {
  '--pad': `${LETTER.pad}px`,
  '--top': `${LETTER.textTop}px`,
  '--line': `${LETTER.line}px`,
  '--font': `${LETTER.font}px`,
  '--footer': `${FOOTER_H}px`,
  '--w': `${LETTER.width}px`,
  '--h': `${LETTER.height}px`,
}
</script>

<template>
  <div class="letter" :style="vars">
    <form
      ref="paper"
      class="paper"
      tabindex="-1"
      :aria-label="mode === 'write' ? 'Write a letter' : 'A letter from the sea'"
      @submit.prevent="emit('submit')"
    >
      <p class="date">{{ formatLetterDate(mode === 'read' ? note?.createdAt : undefined) }}</p>

      <textarea
        v-if="mode === 'write'"
        ref="text"
        v-model="draft.message"
        class="body"
        dir="auto"
        :maxlength="BOTTLE_LIMITS.message"
        placeholder="Dear stranger,"
        aria-label="Your note"
        required
      />
      <p v-else class="body" :dir="isRtl(message) ? 'rtl' : 'ltr'">{{ message }}</p>

      <div class="foot">
        <SeaMelody
          v-if="showTune"
          v-model="melody"
          :editable="mode === 'write'"
          :playing="playing"
          @note="emit('note', $event)"
          @crank="emit('play')"
        />
        <span v-else />
        <label v-if="mode === 'write'" class="sig">
          <span aria-hidden="true">—</span>
          <input
            v-model="draft.name"
            dir="auto"
            :maxlength="BOTTLE_LIMITS.name"
            placeholder="a stranger"
            aria-label="Sign it (optional)"
            autocomplete="given-name"
          >
        </label>
        <p v-else class="sig" dir="auto">— {{ note?.name || 'a stranger' }}</p>
      </div>

      <!-- for bots only -->
      <input v-if="mode === 'write'" v-model="draft.website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
    </form>

    <div class="actions">
      <template v-if="mode === 'write'">
        <span class="meta mono" :class="{ warn: left < 40 }">
          <template v-if="error">{{ error }}</template>
          <template v-else-if="hasNotes(draft.melody)">♪ turn the crank to hear it · {{ left }}</template>
          <template v-else>punch a tune into the strip · {{ left }}</template>
        </span>
        <UiButton label="Cancel" @click="emit('cancel')" />
        <UiButton
          variant="primary"
          :label="busy ? 'Sealing…' : 'Roll it up'"
          :disabled="busy || draft.message.trim().length < 2"
          @click="emit('submit')"
        />
      </template>
      <template v-else>
        <span class="meta mono">from the sea</span>
        <UiButton v-if="hasNotes(note?.melody)" :label="playing !== undefined && playing >= 0 ? 'Stop' : 'Play the tune'" icon="♪" @click="emit('play')" />
        <UiButton variant="primary" label="Throw it back" @click="emit('close')" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.letter {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(var(--w), 100% - 32px);
  height: min(var(--h) + 52px, 100% - 32px);
}
.paper {
  position: relative;
  flex: 1;
  min-height: 0;
  padding: var(--pad);
  border-radius: 3px;
  background:
    radial-gradient(ellipse at center, rgba(120, 90, 50, 0) 40%, rgba(120, 90, 50, 0.12) 100%),
    #f6f1e6;
  color: #2a2622;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.6) inset, 0 20px 50px -18px rgba(20, 30, 40, 0.45);
  outline: none;
}
:global(.game.night) .paper { filter: brightness(0.86); }
.date {
  position: absolute;
  top: var(--pad);
  left: var(--pad);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 13px;
  color: #9b9086;
}
.body {
  position: absolute;
  top: var(--top);
  left: var(--pad);
  right: var(--pad);
  bottom: calc(var(--pad) + var(--footer) + 14px);
  margin: 0;
  padding: 0;
  border: 0;
  overflow: hidden auto;
  font-family: var(--font-serif);
  font-size: var(--font);
  line-height: var(--line);
  color: inherit;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: repeating-linear-gradient(transparent 0 calc(var(--line) - 1px), rgba(120, 96, 70, 0.13) calc(var(--line) - 1px) var(--line));
  background-attachment: local;
  resize: none;
  outline: none;
  scrollbar-width: none;
}
.body::placeholder { color: #b3a89c; }
.foot {
  position: absolute;
  left: var(--pad);
  right: var(--pad);
  bottom: var(--pad);
  height: var(--footer);
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.sig {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: -2px;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 20px;
  line-height: 1;
}
.sig input {
  width: 6.2em; /* browsers without field-sizing */
  min-width: 1ch;
  max-width: 9.5em;
  field-sizing: content;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  outline: none;
  border-bottom: 1px dashed transparent;
  transition: border-color 0.2s;
}
@supports (field-sizing: content) {
  .sig input { width: auto; }
}
.sig input:focus { border-bottom-color: rgba(42, 38, 34, 0.3); }
.sig input::placeholder { color: #b3a89c; }
.hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }

.actions { display: flex; align-items: center; gap: 8px; }
.meta { flex: 1; font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta.warn { color: #c2410c; }
.actions :deep(.btn:disabled) { opacity: 0.45; pointer-events: none; }
@media (max-width: 420px) {
  .meta { display: none; }
  .actions { justify-content: flex-end; }
}
</style>
