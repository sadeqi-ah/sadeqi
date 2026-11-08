const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export default defineEventHandler(async (event) => {
  const origin = getRequestURL(event).origin
  const posts = await queryCollection(event, 'posts')
    .where('draft', '=', false)
    .order('date', 'DESC')
    .all()

  const items = posts.map(p => `
    <item>
      <title>${escape(p.title)}</title>
      <link>${origin}${p.path}</link>
      <guid>${origin}${p.path}</guid>
      <pubDate>${new Date(`${p.date}T12:00:00Z`).toUTCString()}</pubDate>
      <description>${escape(p.description ?? '')}</description>
      ${p.tags.map(t => `<category>${escape(t)}</category>`).join('')}
    </item>`).join('')

  setHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Amir Hossein Sadeghi — Writing</title>
    <link>${origin}/writing</link>
    <description>Notes from learning networking, building tools, and doing research.</description>
    <language>en</language>${items}
  </channel>
</rss>`
})
