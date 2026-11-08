import paperTheme from './shiki-theme'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: true },

  modules: ['@nuxt/content', '@nuxt/fonts', '@vueuse/nuxt'],

  css: ['~/assets/css/main.css'],

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Amir Hossein Sadeghi',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'From pixels to packets — networking, research and the things I build.' },
        { name: 'theme-color', content: '#fafaf9' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'alternate', type: 'application/rss+xml', title: 'Writing — Amir Hossein Sadeghi', href: '/rss.xml' },
      ],
    },
  },

  fonts: {
    families: [
      { name: 'Geist', provider: 'google', weights: [400, 500] },
      { name: 'Geist Mono', provider: 'google', weights: [400] },
      { name: 'Instrument Serif', provider: 'google', weights: [400], styles: ['normal', 'italic'] },
    ],
  },

  content: {
    experimental: { sqliteConnector: 'native' },
    build: {
      markdown: {
        highlight: {
          theme: { default: paperTheme },
          langs: ['yaml', 'bash', 'shell', 'python', 'ts', 'js', 'rust', 'json', 'toml', 'diff'],
        },
      },
    },
  },

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/', '/rss.xml'],
    },
  },
})
