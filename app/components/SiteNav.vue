<script setup lang="ts">
const route = useRoute()
const palette = usePalette()
const { theme, toggle: toggleTheme } = useTheme()

function onTheme(e: MouseEvent) {
  // grow the reveal from the button's centre (also right for keyboard clicks)
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  toggleTheme({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
}

const links = [
  { to: '/', label: 'home' },
  { to: '/projects', label: 'projects' },
  { to: '/research', label: 'research' },
  { to: '/writing', label: 'writing' },
  { to: '/resume', label: 'resume' },
]

const nav = ref<HTMLElement>()

const activeTo = computed(() => links.find(l => l.to === '/' ? route.path === '/' : route.path.startsWith(l.to))?.to ?? null)
const hovered = ref<string | null>(null)
const target = computed(() => hovered.value ?? activeTo.value)

const left = useSpring(0)
const right = useSpring(0)
const visible = ref(false)
let mounted = false

function measure(to: string) {
  const el = nav.value?.querySelector<HTMLElement>(`[data-to="${to}"]`)
  return el ? { l: el.offsetLeft, r: el.offsetLeft + el.offsetWidth } : null
}

function moveBlob() {
  const to = target.value
  const rect = to ? measure(to) : null
  if (!rect) {
    visible.value = false
    return
  }
  const appearing = !visible.value || !mounted
  visible.value = true
  if (appearing) {
    left.set(rect.l, { immediate: true })
    right.set(rect.r, { immediate: true })
    return
  }
  // The edge travelling in the direction of motion leads (stiffer), the
  // other one trails — the blob stretches mid-flight and settles back.
  const goingRight = rect.l > left.value.value
  const lead = { stiffness: 420, damping: 30 }
  const trail = { stiffness: 190, damping: 22 }
  left.set(rect.l, goingRight ? trail : lead)
  right.set(rect.r, goingRight ? lead : trail)
}

watch(target, () => nextTick(moveBlob))

onMounted(async () => {
  await nextTick()
  moveBlob()
  mounted = true
})

const blobStyle = computed(() => ({
  transform: `translateX(${left.value.value}px)`,
  width: `${Math.max(0, right.value.value - left.value.value)}px`,
  opacity: visible.value ? 1 : 0,
}))
</script>

<template>
  <div class="nav-wrap no-print">
    <nav
      ref="nav"
      class="nav"
      aria-label="Main"
      @mouseleave="hovered = null"
    >
      <span class="blob" :style="blobStyle" aria-hidden="true" />
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        :data-to="link.to"
        class="link"
        :class="{ active: target === link.to }"
        @mouseenter="hovered = link.to"
        @focus="hovered = link.to"
        @blur="hovered = null"
      >
        {{ link.label }}
      </NuxtLink>
      <button class="kbd" type="button" aria-label="Open command menu" @click="palette = true">
        ctrl k
      </button>
      <button
        class="theme"
        :class="{ dark: theme === 'dark' }"
        type="button"
        :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
        @click="onTheme"
      >
        <!-- sun ⇄ moon: the disc grows and a second disc slides in to bite it,
             while the rays draw back in -->
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <mask id="moon-bite">
            <rect width="24" height="24" fill="#fff" />
            <circle class="bite" cx="24" cy="2" r="8" fill="#000" />
          </mask>
          <circle class="disc" cx="12" cy="12" r="5" mask="url(#moon-bite)" />
          <g class="rays">
            <path d="M12 1.5v2M12 20.5v2M22.5 12h-2M3.5 12h-2M19.4 4.6l-1.4 1.4M6 18l-1.4 1.4M19.4 19.4L18 18M6 6L4.6 4.6" />
          </g>
        </svg>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.nav-wrap {
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 999px;
  will-change: transform;
  animation: nav-in 0.7s var(--ease-out) both;
}
@keyframes nav-in {
  from { opacity: 0; transform: translateY(-8px); }
}
.blob {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 0;
  border-radius: 999px;
  background: var(--surface);
  transition: opacity 0.25s var(--ease-out);
  will-change: transform, width;
}
.link {
  position: relative;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 14px;
  line-height: normal;
  color: var(--muted);
  transition: color 0.2s var(--ease-out);
}
.link.active,
.link.router-link-active:not([data-to="/"]) { color: var(--text); }
.kbd {
  position: relative;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--surface);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
  transition: color 0.2s, background 0.2s;
}
.kbd:hover { color: var(--text); background: var(--border); }
/* breathing room between the links and the tools */
.kbd { margin-left: 14px; }

.theme {
  position: relative;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-left: 4px;
  border-radius: 999px;
  color: var(--muted);
  transition: color 0.2s, background 0.2s, transform 0.3s var(--ease-spring);
}
.theme:hover { color: var(--text); background: var(--surface); }
.theme:active { transform: scale(0.9); }
.theme svg { overflow: visible; }
.disc { fill: currentColor; transition: r 0.5s var(--ease-spring); }
.bite { transition: cx 0.5s var(--ease-out), cy 0.5s var(--ease-out); }
.rays {
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  transform-origin: 12px 12px;
  transition: transform 0.5s var(--ease-spring), opacity 0.3s var(--ease-out);
}
.theme.dark .disc { r: 8px; }
.theme.dark .bite { cx: 17px; cy: 7px; }
.theme.dark .rays { transform: rotate(-45deg) scale(0.4); opacity: 0; }

@media (max-width: 420px) {
  .kbd { display: none; }
  .theme { margin-left: 2px; }
  .link { padding: 5px 8px; font-size: 13px; }
}
</style>
