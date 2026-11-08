/**
 * Throw a bottle. Plain-text notes only, no links: spam gets nothing out of
 * it. Bots are turned away by a honeypot field, a minimum time spent writing,
 * and a per-IP rate limit (in memory: per server instance, which is fine for
 * a personal site).
 */
import { BOTTLE_LIMITS, hasNotes, isMelody, type Bottle } from '#shared/utils/bottles'

/** 12 hex chars from the Web Crypto RNG (global in Node ≥ 19 and on edge runtimes) */
function newId() {
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join('')
}

const WINDOW_MS = 10 * 60 * 1000
const PER_WINDOW = 3
const hits = new Map<string, number[]>()

function limited(ip: string) {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter(t => now - t < WINDOW_MS)
  if (recent.length >= PER_WINDOW) return true
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear() // never grows without bound
  return false
}

/** collapse runs of blank lines, drop control and bidi-override characters
 *  (but keep ZWNJ/ZWJ: Persian needs them), trim */
function clean(s: unknown, max: number) {
  if (typeof s !== 'string') return ''
  return s
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F\u200B\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|ru|xyz|top|info|ir|me)\b)/i

export default defineEventHandler(async (event): Promise<Bottle> => {
  const body = await readBody<Record<string, unknown>>(event)

  // honeypot and time-to-write: quietly pretend it worked
  const elapsed = Number(body?.elapsed)
  if (body?.website || !(elapsed > 2500)) {
    return { id: newId(), message: '', createdAt: new Date().toISOString() }
  }

  const message = clean(body?.message, BOTTLE_LIMITS.message)
  const name = clean(body?.name, BOTTLE_LIMITS.name).replace(/\n/g, ' ') || undefined
  const melody = isMelody(body?.melody) && hasNotes(body.melody) ? body.melody : undefined

  if (message.length < 2) throw createError({ statusCode: 422, statusMessage: 'The note is empty.' })
  if (LINK.test(message) || (name && LINK.test(name)))
    throw createError({ statusCode: 422, statusMessage: 'No links in bottles, please.' })

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (limited(ip)) throw createError({ statusCode: 429, statusMessage: 'The sea needs a moment. Try again in a few minutes.' })

  const bottle: StoredBottle = {
    id: newId(),
    message,
    name,
    melody,
    createdAt: new Date().toISOString(),
    status: useRuntimeConfig(event).bottlesModerate ? 'pending' : 'published',
    ip,
  }
  await saveBottle(bottle)
  return toPublic(bottle)
})
