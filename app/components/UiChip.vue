<script setup lang="ts">
defineProps<{ label: string, dot?: boolean, active?: boolean, pill?: boolean, as?: string }>()
</script>

<template>
  <component :is="as ?? 'span'" class="chip" :class="{ active, pill }" :type="as === 'button' ? 'button' : undefined">
    <span v-if="dot" class="dot" aria-hidden="true"><img src="/svg/dot.svg" alt="" width="6" height="6"></span>
    {{ label }}
  </component>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--surface);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: normal;
  color: var(--muted);
  white-space: nowrap;
  transition: background 0.25s var(--ease-out), color 0.25s var(--ease-out), transform 0.3s var(--ease-spring);
}
.chip.pill { border-radius: 999px; }
button.chip:hover { color: var(--text); background: var(--border); }
button.chip:active { transform: scale(0.94); }
.chip.active,
button.chip.active:hover { background: var(--text); color: var(--bg); }
.dot { position: relative; width: 6px; height: 6px; }
.dot::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: var(--success);
  animation: ping 2s var(--ease-out) infinite;
}
@keyframes ping {
  0% { transform: scale(1); opacity: 0.6; }
  70%, 100% { transform: scale(2.6); opacity: 0; }
}
</style>
