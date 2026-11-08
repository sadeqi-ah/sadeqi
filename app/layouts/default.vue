<template>
  <div class="shell">
    <SiteNav />
    <slot />
    <CommandPalette />
  </div>
</template>

<style scoped>
.shell {
  width: min(var(--container), 100% - var(--gutter) * 2);
  margin-inline: auto;
  padding: 40px 0 64px;
}
</style>
