<script setup lang="ts">
import type { PlaylistTrack } from '~~/server/api/playlist.get'

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
  title: 'Amir Hossein Sadeghi — from pixels to packets',
  ogTitle: 'Amir Hossein Sadeghi',
  description: 'Software developer moving into networking. Research on consensus in low-power wireless and ad-hoc networks.',
})

const resumeTo = '/resume'

// Tracks come straight from the Spotify playlist linked in media.yml.
const { data: playlist } = await useFetch('/api/playlist')
// Favourite films & series, with posters looked up server-side.
const { data: favourites } = await useFetch('/api/favourites')
const playing = ref<PlaylistTrack | null>(null)
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
            <img src="/svg/pin.svg" alt="" width="14" height="14">
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
        <UiButton label="Resume" icon="↗" :to="resumeTo" />
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
    <section class="section">
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
    <section class="section">
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

    <!-- Favourite music (the Spotify playlist) -->
    <section v-if="playlist?.tracks.length" class="section">
      <SectionLabel v-if="playing" label="Favourite music" :action="playing.title">
        <template #action>
          <span class="eq" aria-hidden="true"><i /><i /><i /></span>
          <span class="playing">{{ playing.title }} · {{ playing.artist }}</span>
        </template>
      </SectionLabel>
      <SectionLabel v-else label="Favourite music" action="Open in Spotify ↗" :to="playlist.url" />
      <LazyTrackList v-model:current="playing" hydrate-on-visible :tracks="playlist.tracks" />
    </section>

    <!-- Favourite films & series -->
    <section v-if="favourites?.length" class="section">
      <SectionLabel label="Favourite films & series" action="Letterboxd ↗" :to="data?.media?.letterboxd" />
      <LazyFavouriteGrid hydrate-on-visible :items="favourites" />
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

.playing { max-width: 260px; overflow: hidden; text-overflow: ellipsis; }

.eq { display: inline-flex; align-items: flex-end; gap: 2px; height: 9px; }
.eq i {
  width: 2px;
  height: 100%;
  background: var(--success);
  border-radius: 1px;
  transform-origin: bottom;
  animation: eq 0.8s var(--ease-in-out) infinite alternate;
}
.eq i:nth-child(2) { animation-delay: -0.35s; }
.eq i:nth-child(3) { animation-delay: -0.6s; }
@keyframes eq { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }

@media (max-width: 520px) {
  .page { margin-top: 64px; gap: 60px; }
  .actions { flex-wrap: wrap; }
  .playing { max-width: 160px; }
}
</style>
