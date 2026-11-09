<script setup lang="ts">
const { data: projects } = await useAsyncData('projects', () =>
  queryCollection('projects').order('order', 'ASC').all(),
)

// Only offer categories that have at least one project.
const filters = computed(() => ['all', ...new Set((projects.value ?? []).map(p => p.category))])
const active = ref('all')
const visible = computed(() =>
  (projects.value ?? []).filter(p => active.value === 'all' || p.category === active.value),
)

useSeoMeta({ title: 'Projects — AmirHossein Sadeghi', description: 'Network tools, desktop apps and labs.' })
</script>

<template>
  <main class="page">
    <PageHeader
      path="~/projects"
      title="Things I built"
      lede="Network tools, desktop apps and labs. Most of it is open source — click through for write-ups, diagrams and the problems I hit along the way."
    >
      <div v-if="filters.length > 2" class="filters" role="toolbar" aria-label="Filter projects">
        <UiChip
          v-for="f in filters"
          :key="f"
          as="button"
          :label="f"
          :active="active === f"
          :aria-pressed="active === f"
          @click="active = f"
        />
      </div>
    </PageHeader>

    <TransitionGroup tag="div" name="list" class="projects">
      <ProjectCard
        v-for="(p, i) in visible"
        :key="p.title"
        v-reveal="i === 0 ? 150 : 0"
        :title="p.title"
        :year="p.year"
        :description="p.description"
        :stack="p.stack"
        :links="p.links"
        :thumbnail="p.thumbnail"
        :logo="p.logo"
      />
    </TransitionGroup>
    <p v-if="!visible.length" class="empty">Nothing here yet — check back soon.</p>

    <SiteFooter />
  </main>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 56px; margin-top: 88px; }
.filters { display: flex; gap: 6px; flex-wrap: wrap; }
.projects { position: relative; display: flex; flex-direction: column; gap: 64px; }
.empty { font-size: 15px; color: var(--muted); }

.list-move { transition: transform 0.6s var(--ease-out); }
.list-enter-active { transition: opacity 0.5s var(--ease-out), transform 0.6s var(--ease-out); }
.list-leave-active { transition: opacity 0.25s var(--ease-out), transform 0.3s var(--ease-out); position: absolute; width: 100%; }
.list-enter-from { opacity: 0; transform: translateY(16px) scale(0.98); }
.list-leave-to { opacity: 0; transform: scale(0.97); }

@media (max-width: 520px) { .page { margin-top: 56px; } }
</style>
