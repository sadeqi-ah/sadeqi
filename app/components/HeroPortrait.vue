<script setup lang="ts">
/**
 * The portrait on the home page. It develops like an instant-film print —
 * pale and washed-out, warming into full colour — then tilts toward the
 * pointer with a soft glare, like a print held up to the light.
 *
 * The develop is pure CSS, so it starts with the HTML on the same clock as
 * the hero stagger and never waits for hydration.
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
      <img :src="src" :alt="alt" width="312" height="426" fetchpriority="high">
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
  /* the blank print: warm, pale paper the image surfaces out of */
  background: #ece6da;
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
  object-fit: cover;
  object-position: 50% 35%;
  filter: saturate(0.9) contrast(1.02);
  /* ease-out: most of the image shows up fast, the last of the colour lingers */
  /* `backwards`, not `both`: once done the animation lets go of `filter`,
     so the hover saturate below still works */
  animation: develop 2.2s cubic-bezier(0.2, 0.7, 0.2, 1) var(--delay) backwards;
  transition: filter 0.6s var(--ease-out);
}
/* Instant film: first a faint ghost, then contrast, then colour. */
@keyframes develop {
  0% { opacity: 0; filter: brightness(1.5) contrast(0.35) saturate(0) sepia(0.4); }
  25% { opacity: 1; filter: brightness(1.3) contrast(0.55) saturate(0.2) sepia(0.35); }
  60% { filter: brightness(1.08) contrast(0.85) saturate(0.6) sepia(0.15); }
  100% { opacity: 1; filter: saturate(0.9) contrast(1.02); }
}
.stage:hover .portrait img { filter: saturate(1.08) contrast(1.04); }

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
