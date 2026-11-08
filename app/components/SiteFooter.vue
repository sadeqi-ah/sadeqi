<template>
  <footer v-reveal class="footer no-print">
    <div class="top">
      <NuxtLink to="/" aria-label="Home">
        <SiteSignature size="footer" />
      </NuxtLink>
      <SocialLinks :order="['instagram', 'telegram', 'x', 'email', 'github']" />
    </div>
    <div class="meta">
      <p>© {{ new Date().getFullYear() }} Amir Hossein Sadeghi</p>
      <span class="links">
        <NuxtLink to="/guestbook" class="rss">leave a note</NuxtLink>
        <a href="/rss.xml" class="rss">rss</a>
      </span>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 32px;
  border-top: 1px solid var(--border);
}
.top { display: flex; align-items: center; justify-content: space-between; }
.meta {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
}
.links { display: flex; gap: 14px; }
.rss { transition: color 0.2s; }
.rss:hover { color: var(--text); }
</style>
