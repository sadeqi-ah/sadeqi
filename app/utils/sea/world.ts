/**
 * The infinite archipelago.
 *
 * The ocean is cut into CELL × CELL squares; each square may hold one island,
 * decided by a hash of its coordinates, so the world is endless and yet the
 * same on every visit. An island is a smooth blend of four circles with a
 * wavy coastline, described by a signed distance (negative on land).
 *
 * Height is a function of that distance, evaluated twice from one source:
 *  - GLSL (WORLD_GLSL) displaces the terrain and colours the water by depth
 *  - JS (worldSdf / heightAt) keeps the boat off the beaches and puts every
 *    palm, rock and coral on the ground the GPU draws.
 * The GPU only sees the islands near the boat, uploaded as uniforms.
 */

export const CELL = 64
export const MAX_ISLES = 16
/** beyond this distance from its outline an island no longer shapes the sea floor */
export const REACH = 26

export type IslandKind = 0 | 1 | 2 // sandy, rocky, islet

export interface Island {
  key: string
  ci: number
  cj: number
  x: number
  z: number
  /** how far its circles reach from the centre */
  bound: number
  kind: IslandKind
  circles: [number, number, number][]
  /** coastline wobble phases */
  wob: [number, number, number]
  seed: number
  /** set for the hand-placed islands near the start */
  special?: 'home' | 'lighthouse'
}

/** mulberry32: small, fast, good enough for scenery */
export function rng(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const cellSeed = (i: number, j: number) => (Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ 0x51ed27) | 0

/** where the boat starts, and the two islands placed by hand around it */
export const SPAWN = { x: 30, z: 46, heading: 0 }
const FORCED: Record<string, { x: number, z: number, kind: IslandKind, size: number, special: Island['special'] }> = {
  '0,0': { x: 27, z: 12, kind: 0, size: 12, special: 'home' },
  '1,-1': { x: 84, z: -18, kind: 1, size: 10, special: 'lighthouse' },
}

const cache = new Map<string, Island | null>()

export function islandAt(ci: number, cj: number): Island | null {
  const key = `${ci},${cj}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const r = rng(cellSeed(ci, cj))
  const forced = FORCED[key]
  let isl: Island | null = null
  if (forced || r() < 0.52) {
    const kind: IslandKind = forced?.kind ?? (r() < 0.55 ? 0 : r() < 0.72 ? 1 : 2)
    const size = forced?.size ?? (kind === 2 ? 3.2 + r() * 2.2 : 7 + r() * 7)
    const x = forced?.x ?? (ci + 0.3 + r() * 0.4) * CELL
    const z = forced?.z ?? (cj + 0.3 + r() * 0.4) * CELL
    const circles: [number, number, number][] = [[x, z, size * 0.72]]
    let bound = size * 0.72
    for (let k = 1; k < 4; k++) {
      const a = r() * Math.PI * 2
      const dist = size * (kind === 2 ? 0.2 + r() * 0.3 : 0.3 + r() * 0.45)
      const rad = size * (0.32 + r() * 0.3)
      circles.push([x + Math.cos(a) * dist, z + Math.sin(a) * dist, rad])
      bound = Math.max(bound, dist + rad)
    }
    isl = {
      key, ci, cj, x, z, bound, kind, circles,
      wob: [r() * 6.283, r() * 6.283, r() * 6.283],
      seed: cellSeed(ci, cj) ^ 0x9e3779b9,
      special: forced?.special,
    }
  }
  cache.set(key, isl)
  return isl
}

const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}
const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** signed distance to one island's coast (negative inside) */
export function islandSdf(isl: Island, x: number, z: number) {
  let d = 1e4
  for (const [cx, cz, cr] of isl.circles) d = smin(d, Math.hypot(x - cx, z - cz) - cr, 5)
  const qx = x - isl.x
  const qz = z - isl.z
  return d
    + Math.sin(qx * 0.31 + isl.wob[0]) * Math.sin(qz * 0.27 + isl.wob[1]) * 1.3
    + Math.sin(qx * 0.83 - qz * 0.71 + isl.wob[2]) * 0.45
}

export interface WorldSample { d: number, isl: Island | null }

/** signed distance to the nearest coast anywhere in the world */
export function worldSdf(x: number, z: number, out: WorldSample = { d: 0, isl: null }): WorldSample {
  const ci = Math.floor(x / CELL)
  const cj = Math.floor(z / CELL)
  out.d = 1e4
  out.isl = null
  for (let j = cj - 1; j <= cj + 1; j++) {
    for (let i = ci - 1; i <= ci + 1; i++) {
      const isl = islandAt(i, j)
      if (!isl) continue
      const dx = x - isl.x
      const dz = z - isl.z
      if (dx * dx + dz * dz > (isl.bound + REACH) ** 2) continue
      const d = islandSdf(isl, x, z)
      if (d < out.d) {
        out.d = d
        out.isl = isl
      }
    }
  }
  return out
}

/** ground height for a coast distance; 0 is sea level */
export function heightFromSdf(d: number, kind: number) {
  if (d >= 0) return -1.25 * sstep(0, 3.5, d) - 7.5 * sstep(3, 22, d)
  const e = -d
  if (kind === 1) return 2.6 * sstep(0, 1.8, e) + 1.4 * sstep(2.5, 10, e)
  if (kind === 2) return 0.45 * sstep(0, 3, e)
  return 0.55 * sstep(0, 4, e) + 1.1 * sstep(3.5, 11, e)
}

const tmp: WorldSample = { d: 0, isl: null }
export function heightAt(x: number, z: number) {
  const s = worldSdf(x, z, tmp)
  return heightFromSdf(s.d, s.isl?.kind ?? 0)
}

/** outward direction of the coast at (x, z) (gradient of the distance) */
export function coastNormal(x: number, z: number) {
  const e = 0.25
  const dx = worldSdf(x + e, z, tmp).d - worldSdf(x - e, z, tmp).d
  const dz = worldSdf(x, z + e, tmp).d - worldSdf(x, z - e, tmp).d
  const l = Math.hypot(dx, dz) || 1
  return { x: dx / l, z: dz / l }
}

/** the islands whose influence reaches within `radius` of (x, z), nearest first */
export function islandsNear(x: number, z: number, radius: number) {
  const out: Island[] = []
  const n = Math.ceil(radius / CELL) + 1
  const ci = Math.floor(x / CELL)
  const cj = Math.floor(z / CELL)
  for (let j = cj - n; j <= cj + n; j++) {
    for (let i = ci - n; i <= ci + n; i++) {
      const isl = islandAt(i, j)
      if (isl && Math.hypot(isl.x - x, isl.z - z) - isl.bound - REACH < radius) out.push(isl)
    }
  }
  return out.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))
}

/**
 * GLSL twin of islandSdf / worldSdf / heightFromSdf. Reads the islands near
 * the boat from uniforms the engine fills each time the boat changes cell.
 */
export const WORLD_GLSL = /* glsl */ `
uniform vec4 uIsles[${MAX_ISLES}];        // x, z, bound, kind
uniform vec3 uIsleWob[${MAX_ISLES}];
uniform vec3 uCircles[${MAX_ISLES * 4}];  // x, z, r
uniform int uIsleCount;

float sminW(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float worldSdf(vec2 p, out float kind) {
  float d = 1e4;
  kind = 0.0;
  for (int i = 0; i < ${MAX_ISLES}; i++) {
    if (i >= uIsleCount) break;
    vec4 b = uIsles[i];
    vec2 q = p - b.xy;
    float reach = b.z + ${REACH.toFixed(1)};
    if (dot(q, q) > reach * reach) continue;
    float di = 1e4;
    for (int j = 0; j < 4; j++) {
      vec3 c = uCircles[i * 4 + j];
      di = sminW(di, length(p - c.xy) - c.z, 5.0);
    }
    vec3 w = uIsleWob[i];
    di += sin(q.x * 0.31 + w.x) * sin(q.y * 0.27 + w.y) * 1.3 + sin(q.x * 0.83 - q.y * 0.71 + w.z) * 0.45;
    if (di < d) { d = di; kind = b.w; }
  }
  return d;
}

float terrainH(float d, float kind) {
  if (d >= 0.0) return -1.25 * smoothstep(0.0, 3.5, d) - 7.5 * smoothstep(3.0, 22.0, d);
  float e = -d;
  if (kind > 0.5 && kind < 1.5) return 2.6 * smoothstep(0.0, 1.8, e) + 1.4 * smoothstep(2.5, 10.0, e);
  if (kind > 1.5) return 0.45 * smoothstep(0.0, 3.0, e);
  return 0.55 * smoothstep(0.0, 4.0, e) + 1.1 * smoothstep(3.5, 11.0, e);
}
`
