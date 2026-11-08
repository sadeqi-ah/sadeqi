<script setup lang="ts">
import type { Favourite } from '~~/server/api/favourites.get'

defineProps<{ items: Favourite[] }>()

const initials = (t: string) => t.split(/\s+/).filter(w => /\w/.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase()
</script>

<template>
  <ul v-reveal class="grid">
    <li v-for="f in items" :key="f.title" class="item">
      <component :is="f.url ? 'a' : 'div'" :href="f.url" :target="f.url ? '_blank' : undefined" :rel="f.url ? 'noopener' : undefined" class="card">
        <span class="poster">
          <img v-if="f.cover" :src="f.cover" :alt="`${f.title} poster`" width="400" height="600" loading="lazy">
          <!-- no poster found: a typographic card instead -->
          <span v-else class="fallback" aria-hidden="true">{{ initials(f.title) }}</span>
          <span v-if="f.rating" class="rating">{{ f.rating }}</span>
        </span>
        <span class="caption">
          <span class="title">{{ f.title }}</span>
          <span class="meta">{{ f.kind === 'film' ? 'Film' : 'Series' }}<template v-if="f.note"> · {{ f.note }}</template></span>
        </span>
      </component>
    </li>
  </ul>
</template>

<style scoped>
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px 14px;
}
.card { display: flex; flex-direction: column; gap: 8px; color: inherit; }
.poster {
  position: relative;
  display: block;
  aspect-ratio: 2 / 3;
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.06),
    0 8px 20px -12px rgba(40, 30, 10, 0.35);
  transition: transform 0.45s var(--ease-spring), box-shadow 0.35s var(--ease-out);
}
.poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
.fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 30px;
  color: var(--muted);
  background: linear-gradient(160deg, var(--surface), var(--border));
}
.rating {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.72);
  backdrop-filter: blur(6px);
  font-family: var(--font-mono);
  font-size: 11px;
  color: #fff;
}
.card:hover .poster {
  transform: translateY(-3px) rotate(-1deg);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.06),
    0 16px 28px -14px rgba(40, 30, 10, 0.45);
}
.caption { display: flex; flex-direction: column; gap: 1px; min-width: 0; line-height: 1.3; }
.title { font-size: 14px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta { font-size: 12px; color: var(--muted); }

@media (max-width: 520px) {
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
