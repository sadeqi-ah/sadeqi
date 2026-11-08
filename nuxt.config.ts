import paperTheme from './shiki-theme'

// Load gate. Runs in <head> before first paint: marks the page as JS-driven
// (so CSS can hold load animations and show the loader) and defines
//  - __appHydrated(): called by the ready.client plugin after hydration
//  - __appReady():    opens the gate (<html class="ready">); SiteLoader calls
//                     it once the signature has finished writing
// Fallback: if the app never hydrates, hide the loader and open the gate
// after 4s, so a failed bundle can't leave the page covered.
// Without JS there is no `js` class: no loader, CSS animates as usual.
const APP_READY = `(function(){var d=document.documentElement;d.classList.add('js');window.__appReady=function(){if(d.classList.contains('ready'))return;d.classList.add('ready');window.dispatchEvent(new Event('app:ready'))};window.__appHydrated=function(){window.__hydrated=true;window.dispatchEvent(new Event('app:hydrated'))};setTimeout(function(){if(window.__hydrated)return;var l=document.querySelector('.site-loader');if(l)l.style.display='none';var t=document.querySelector('[data-signature-target]');if(t)t.setAttribute('data-landed','');window.__appReady()},4000)})()`

// Watch [data-reveal] elements as soon as the HTML is parsed, without waiting
// for hydration, and reveal the ones in view the moment the page is ready.
// Options must match REVEAL_OPTIONS in app/plugins/reveal.ts.
const REVEAL_EARLY = `(function(){if(!('IntersectionObserver' in window))return;var d=document.documentElement;var q=[];function mark(el){el.setAttribute('data-revealed','')}window.addEventListener('app:ready',function(){q.forEach(mark);q=[]});var io=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;io.unobserve(e.target);if(d.classList.contains('ready'))mark(e.target);else q.push(e.target)})},{rootMargin:'0px 0px -8% 0px',threshold:0.08});document.querySelectorAll('[data-reveal]').forEach(function(el){io.observe(el)})})()`

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
      script: [
        { innerHTML: APP_READY, tagPosition: 'head' },
        { innerHTML: REVEAL_EARLY, tagPosition: 'bodyClose' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'alternate', type: 'application/rss+xml', title: 'Writing — Amir Hossein Sadeghi', href: '/rss.xml' },
      ],
    },
  },

  runtimeConfig: {
    // optional: TMDB key for film/series posters (server/api/favourites); set NUXT_TMDB_KEY
    tmdbKey: '',
  },

  fonts: {
    families: [
      // Preload the latin faces the hero uses, so they're in before first paint
      // instead of swapping in (and visibly re-shaping the text) mid-animation.
      { name: 'Geist', provider: 'google', weights: [400, 500], preload: { subsets: ['latin'] } },
      { name: 'Geist Mono', provider: 'google', weights: [400], preload: { subsets: ['latin'] } },
      { name: 'Instrument Serif', provider: 'google', weights: [400], styles: ['normal', 'italic'], preload: { subsets: ['latin'], styles: ['italic'] } },
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
