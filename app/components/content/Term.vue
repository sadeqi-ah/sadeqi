<script setup lang="ts">
/**
 * MDC inline component — a dashed term with a small mono tooltip. With `icon`
 * + `color`, hovering also tints the word in its brand colour and slides the
 * brand logo in beside it.
 *   :term[frontend,]{tip="React · Svelte · Vue"}
 *   :term[Rust]{tip="Tauri desktop apps" icon="rust" color="#e8590c"}
 */
const props = defineProps<{ tip?: string, icon?: string, color?: string }>()
const iconStyle = computed(() => props.icon ? { maskImage: `url(/svg/tech/${props.icon}.svg)` } : undefined)
</script>

<template>
  <span
    class="term"
    :class="{ branded: !!icon }"
    :style="color ? { '--brand': color } : undefined"
    :tabindex="tip || icon ? 0 : undefined"
  >
    <i v-if="icon" class="logo" :style="iconStyle" aria-hidden="true" />
    <slot mdc-unwrap="p" />
    <span v-if="tip" class="tip" role="tooltip">{{ tip }}</span>
  </span>
</template>

<style scoped>
.term {
  position: relative;
  color: var(--text);
  text-decoration: underline dashed;
  text-decoration-color: color-mix(in srgb, var(--text) 45%, transparent);
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  border-radius: 4px;
  cursor: help;
  outline: none;
  transition: background 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out), text-decoration-color 0.2s, color 0.25s var(--ease-out);
}
.term:hover,
.term:focus-visible {
  background: var(--surface);
  box-shadow: 0 0 0 3px var(--surface);
  text-decoration-color: transparent;
}
.term.branded:hover,
.term.branded:focus-visible {
  color: var(--brand);
  background: color-mix(in srgb, var(--brand) 10%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 10%, transparent);
}

.logo {
  display: inline-block;
  vertical-align: -0.12em;
  width: 0;
  height: 0.95em;
  margin-right: 0;
  background: var(--brand);
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
  opacity: 0;
  transform: translateX(-4px) scale(0.6);
  text-decoration: none;
  transition:
    width 0.35s var(--ease-spring),
    margin 0.35s var(--ease-spring),
    opacity 0.25s var(--ease-out),
    transform 0.4s var(--ease-spring);
}
.term:hover .logo,
.term:focus-visible .logo {
  width: 0.95em;
  margin-right: 0.28em;
  opacity: 1;
  transform: none;
}

.tip {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  z-index: 5;
  padding: 6px 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.4;
  color: var(--muted);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transform: translate(-50%, 4px) scale(0.96);
  transform-origin: bottom center;
  transition: opacity 0.18s var(--ease-out), transform 0.3s var(--ease-spring);
}
.term:hover .tip,
.term:focus-visible .tip { opacity: 1; transform: translate(-50%, 0) scale(1); }

@media (prefers-reduced-motion: reduce) {
  .logo { transition: opacity 0.2s; }
}
</style>
