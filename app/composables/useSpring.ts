export interface SpringOptions {
  stiffness?: number
  damping?: number
  mass?: number
}

/**
 * A tiny physics spring driven by requestAnimationFrame.
 * `set()` retargets the spring; per-call options let callers make one
 * edge of a shape snappier than the other (used for the gooey nav blob).
 */
export function useSpring(initial = 0, defaults: SpringOptions = {}) {
  const value = ref(initial)
  let target = initial
  let velocity = 0
  let raf = 0
  let last = 0
  let { stiffness = 170, damping = 26, mass = 1 } = defaults

  const reduced = import.meta.client
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : true

  function step(now: number) {
    // Clamp dt so a backgrounded tab does not explode the integration.
    const dt = Math.min((now - last) / 1000, 1 / 30)
    last = now
    const force = -stiffness * (value.value - target) - damping * velocity
    velocity += (force / mass) * dt
    value.value += velocity * dt

    if (Math.abs(velocity) < 0.02 && Math.abs(value.value - target) < 0.02) {
      value.value = target
      velocity = 0
      raf = 0
      return
    }
    raf = requestAnimationFrame(step)
  }

  function set(next: number, opts: SpringOptions & { immediate?: boolean } = {}) {
    target = next
    if (opts.stiffness) stiffness = opts.stiffness
    if (opts.damping) damping = opts.damping
    if (opts.mass) mass = opts.mass

    if (opts.immediate || reduced) {
      cancelAnimationFrame(raf)
      raf = 0
      velocity = 0
      value.value = next
      return
    }
    if (!raf) {
      last = performance.now()
      raf = requestAnimationFrame(step)
    }
  }

  onScopeDispose(() => cancelAnimationFrame(raf))

  return { value: readonly(value), set }
}
