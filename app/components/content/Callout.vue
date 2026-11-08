<template>
  <aside v-reveal class="callout">
    <span class="bar" aria-hidden="true" />
    <div class="text"><slot mdc-unwrap="p" /></div>
  </aside>
</template>

<style scoped>
.callout { display: flex; gap: 14px; align-items: stretch; }
.bar {
  width: 2px;
  flex-shrink: 0;
  background: var(--text);
  transform: scaleY(0);
  transform-origin: top;
  transition: transform 0.8s var(--ease-out) 0.2s;
}
[data-revealed] .bar { transform: none; }
.text {
  flex: 1;
  font-family: var(--font-serif);
  font-size: 20px;
  line-height: 1.4;
}
</style>
