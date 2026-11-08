/**
 * Favourite films & series from content/media.yml, with posters.
 *
 * Poster sources, best first:
 *  1. the entry's own `cover:` (always wins)
 *  2. TMDB, when NUXT_TMDB_KEY is set (free key: themoviedb.org → Settings →
 *     API). Covers every film and series.
 *  3. Apple's public iTunes Search API, no key. Spotty for films, so matching
 *     is strict: exact title (and year, if given). No confident match → no
 *     cover, and the page shows a typographic card instead of a wrong poster.
 * Cached for a day on a server, baked in on a static build.
 */
export interface Favourite {
  title: string
  kind: 'film' | 'series'
  note?: string
  year?: number
  rating?: string
  url?: string
  cover?: string
}

const ART_SIZE = '400x600bb'
/** case- and punctuation-insensitive title equality */
const norm = (t?: string) => (t ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
const same = (a?: string, b?: string) => !!a && norm(a) === norm(b)
const art = (url?: string) => url?.replace(/\/\d+x\d+bb\./, `/${ART_SIZE}.`)

async function search(term: string, params: Record<string, string>) {
  const res = await $fetch<{ results: any[] }>('https://itunes.apple.com/search', {
    query: { term, limit: '15', country: 'us', ...params },
    responseType: 'json',
    parseResponse: JSON.parse,
  }).catch(() => ({ results: [] }))
  return res.results
}

async function tmdbPoster(f: Favourite, key: string): Promise<string | undefined> {
  const type = f.kind === 'film' ? 'movie' : 'tv'
  const res = await $fetch<{ results: any[] }>(`https://api.themoviedb.org/3/search/${type}`, {
    query: {
      api_key: key,
      query: f.title,
      ...(f.year ? { [type === 'movie' ? 'year' : 'first_air_date_year']: f.year } : {}),
    },
  }).catch(() => ({ results: [] }))
  const hit = res.results.find(r => r.poster_path && same(r.title ?? r.name, f.title))
    ?? res.results.find(r => r.poster_path)
  return hit ? `https://image.tmdb.org/t/p/w342${hit.poster_path}` : undefined
}

async function itunesPoster(f: Favourite): Promise<string | undefined> {
  if (f.kind === 'series') {
    const seasons = (await search(f.title, { entity: 'tvSeason' }))
      .filter(r => same(r.artistName, f.title))
    const first = seasons.find(r => /Season 1\b/.test(r.collectionName)) ?? seasons[0]
    return art(first?.artworkUrl100)
  }
  // unfiltered search (the movie filters return nothing), so look deep
  const films = (await search(f.title, { limit: '50' }))
    .filter(r => r.kind === 'feature-movie' && same(r.trackName, f.title))
  const match = f.year
    ? films.find(r => r.releaseDate?.startsWith(String(f.year)))
    : films[0]
  return art(match?.artworkUrl100)
}

export default defineCachedEventHandler(async (event): Promise<Favourite[]> => {
  const media = await queryCollection(event, 'media').first()
  const list = (media?.favourites ?? []) as Favourite[]
  const key = useRuntimeConfig(event).tmdbKey
  const posterFor = (f: Favourite) => key ? tmdbPoster(f, key) : itunesPoster(f)
  return Promise.all(list.map(async f => ({ ...f, cover: f.cover ?? await posterFor(f) })))
}, { name: 'favourites', maxAge: 60 * 60 * 24, swr: true })
