<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'

interface Item { label: string, hint: string, to: string, group: string, run?: () => void }

const open = usePalette()
const { theme, toggle: toggleTheme } = useTheme()
const router = useRouter()
const query = ref('')
const active = ref(0)
const input = ref<HTMLInputElement>()
const listEl = ref<HTMLElement>()

const pages: Item[] = [
  { label: 'Home', hint: '~', to: '/', group: 'pages' },
  { label: 'Projects', hint: '~/projects', to: '/projects', group: 'pages' },
  { label: 'Research', hint: '~/research', to: '/research', group: 'pages' },
  { label: 'Writing', hint: '~/writing', to: '/writing', group: 'pages' },
  { label: 'Resume', hint: '~/resume', to: '/resume', group: 'pages' },
  { label: 'Favourite music', hint: '~/music', to: '/music', group: 'pages' },
  { label: 'Films & series', hint: '~/films', to: '/films', group: 'pages' },
  { label: 'RSS feed', hint: '/rss.xml', to: '/rss.xml', group: 'pages' },
]

// Lazily load posts the first time the palette opens.
const { data: posts, execute } = useAsyncData(
  'palette-posts',
  () => queryCollection('posts').where('draft', '=', false).order('date', 'DESC').select('title', 'path', 'date').all(),
  { immediate: false },
)

const items = computed<Item[]>(() => {
  const all: Item[] = [
    ...pages,
    {
      label: theme.value === 'dark' ? 'Light theme' : 'Dark theme',
      hint: 'theme',
      to: '#theme',
      group: 'actions',
      // reveal from the top-right corner, where the nav toggle lives
      run: () => toggleTheme({ x: innerWidth, y: 0 }),
    },
    ...(posts.value ?? []).map(p => ({ label: p.title, hint: formatMonthYear(p.date), to: p.path, group: 'writing' })),
  ]
  const q = query.value.trim().toLowerCase()
  if (!q) return all
  return all.filter(i => `${i.label} ${i.hint}`.toLowerCase().includes(q))
})

watch(items, () => { active.value = 0 })

watch(open, async (v) => {
  if (!v) return
  query.value = ''
  if (!posts.value) execute()
  await nextTick()
  input.value?.focus()
})

onKeyStroke('k', (e) => {
  if (!(e.metaKey || e.ctrlKey)) return
  e.preventDefault()
  open.value = !open.value
})
onKeyStroke('Escape', () => { open.value = false })

function go(item?: Item) {
  if (!item) return
  open.value = false
  if (item.run) return item.run()
  if (item.to.endsWith('.xml')) window.location.href = item.to
  else router.push(item.to)
}

function onKey(e: KeyboardEvent) {
  const n = items.value.length
  if (!n) return
  if (e.key === 'ArrowDown') { e.preventDefault(); active.value = (active.value + 1) % n }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active.value = (active.value - 1 + n) % n }
  else if (e.key === 'Enter') { e.preventDefault(); go(items.value[active.value]) }
  else return
  nextTick(() => listEl.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }))
}
</script>

<template>
  <Teleport to="body">
    <Transition name="palette">
      <div v-if="open" class="overlay" @mousedown.self="open = false">
        <div class="panel" role="dialog" aria-modal="true" aria-label="Command menu">
          <div class="search">
            <img src="/svg/search.svg" alt="" width="16" height="16">
            <input
              ref="input"
              v-model="query"
              type="text"
              placeholder="Jump to…"
              aria-label="Search pages and posts"
              @keydown="onKey"
            >
            <UiChip label="esc" />
          </div>
          <ul ref="listEl" class="list" role="listbox">
            <li
              v-for="(item, i) in items"
              :key="item.to"
              role="option"
              :aria-selected="i === active"
              class="item"
              :class="{ active: i === active }"
              :style="{ '--i': i }"
              @mousemove="active = i"
              @click="go(item)"
            >
              <span class="arrow">→</span>
              <span class="label">{{ item.label }}</span>
              <span class="hint">{{ item.hint }}</span>
            </li>
            <li v-if="!items.length" class="empty">No matches for “{{ query }}”</li>
          </ul>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 14vh 20px 20px;
  background: var(--scrim);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.panel {
  width: min(520px, 100%);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 24px 60px -12px var(--shadow-soft), 0 2px 6px var(--shadow-soft);
  overflow: hidden;
}
.search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}
.search input {
  flex: 1;
  border: 0;
  outline: 0;
  background: none;
  font: inherit;
  font-size: 14px;
  color: var(--text);
}
.search input::placeholder { color: var(--muted); }
.list {
  list-style: none;
  margin: 0;
  padding: 6px;
  max-height: 340px;
  overflow-y: auto;
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  animation: item-in 0.35s var(--ease-out) both;
  animation-delay: calc(min(var(--i), 10) * 18ms);
}
@keyframes item-in { from { opacity: 0; transform: translateY(4px); } }
.item.active { background: var(--surface); }
.arrow {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--accent);
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 0.2s, transform 0.25s var(--ease-out);
}
.item.active .arrow { opacity: 1; transform: none; }
.label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hint { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
.empty { padding: 18px 10px; font-size: 14px; color: var(--muted); text-align: center; }

.palette-enter-active, .palette-leave-active { transition: opacity 0.25s var(--ease-out); }
.palette-enter-active .panel, .palette-leave-active .panel { transition: transform 0.35s var(--ease-spring), opacity 0.25s var(--ease-out); }
.palette-enter-from, .palette-leave-to { opacity: 0; }
.palette-enter-from .panel { transform: translateY(-8px) scale(0.97); opacity: 0; }
.palette-leave-to .panel { transform: scale(0.98); opacity: 0; }
</style>
