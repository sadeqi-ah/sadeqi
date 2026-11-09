<script setup lang="ts">
// Favourite films & series from content/media.yml, posters looked up server-side.
const { data: favourites } = await useFetch('/api/favourites')

const filters = ['all', 'film', 'series'] as const
const active = ref<(typeof filters)[number]>('all')
const visible = computed(() =>
  (favourites.value ?? []).filter(f => active.value === 'all' || f.kind === active.value),
)
const count = (k: (typeof filters)[number]) =>
  (favourites.value ?? []).filter(f => k === 'all' || f.kind === k).length
const chipLabel = (k: (typeof filters)[number]) =>
  `${k === 'all' ? 'all' : k === 'film' ? 'films' : 'series'} · ${count(k)}`

useSeoMeta({ title: 'Favourite films & series — AmirHossein Sadeghi', description: 'Films and series I keep coming back to.' })
</script>

<template>
  <main class="page">
    <PageHeader
      path="~/films"
      title="Films & series"
      lede="The ones I keep coming back to, and recommend whenever someone asks."
    >
      <div class="filters" role="toolbar" aria-label="Filter films and series">
        <UiChip
          v-for="f in filters"
          :key="f"
          as="button"
          :label="chipLabel(f)"
          :active="active === f"
          :aria-pressed="active === f"
          @click="active = f"
        />
      </div>
    </PageHeader>

    <!-- keyed on the filter so the grid reveals again when it changes -->
    <FavouriteGrid v-if="visible.length" :key="active" :items="visible" />
    <p v-else class="empty">Nothing here yet — check back soon.</p>

    <SiteFooter />
  </main>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 56px; margin-top: 88px; }
.filters { display: flex; gap: 6px; flex-wrap: wrap; }
.empty { font-size: 15px; color: var(--muted); }
@media (max-width: 520px) { .page { margin-top: 56px; } }
</style>
