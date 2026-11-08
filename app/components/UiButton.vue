<script setup lang="ts">
import { NuxtLink } from '#components'
defineProps<{
  label: string
  icon?: string
  variant?: 'primary' | 'secondary'
  to?: string
}>()
</script>

<template>
  <component
    :is="to ? NuxtLink : 'button'"
    :to="to"
    :type="to ? undefined : 'button'"
    :target="to && isExternal(to) ? '_blank' : undefined"
    class="btn"
    :class="variant ?? 'secondary'"
  >
    <span class="label">{{ label }}</span>
    <span v-if="icon" class="icon" aria-hidden="true">{{ icon }}</span>
  </component>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  line-height: normal;
  white-space: nowrap;
  transition:
    transform 0.3s var(--ease-spring),
    background 0.2s var(--ease-out),
    border-color 0.2s var(--ease-out),
    box-shadow 0.25s var(--ease-out);
}
.label { font-weight: 500; }
.icon { display: inline-block; transition: transform 0.35s var(--ease-spring); }
.secondary { background: var(--bg); border: 1px solid var(--border); color: var(--text); }
.secondary .icon { color: var(--muted); }
.secondary:hover { border-color: #d6d3d1; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); }
.primary { background: var(--text); color: var(--bg); border: 1px solid var(--text); }
.primary:hover { background: #262626; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15); }
.btn:hover { transform: translateY(-1px); }
.btn:hover .icon { transform: translate(2px, -2px); }
.btn:active { transform: translateY(0) scale(0.97); }
</style>
