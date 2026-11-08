<script setup lang="ts">
const props = withDefaults(defineProps<{ text: string, duration?: number, autoplayDelay?: number }>(), {
  duration: 300,
  autoplayDelay: 900,
})

const display = ref(props.text)
let raf = 0
let timer: ReturnType<typeof setTimeout> | undefined

function play() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  cancelAnimationFrame(raf)
  const start = performance.now()
  const tick = (now: number) => {
    const p = Math.min((now - start) / props.duration, 1)
    display.value = scrambleFrame(props.text, p)
    if (p < 1) raf = requestAnimationFrame(tick)
    else display.value = props.text
  }
  raf = requestAnimationFrame(tick)
}

onMounted(() => {
  // Decode once after the hero has settled, so the effect is discoverable.
  if (props.autoplayDelay >= 0) timer = setTimeout(play, props.autoplayDelay)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  clearTimeout(timer)
})
</script>

<template>
  <span class="packets" :aria-label="text" @mouseenter="play" @focus="play" tabindex="0">
    <span aria-hidden="true">{{ display }}</span>
  </span>
</template>

<style scoped>
.packets {
  font-family: var(--font-mono);
  font-size: 27px;
  letter-spacing: -1.08px;
  color: var(--text);
  cursor: default;
  outline: none;
}
</style>
