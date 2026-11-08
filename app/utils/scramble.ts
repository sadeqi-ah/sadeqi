/**
 * Produce one animation frame of the "packets" decode effect.
 *
 * @param target   the final word, e.g. "packets"
 * @param progress 0 → 1 over the animation (~300ms)
 * @returns        a string of the same length as `target`
 *
 * At progress 0 every letter is a random bit (0 or 1); as progress grows,
 * letters lock back into `target` from left to right; at 1 the result equals
 * `target` exactly.
 *
 * Choices:
 *  - boundary uses `Math.floor`, so the last letter locks only at the very end
 *  - bits are re-rolled every frame (more shimmer)
 *  - a soft edge of SOFT characters past the boundary sometimes flashes the
 *    right letter early, which makes the decode feel organic
 */
const SOFT = 2

export function scrambleFrame(target: string, progress: number): string {
  const n = target.length
  if (progress >= 1) return target

  const p = Math.max(0, progress)
  const locked = Math.floor(p * n)
  let out = ''

  for (let i = 0; i < n; i++) {
    const ch = target[i]!
    if (i < locked || ch === ' ') {
      out += ch
    }
    else if (p > 0 && i < locked + SOFT && Math.random() < 0.45 * (1 - (i - locked) / SOFT)) {
      out += ch
    }
    else {
      out += Math.random() < 0.5 ? '0' : '1'
    }
  }
  return out
}
