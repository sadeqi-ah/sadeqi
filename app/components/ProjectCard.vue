<script setup lang="ts">
const props = defineProps<{
  title: string
  year: string
  description: string
  stack: string[]
  links: { label: string, href?: string }[]
  thumbnail?: string
  logo?: string
}>()

const monogram = computed(() => props.title.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase())
</script>

<template>
  <article class="card">
    <div class="thumb">
      <img v-if="thumbnail" :src="thumbnail" :alt="`${title} screenshot`" class="shot" loading="lazy">
      <img v-else-if="logo" :src="logo" alt="" class="mark" width="112" height="112">
      <span v-else class="mark mono" aria-hidden="true">{{ monogram }}</span>
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
.card:hover .thumb { box-shadow: 0 18px 40px -20px var(--shadow); border-color: var(--border-strong); }
.shot { width: 100%; height: 100%; object-fit: cover; transition: transform 0.9s var(--ease-out); }
.card:hover .shot { transform: scale(1.03); }
.mark {
  width: 112px;
  height: 112px;
  border-radius: 26px;
  box-shadow: 0 14px 30px -14px var(--shadow), 0 0 0 1px var(--hairline);
  transition: transform 0.9s var(--ease-out);
}
.mono {
  display: grid;
  place-items: center;
  background: var(--bg);
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 44px;
  color: var(--muted);
}
.card:hover .mark { transform: scale(1.06) rotate(-2deg); }
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
  .mark { width: 88px; height: 88px; border-radius: 20px; }
}
</style>
