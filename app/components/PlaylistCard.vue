<script setup lang="ts">
defineProps<{ name: string, tracks: number, cover?: string, href?: string }>()
</script>

<template>
  <component :is="href ? 'a' : 'div'" :href="href" :target="href ? '_blank' : undefined" rel="noopener" class="card">
    <div class="cover">
      <img v-if="cover" :src="cover" alt="" loading="lazy">
      <span class="eq" aria-hidden="true"><i /><i /><i /><i /></span>
    </div>
    <p class="name">{{ name }}</p>
    <p class="meta">{{ tracks }} tracks</p>
  </component>
</template>

<style scoped>
.card { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.cover {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  overflow: hidden;
  transition: transform 0.5s var(--ease-spring), box-shadow 0.4s var(--ease-out);
}
.cover img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.8s var(--ease-out); }
.card:hover .cover { transform: translateY(-4px) rotate(-1.2deg); box-shadow: 0 14px 30px -12px rgba(0, 0, 0, 0.22); }
.card:hover .cover img { transform: scale(1.05); }
.eq {
  position: absolute;
  left: 12px;
  bottom: 12px;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 16px;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.3s, transform 0.4s var(--ease-out);
}
.eq i {
  width: 3px;
  height: 100%;
  border-radius: 2px;
  background: var(--text);
  transform-origin: bottom;
  animation: eq 0.9s var(--ease-in-out) infinite alternate;
  animation-play-state: paused;
}
.eq i:nth-child(2) { animation-delay: -0.3s; }
.eq i:nth-child(3) { animation-delay: -0.6s; }
.eq i:nth-child(4) { animation-delay: -0.15s; }
.card:hover .eq { opacity: 1; transform: none; }
.card:hover .eq i { animation-play-state: running; }
@keyframes eq { 0% { transform: scaleY(0.25); } 100% { transform: scaleY(1); } }
.name { font-size: 14px; font-weight: 500; line-height: normal; }
.meta { font-family: var(--font-mono); font-size: 12px; color: var(--muted); line-height: normal; }
</style>
