<script setup lang="ts">
/**
 * The guestbook game: full screen, the site's chrome gone except a way home.
 *
 *   sail:   WASD / arrows, or click (tap) the sea to set a course, drag to steer
 *   read:   come alongside a bottle → Fish it out (Space) → it hops into your
 *           hands, uncorks, the letter unrolls into the HTML letter
 *   write:  Write a note → Roll it up (POST) → the letter rolls into a bottle
 *           → flick it (or Space) and it lands in the sea ahead of the boat
 *
 * three.js is imported only here, after mount. Without WebGL the letters
 * still work (`flat`: a plain list and the same writing desk).
 */
import { MELODY_SCALE, MELODY_STEPS, hasNotes, type Bottle } from '#shared/utils/bottles'
import { drawLetter, isRtl } from '~/utils/sea/letter'
import type { SeaEngine } from '~/utils/sea/engine'
import { SeaSynth } from '~/utils/sea/synth'

type Mode = 'sea' | 'write' | 'sealing' | 'holding' | 'opening' | 'read' | 'closing'

const canvas = ref<HTMLCanvasElement>()
const pointer = ref<HTMLElement>()
const pointerLabel = ref<HTMLElement>()
const compass = ref<HTMLElement>()
const compassLabel = ref<HTMLElement>()
const letterRef = ref<{ paper: HTMLElement, focus: () => void }>()

const mode = ref<Mode>('sea')
const ready = ref(false)
const flat = ref(false)
const bottles = ref<Bottle[]>([])
const total = ref(0)
const reading = ref<Bottle>()
const playing = ref<number>()
const nearId = ref<string | null>(null)
const moved = ref(false)
const toast = ref('')
const error = ref('')
const busy = ref(false)
const night = ref(false)
const touch = ref(false)
const sound = useLocalStorage('sea:sound', true)
const mine = useLocalStorage<string[]>('sea:mine', [])
const readIds = useLocalStorage<string[]>('sea:read', [])
const guide = useLocalStorage('sea:guide', true)

const blank = () => ({ message: '', name: '', melody: Array(MELODY_STEPS).fill(-1), website: '' })
const draft = ref(blank())
let openedAt = 0
let stopTune: (() => void) | undefined
let toastTimer: ReturnType<typeof setTimeout> | undefined
let pendingThrow: Bottle | undefined

const synth = new SeaSynth()
let engine: SeaEngine | undefined

const found = computed(() => Math.min(readIds.value.length, total.value || Infinity))
const letterMode = computed(() => (mode.value === 'write' || mode.value === 'sealing' ? 'write' : 'read'))
const letterShown = computed(() => ['write', 'read'].includes(mode.value) || (flat.value && mode.value === 'sealing'))
const letterMounted = computed(() => ['write', 'sealing', 'opening', 'read', 'closing'].includes(mode.value))
const dim = computed(() => mode.value === 'write' || mode.value === 'read')

function say(msg: string, ms = 4200) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, ms)
}

// ───────── bottles from the API ─────────

const seen = () => new Set([...readIds.value, ...mine.value])

async function load() {
  try {
    const res = await $fetch<{ bottles: Bottle[], total: number }>('/api/bottles', { query: { mine: mine.value.join(',') } })
    total.value = res.total
    const known = new Set(bottles.value.map(b => b.id))
    const fresh = res.bottles.filter(b => !known.has(b.id))
    bottles.value.push(...fresh)
    engine?.setBottles(fresh, seen())
    return fresh.filter(b => !seen().has(b.id)).length
  }
  catch {
    say('The sea is unreachable right now.')
    return 0
  }
}

async function onNeedMore() {
  const n = await load()
  if (!n) say('You\'ve read every bottle out here. Why not write one?', 6000)
  else say('The tide brought in more bottles.')
}

// ───────── write ─────────

async function startWriting() {
  if (mode.value !== 'sea') return
  error.value = ''
  mode.value = 'write'
  engine?.setControls(false)
  openedAt = performance.now()
  await nextTick()
  letterRef.value?.focus()
}

function cancelWriting() {
  mode.value = 'sea'
  engine?.setControls(true)
}

async function seal() {
  if (busy.value || draft.value.message.trim().length < 2) return
  busy.value = true
  error.value = ''
  let bottle: Bottle
  try {
    bottle = await $fetch<Bottle>('/api/bottles', {
      method: 'POST',
      body: { ...draft.value, elapsed: performance.now() - openedAt },
    })
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || 'The sea is unreachable right now.'
    busy.value = false
    return
  }
  busy.value = false
  mine.value = [bottle.id, ...mine.value].slice(0, 5)
  bottles.value.push(bottle)

  if (!engine) {
    mode.value = 'sea'
    draft.value = blank()
    return say('Sent out to sea. Someone will find it.')
  }
  const rect = letterRef.value!.paper.getBoundingClientRect()
  const pic = drawLetter({ ...draft.value, createdAt: bottle.createdAt }, rect.width, rect.height)
  mode.value = 'sealing'
  await engine.seal(bottle, rect, pic)
  draft.value = blank()
  pendingThrow = bottle
  mode.value = 'holding'
}

function throwIt() {
  void engine?.throwHeld()
}

function onLanded() {
  mode.value = 'sea'
  pendingThrow = undefined
  say('Out to sea. Someone will fish it out one day.')
}

// ───────── read ─────────

async function open(id: string) {
  const b = bottles.value.find(x => x.id === id)
  if (!b || mode.value !== 'sea') return
  if (sound.value) synth.startSea()
  reading.value = b
  if (!readIds.value.includes(id) && !mine.value.includes(id)) readIds.value = [...readIds.value, id]
  if (!engine) {
    mode.value = 'read'
    await nextTick()
    letterRef.value?.focus()
    return
  }
  mode.value = 'opening' // mounted but invisible: measure it
  await nextTick()
  const rect = letterRef.value!.paper.getBoundingClientRect()
  await engine.open(id, rect, drawLetter(b, rect.width, rect.height))
  mode.value = 'read'
  setTimeout(() => engine?.releasePaper(), 260)
  await nextTick()
  letterRef.value?.focus()
  if (hasNotes(b.melody)) setTimeout(play, 350)
}

function play() {
  const m = reading.value?.melody
  if (!m) return
  stopTune?.()
  stopTune = synth.play(m, (i) => { playing.value = i < 0 ? undefined : i })
}

async function close() {
  if (mode.value === 'write') return cancelWriting()
  if (mode.value !== 'read') return
  stopTune?.()
  playing.value = undefined
  if (!engine) {
    reading.value = undefined
    mode.value = 'sea'
    return
  }
  const rect = letterRef.value!.paper.getBoundingClientRect()
  mode.value = 'closing'
  await engine.close(rect)
  reading.value = undefined
  mode.value = 'sea'
}

// ───────── chrome ─────────

function toggleSound() {
  sound.value = !sound.value
  synth.setMuted(!sound.value)
  if (sound.value) synth.startSea()
  else synth.stopSea()
}

function toggleGuide() {
  guide.value = !guide.value
  if (engine) engine.guide = guide.value
}

function toggleNight() {
  night.value = !night.value
  engine?.setNight(night.value)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && (mode.value === 'read' || mode.value === 'write')) close()
}

/** the first click anywhere is allowed to start sound */
function wake() {
  if (sound.value) synth.startSea()
}

onMounted(async () => {
  document.documentElement.classList.add('sea-mode')
  touch.value = matchMedia('(pointer: coarse)').matches
  night.value = document.documentElement.classList.contains('dark')
  synth.setMuted(!sound.value)
  window.addEventListener('keydown', onKey)
  window.addEventListener('pointerdown', wake, { once: true })
  window.addEventListener('keydown', wake, { once: true })

  const [{ SeaEngine }] = await Promise.all([import('~/utils/sea/engine'), load()])
  if (!canvas.value) return
  if (!SeaEngine.supported()) {
    flat.value = true
    ready.value = true
    return
  }
  engine = new SeaEngine(canvas.value, {
    synth,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    hud: { pointer: pointer.value!, label: pointerLabel.value!, compass: compass.value!, compassLabel: compassLabel.value! },
    events: {
      ready: () => { ready.value = true },
      near: (id) => { nearId.value = id },
      pick: id => open(id),
      landed: onLanded,
      moved: () => { moved.value = true },
      needMore: onNeedMore,
    },
  })
  engine.setNight(night.value, true)
  engine.guide = guide.value
  engine.setBottles(bottles.value, seen())
})

onBeforeUnmount(() => {
  document.documentElement.classList.remove('sea-mode')
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('pointerdown', wake)
  window.removeEventListener('keydown', wake)
  stopTune?.()
  clearTimeout(toastTimer)
  engine?.dispose()
  synth.dispose()
})

const hint = computed(() => touch.value
  ? 'Tap the sea to sail · drag to steer · tap your boat to honk'
  : 'WASD or arrows to sail · click the sea to set a course · H to honk')
</script>

<template>
  <div class="game" :class="{ ready, night, touch }">
    <canvas ref="canvas" class="canvas" aria-hidden="true" />

    <!-- points at the nearest unread bottle when it's off screen -->
    <div class="pointer-anchor" aria-hidden="true">
      <div ref="pointer" class="pointer">
        <span class="arrow" />
        <span ref="pointerLabel" class="dist" />
      </div>
    </div>

    <!-- always: which way, and how far, to the nearest bottle you haven't read -->
    <div ref="compass" class="compass chip" data-state="off" aria-hidden="true">
      <span class="needle"><svg viewBox="0 0 20 20" width="18" height="18"><path d="M3 10h11M10 5.5 14.5 10 10 14.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
      <span ref="compassLabel" class="mono" />
      <span class="what">new bottle</span>
    </div>

    <header class="top">
      <NuxtLink to="/" class="chip back" aria-label="Back to the site">
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
        <span>Home</span>
      </NuxtLink>
      <h1 class="chip title">Message in a bottle</h1>
      <div class="chip tools">
        <span class="found" :title="`You've fished out ${found} ${found === 1 ? 'bottle' : 'bottles'}`">
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M8 2.5h4M8.7 2.5v3.2c0 .4-.2.7-.5 1L6.6 8.1A3.4 3.4 0 0 0 5.5 10.6v4.9A2 2 0 0 0 7.5 17.5h5a2 2 0 0 0 2-2v-4.9c0-1-.4-1.9-1.1-2.5l-1.6-1.4c-.3-.3-.5-.6-.5-1V2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /><path d="M7.5 11.5h5M7.5 14h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
          <span class="mono">{{ found }}<template v-if="total"> / {{ total }}</template></span>
        </span>
        <button type="button" class="icon" :class="{ off: !guide }" :aria-pressed="guide" :aria-label="guide ? 'Hide the way to new bottles' : 'Show the way to new bottles'" :title="guide ? 'Hide the compass' : 'Show the compass'" @click="toggleGuide">
          <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M12.8 7.2 11 11l-3.8 1.8L9 9z" fill="currentColor" /></svg>
        </button>
        <button type="button" class="icon" :aria-pressed="sound" :aria-label="sound ? 'Mute' : 'Unmute'" @click="toggleSound">
          <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
            <path d="M3 8h3l4-3v10l-4-3H3z" fill="currentColor" />
            <g v-if="sound" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M13 7.5a3.5 3.5 0 0 1 0 5" /><path d="M15.5 5a7 7 0 0 1 0 10" /></g>
            <path v-else d="M13.5 8l4 4m0-4l-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
        <button type="button" class="icon" :aria-label="night ? 'Make it day' : 'Make it night'" @click="toggleNight">
          <svg v-if="night" viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="currentColor" /><path d="M10 1.8v2M10 16.2v2M18.2 10h-2M3.8 10h-2M15.8 4.2l-1.4 1.4M5.6 14.4l-1.4 1.4M15.8 15.8l-1.4-1.4M5.6 5.6 4.2 4.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
          <svg v-else viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path d="M15.5 12.6A6.5 6.5 0 0 1 7.4 4.5a6.5 6.5 0 1 0 8.1 8.1z" fill="currentColor" /></svg>
        </button>
      </div>
    </header>

    <Transition name="toast">
      <p v-if="toast" :key="toast" class="toast chip" role="status">{{ toast }}</p>
    </Transition>

    <div v-show="!dim && mode !== 'opening' && mode !== 'closing' && mode !== 'sealing'" class="bottom">
      <Transition name="fade">
        <p v-if="ready && !moved && mode === 'sea' && !flat" class="hint chip">{{ hint }}</p>
      </Transition>
      <div class="actions">
        <Transition name="pop">
          <button v-if="nearId && mode === 'sea'" type="button" class="btn primary big" @click="engine?.pickNear()">
            Fish it out <kbd v-if="!touch">Space</kbd>
          </button>
        </Transition>
        <Transition name="pop">
          <button v-if="mode === 'holding'" type="button" class="btn primary big" @click="throwIt">
            Throw it overboard <kbd v-if="!touch">Space</kbd>
          </button>
        </Transition>
        <button v-if="mode === 'sea'" type="button" class="btn" @click="startWriting">
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M13.6 3.4a1.9 1.9 0 0 1 2.7 2.7L7 15.4l-3.6.9.9-3.6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg>
          Write a note
        </button>
      </div>
      <p v-if="mode === 'holding'" class="hint chip">{{ touch ? 'Swipe up to throw it' : 'Flick it up, or press Space' }} · you can keep sailing first</p>
    </div>

    <div class="overlay" :class="{ dim }">
      <Transition name="letter">
        <SeaLetter
          v-if="letterMounted"
          ref="letterRef"
          v-model:draft="draft"
          class="letter"
          :class="{ hidden: !letterShown }"
          :mode="letterMode"
          :note="reading"
          :playing="playing"
          :busy="busy"
          :error="error"
          @submit="seal"
          @cancel="close"
          @close="close"
          @play="play"
          @note="r => synth.note(MELODY_SCALE[r]!)"
        />
      </Transition>
    </div>

    <!-- no WebGL: the letters, plainly -->
    <section v-if="flat" class="flat chip">
      <p class="flat-title serif">The sea can't be drawn in this browser, but the letters still float.</p>
      <ul>
        <li v-for="b in bottles" :key="b.id">
          <button type="button" :dir="isRtl(b.message) ? 'rtl' : 'ltr'" @click="open(b.id)">{{ b.message }}</button>
        </li>
      </ul>
    </section>

    <ul class="sr-only" aria-label="Letters in the sea">
      <li v-for="b in bottles" :key="b.id">{{ b.message }} — {{ b.name || 'a stranger' }}</li>
    </ul>

    <Transition name="fade">
      <div v-if="!ready" class="loading" aria-live="polite">
        <svg class="boat" viewBox="0 0 64 48" width="64" height="48" aria-hidden="true">
          <path d="M8 30h48l-6 10H14z" fill="#b77744" />
          <path d="M8 30h48l-1.2 2H9.2z" fill="#f3efe4" />
          <path d="M31 6v24" stroke="#8a5a35" stroke-width="2.2" />
          <path d="M33 8l15 20H33z" fill="#fbf6ea" />
          <path d="M29 10 18 27h11z" fill="#fbf6ea" />
          <path d="M33 20h11.5" stroke="#e35d45" stroke-width="2" />
          <path d="M31 6l8 2-8 2z" fill="#e35d45" />
        </svg>
        <p class="serif">Setting sail…</p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.game {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: linear-gradient(#bfe6ff, #7fd8e8);
  color: #10324a;
  font-family: var(--font-sans);
  -webkit-tap-highlight-color: transparent;
  --glass: rgba(255, 255, 255, 0.74);
  --glass-edge: rgba(255, 255, 255, 0.85);
  --ink: #10324a;
  --shadow: 0 10px 30px -10px rgba(16, 50, 74, 0.45);
}
.game.night {
  background: linear-gradient(#0a1230, #12305a);
  color: #e6efff;
  --glass: rgba(14, 26, 54, 0.62);
  --glass-edge: rgba(255, 255, 255, 0.1);
  --ink: #e6efff;
  --shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.7);
}
.canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
  opacity: 0;
  transition: opacity 1s var(--ease-out);
}
.ready .canvas { opacity: 1; }

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  margin: 0;
  border-radius: 999px;
  background: var(--glass);
  -webkit-backdrop-filter: blur(14px) saturate(1.5);
  backdrop-filter: blur(14px) saturate(1.5);
  box-shadow: 0 0 0 1px var(--glass-edge) inset, var(--shadow);
  color: var(--ink);
  font-size: 14px;
  white-space: nowrap;
}

.top {
  position: absolute;
  top: max(16px, env(safe-area-inset-top));
  left: max(16px, env(safe-area-inset-left));
  right: max(16px, env(safe-area-inset-right));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  pointer-events: none;
}
.top > * { pointer-events: auto; }
.back { font-weight: 500; transition: transform 0.25s var(--ease-spring); }
.back:hover { transform: translateX(-2px); }
.title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
  font-size: 19px;
  pointer-events: none;
}
.tools { padding: 0 6px 0 14px; gap: 4px; }
.found { display: inline-flex; align-items: center; gap: 6px; margin-right: 6px; font-size: 13px; }
.icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  color: inherit;
  transition: background 0.2s, transform 0.25s var(--ease-spring);
}
.icon:hover { background: rgba(127, 160, 190, 0.18); }
.icon:active { transform: scale(0.9); }
.icon.off { opacity: 0.45; }

.compass {
  position: absolute;
  top: calc(max(16px, env(safe-area-inset-top)) + 52px);
  left: max(16px, env(safe-area-inset-left));
  height: 36px;
  padding: 0 12px 0 8px;
  gap: 6px;
  font-size: 13px;
  pointer-events: none;
  transition: opacity 0.3s;
}
.compass[data-state='off'], .compass[data-state='none'] { opacity: 0; }
.needle { display: grid; place-items: center; width: 22px; height: 22px; color: #e8912c; transform: rotate(var(--angle, 0rad)); }
.night .needle { color: #ffc46b; }
.what { opacity: 0.7; font-size: 12px; }

.bottom {
  position: absolute;
  left: 50%;
  bottom: max(22px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: max-content;
  max-width: calc(100vw - 32px);
}
.actions { display: flex; align-items: center; gap: 10px; }
.btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 48px;
  padding: 0 22px;
  border-radius: 999px;
  background: var(--glass);
  -webkit-backdrop-filter: blur(14px) saturate(1.5);
  backdrop-filter: blur(14px) saturate(1.5);
  box-shadow: 0 0 0 1px var(--glass-edge) inset, var(--shadow);
  color: var(--ink);
  font-size: 15px;
  font-weight: 500;
  transition: transform 0.3s var(--ease-spring), box-shadow 0.25s;
}
.btn:hover { transform: translateY(-2px); }
.btn:active { transform: translateY(0) scale(0.96); }
.btn.primary { background: var(--ink); color: #fff; box-shadow: var(--shadow); }
.night .btn.primary { color: #0d1b33; }
.btn.big { height: 54px; padding: 0 26px; font-size: 16px; animation: nudge 1.8s var(--ease-in-out) infinite; }
@keyframes nudge { 50% { transform: translateY(-4px); } }
kbd {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 3px 7px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.2);
}
.hint { height: 34px; font-size: 13px; opacity: 0.92; }

.toast {
  position: absolute;
  top: calc(max(16px, env(safe-area-inset-top)) + 54px);
  left: 50%;
  transform: translateX(-50%);
  height: 38px;
}

/* the off-screen bottle pointer: positioned by the engine */
.pointer-anchor { position: absolute; left: 50%; top: 50%; width: 0; height: 0; pointer-events: none; }
.pointer {
  position: absolute;
  left: -26px;
  top: -26px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--glass);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  box-shadow: 0 0 0 1px var(--glass-edge) inset, var(--shadow);
  color: var(--ink);
  opacity: 0;
  transition: opacity 0.35s;
}
.arrow { position: absolute; inset: 0; transform: rotate(var(--angle, 0rad)); }
.arrow::after {
  content: '';
  position: absolute;
  right: -9px;
  top: 50%;
  transform: translateY(-50%);
  border-left: 10px solid #ffb84d;
  border-top: 7px solid transparent;
  border-bottom: 7px solid transparent;
}
.dist { font-family: var(--font-mono); font-size: 11px; }

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
  transition: background 0.5s var(--ease-out);
}
.overlay.dim { background: radial-gradient(ellipse at center, rgba(6, 28, 48, 0.18), rgba(6, 28, 48, 0.5)); pointer-events: auto; }
.letter { pointer-events: auto; }
.letter.hidden { visibility: hidden; }
.letter-enter-active { transition: opacity 0.35s var(--ease-out), transform 0.5s var(--ease-out); }
.letter-enter-from { opacity: 0; transform: translateY(14px) scale(0.98); }
.letter-leave-active { transition: none; }
.letter:not(.hidden) { animation: letter-in 0.25s var(--ease-out); }
@keyframes letter-in { from { opacity: 0; } }

.loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 10px;
  color: #10324a;
}
.night .loading { color: #e6efff; }
.loading p { font-size: 22px; font-style: italic; }
.loading .boat { animation: rock 1.6s var(--ease-in-out) infinite; transform-origin: 50% 80%; }
@keyframes rock { 0%, 100% { transform: rotate(-6deg) translateY(0); } 50% { transform: rotate(6deg) translateY(-3px); } }

.flat {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(520px, 100vw - 32px);
  max-height: 70vh;
  height: auto;
  border-radius: 20px;
  padding: 20px;
  flex-direction: column;
  align-items: stretch;
  overflow: auto;
  white-space: normal;
}
.flat-title { font-size: 18px; }
.flat ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.flat button { width: 100%; padding: 10px 0; text-align: start; border-bottom: 1px solid rgba(127, 160, 190, 0.3); font-family: var(--font-serif); font-size: 17px; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.5s var(--ease-out); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.pop-enter-active { transition: opacity 0.3s var(--ease-out), transform 0.45s var(--ease-spring); }
.pop-leave-active { transition: opacity 0.2s, transform 0.2s; }
.pop-enter-from, .pop-leave-to { opacity: 0; transform: translateY(10px) scale(0.9); }
.toast-enter-active { transition: opacity 0.3s, transform 0.4s var(--ease-spring); }
.toast-leave-active { transition: opacity 0.3s; }
.toast-enter-from { opacity: 0; transform: translate(-50%, -8px); }
.toast-leave-to { opacity: 0; }

@media (max-width: 720px) {
  .title { display: none; }
  .hint { height: auto; min-height: 34px; padding: 8px 14px; white-space: normal; text-align: center; line-height: 1.35; }
}
@media (prefers-reduced-motion: reduce) {
  .btn.big, .loading .boat { animation: none; }
}
</style>

<style>
/* the game owns the whole viewport while it's open */
html.sea-mode, html.sea-mode body { overflow: hidden; overscroll-behavior: none; }
</style>
