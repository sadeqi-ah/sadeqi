<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'
import { GithubIcon, InstagramIcon, Mail01Icon, NewTwitterIcon, TelegramIcon } from '@hugeicons/core-free-icons'

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

const icons = {
  email: Mail01Icon,
  github: GithubIcon,
  x: NewTwitterIcon,
  telegram: TelegramIcon,
  instagram: InstagramIcon,
} satisfies Record<Key, unknown>

const items = computed(() =>
  props.order.map(key => ({
    key,
    label: labels[key],
    href: site.value?.socials[key] ?? '#',
    icon: icons[key],
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
      <HugeiconsIcon :icon="item.icon" :size="18" class="glyph" aria-hidden="true" />
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
.social .glyph { transition: transform 0.35s var(--ease-spring); }
.social:hover { border-color: var(--border-strong); background: var(--surface); transform: translateY(-2px); }
.social:hover .glyph { transform: scale(1.08) rotate(-6deg); }
.social:active { transform: translateY(0) scale(0.94); }
</style>
