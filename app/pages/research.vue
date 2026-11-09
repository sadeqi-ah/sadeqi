<script setup lang="ts">
const { data: papers } = await useAsyncData('research', () =>
  queryCollection('papers').order('year', 'DESC').all(),
)

const years = computed(() => groupByYear(papers.value ?? [], p => p.year))
const interests = ['low-power wireless', 'distributed systems', 'blockchain']

useSeoMeta({ title: 'Research — Amir Hossein Sadeghi', description: 'Research on low-power wireless networks.' })
</script>

<template>
  <main class="page">
    <PageHeader
      path="~/research"
      title="Research"
      lede="I study how distributed systems behave on constrained, imperfect wireless networks. Work in progress; details will land here as it matures."
    >
      <div class="chips">
        <UiChip v-for="tag in interests" :key="tag" :label="tag" />
      </div>
    </PageHeader>

    <section v-if="papers?.length" class="section">
      <SectionLabel label="Papers" action="Google Scholar ↗" to="https://scholar.google.com" />
      <YearGroup v-for="[year, items] in years" :key="year" :year="year" class="year">
        <ResearchItem
          v-for="paper in items"
          :key="paper.title"
          :status="paper.status"
          :venue="paper.venue"
          :title="paper.title"
          :authors="paper.authors"
          :links="paper.links"
        />
      </YearGroup>
    </section>

    <p v-else class="empty">Nothing public yet. Work in progress; papers will appear here once they are out.</p>

    <SiteFooter />
  </main>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 56px; margin-top: 88px; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.section { display: flex; flex-direction: column; gap: 12px; }
.empty { font-size: 15px; color: var(--muted); }
.year { padding-top: 8px; --year-offset: 8px; }
@media (max-width: 520px) { .page { margin-top: 56px; } }
</style>
