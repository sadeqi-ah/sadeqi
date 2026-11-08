<script setup lang="ts">
defineProps<{
  status: string
  venue: string
  title: string
  authors: string
  links: { label: string, href?: string }[]
}>()
</script>

<template>
  <article class="item">
    <div class="top">
      <span class="status">{{ status }}</span>
      <span class="venue">{{ venue }}</span>
    </div>
    <h3 class="title">{{ title }}</h3>
    <p class="authors">{{ authors }}</p>
    <div v-if="links.length" class="links">
      <template v-for="link in links" :key="link.label">
        <a v-if="link.href" :href="link.href" class="link" target="_blank" rel="noopener">
          {{ link.label }}
        </a>
        <span v-else class="link static">{{ link.label }}</span>
      </template>
    </div>
  </article>
</template>

<style scoped>
.item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px 0;
  border-bottom: 1px solid var(--border);
}
.top { display: flex; align-items: center; gap: 10px; }
.status {
  padding: 2px 7px;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: normal;
}
.venue { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
.title { font-size: 15px; font-weight: 500; line-height: 1.5; }
.authors { font-size: 14px; line-height: 1.5; color: var(--muted); }
.links { display: flex; gap: 20px; font-family: var(--font-mono); font-size: 12px; }
.link { position: relative; color: var(--text); }
a.link::after {
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
a.link:hover::after { transform: scaleX(1); transform-origin: left; }
</style>
