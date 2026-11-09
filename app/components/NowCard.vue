<script setup lang="ts">
defineProps<{ items: { title: string, meta: string, progress: number }[] }>()
</script>

<template>
  <ul v-reveal class="card">
    <li v-for="(item, i) in items" :key="item.title" class="item" data-marquee-host :style="{ '--i': i, '--target': item.progress }">
      <span class="arrow">→</span>
      <MarqueeText class="title" :text="item.title" />
      <span class="meta">{{ item.meta }}</span>
      <span class="spacer" />
      <span class="bar" role="progressbar" :aria-valuenow="item.progress" aria-valuemin="0" aria-valuemax="100" :aria-label="`${item.title} progress`">
        <span class="fill" />
      </span>
      <span class="pct" aria-hidden="true" />
    </li>
  </ul>
</template>

<style scoped>
@property --num {
  syntax: '<integer>';
  initial-value: 0;
  inherits: false;
}
.card {
  list-style: none;
  margin: 0;
  padding: 6px 18px;
  border: 1px dashed var(--border);
  border-radius: 12px;
}
.item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  line-height: normal;
}
.item:last-child { border-bottom: 0; }
.arrow { font-family: var(--font-mono); font-size: 12px; color: var(--accent); animation: nudge 1.8s var(--ease-in-out) infinite; }
@keyframes nudge { 50% { transform: translateX(3px); } }
.title { font-size: 15px; flex: 0 1 auto; min-width: 0; }
.meta { font-family: var(--font-mono); font-size: 12px; color: var(--muted); white-space: nowrap; flex-shrink: 0; }
.spacer { flex: 1 0 0; min-width: 0; }
.bar {
  position: relative;
  width: 64px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  overflow: hidden;
  flex-shrink: 0;
}
.fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(var(--target) * 1%);
  border-radius: 2px;
  background: var(--text);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 1.2s var(--ease-out);
  transition-delay: calc(var(--i) * 120ms + 200ms);
}
.pct {
  --num: 0;
  width: 3ch;
  text-align: right;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
  counter-reset: num var(--num);
  font-variant-numeric: tabular-nums;
  transition: --num 1.2s var(--ease-out);
  transition-delay: calc(var(--i) * 120ms + 200ms);
}
.pct::after { content: counter(num) '%'; }
[data-revealed] .fill { transform: scaleX(1); }
[data-revealed] .pct { --num: var(--target); }

@media (max-width: 520px) {
  .meta { display: none; }
  .title { font-size: 14px; }
}
</style>
