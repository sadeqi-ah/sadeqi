<script setup lang="ts">
type Track = 'network' | 'fullstack'

const { data: resume } = await useAsyncData('resume', () => queryCollection('resume').first())
const { data: site } = await useSite()

const track = ref<Track>('network')
const tracks: { id: Track, label: string }[] = [
  { id: 'network', label: 'network' },
  { id: 'fullstack', label: 'full-stack' },
]

// Primary track first: an item's first listed track decides its priority.
const byTrack = <T extends { tracks: Track[] }>(items: T[]) =>
  items
    .filter(i => i.tracks.includes(track.value))
    .sort((a, b) => Number(b.tracks[0] === track.value) - Number(a.tracks[0] === track.value))

const experience = computed(() => byTrack(resume.value?.experience ?? []))
const skills = computed(() => byTrack(resume.value?.skills ?? []))

// Measure the active tab so the sliding thumb fits any font/label.
const toggleEl = ref<HTMLElement>()
const thumb = ref({ x: 0, w: 0 })
function measureThumb() {
  const btn = toggleEl.value?.querySelector<HTMLElement>('button.on')
  if (btn) thumb.value = { x: btn.offsetLeft - 3, w: btn.offsetWidth }
}
watch(track, () => nextTick(measureThumb))
onMounted(() => document.fonts?.ready.then(measureThumb) ?? measureThumb())

function print() {
  window.print()
}

useSeoMeta({ title: 'Resume — Amir Hossein Sadeghi', description: 'Network & Software Engineer · France' })
</script>

<template>
  <main v-if="resume" class="page">
    <header class="header stagger">
      <p class="path no-print" style="--i: 0">~/resume</p>

      <div class="identity" style="--i: 1">
        <div class="avatar">
          <img v-if="resume.avatar" :src="resume.avatar" alt="" class="photo">
          <template v-else>
            <img src="/svg/avatar.svg" alt="" width="72" height="72">
            <span class="photo-label">photo</span>
          </template>
        </div>
        <div>
          <h1 class="name">{{ resume.name }}</h1>
          <p class="role">{{ resume.role }}</p>
        </div>
      </div>

      <div class="actions no-print" style="--i: 2">
        <div ref="toggleEl" class="toggle" role="tablist" aria-label="Resume version">
          <span
            class="thumb"
            aria-hidden="true"
            :style="thumb.w ? { transform: `translateX(${thumb.x}px)`, width: `${thumb.w}px` } : undefined"
          />
          <button
            v-for="t in tracks"
            :key="t.id"
            type="button"
            role="tab"
            :aria-selected="track === t.id"
            :class="{ on: track === t.id }"
            @click="track = t.id"
          >
            {{ t.label }}
          </button>
        </div>
        <span class="spacer" />
        <UiButton label="Print" icon="⎙" @click="print" />
        <UiButton
          v-if="site?.resumePdf"
          label="Download PDF"
          icon="↓"
          variant="primary"
          :to="site.resumePdf"
        />
        <UiButton v-else label="Download PDF" icon="↓" variant="primary" @click="print" />
      </div>

      <p class="contact" style="--i: 3">
        <a v-for="c in resume.contact" :key="c.label" :href="c.href">{{ c.label }}</a>
      </p>
    </header>

    <section class="section">
      <SectionLabel label="Summary" />
      <Transition name="swap" mode="out-in">
        <p :key="track" class="summary">{{ resume.summary[track] }}</p>
      </Transition>
    </section>

    <section class="section">
      <SectionLabel label="Experience" />
      <TransitionGroup tag="div" name="list" class="stack">
        <article v-for="job in experience" :key="job.role" v-reveal class="job">
          <div class="job-head">
            <p><span class="strong">{{ job.role }}</span> <span class="muted">· {{ job.org }}</span></p>
            <span class="period">{{ job.period }}</span>
          </div>
          <ul class="bullets">
            <li v-for="b in job.bullets" :key="b">{{ b }}</li>
          </ul>
        </article>
      </TransitionGroup>
    </section>

    <section class="section">
      <SectionLabel label="Education" />
      <div v-for="ed in resume.education" :key="ed.degree" v-reveal class="edu">
        <div>
          <p class="strong">{{ ed.degree }}</p>
          <p class="school">{{ ed.school }}</p>
        </div>
        <span class="period">{{ ed.period }}</span>
      </div>
    </section>

    <section class="section">
      <SectionLabel label="Skills" />
      <TransitionGroup tag="div" name="list" class="skills">
        <div v-for="group in skills" :key="group.group" v-reveal class="skill-row">
          <p class="group">{{ group.group }}</p>
          <div class="chips">
            <UiChip v-for="s in group.items" :key="s" :label="s" />
          </div>
        </div>
      </TransitionGroup>
    </section>

    <section class="section">
      <SectionLabel label="Languages" />
      <div v-reveal class="langs">
        <div v-for="l in resume.languages" :key="l.name">
          <p class="strong">{{ l.name }}</p>
          <p class="level">{{ l.level }}</p>
        </div>
      </div>
    </section>

    <SiteFooter />
  </main>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 56px; margin-top: 88px; }
.header { display: flex; flex-direction: column; gap: 20px; }
.path { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }

.identity { display: flex; align-items: center; gap: 16px; }
.avatar { position: relative; width: 72px; height: 72px; flex-shrink: 0; }
.photo { width: 72px; height: 72px; border-radius: 999px; object-fit: cover; object-position: 50% 30%; border: 1px solid var(--border); }
.photo-label {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
}
.name { font-family: var(--font-serif); font-style: italic; font-weight: 400; font-size: 44px; line-height: 1; }
.role { font-size: 15px; color: var(--muted); margin-top: 2px; }

.actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.spacer { flex: 1 0 0; }
.toggle {
  position: relative;
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  background: var(--surface);
}
.toggle button {
  position: relative;
  z-index: 1;
  padding: 6px 12px;
  border-radius: 8px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
  transition: color 0.25s;
}
.toggle button.on { color: var(--text); }
.thumb {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: 75px;
  border-radius: 8px;
  background: var(--bg);
  box-shadow: 0 1px 2px var(--shadow-soft);
  transition: transform 0.5s var(--ease-spring), width 0.5s var(--ease-spring);
}

.contact { display: flex; gap: 16px; flex-wrap: wrap; font-family: var(--font-mono); font-size: 12px; }
.contact a { position: relative; }
.contact a::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
  height: 1px;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: right;
  transition: transform 0.35s var(--ease-out);
}
.contact a:hover::after { transform: scaleX(1); transform-origin: left; }

.section { display: flex; flex-direction: column; gap: 16px; }
.summary { font-size: 15px; line-height: 1.65; }
.stack { position: relative; display: flex; flex-direction: column; gap: 16px; }
.job { display: flex; flex-direction: column; gap: 8px; }
.job-head,
.edu { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; font-size: 15px; line-height: normal; }
.strong { font-weight: 500; font-size: 15px; }
.muted { color: var(--muted); }
.period { font-family: var(--font-mono); font-size: 12px; color: var(--muted); white-space: nowrap; padding-top: 2px; }
.bullets { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.bullets li {
  position: relative;
  padding-left: 19px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--muted);
}
.bullets li::before { content: '–'; position: absolute; left: 0; }
.school { font-size: 14px; color: var(--muted); margin-top: 4px; }

.skills { position: relative; display: flex; flex-direction: column; gap: 16px; }
.skill-row { display: flex; gap: 16px; align-items: flex-start; }
.group { width: 110px; flex-shrink: 0; font-family: var(--font-mono); font-size: 12px; color: var(--muted); padding-top: 3px; }
.chips { flex: 1 0 0; min-width: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.langs { display: flex; gap: 32px; }
.level { font-family: var(--font-mono); font-size: 12px; color: var(--muted); margin-top: 2px; }

.swap-enter-active, .swap-leave-active { transition: opacity 0.25s var(--ease-out), filter 0.25s, transform 0.3s var(--ease-out); }
.swap-enter-from { opacity: 0; filter: blur(3px); transform: translateY(4px); }
.swap-leave-to { opacity: 0; filter: blur(3px); transform: translateY(-4px); }
.list-move { transition: transform 0.55s var(--ease-out); }

@media (max-width: 520px) {
  .page { margin-top: 56px; }
  .skill-row { flex-direction: column; gap: 8px; }
}
@media print {
  .page { margin-top: 0; gap: 28px; }
}
</style>
