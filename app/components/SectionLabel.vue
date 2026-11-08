<script setup lang="ts">
defineProps<{ label: string, action?: string, to?: string }>()
</script>

<template>
  <div v-reveal class="section-label">
    <h2 class="label">{{ label }}</h2>
    <span class="rule" aria-hidden="true"><img src="/svg/rule.svg" alt="" width="405" height="1"></span>
    <template v-if="action">
      <NuxtLink v-if="to" :to="to" class="action" :target="isExternal(to) ? '_blank' : undefined">{{ action }}</NuxtLink>
      <span v-else class="action"><slot name="action">{{ action }}</slot></span>
    </template>
  </div>
</template>

<style scoped>
.section-label {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 20px;
  width: 100%;
}
.label {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 400;
  color: var(--text);
  white-space: nowrap;
}
.rule {
  flex: 1 0 0;
  min-width: 1px;
  height: 1px;
  overflow: hidden;
}
.rule img {
  width: 100%;
  height: 1px;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 1.1s var(--ease-out) 0.15s;
}
[data-revealed] .rule img { transform: scaleX(1); }
.action {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: color 0.2s;
}
a.action:hover { color: var(--text); }
</style>
