/**
 * A handful of random bottles to float on the sea, plus the total.
 * `?mine=id,id` adds the visitor's own bottles (ids kept in localStorage),
 * so the one you just threw is still out there after a reload — even when
 * it's pending moderation.
 */
import type { Bottle } from '#shared/utils/bottles'

const SAMPLE = 14

export default defineEventHandler(async (event): Promise<{ bottles: Bottle[], total: number }> => {
  const mine = String(getQuery(event).mine ?? '')
    .split(',')
    .filter(id => /^[a-z0-9]{6,16}$/.test(id))
    .slice(0, 5)

  const all = await listBottles()
  const published = all.filter(b => b.status === 'published')
  const own = all.filter(b => mine.includes(b.id))
  const rest = published.filter(b => !mine.includes(b.id))

  // Fisher–Yates on a copy, take what fits next to the visitor's own
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j]!, rest[i]!]
  }

  setResponseHeader(event, 'cache-control', 'no-store')
  return {
    bottles: [...own, ...rest.slice(0, Math.max(0, SAMPLE - own.length))].map(toPublic),
    total: published.length,
  }
})
