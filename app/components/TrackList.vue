<script setup lang="ts">
import type { PlaylistTrack } from '~~/server/api/playlist.get'

const props = withDefaults(defineProps<{ tracks: PlaylistTrack[], initial?: number }>(), { initial: 6 })
/** The track whose preview is playing, so the section label can show it. */
const current = defineModel<PlaylistTrack | null>('current', { default: null })

const expanded = ref(false)
const shown = computed(() => expanded.value ? props.tracks : props.tracks.slice(0, props.initial))

const audio = ref<HTMLAudioElement>()
const progress = ref(0)
let raf = 0

function tick() {
  const a = audio.value
  if (a?.duration) progress.value = a.currentTime / a.duration
  raf = requestAnimationFrame(tick)
}

function stop() {
  audio.value?.pause()
  cancelAnimationFrame(raf)
  current.value = null
  progress.value = 0
}

async function toggle(track: PlaylistTrack) {
  if (current.value?.id === track.id) return stop()
  if (!track.preview) return window.open(track.url, '_blank', 'noopener')
  stop()
  audio.value ??= new Audio()
  audio.value.src = track.preview
  audio.value.volume = 0.6
  audio.value.onended = () => onEnded(track)
  current.value = track
  try {
    await audio.value.play()
    raf = requestAnimationFrame(tick)
  }
  catch { stop() }
}

function onEnded(track: PlaylistTrack) {
  // carry on to the next track that has a preview; stop at the end of the list
  const i = props.tracks.findIndex(t => t.id === track.id)
  const next = props.tracks.slice(i + 1).find(t => t.preview)
  if (!next) return stop()
  if (props.tracks.indexOf(next) >= props.initial) expanded.value = true
  toggle(next)
}

onBeforeUnmount(stop)

const time = (ms: number) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
</script>

<template>
  <div class="tracks">
    <!-- v-reveal lives on the list, not the rows: the rows bind :class, and
         Vue's class patch would wipe the is-revealed class the directive adds -->
    <ol v-reveal class="list">
      <li
        v-for="(t, i) in shown"
        :key="t.id"
        class="track"
        :class="{ playing: current?.id === t.id, extra: i >= initial }"
        :style="{ '--k': i - initial, ...(current?.id === t.id ? { '--p': progress } : {}) }"
      >
        <button
          type="button"
          class="hit"
          :aria-label="current?.id === t.id ? `Stop ${t.title}` : t.preview ? `Play a preview of ${t.title}` : `Open ${t.title} on Spotify`"
          @click="toggle(t)"
        />
        <span class="num" aria-hidden="true">
          <span class="n">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="glyph">
            <span v-if="current?.id === t.id" class="eq"><i /><i /><i /></span>
            <svg v-else viewBox="0 0 10 10" width="9" height="9"><path d="M2 1.2v7.6L8.6 5z" fill="currentColor" /></svg>
          </span>
        </span>
        <span class="cover">
          <img v-if="t.cover" :src="t.cover" alt="" width="36" height="36" loading="lazy">
        </span>
        <span class="text">
          <span class="title">{{ t.title }}</span>
          <span class="artist">{{ t.artist }}</span>
        </span>
        <span class="dur">{{ time(t.duration) }}</span>
        <a :href="t.url" target="_blank" rel="noopener" class="out" :aria-label="`${t.title} on Spotify`">↗</a>
        <span class="bar" aria-hidden="true" />
      </li>
    </ol>
    <button v-if="tracks.length > initial" type="button" class="more" @click="expanded = !expanded">
      {{ expanded ? 'show less' : `show all ${tracks.length}` }}
    </button>
  </div>
</template>

<style scoped>
.tracks { display: flex; flex-direction: column; gap: 4px; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }

.track {
  position: relative;
  display: grid;
  grid-template-columns: 22px 36px 1fr auto 14px;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  isolation: isolate;
}
/* the whole row is the play button; the ↗ link sits above it */
.hit { position: absolute; inset: 0; z-index: 1; cursor: pointer; background: none; border: 0; padding: 0; }
.hit:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }
.track::before {
  content: '';
  position: absolute;
  inset: 0 -10px;
  border-radius: 8px;
  background: var(--surface);
  opacity: 0;
  transform: scaleX(0.97);
  transition: opacity 0.25s var(--ease-out), transform 0.35s var(--ease-out);
  z-index: -1;
}
/* rows revealed by "show all" cascade in */
.track.extra { animation: row-in 0.45s var(--ease-out) calc(var(--k) * 35ms) both; }
@keyframes row-in { from { opacity: 0; transform: translateY(6px); } }
.track:hover::before, .track.playing::before { opacity: 1; transform: none; }

.num { position: relative; display: grid; place-items: center; height: 100%; font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
.num > * { grid-area: 1 / 1; transition: opacity 0.2s, transform 0.3s var(--ease-out); }
.glyph { display: grid; place-items: center; color: var(--text); opacity: 0; transform: scale(0.6); }
.track:hover .n, .track.playing .n { opacity: 0; transform: scale(0.6); }
.track:hover .glyph, .track.playing .glyph { opacity: 1; transform: none; }

.cover {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--surface);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
}
.cover img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.6s var(--ease-out); }
.track:hover .cover img { transform: scale(1.06); }
.track.playing .cover { animation: spin-in 0.5s var(--ease-spring); }
@keyframes spin-in { from { transform: rotate(-8deg) scale(0.9); } }

.text { min-width: 0; display: flex; flex-direction: column; gap: 1px; line-height: 1.3; }
.title, .artist { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.title { font-size: 14px; font-weight: 500; color: var(--text); transition: transform 0.35s var(--ease-out); }
.artist { font-size: 13px; color: var(--muted); transition: transform 0.35s var(--ease-out) 0.03s; }
.track:hover .title, .track:hover .artist { transform: translateX(3px); }

.dur { font-family: var(--font-mono); font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }

.out {
  position: relative;
  z-index: 2;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
  opacity: 0;
  transform: translate(-3px, 3px);
  transition: opacity 0.2s, transform 0.3s var(--ease-out), color 0.2s;
}
.track:hover .out, .out:focus-visible { opacity: 1; transform: none; }
.out:hover { color: var(--text); }

/* preview progress: a hairline that fills along the bottom border */
.bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 1px;
  background: var(--text);
  transform-origin: left;
  transform: scaleX(var(--p, 0));
}

.eq { display: inline-flex; align-items: flex-end; gap: 2px; height: 10px; }
.eq i {
  width: 2px;
  height: 100%;
  background: var(--success);
  border-radius: 1px;
  transform-origin: bottom;
  animation: eq 0.8s var(--ease-in-out) infinite alternate;
}
.eq i:nth-child(2) { animation-delay: -0.35s; }
.eq i:nth-child(3) { animation-delay: -0.6s; }
@keyframes eq { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }

.more {
  align-self: flex-start;
  margin-top: 6px;
  padding: 0;
  background: none;
  border: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.2s;
}
.more:hover { color: var(--text); }

@media (hover: none) {
  .out { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .eq i { animation: none; }
}
</style>
