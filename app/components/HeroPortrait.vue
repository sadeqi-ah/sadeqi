<script setup lang="ts">
/**
 * The portrait on the home page. It "develops" from coarse pixels into the
 * photo (from pixels…), then tilts toward the pointer with a soft glare, like
 * a print held up to the light.
 *
 * The develop is pure CSS: tiny pre-averaged frames (see utils/portraitFrames)
 * are scaled up with `image-rendering: pixelated` and stacked, each popping in
 * on a timer. It starts with the HTML, on the same clock as the hero stagger,
 * so it never waits for hydration and never shows an empty card.
 */
withDefaults(defineProps<{ src: string, alt: string, delay?: number }>(), { delay: 0 })

const root = ref<HTMLElement>()

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
    <figure
      ref="root"
      class="portrait"
      :style="{ '--delay': `${delay}ms`, '--frames': PORTRAIT_FRAMES.length }"
    >
      <img
        v-for="(frame, i) in PORTRAIT_FRAMES"
        :key="i"
        class="frame"
        :src="frame"
        :style="{ '--f': i }"
        alt=""
        aria-hidden="true"
      >
      <img class="photo" :src="src" :alt="alt" width="312" height="426" fetchpriority="high">
      <span class="glare" aria-hidden="true" />
    </figure>
  </div>
</template>

<style scoped>
.stage { perspective: 600px; flex-shrink: 0; }
.portrait {
  --rx: 0deg;
  --ry: 0deg;
  --step: 80ms;
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
.portrait img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Frames are opaque and stacked coarse → fine, so each one simply covers the
   last. The first is visible from the first paint; the rest pop in on a step. */
.frame {
  image-rendering: pixelated;
  opacity: 0;
  animation: pop 0s linear calc(var(--delay) + var(--f) * var(--step)) forwards;
}
.frame:first-child { opacity: 1; animation: none; }
@keyframes pop { to { opacity: 1; } }

/* The photo fades in over the finest frame. If it hasn't loaded yet, the
   finest frame just stays until it does — never a blank card. */
.photo {
  object-fit: cover;
  object-position: 50% 35%;
  filter: saturate(0.9) contrast(1.02);
  animation: develop 0.35s var(--ease-out) calc(var(--delay) + var(--frames) * var(--step)) both;
  transition: filter 0.6s var(--ease-out);
}
@keyframes develop { from { opacity: 0; } }
.stage:hover .portrait .photo { filter: saturate(1.08) contrast(1.04); }

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
  .frame { display: none; }
}
</style>
