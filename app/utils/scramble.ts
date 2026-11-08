/**
 * Produce one animation frame of the "packets" decode effect.
 *
 * @param target   the final word, e.g. "packets"
 * @param progress 0 → 1 over the animation (~300ms)
 * @returns        a string of the same length as `target`
 *
 * At progress 0 every letter should be a random bit (0 or 1); as progress
 * grows, letters lock back into `target` from left to right; at 1 the
 * result must equal `target` exactly.
 */
export function scrambleFrame(target: string, progress: number): string {
  // TODO(human): implement the left→right 0/1 decode.
  return target
}
