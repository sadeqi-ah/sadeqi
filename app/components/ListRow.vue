<script setup lang="ts">
import { NuxtLink } from '#components'
defineProps<{
  title: string
  description?: string
  meta?: string
  to?: string
}>()
</script>

<template>
  <component
    :is="to ? NuxtLink : 'div'"
    :to="to"
    :target="to && isExternal(to) ? '_blank' : undefined"
    class="row"
    :class="{ link: !!to }"
  >
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
