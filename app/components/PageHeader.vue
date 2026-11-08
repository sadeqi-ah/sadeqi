<script setup lang="ts">
defineProps<{ path: string, title: string, lede?: string }>()
</script>

<template>
  <header class="header stagger">
    <p class="path" style="--i: 0">{{ path }}</p>
    <h1 class="title" style="--i: 1">{{ title }}</h1>
    <p v-if="lede" class="lede" style="--i: 2">{{ lede }}</p>
    <div v-if="$slots.default" class="extra" style="--i: 3"><slot /></div>
  </header>
</template>

<style scoped>
.header { display: flex; flex-direction: column; gap: 14px; }
.path { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
.title {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
  font-size: 48px;
  line-height: 1;
  letter-spacing: -0.48px;
}
.lede { font-size: 15px; line-height: 1.65; color: var(--muted); }
.extra { display: flex; flex-direction: column; gap: 14px; }
</style>
