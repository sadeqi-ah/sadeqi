/**
 * Tracks of the playlist linked in content/media.yml.
 *
 * No Spotify API key needed: the public embed page ships the playlist as JSON
 * (__NEXT_DATA__) with titles, artists, durations and 30s previews; album art
 * per track comes from Spotify's oEmbed endpoint. Editing the playlist on
 * Spotify is all it takes to update the site — the result is cached for a few
 * hours on a server, and baked in at build time on a static deploy.
 */
export interface PlaylistTrack {
  id: string
  title: string
  artist: string
  duration: number
  url: string
  preview?: string
  cover?: string
}

export interface Playlist {
  name: string
  url: string
  cover?: string
  tracks: PlaylistTrack[]
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'

export default defineCachedEventHandler(async (event): Promise<Playlist | null> => {
  const media = await queryCollection(event, 'media').first()
  const id = media?.playlist?.match(/playlist[/:]([A-Za-z0-9]+)/)?.[1]
  if (!id) return null

  const html = await $fetch<string>(`https://open.spotify.com/embed/playlist/${id}`, {
    headers: { 'user-agent': UA },
    responseType: 'text',
  })
  const json = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1]
  if (!json) throw createError({ statusCode: 502, statusMessage: 'Spotify embed changed shape' })
  const entity = JSON.parse(json).props.pageProps.state.data.entity

  const tracks: PlaylistTrack[] = await Promise.all(
    (entity.trackList as any[]).map(async (t) => {
      const trackId = t.uri.split(':').pop()
      const url = `https://open.spotify.com/track/${trackId}`
      const oembed = await $fetch<{ thumbnail_url?: string }>('https://open.spotify.com/oembed', { query: { url } })
        .catch(() => null)
      return {
        id: trackId,
        title: t.title,
        artist: t.subtitle,
        duration: t.duration,
        url,
        preview: t.audioPreview?.url,
        cover: oembed?.thumbnail_url,
      }
    }),
  )

  return {
    name: entity.name,
    url: `https://open.spotify.com/playlist/${id}`,
    cover: entity.coverArt?.sources?.find((s: any) => s.width === 300)?.url,
    tracks,
  }
}, { name: 'playlist', maxAge: 60 * 60 * 6, swr: true })
