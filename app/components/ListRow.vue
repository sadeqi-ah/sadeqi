<script setup lang="ts">
import { NuxtLink } from '#components'
const props = defineProps<{
  title: string
  description?: string
  meta?: string
  to?: string
  /** leading icon: an image URL, or `true` for a monogram tile from the title */
  icon?: string | boolean
}>()

const monogram = computed(() => props.title.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase())
</script>

<template>
  <component
    :is="to ? NuxtLink : 'div'"
    :to="to"
    :target="to && isExternal(to) ? '_blank' : undefined"
    class="row"
    :class="{ link: !!to }"
  >
    <span v-if="icon" class="icon" aria-hidden="true">
      <img v-if="typeof icon === 'string'" :src="icon" alt="" width="28" height="28" loading="lazy">
      <span v-else class="mono">{{ monogram }}</span>
    </span>
    <span class="left">
      <span class="title">{{ title }}</span>
      <span v-if="description" class="desc">{{ description }}</span>
    </span>
    <span class="meta">{{ meta }}</span>
  </component>
</template>

<style scoped>
.row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 40px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  line-height: normal;
}
.icon {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  margin: -4px -4px -4px 0; /* sits 12px from the title, not the row's 16px */
  border-radius: 7px;
  overflow: hidden;
  background: var(--surface);
  box-shadow: inset 0 0 0 1px var(--hairline);
  transition: transform 0.45s var(--ease-spring);
}
.icon img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mono {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: -0.3px;
  color: var(--muted);
}
.row.link:hover .icon { transform: rotate(-6deg) scale(1.06); }
.left {
  flex: 1 0 0;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 15px;
  overflow: hidden;
}
.title {
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  transition: transform 0.35s var(--ease-out);
}
.desc {
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.25s, transform 0.35s var(--ease-out);
}
.meta {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--muted);
  transition: color 0.25s;
}
/* Hover: a soft wash slides in behind the row; title nudges right. */
.row.link::before {
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
.row.link:hover::before { opacity: 1; transform: none; }
.row.link:hover .title,
.row.link:hover .desc { transform: translateX(4px); }
.row.link:hover .meta { color: var(--text); }

@media (max-width: 520px) {
  .left { flex-direction: column; gap: 2px; }
  .desc { font-size: 14px; }
  .title { white-space: normal; }
}
</style>
