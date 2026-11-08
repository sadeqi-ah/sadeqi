<script setup lang="ts">
/**
 *   ::image-figure{src="/images/lab-01.png" caption="fig. 1 — …"}
 *   ::
 */
defineProps<{ src?: string, alt?: string, caption?: string }>()
</script>

<template>
  <figure v-reveal class="figure">
    <div class="frame">
      <img v-if="src" :src="src" :alt="alt ?? caption ?? ''" loading="lazy">
      <slot v-else />
    </div>
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.figure { display: flex; flex-direction: column; gap: 8px; }
.frame {
  min-height: 260px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  overflow: hidden;
  display: grid;
  place-items: center;
}
.frame img { width: 100%; height: auto; display: block; }
figcaption { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
</style>
