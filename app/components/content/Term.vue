<script setup lang="ts">
/**
 * MDC inline component — a dashed term with a small mono tooltip.
 *   :term[frontend,]{tip="React · Svelte · Vue"}
 */
defineProps<{ tip?: string }>()
</script>

<template>
  <span class="term" :tabindex="tip ? 0 : undefined">
    <slot mdc-unwrap="p" />
    <span v-if="tip" class="tip" role="tooltip">{{ tip }}</span>
  </span>
</template>

<style scoped>
.term {
  position: relative;
  color: var(--text);
  text-decoration: underline dashed;
  text-decoration-color: color-mix(in srgb, var(--text) 45%, transparent);
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  border-radius: 4px;
  cursor: help;
  outline: none;
  transition: background 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out), text-decoration-color 0.2s;
}
.term:hover,
.term:focus-visible {
  background: var(--surface);
  box-shadow: 0 0 0 3px var(--surface);
  text-decoration-color: transparent;
}
.tip {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  z-index: 5;
  padding: 6px 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.4;
  color: var(--muted);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transform: translate(-50%, 4px) scale(0.96);
  transform-origin: bottom center;
  transition: opacity 0.18s var(--ease-out), transform 0.3s var(--ease-spring);
}
.term:hover .tip,
.term:focus-visible .tip { opacity: 1; transform: translate(-50%, 0) scale(1); }
</style>
