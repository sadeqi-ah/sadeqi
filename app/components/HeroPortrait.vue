<script setup lang="ts">
/**
 * The portrait on the home page. It "develops" from coarse pixels into the
 * photo (from pixels…), then tilts toward the pointer with a soft glare, like
 * a print held up to the light.
 */
const props = withDefaults(defineProps<{ src: string, alt: string, delay?: number }>(), { delay: 0 })

const root = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const photo = ref<HTMLImageElement>()
const developed = ref(false)

// block sizes in CSS px, coarse → fine; each held for one frame step
const STEPS = [24, 16, 11, 8, 6, 4, 3, 2]
const STEP_MS = 85

function draw(img: HTMLImageElement, block: number) {
  const c = canvas.value
  if (!c) return
  const dpr = window.devicePixelRatio || 1
  const W = c.clientWidth * dpr
  const H = c.clientHeight * dpr
  c.width = W
  c.height = H
  // object-fit: cover, anchored slightly above centre like the <img>
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight)
  const sw = W / scale
  const sh = H / scale
  const sx = (img.naturalWidth - sw) / 2
  const sy = (img.naturalHeight - sh) * 0.35
  const w = Math.max(1, Math.round(c.clientWidth / block))
  const h = Math.max(1, Math.round(c.clientHeight / block))
  const off = document.createElement('canvas')
  off.width = w
  off.height = h
  off.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(off, 0, 0, w, h, 0, 0, W, H)
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

onMounted(async () => {
  const img = photo.value!
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    developed.value = true
    return
  }
  // never leave an empty frame: if the photo is slow (or the tab is in the
  // background, where decoding can be deferred) just show it when it lands
  const loaded = img.complete
    ? Promise.resolve()
    : new Promise<void>(r => img.addEventListener('load', () => r(), { once: true }))
  const ok = await Promise.race([loaded.then(() => true), wait(1500).then(() => false)])
  if (!ok || !img.naturalWidth) {
    developed.value = true
    return
  }
  draw(img, STEPS[0]!)
  await wait(props.delay)
  for (const block of STEPS.slice(1)) {
    await wait(STEP_MS)
    draw(img, block)
  }
  await wait(STEP_MS)
  developed.value = true
})

// pointer tilt + glare
function onMove(e: PointerEvent) {
  if (e.pointerType !== 'mouse' || !root.value) return
  const r = root.value.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width
  const y = (e.clientY - r.top) / r.height
  root.value.style.setProperty('--rx', `${(0.5 - y) * 14}deg`)
  root.value.style.setProperty('--ry', `${(x - 0.5) * 14}deg`)
  root.value.style.setProperty('--gx', `${x * 100}%`)
  root.value.style.setProperty('--gy', `${y * 100}%`)
}
function onLeave() {
  root.value?.style.setProperty('--rx', '0deg')
  root.value?.style.setProperty('--ry', '0deg')
}
</script>

<template>
  <div class="stage" @pointermove="onMove" @pointerleave="onLeave">
    <figure ref="root" class="portrait" :class="{ developed }">
      <img ref="photo" :src="src" :alt="alt" width="1467" height="2000" decoding="async">
      <canvas ref="canvas" aria-hidden="true" />
      <span class="glare" aria-hidden="true" />
    </figure>
  </div>
</template>

<style scoped>
.stage { perspective: 600px; flex-shrink: 0; }
.portrait {
  --rx: 0deg;
  --ry: 0deg;
  position: relative;
  width: 104px;
  aspect-ratio: 104 / 136;
  margin: 0;
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.06),
    0 1px 2px rgba(0, 0, 0, 0.06),
    0 12px 28px -14px rgba(60, 40, 10, 0.45);
  transform: rotate(2.5deg) rotateX(var(--rx)) rotateY(var(--ry));
  transition: transform 0.7s var(--ease-spring), box-shadow 0.4s var(--ease-out);
  will-change: transform;
}
.stage:hover .portrait {
  transform: rotate(0deg) rotateX(var(--rx)) rotateY(var(--ry)) scale(1.04);
  transition: transform 0.25s var(--ease-out), box-shadow 0.4s var(--ease-out);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.06),
    0 2px 4px rgba(0, 0, 0, 0.06),
    0 22px 40px -16px rgba(60, 40, 10, 0.55);
}
.portrait img,
.portrait canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.portrait img {
  object-fit: cover;
  object-position: 50% 35%;
  opacity: 0;
  filter: saturate(0.9) contrast(1.02);
  transition: filter 0.6s var(--ease-out);
}
.stage:hover .portrait img { filter: saturate(1.08) contrast(1.04); }
.portrait canvas { image-rendering: pixelated; transition: opacity 0.35s var(--ease-out); }
.portrait.developed img { opacity: 1; }
.portrait.developed canvas { opacity: 0; }

.glare {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at var(--gx, 30%) var(--gy, 20%), rgba(255, 244, 220, 0.38), transparent 55%);
  mix-blend-mode: soft-light;
  opacity: 0;
  transition: opacity 0.4s var(--ease-out);
  pointer-events: none;
}
.stage:hover .glare { opacity: 1; }

@media (max-width: 520px) {
  .portrait { width: 80px; border-radius: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  .portrait, .stage:hover .portrait { transform: none; }
}
</style>
