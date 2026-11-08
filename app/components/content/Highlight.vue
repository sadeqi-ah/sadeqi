<script setup lang="ts">
/**
 * MDC inline component — a highlighter that sweeps in left→right once.
 *   :highlight[low-power wireless and ad-hoc networks]
 */
withDefaults(defineProps<{ delay?: number }>(), { delay: 700 })
</script>

<template>
  <mark class="hl" :style="{ '--delay': `${delay}ms` }"><slot mdc-unwrap="p" /></mark>
</template>

<style scoped>
.hl {
  color: var(--text);
  /* padding gives the rounded ends room; the negative margin gives that room
     back so the text around it (spaces, a trailing comma) doesn't shift */
  padding: 1px 4px;
  margin: 0 -3px;
  border-radius: 6px;
  background-color: transparent;
  background-image: linear-gradient(var(--highlight), var(--highlight));
  background-repeat: no-repeat;
  background-position: 0 0;
  background-size: 0% 100%;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
  animation: sweep 900ms var(--ease-in-out) var(--delay) forwards;
}
@keyframes sweep { to { background-size: 100% 100%; } }
@media print { .hl { background-size: 100% 100%; animation: none; } }
</style>
