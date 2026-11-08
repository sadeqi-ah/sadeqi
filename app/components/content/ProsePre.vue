<script setup lang="ts">
import { useClipboard } from '@vueuse/core'

const props = defineProps<{
  code?: string
  language?: string | null
  filename?: string | null
  highlights?: number[]
  meta?: string | null
  class?: string | null
}>()

const { copy, copied } = useClipboard({ copiedDuring: 1600 })
</script>

<template>
  <div v-reveal class="code-block">
    <div class="bar">
      <span>{{ filename || language || 'code' }}</span>
      <button type="button" class="copy" :aria-label="copied ? 'Copied' : 'Copy code'" @click="copy(props.code ?? '')">
        <Transition name="swap" mode="out-in">
          <span :key="String(copied)">{{ copied ? 'copied ✓' : 'copy' }}</span>
        </Transition>
      </button>
    </div>
    <pre :class="props.class"><slot /></pre>
  </div>
</template>

<style scoped>
.code-block {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.bar {
  display: flex;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: normal;
  color: var(--muted);
}
.copy { color: var(--muted); transition: color 0.2s; }
.copy:hover { color: var(--text); }
pre {
  margin: 0;
  padding: 12px 14px;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.7;
  color: var(--text);
  background: transparent !important;
}
pre :deep(code) { font-family: inherit; }
.swap-enter-active, .swap-leave-active { transition: opacity 0.15s, transform 0.2s var(--ease-out); }
.swap-enter-from { opacity: 0; transform: translateY(4px); }
.swap-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
