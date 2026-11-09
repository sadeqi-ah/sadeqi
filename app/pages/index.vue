<script setup lang="ts">
import type { PlaylistTrack } from '~~/server/api/playlist.get'
import { HugeiconsIcon } from '@hugeicons/vue'
import { Location01Icon, PencilEdit01Icon } from '@hugeicons/core-free-icons'

const { data: site } = await useSite()

const { data } = await useAsyncData('home', async () => {
  const [intro, now, projects, papers, posts, media] = await Promise.all([
    queryCollection('pages').path('/pages').first(),
    queryCollection('now').first(),
    queryCollection('projects').order('order', 'ASC').limit(3).all(),
    queryCollection('papers').where('featured', '=', true).order('year', 'DESC').all(),
    queryCollection('posts').where('draft', '=', false).order('date', 'DESC').limit(3).all(),
    queryCollection('media').first(),
  ])
  return { intro, now, projects, papers, posts, media }
})

useSeoMeta({
  title: 'AmirHossein Sadeghi — from pixels to packets',
  ogTitle: 'AmirHossein Sadeghi',
  description: 'Software developer moving into networking. Research on consensus in low-power wireless and ad-hoc networks.',
})

// Tracks come straight from the Spotify playlist linked in media.yml.
const { data: playlist } = await useFetch('/api/playlist')
// Favourite films & series, with posters looked up server-side.
const { data: favourites } = await useFetch('/api/favourites')
const playing = ref<PlaylistTrack | null>(null)
const HOME_TRACKS = 6
const HOME_FILMS = 4
</script>

<template>
  <main class="page home">
    <!-- Hero -->
    <section class="hero stagger">
      <div class="top" style="--i: 0">
        <div class="heading">
          <p class="name">{{ site?.name }}</p>
          <h1 class="tagline">
            From <em class="serif"><PixelText text="pixels" /></em> to <PacketsText text="packets" />.
          </h1>
          <p class="location">
            <HugeiconsIcon :icon="Location01Icon" :size="15" aria-hidden="true" />
            <span>{{ site?.location }}</span>
            <LocalClock v-if="site" :timezone="site.timezone" />
          </p>
        </div>
        <HeroPortrait src="/amir-sm.webp" :alt="site?.name ?? 'Portrait'" :delay="120" />
      </div>

      <ContentRenderer v-if="data?.intro" :value="data.intro" class="intro" style="--i: 1" />

      <!-- not part of the stagger: the loader flies the signature in here -->
      <div class="sign-off">
        <SiteSignature size="hero" trigger="loader" />
      </div>

      <div class="actions" style="--i: 3">
        <SocialLinks />
        <span class="spacer" />
        <UiButton label="Leave a note" :icon="PencilEdit01Icon" to="/guestbook" />
      </div>
    </section>

    <!-- Now -->
    <section v-if="data?.now" class="section">
      <SectionLabel label="Now" :action="`updated ${data.now.updated}`" />
      <LazyNowCard hydrate-on-visible :items="data.now.items" />
    </section>

    <!-- Projects -->
    <section class="section">
      <SectionLabel label="Projects" action="View all →" to="/projects" />
      <div v-reveal class="list">
        <LazyListRow
          hydrate-on-visible
          v-for="p in data?.projects"
          :key="p.title"
          :icon="p.logo ?? true"
          :title="p.title"
          :description="p.short"
          :meta="p.year"
          to="/projects"
        />
      </div>
    </section>

    <!-- Research -->
    <section v-if="data?.papers?.length" class="section">
      <SectionLabel label="Research" action="View all →" to="/research" />
      <div v-reveal class="list">
        <LazyResearchItem
          hydrate-on-visible
          v-for="paper in data?.papers"
          :key="paper.title"
          :status="paper.status"
          :venue="`${paper.year} · ${paper.venue}`"
          :title="paper.title"
          :authors="paper.authors"
          :links="paper.links"
        />
      </div>
    </section>

    <!-- Writing -->
    <section v-if="data?.posts?.length" class="section">
      <SectionLabel label="Writing" action="View all →" to="/writing" />
      <div v-reveal class="list">
        <LazyListRow
          hydrate-on-visible
          v-for="post in data?.posts"
          :key="post.path"
          :title="post.title"
          :meta="formatMonthYear(post.date)"
          :to="post.path"
        />
      </div>
    </section>

    <!-- Favourite music (the Spotify playlist): a few here, the rest on /music -->
    <section v-if="playlist?.tracks.length" class="section">
      <PlayingLabel label="Favourite music" :playing="playing" action="View all →" to="/music" />
      <LazyTrackList
        v-model:current="playing"
        hydrate-on-visible
        :tracks="playlist.tracks.slice(0, HOME_TRACKS)"
        :initial="HOME_TRACKS"
      />
      <!-- the rows only play 30s previews; the full songs live on Spotify -->
      <a :href="playlist.url" target="_blank" rel="noopener" class="out-link">Open in Spotify ↗</a>
    </section>

    <!-- Favourite films & series: the first few here, the rest on /films -->
    <section v-if="favourites?.length" class="section">
      <SectionLabel label="Favourite films & series" action="View all →" to="/films" />
      <LazyFavouriteGrid hydrate-on-visible :items="favourites.slice(0, HOME_FILMS)" />
    </section>

    <LazySiteFooter hydrate-on-visible />
  </main>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 72px; margin-top: 96px; }

.hero { display: flex; flex-direction: column; gap: 20px; }
.top { display: flex; align-items: flex-start; gap: 24px; }
.heading { flex: 1 0 0; min-width: 0; display: flex; flex-direction: column; gap: 6px; padding-bottom: 8px; }
.name { font-size: 15px; font-weight: 500; line-height: 1.4; }
.tagline {
  font-size: 30px;
  font-weight: 400;
  line-height: 1.2;
  letter-spacing: -0.45px;
  color: var(--muted);
}
.tagline em {
  font-size: 34px;
  color: var(--text);
  letter-spacing: 0;
  display: inline-block;
  transition: transform 0.5s var(--ease-spring);
}
.tagline em:hover { transform: rotate(-4deg) translateY(-2px); }
.location {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  line-height: 1.4;
  color: var(--muted);
}

.intro { display: flex; flex-direction: column; gap: 20px; }
.intro :deep(p) { font-size: 15px; line-height: 1.65; color: var(--text); }
.intro :deep(p:first-child) { color: var(--muted); }

.sign-off { display: flex; }
.stagger > .sign-off { animation: none; }
.actions { display: flex; align-items: center; gap: 8px; }
.spacer { flex: 1 0 0; }

.section { display: flex; flex-direction: column; gap: 12px; }
.list { display: flex; flex-direction: column; }

.out-link {
  align-self: flex-start;
  margin-top: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
  transition: color 0.2s;
}
.out-link:hover { color: var(--text); }

@media (max-width: 520px) {
  .page { margin-top: 64px; gap: 60px; }
  .actions { flex-wrap: wrap; }
}
</style>
