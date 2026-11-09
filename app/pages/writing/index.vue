<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'
import { Search01Icon } from '@hugeicons/core-free-icons'
import { onKeyStroke } from '@vueuse/core'

const { data: posts } = await useAsyncData('posts', () =>
  queryCollection('posts')
    .where('draft', '=', false)
    .order('date', 'DESC')
    .select('title', 'description', 'path', 'date', 'tags', 'pinned', 'readingTime')
    .all(),
)

const query = ref('')
const tag = ref('all')
const search = ref<HTMLInputElement>()

const tags = computed(() => {
  const set = new Set<string>()
  posts.value?.forEach(p => p.tags.forEach(t => set.add(t)))
  return ['all', ...[...set].sort()]
})

const pinned = computed(() => posts.value?.find(p => p.pinned))
const isFiltering = computed(() => !!query.value.trim() || tag.value !== 'all')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return (posts.value ?? []).filter((p) => {
    if (!isFiltering.value && p.pinned) return false // shown as the featured card
    if (tag.value !== 'all' && !p.tags.includes(tag.value)) return false
    if (!q) return true
    return `${p.title} ${p.description} ${p.tags.join(' ')}`.toLowerCase().includes(q)
  })
})

const years = computed(() => groupByYear(filtered.value, p => yearOf(p.date)))

// "/" focuses search, like on most dev sites.
onKeyStroke('/', (e) => {
  const t = e.target as HTMLElement
  if (t.closest('input, textarea, [contenteditable]')) return
  e.preventDefault()
  search.value?.focus()
})

useSeoMeta({ title: 'Writing — AmirHossein Sadeghi', description: 'Notes from learning networking, building tools, and doing research.' })
</script>

<template>
  <main class="page">
    <PageHeader
      path="~/writing"
      title="Writing"
      lede="Notes from learning networking, building tools, and doing research. Mostly technical, occasionally personal. RSS available."
    >
      <label v-if="posts?.length" class="search">
        <HugeiconsIcon :icon="Search01Icon" :size="16" class="search-icon" aria-hidden="true" />
        <input ref="search" v-model="query" type="search" placeholder="Search posts…" aria-label="Search posts">
        <UiChip label="/" />
      </label>
      <div v-if="posts?.length" class="tags" role="toolbar" aria-label="Filter by tag">
        <UiChip
          v-for="t in tags"
          :key="t"
          as="button"
          :label="t"
          :active="tag === t"
          :aria-pressed="tag === t"
          @click="tag = t"
        />
      </div>
    </PageHeader>

    <Transition name="featured">
      <NuxtLink v-if="pinned && !isFiltering" v-reveal="120" :to="pinned.path" class="featured">
        <UiChip label="pinned" dot />
        <h2 class="featured-title">{{ pinned.title }}</h2>
        <p class="featured-desc">{{ pinned.description }}</p>
        <p class="featured-meta">
          {{ formatMonthYear(pinned.date) }} · {{ pinned.readingTime }} min read <span class="go">→</span>
        </p>
      </NuxtLink>
    </Transition>

    <TransitionGroup tag="div" name="list" class="years">
      <YearGroup v-for="[year, items] in years" :key="year" :year="year">
        <TransitionGroup name="list">
          <ListRow
            v-for="post in items"
            :key="post.path"
            :title="post.title"
            :meta="formatMonthDay(post.date)"
            :to="post.path"
          />
        </TransitionGroup>
      </YearGroup>
    </TransitionGroup>
    <p v-if="!posts?.length" class="empty">Nothing published yet. Posts will appear here.</p>
    <p v-else-if="!filtered.length" class="empty">No posts match “{{ query || tag }}”.</p>

    <SiteFooter />
  </main>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 56px; margin-top: 88px; }
.search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: text;
  transition: border-color 0.2s, box-shadow 0.3s var(--ease-out);
}
.search:focus-within { border-color: var(--border-strong); box-shadow: 0 0 0 4px var(--surface); }
.search input {
  flex: 1 0 0;
  min-width: 0;
  border: 0;
  outline: 0;
  background: none;
  font: inherit;
  font-size: 14px;
  color: var(--text);
}
.search input::placeholder { color: var(--muted); }
.search input::-webkit-search-cancel-button { display: none; }
.tags { display: flex; gap: 6px; flex-wrap: wrap; }

.featured {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 22px;
  border-radius: 12px;
  background: var(--surface);
  transition: transform 0.5s var(--ease-out), box-shadow 0.5s var(--ease-out), opacity 0.4s;
}
.featured :deep(.chip) { background: var(--surface); padding-left: 0; }
.featured:hover { transform: translateY(-2px); box-shadow: 0 16px 36px -20px var(--shadow); }
.featured-title { font-family: var(--font-serif); font-weight: 400; font-size: 26px; line-height: 1.2; }
.featured-desc { font-size: 15px; line-height: 1.65; color: var(--muted); }
.featured-meta { font-family: var(--font-mono); font-size: 12px; white-space: pre; }
.go { display: inline-block; margin-left: 6px; transition: transform 0.35s var(--ease-spring); }
.featured:hover .go { transform: translateX(4px); }

.years { position: relative; display: flex; flex-direction: column; gap: 56px; }
.empty { font-size: 15px; color: var(--muted); }

.featured-enter-active, .featured-leave-active { transition: opacity 0.35s var(--ease-out), transform 0.4s var(--ease-out); }
.featured-enter-from, .featured-leave-to { opacity: 0; transform: translateY(-6px); }

.list-move { transition: transform 0.5s var(--ease-out); }
.list-enter-active { transition: opacity 0.4s var(--ease-out), transform 0.5s var(--ease-out); }
.list-leave-active { transition: opacity 0.2s var(--ease-out); position: absolute; width: 100%; }
.list-enter-from { opacity: 0; transform: translateY(8px); }
.list-leave-to { opacity: 0; }

@media (max-width: 520px) { .page { margin-top: 56px; } }
.search-icon { flex-shrink: 0; color: var(--muted); }
</style>
