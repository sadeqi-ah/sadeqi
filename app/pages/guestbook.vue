<script setup lang="ts">
/**
 * The guestbook: a little game, full screen, outside the site's layout —
 * sail an endless archipelago, fish messages in bottles out of the sea,
 * write your own and throw it overboard. See components/sea/Game.vue.
 */
// no layout, and no page transition: the game fades itself in
definePageMeta({ layout: false, pageTransition: false })

useSeoMeta({
  title: 'Message in a bottle — AmirHossein Sadeghi',
  description: 'Sail an endless sea of little islands, fish messages in bottles out of the water and read them, or write your own and throw it overboard.',
})
</script>

<template>
  <ClientOnly>
    <SeaGame />
    <template #fallback>
      <div class="boot">
        <p>Setting sail…</p>
      </div>
    </template>
  </ClientOnly>
</template>

<style scoped>
.boot {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: linear-gradient(#bfe6ff, #7fd8e8);
  color: #10324a;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 22px;
}
</style>
