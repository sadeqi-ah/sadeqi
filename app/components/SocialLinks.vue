<script setup lang="ts">
type Key = 'email' | 'github' | 'x' | 'telegram' | 'instagram'

const props = withDefaults(defineProps<{ order?: Key[] }>(), {
  order: () => ['email', 'github', 'x', 'telegram', 'instagram'],
})

const { data: site } = await useSite()

const labels: Record<Key, string> = {
  email: 'Email',
  github: 'GitHub',
  x: 'X (Twitter)',
  telegram: 'Telegram',
  instagram: 'Instagram',
}

const items = computed(() =>
  props.order.map(key => ({
    key,
    label: labels[key],
    href: site.value?.socials[key] ?? '#',
    icon: `/svg/${key}.svg`,
  })),
)
</script>

<template>
  <div class="socials">
    <a
      v-for="(item, i) in items"
      :key="item.key"
      :href="item.href"
      :aria-label="item.label"
      :title="item.label"
      class="social"
      :style="{ '--i': i }"
      :target="item.href.startsWith('http') ? '_blank' : undefined"
      rel="noopener"
    >
      <img :src="item.icon" alt="" width="18" height="18">
    </a>
  </div>
</template>

<style scoped>
.socials { display: flex; gap: 8px; align-items: center; }
.social {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 999px;
  transition:
    transform 0.35s var(--ease-spring),
    border-color 0.2s var(--ease-out),
    background 0.2s var(--ease-out);
}
.social img { transition: transform 0.35s var(--ease-spring); }
.social:hover { border-color: #d6d3d1; background: var(--surface); transform: translateY(-2px); }
.social:hover img { transform: scale(1.08) rotate(-6deg); }
.social:active { transform: translateY(0) scale(0.94); }
</style>
