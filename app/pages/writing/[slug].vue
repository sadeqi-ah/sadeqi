<script setup lang="ts">
const route = useRoute()
const path = computed(() => route.path.replace(/\/$/, ''))

const { data: post } = await useAsyncData(`post:${path.value}`, () =>
  queryCollection('posts').path(path.value).first(),
)
if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: 'Post not found', fatal: true })
}

// Newer post = "next", older = "previous".
const { data: around } = await useAsyncData(`post-around:${path.value}`, () =>
  queryCollectionItemSurroundings('posts', path.value, { fields: ['title'] })
    .where('draft', '=', false)
    .order('date', 'DESC'),
)
const newer = computed(() => around.value?.[0])
const older = computed(() => around.value?.[1])

// Reading progress bar
const progress = ref(0)
function onScroll() {
  const el = document.documentElement
  const max = el.scrollHeight - el.clientHeight
  progress.value = max > 0 ? Math.min(1, el.scrollTop / max) : 0
}
onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

useSeoMeta({
  title: `${post.value.title} — AmirHossein Sadeghi`,
  description: post.value.description,
  ogTitle: post.value.title,
  ogDescription: post.value.description,
  ogType: 'article',
})
</script>

<template>
  <main v-if="post" class="page">
    <div class="progress no-print" :style="{ transform: `scaleX(${progress})` }" aria-hidden="true" />

    <header class="header stagger">
      <NuxtLink to="/writing" class="back" style="--i: 0"><span class="arrow">←</span> ~/writing</NuxtLink>
      <h1 class="title" style="--i: 1">{{ post.title }}</h1>
      <div class="meta" style="--i: 2">
        <span>{{ formatLong(post.date) }} · {{ post.readingTime }} min read</span>
        <UiChip v-for="t in post.tags" :key="t" :label="t" />
      </div>
    </header>

    <img class="divider" src="/svg/line.svg" alt="" width="560" height="1">

    <ContentRenderer :value="post" class="prose stagger-late" />

    <SiteSignature size="hero" class="sign" />

    <nav class="prev-next" aria-label="More posts">
      <NuxtLink v-if="older" :to="older.path" class="pn prev">
        <span class="pn-label">← previous</span>
        <span class="pn-title">{{ older.title }}</span>
      </NuxtLink>
      <span v-else />
      <NuxtLink v-if="newer" :to="newer.path" class="pn next">
        <span class="pn-label">next →</span>
        <span class="pn-title">{{ newer.title }}</span>
      </NuxtLink>
    </nav>

    <SiteFooter />
  </main>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 28px; margin-top: 88px; }
.progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--text);
  transform-origin: left;
  z-index: 40;
}
.header { display: flex; flex-direction: column; gap: 16px; }
.back {
  align-self: flex-start;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
  transition: color 0.2s;
}
.back .arrow { display: inline-block; transition: transform 0.35s var(--ease-spring); }
.back:hover { color: var(--text); }
.back:hover .arrow { transform: translateX(-3px); }
.title {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
  font-size: 44px;
  line-height: 1.05;
  text-wrap: balance;
}
.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
}
.divider { width: 100%; height: 1px; }

.prose { display: flex; flex-direction: column; gap: 28px; animation: rise 0.9s var(--ease-out) 0.3s both; }
.prose :deep(p) { font-size: 15px; line-height: 1.65; }
.prose :deep(h2),
.prose :deep(h3) {
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: 22px;
  line-height: 1.3;
  margin-top: 0;
}
.prose :deep(h2 a),
.prose :deep(h3 a) { color: inherit; }
.prose :deep(p a) {
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: var(--border);
  transition: text-decoration-color 0.2s;
}
.prose :deep(p a:hover) { text-decoration-color: var(--text); }
.prose :deep(:not(pre) > code) {
  font-family: var(--font-mono);
  font-size: 13px;
  background: var(--surface);
  padding: 1px 5px;
  border-radius: 4px;
}
.prose :deep(ul),
.prose :deep(ol) { padding-left: 1.2em; font-size: 15px; line-height: 1.65; }

.sign { margin-top: 0; }

.prev-next {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}
.pn { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.pn.next { align-items: flex-end; text-align: right; }
.pn-label { font-family: var(--font-mono); font-size: 12px; color: var(--muted); transition: transform 0.35s var(--ease-spring), color 0.2s; }
.pn-title { font-size: 14px; font-weight: 500; }
.pn.prev:hover .pn-label { transform: translateX(-3px); color: var(--text); }
.pn.next:hover .pn-label { transform: translateX(3px); color: var(--text); }

@media (max-width: 520px) {
  .page { margin-top: 56px; }
  .title { font-size: 36px; }
}
</style>
