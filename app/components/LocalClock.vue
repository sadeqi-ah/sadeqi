<script setup lang="ts">
import { useNow } from '@vueuse/core'

const props = defineProps<{ timezone: string }>()

// Rendered only after mount — the server's clock is not the visitor's.
const mounted = ref(false)
onMounted(() => { mounted.value = true })
const now = useNow({ interval: 1000 })

const parts = computed(() => {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: props.timezone, hour: '2-digit', minute: '2-digit', hour12: false })
  const [h, m] = fmt.format(now.value).split(':')
  return { h, m }
})
</script>

<template>
  <span class="clock">
    ·
    <Transition name="fade" mode="out-in">
      <span v-if="mounted" :key="`${parts.h}${parts.m}`" class="time"><time>{{ parts.h }}<span class="colon">:</span>{{ parts.m }}</time></span>
      <span v-else class="time">--:--</span>
    </Transition>
    local
  </span>
</template>

<style scoped>
.clock {
  display: inline-flex;
  gap: 0.4em;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.4;
  color: var(--muted);
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}
.colon { animation: blink 2s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0.25; } }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s, transform 0.3s var(--ease-out); }
.fade-enter-from { opacity: 0; transform: translateY(3px); }
.fade-leave-to { opacity: 0; transform: translateY(-3px); }
</style>
