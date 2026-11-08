<template>
  <div class="shell">
    <SiteNav />
    <slot />
    <!-- not needed for first paint: hydrate once the browser is idle -->
    <LazyCommandPalette hydrate-on-idle />
  </div>
</template>

<style scoped>
.shell {
  width: min(var(--container), 100% - var(--gutter) * 2);
  margin-inline: auto;
  padding: 40px 0 64px;
}
</style>
