<script setup lang="ts">
import { NuxtLink } from '#components'
const { data } = await useAsyncData('research', async () => {
  const [papers, notes] = await Promise.all([
    queryCollection('papers').order('year', 'DESC').all(),
    queryCollection('researchNotes').first(),
  ])
  return { papers, notes }
})

const years = computed(() => groupByYear(data.value?.papers ?? [], p => p.year))
const interests = ['distributed consensus', 'network topology', 'simulation', 'NetDevOps']

useSeoMeta({ title: 'Research — Amir Hossein Sadeghi', description: 'Consensus on real, imperfect networks.' })
</script>

<template>
  <main class="page">
    <PageHeader
      path="~/research"
      title="Research"
      lede="I study how distributed systems behave on real, imperfect networks — consensus under different topologies, latency and partitions."
    >
      <div class="chips">
        <UiChip v-for="tag in interests" :key="tag" :label="tag" />
      </div>
    </PageHeader>

    <section class="section">
      <SectionLabel label="Papers" action="Google Scholar ↗" to="https://scholar.google.com" />
      <YearGroup v-for="[year, papers] in years" :key="year" :year="year" class="year">
        <ResearchItem
          v-for="paper in papers"
          :key="paper.title"
          :status="paper.status"
          :venue="paper.venue"
          :title="paper.title"
          :authors="paper.authors"
          :links="paper.links"
        />
      </YearGroup>
    </section>

    <section v-if="data?.notes" class="section">
      <SectionLabel label="Research notes" action="all notes →" to="/writing" />
      <ul v-reveal class="notes">
        <li v-for="note in data.notes.items" :key="note.title">
          <component :is="note.href ? NuxtLink : 'span'" :to="note.href" class="note">
            <span class="pilcrow">¶</span>
            <span class="note-title">{{ note.title }}</span>
          </component>
        </li>
      </ul>
    </section>

    <SiteFooter />
  </main>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 56px; margin-top: 88px; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.section { display: flex; flex-direction: column; gap: 12px; }
.year { padding-top: 8px; --year-offset: 8px; }
.notes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.note { display: inline-flex; gap: 10px; align-items: baseline; font-size: 15px; line-height: normal; }
.pilcrow {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--muted);
  transition: color 0.2s, transform 0.35s var(--ease-spring);
}
.note-title {
  background-image: linear-gradient(var(--text), var(--text));
  background-size: 0% 1px;
  background-position: 0 100%;
  background-repeat: no-repeat;
  transition: background-size 0.4s var(--ease-out);
}
a.note:hover .note-title { background-size: 100% 1px; }
a.note:hover .pilcrow { color: var(--accent); transform: translateX(-2px); }

@media (max-width: 520px) { .page { margin-top: 56px; } }
</style>
