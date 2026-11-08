<script setup lang="ts">
defineProps<{
  title: string
  year: string
  description: string
  stack: string[]
  links: { label: string, href?: string }[]
  thumbnail?: string
}>()
</script>

<template>
  <article class="card">
    <div class="thumb">
      <img v-if="thumbnail" :src="thumbnail" :alt="`${title} screenshot`" class="shot" loading="lazy">
      <div v-else class="topology" aria-hidden="true">
        <img src="/svg/topology.svg" alt="" width="300" height="160">
        <!-- A packet hopping across the topology on hover -->
        <span class="packet" />
        <span class="packet late" />
      </div>
    </div>
    <div class="head">
      <h2 class="title">{{ title }}</h2>
      <span class="year">{{ year }}</span>
    </div>
    <p class="desc">{{ description }}</p>
    <div class="foot">
      <span class="stack">{{ stack.join(' · ') }}</span>
      <span class="links">
        <a v-for="link in links" :key="link.label" :href="link.href" class="link" :target="isExternal(link.href) ? '_blank' : undefined" rel="noopener">{{ link.label }}</a>
      </span>
    </div>
  </article>
</template>

<style scoped>
.card { display: flex; flex-direction: column; gap: 10px; }
.thumb {
  position: relative;
  height: 300px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  overflow: hidden;
  display: grid;
  place-items: center;
  transition: box-shadow 0.5s var(--ease-out), border-color 0.3s;
}
.card:hover .thumb { box-shadow: 0 18px 40px -20px rgba(0, 0, 0, 0.18); border-color: #dcd9d6; }
.shot { width: 100%; height: 100%; object-fit: cover; transition: transform 0.9s var(--ease-out); }
.card:hover .shot { transform: scale(1.03); }
.topology {
  position: relative;
  width: 300px;
  height: 160px;
  transition: transform 0.9s var(--ease-out);
}
.card:hover .topology { transform: scale(1.04); }
.packet {
  position: absolute;
  top: 0;
  left: 0;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
  offset-path: path('M40 80 L120 80 L190 30 L260 80 L190 130 L120 80 L40 80');
  offset-rotate: 0deg;
  offset-anchor: center;
  opacity: 0;
  transition: opacity 0.3s;
  animation: hop 3.2s var(--ease-in-out) infinite;
  animation-play-state: paused;
}
.packet.late { animation-delay: -1.6s; }
.card:hover .packet { opacity: 1; animation-play-state: running; }
@keyframes hop {
  from { offset-distance: 0%; }
  to { offset-distance: 100%; }
}
.head { display: flex; align-items: center; justify-content: space-between; padding-top: 6px; line-height: normal; }
.title { font-size: 15px; font-weight: 500; }
.year { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
.desc { font-size: 15px; line-height: 1.6; color: var(--muted); }
.foot {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: normal;
}
.stack { color: var(--muted); }
.links { display: flex; gap: 14px; }
.link { position: relative; color: var(--text); }
.link::after {
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
.link:hover::after { transform: scaleX(1); transform-origin: left; }

@media (max-width: 520px) {
  .thumb { height: 220px; }
  .topology { transform: scale(0.85); }
}
</style>
