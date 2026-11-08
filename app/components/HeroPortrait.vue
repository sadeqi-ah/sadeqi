<script setup lang="ts">
/**
 * The portrait on the home page. It comes into focus like a lens pulling
 * focus — soft and slightly zoomed, settling sharp — then tilts toward the
 * pointer with a soft glare, like a print held up to the light.
 *
 * The focus pull animates only opacity and transform, so it runs entirely on
 * the compositor: a pre-blurred copy (static blur, painted once) fades out
 * over the sharp photo while the image settles from a slight zoom. Held by
 * the load gate (main.css) like the rest of the hero.
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
    <figure ref="root" class="portrait" :style="{ '--delay': `${delay}ms` }">
      <div class="lens">
        <img class="photo" :src="src" :alt="alt" width="312" height="426" fetchpriority="high">
        <img class="soft" :src="src" alt="" aria-hidden="true" width="312" height="426">
      </div>
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

/* the lens: zoomed in a touch, settles to rest as focus lands */
.lens {
  position: absolute;
  inset: 0;
  animation: settle 1.4s cubic-bezier(0.22, 1, 0.36, 1) var(--delay) both;
  will-change: transform;
}
@keyframes settle { from { transform: scale(1.08); } }

.lens img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 35%;
}
.photo {
  filter: saturate(0.9) contrast(1.02);
  transition: filter 0.6s var(--ease-out);
}
.stage:hover .photo { filter: saturate(1.08) contrast(1.04); }

/* Out of focus: a static blur (painted once), oversized so its soft edges
   stay outside the frame. Only its opacity animates. */
.soft {
  filter: blur(9px) saturate(0.85) brightness(1.04);
  transform: scale(1.12);
  opacity: 0;
  animation: unblur 1.1s cubic-bezier(0.33, 0, 0.2, 1) var(--delay) both;
  will-change: opacity;
  pointer-events: none;
}
@keyframes unblur { from { opacity: 1; } }

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
  .soft { display: none; }
}
</style>
