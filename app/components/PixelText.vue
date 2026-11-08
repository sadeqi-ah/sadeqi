<script setup lang="ts">
/**
 * Text that "resolves" from big chunky pixels to crisp type. A canvas draws the
 * word at a low resolution and scales it up with smoothing off; resolution
 * steps up each frame until the real text takes over.
 */
const props = withDefaults(defineProps<{ text: string, duration?: number, autoplayDelay?: number }>(), {
  duration: 420,
  autoplayDelay: 500,
})

const root = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const active = ref(false)
let raf = 0
let timer: ReturnType<typeof setTimeout> | undefined

// fraction of full resolution per step (coarse → fine)
const STEPS = [0.1, 0.14, 0.2, 0.3, 0.45, 0.7]

function draw(scale: number) {
  const el = root.value
  const cv = canvas.value
  if (!el || !cv) return
  const dpr = window.devicePixelRatio || 1
  const w = el.offsetWidth
  const h = el.offsetHeight
  const W = Math.round(w * dpr)
  const H = Math.round(h * dpr)
  // Not laid out yet (or hidden): nothing to draw, and a 0-size canvas throws in drawImage.
  if (!(w > 0 && h > 0 && W > 0 && H > 0)) return
  if (cv.width !== W || cv.height !== H) {
    cv.width = W
    cv.height = H
  }
  const sw = Math.max(1, Math.round(W * scale))
  const sh = Math.max(1, Math.round(H * scale))
  const small = document.createElement('canvas')
  small.width = sw
  small.height = sh
  const sctx = small.getContext('2d')!
  const cs = getComputedStyle(el)
  sctx.scale(sw / w, sh / h)
  sctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  sctx.fillStyle = cs.color
  sctx.textBaseline = 'middle'
  sctx.fillText(props.text, 0, h / 2 + h * 0.04)

  const ctx = cv.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, W, H)
  ctx.drawImage(small, 0, 0, sw, sh, 0, 0, W, H)
}

function play() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  cancelAnimationFrame(raf)
  active.value = true
  const start = performance.now()
  const tick = (now: number) => {
    // rAF timestamps can precede performance.now() captured at start → clamp
    const p = Math.max(0, (now - start) / props.duration)
    if (p >= 1) {
      active.value = false
      return
    }
    draw(STEPS[Math.min(STEPS.length - 1, Math.floor(p * STEPS.length))]!)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}

onMounted(() => {
  if (props.autoplayDelay >= 0) timer = setTimeout(play, props.autoplayDelay)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  clearTimeout(timer)
})
</script>

<template>
  <span ref="root" class="pixel" :class="{ active }" tabindex="0" @mouseenter="play" @focus="play">
    <span class="txt">{{ text }}</span>
    <canvas ref="canvas" class="cv" aria-hidden="true" />
  </span>
</template>

<style scoped>
.pixel {
  position: relative;
  display: inline-block;
  outline: none;
  cursor: default;
}
.txt { transition: none; }
.pixel.active .txt { color: transparent; }
.cv {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0;
}
.pixel.active .cv { opacity: 1; }
</style>
