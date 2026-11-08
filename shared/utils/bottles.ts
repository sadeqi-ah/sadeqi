/**
 * Messages in bottles — the guestbook on /guestbook.
 * Shared by the API (validation) and the page (form limits, rendering).
 */

/** One step of a melody: -1 is a rest, otherwise a row of MELODY_SCALE */
export type MelodyStep = number

export interface Bottle {
  id: string
  message: string
  name?: string
  /** MELODY_STEPS steps, or absent when the writer didn't compose one */
  melody?: MelodyStep[]
  createdAt: string
}

export interface BottleDraft {
  message: string
  name?: string
  melody?: MelodyStep[]
}

export const BOTTLE_LIMITS = {
  message: 400,
  name: 32,
} as const

/** Steps in a melody (a single bar of eighth notes) */
export const MELODY_STEPS = 8

/**
 * Rows of the melody grid, low to high: C major pentatonic over two octaves.
 * Pentatonic has no semitone clashes, so any tune someone taps sounds fine.
 */
export const MELODY_SCALE = [72, 74, 76, 79, 81, 84, 86] as const

export function isMelody(v: unknown): v is MelodyStep[] {
  return Array.isArray(v)
    && v.length === MELODY_STEPS
    && v.every(s => Number.isInteger(s) && s >= -1 && s < MELODY_SCALE.length)
}

export function hasNotes(melody?: MelodyStep[]) {
  return !!melody?.some(s => s >= 0)
}

/** Stable 0..1 from an id: glass tint, size and drift are derived from it */
export function idHash(id: string, salt = 0) {
  let h = 2166136261 ^ salt
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}
