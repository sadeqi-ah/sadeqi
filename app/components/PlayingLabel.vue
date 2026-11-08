<script setup lang="ts">
import type { PlaylistTrack } from '~~/server/api/playlist.get'

/**
 * A SectionLabel for a track list: shows the track whose preview is playing
 * (with a little equaliser), otherwise a normal link action.
 */
defineProps<{ label: string, playing: PlaylistTrack | null, action?: string, to?: string }>()
</script>

<template>
  <SectionLabel v-if="playing" :label="label" :action="playing.title">
    <template #action>
      <span class="eq" aria-hidden="true"><i /><i /><i /></span>
      <span class="playing">{{ playing.title }} · {{ playing.artist }}</span>
    </template>
  </SectionLabel>
  <SectionLabel v-else :label="label" :action="action" :to="to" />
</template>

<style scoped>
.playing { max-width: 260px; overflow: hidden; text-overflow: ellipsis; }

.eq { display: inline-flex; align-items: flex-end; gap: 2px; height: 9px; }
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

@media (max-width: 520px) {
  .playing { max-width: 160px; }
}
@media (prefers-reduced-motion: reduce) {
  .eq i { animation: none; }
}
</style>
