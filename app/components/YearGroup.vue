<script setup lang="ts">
defineProps<{ year: string | number }>()
</script>

<template>
  <section v-reveal class="year-group">
    <p class="y-label">{{ year }}</p>
    <div class="items"><slot /></div>
  </section>
</template>

<style scoped>
.year-group { display: flex; gap: 24px; align-items: flex-start; }
.y-label {
  width: 40px;
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: normal;
  color: var(--muted);
  position: sticky;
  top: 24px;
  padding-top: var(--year-offset, 0);
}
.items { flex: 1 0 0; min-width: 0; display: flex; flex-direction: column; }

@media (max-width: 520px) {
  .year-group { flex-direction: column; gap: 4px; }
  .y-label { position: static; }
  .items { width: 100%; }
}
</style>
