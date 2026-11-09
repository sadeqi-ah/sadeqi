<script setup lang="ts">
import { ArrowUpRight01Icon } from '@hugeicons/core-free-icons'
import type { PlaylistTrack } from '~~/server/api/playlist.get'

// The whole Spotify playlist linked in content/media.yml.
const { data: playlist } = await useFetch('/api/playlist')
const playing = ref<PlaylistTrack | null>(null)

useSeoMeta({ title: 'Favourite music — Amir Hossein Sadeghi', description: 'Songs on repeat.' })
</script>

<template>
  <main class="page">
    <PageHeader
      path="~/music"
      title="Favourite music"
      lede="Songs on repeat. Tap a row for a 30-second preview — the full songs are on Spotify."
    >
      <div v-if="playlist" class="actions">
        <UiButton :to="playlist.url" label="Open in Spotify" :icon="ArrowUpRight01Icon" variant="primary" />
      </div>
    </PageHeader>

    <section v-if="playlist?.tracks.length" class="section">
      <PlayingLabel
        :label="`${playlist.tracks.length} tracks`"
        :playing="playing"
        :action="`${playlist.name} ↗`"
        :to="playlist.url"
      />
      <TrackList v-model:current="playing" :tracks="playlist.tracks" :initial="playlist.tracks.length" />
    </section>
    <p v-else class="empty">The playlist couldn't be loaded — try it on Spotify.</p>

    <SiteFooter />
  </main>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 56px; margin-top: 88px; }
.actions { display: flex; gap: 8px; }
.section { display: flex; flex-direction: column; gap: 12px; }
.empty { font-size: 15px; color: var(--muted); }
@media (max-width: 520px) { .page { margin-top: 56px; } }
</style>
