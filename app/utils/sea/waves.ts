/**
 * The swell: a height field made of a few travelling sine waves — gentle,
 * cartoon-sized rather than a physical ocean.
 *
 * The same table is evaluated twice: in GLSL (generated below) for the water
 * surface, and in JS so the boat and the bottles ride exactly the waves the
 * GPU draws.
 */

interface Wave {
  dir: [number, number]
  length: number
  amp: number
  speed: number
}

export const WAVES: readonly Wave[] = [
  { dir: [1, 0.3], length: 6.5, amp: 0.12, speed: 0.9 },
  { dir: [-0.4, 1], length: 4.2, amp: 0.075, speed: 1.1 },
  { dir: [0.7, -1], length: 2.6, amp: 0.04, speed: 1.4 },
]

const W = WAVES.map(({ dir, length, amp, speed }) => {
  const n = Math.hypot(dir[0], dir[1])
  const k = (2 * Math.PI) / length
  return { dx: (dir[0] / n) * k, dz: (dir[1] / n) * k, w: speed * k * 0.35, a: amp }
})

const f = (n: number) => n.toFixed(6)

/** GLSL: `float seaHeight(vec2 p, float t)` */
export const SEA_GLSL = /* glsl */ `
float seaHeight(vec2 p, float t) {
  float h = 0.0;
  ${W.map(w => `h += ${f(w.a)} * sin(dot(p, vec2(${f(w.dx)}, ${f(w.dz)})) - ${f(w.w)} * t);`).join('\n  ')}
  return h;
}
`

export interface SurfacePoint {
  y: number
  nx: number
  ny: number
  nz: number
}

/** height and normal of the surface at (x, z), diorama-local */
export function sampleSurface(x: number, z: number, t: number, out: SurfacePoint): SurfacePoint {
  let y = 0
  let gx = 0
  let gz = 0
  for (const w of W) {
    const ph = w.dx * x + w.dz * z - w.w * t
    y += w.a * Math.sin(ph)
    const c = w.a * Math.cos(ph)
    gx += c * w.dx
    gz += c * w.dz
  }
  const l = Math.hypot(gx, 1, gz)
  out.y = y
  out.nx = -gx / l
  out.ny = 1 / l
  out.nz = -gz / l
  return out
}
