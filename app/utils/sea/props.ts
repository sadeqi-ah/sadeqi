/**
 * Everything that grows on, stands on or sinks around an island, built from
 * primitives as low-poly, vertex-coloured geometry: palms, round trees,
 * bushes, flowers, rocks, coral, starfish, huts, docks, a lighthouse — and
 * the wooden hull shared by the player's boat and the rowboats at the docks.
 *
 * Each island's props are merged into a handful of geometries (one draw call
 * each). Placement is seeded by the island, so it looks the same every visit.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { heightFromSdf, islandSdf, rng, type Island } from './world'

type ColorFn = (local: THREE.Vector3) => THREE.ColorRepresentation
type SwayFn = (local: THREE.Vector3) => number

const _v = new THREE.Vector3()
const _c = new THREE.Color()
const UPV = new THREE.Vector3(0, 1, 0)

/** collects coloured parts and merges them into one geometry */
export class Builder {
  private parts: THREE.BufferGeometry[] = []
  constructor(private rand: () => number = Math.random) {}

  /** `color` null: keep the geometry's own colour attribute */
  add(src: THREE.BufferGeometry, color: THREE.ColorRepresentation | ColorFn | null, matrix: THREE.Matrix4, sway: number | SwayFn = 0, jitter = 0.06) {
    const g = src.index ? src.toNonIndexed() : src.clone()
    const own = color === null ? g.attributes.color : null
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
    if (!g.attributes.normal) g.computeVertexNormals()
    const pos = g.attributes.position!
    const n = pos.count
    const col = new Float32Array(n * 3)
    const sw = new Float32Array(n)
    const fixed = color === null || typeof color === 'function' ? null : new THREE.Color(color)
    for (let i = 0; i < n; i += 3) {
      // every triangle a touch lighter or darker: a painted, hand-made look
      const j = 1 + (this.rand() - 0.5) * jitter * 2
      for (let k = 0; k < 3 && i + k < n; k++) {
        _v.fromBufferAttribute(pos, i + k)
        if (own) _c.fromBufferAttribute(own as THREE.BufferAttribute, i + k)
        else if (fixed) _c.copy(fixed)
        else _c.set((color as ColorFn)(_v))
        col[(i + k) * 3] = _c.r * j
        col[(i + k) * 3 + 1] = _c.g * j
        col[(i + k) * 3 + 2] = _c.b * j
        sw[i + k] = typeof sway === 'function' ? sway(_v) : sway
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setAttribute('sway', new THREE.BufferAttribute(sw, 1))
    g.applyMatrix4(matrix)
    this.parts.push(g)
  }

  get empty() {
    return this.parts.length === 0
  }

  build() {
    if (!this.parts.length) return null
    const g = mergeGeometries(this.parts, false)
    this.parts.forEach(p => p.dispose())
    this.parts = []
    g.computeBoundingSphere()
    return g
  }
}

export function mat4(p: [number, number, number] | THREE.Vector3, r: [number, number, number] = [0, 0, 0], s: number | [number, number, number] = 1) {
  const pos = Array.isArray(p) ? new THREE.Vector3(...p) : p
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], 'YXZ'))
  const sc = typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s)
  return new THREE.Matrix4().compose(pos, q, sc)
}

/** a cylinder spanning two points */
function strut(b: Builder, a: THREE.Vector3, c: THREE.Vector3, r0: number, r1: number, color: THREE.ColorRepresentation, seg = 6, sway: number | SwayFn = 0) {
  const dir = c.clone().sub(a)
  const len = dir.length()
  const geo = new THREE.CylinderGeometry(r1, r0, len, seg, 1)
  geo.translate(0, len / 2, 0)
  const q = new THREE.Quaternion().setFromUnitVectors(UPV, dir.normalize())
  b.add(geo, color, new THREE.Matrix4().compose(a, q, new THREE.Vector3(1, 1, 1)), sway)
  geo.dispose()
}

// ───────── palette ─────────
const C = {
  trunk: ['#b98a55', '#9c7243'],
  frond: ['#5cc75b', '#44ab4c', '#7fd96a'],
  leaf: ['#6cc04a', '#58ad3e', '#83d35b', '#4f9f3a'],
  bark: '#8a5a3b',
  rock: ['#bdb3a8', '#a99f95', '#c9c0b6'],
  coral: ['#ff7aa8', '#ff9a5c', '#b48cff', '#58d6b8', '#ffd166', '#ff6f91', '#7ec8ff'],
  flower: ['#ff8fb1', '#fff4a3', '#ffffff', '#ffb36b', '#c9a7ff'],
  wood: ['#b07a49', '#a36d3e', '#bf8955'],
  post: '#6e4a2e',
  wall: '#f4ead6',
  roof: '#e4643f',
  roofDark: '#c4502f',
  door: '#7a4a2c',
  glow: '#ffe39a',
  stone: '#d2c9be',
  red: '#e2553f',
  white: '#fbf5ea',
}

const pick = <T>(arr: readonly T[], r: () => number) => arr[Math.floor(r() * arr.length)]!

// ───────── plants ─────────

/** a palm frond: a folded, serrated leaf that rises then droops, along +x */
function frondGeometry(len: number, width: number) {
  const N = 9
  const pos: number[] = []
  const st: [THREE.Vector3, THREE.Vector3, THREE.Vector3][] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const x = len * t
    const y = len * (0.3 * t - 0.62 * t * t)
    const w = width * Math.sin(Math.PI * Math.min(1, t * 1.04)) * (i % 2 ? 1 : 0.62)
    st.push([
      new THREE.Vector3(x, y - w * 0.35, -w),
      new THREE.Vector3(x, y + w * 0.12, 0),
      new THREE.Vector3(x, y - w * 0.35, w),
    ])
  }
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
  for (let i = 0; i < N; i++) {
    const [l0, m0, r0] = st[i]!
    const [l1, m1, r1] = st[i + 1]!
    tri(l0, m0, m1); tri(l0, m1, l1)
    tri(m0, r0, r1); tri(m0, r1, m1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

export function palm(b: Builder, x: number, y: number, z: number, r: () => number, leanX = 0, leanZ = 0, scale = 1) {
  const H = (3.6 + r() * 1.8) * scale
  const segs = 7
  const P = (t: number) => new THREE.Vector3(x + leanX * t * t, y + H * t, z + leanZ * t * t)
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs
    const t1 = (i + 1) / segs
    const r0 = (0.24 - 0.1 * t0) * scale
    strut(b, P(t0).add(new THREE.Vector3(0, -0.05, 0)), P(t1), r0, r0 * 0.86, C.trunk[i % 2]!, 6)
  }
  const top = P(1)
  const fronds = 7 + Math.floor(r() * 2)
  const a0 = r() * Math.PI * 2
  for (let k = 0; k < fronds; k++) {
    const len = (2.1 + r() * 0.7) * scale
    const g = frondGeometry(len, (0.42 + r() * 0.1) * scale)
    const ang = a0 + (k / fronds) * Math.PI * 2 + (r() - 0.5) * 0.4
    const tilt = (r() - 0.35) * 0.35
    const c1 = pick(C.frond, r)
    const c2 = C.frond[(C.frond.indexOf(c1) + 1) % C.frond.length]!
    b.add(g, v => (v.z < 0 ? c1 : c2), mat4(top, [0, ang, tilt]), v => Math.min(1, v.x / len) * 0.9 + 0.1)
    g.dispose()
  }
  const nut = new THREE.IcosahedronGeometry(0.15 * scale, 0)
  for (let k = 0; k < 3; k++) {
    const a = a0 + k * 2.1
    b.add(nut, '#6b4a2b', mat4([top.x + Math.cos(a) * 0.2 * scale, top.y - 0.18 * scale, top.z + Math.sin(a) * 0.2 * scale]))
  }
  nut.dispose()
}

export function roundTree(b: Builder, x: number, y: number, z: number, r: () => number, scale = 1) {
  const h = (1.3 + r() * 0.6) * scale
  strut(b, new THREE.Vector3(x, y - 0.1, z), new THREE.Vector3(x, y + h, z), 0.2 * scale, 0.13 * scale, C.bark, 6)
  const blob = new THREE.IcosahedronGeometry(1, 1)
  const n = 3 + Math.floor(r() * 2)
  for (let k = 0; k < n; k++) {
    const a = r() * Math.PI * 2
    const d = k === 0 ? 0 : (0.45 + r() * 0.3) * scale
    const s = (k === 0 ? 1.05 : 0.7 + r() * 0.25) * scale
    b.add(blob, pick(C.leaf, r), mat4([x + Math.cos(a) * d, y + h + 0.55 * scale + (k ? r() * 0.4 - 0.1 : 0.2), z + Math.sin(a) * d], [r(), r(), 0], [s, s * 0.88, s]), 0.25)
  }
  blob.dispose()
}

export function bush(b: Builder, x: number, y: number, z: number, r: () => number, flowers = false) {
  const blob = new THREE.IcosahedronGeometry(1, 1)
  const n = 2 + Math.floor(r() * 2)
  for (let k = 0; k < n; k++) {
    const s = 0.38 + r() * 0.3
    const a = r() * Math.PI * 2
    const d = k ? 0.35 + r() * 0.2 : 0
    b.add(blob, pick(C.leaf, r), mat4([x + Math.cos(a) * d, y + s * 0.45, z + Math.sin(a) * d], [r(), r(), 0], [s, s * 0.78, s]), 0.15)
  }
  blob.dispose()
  if (flowers) {
    const f = new THREE.IcosahedronGeometry(0.08, 0)
    const fc = pick(C.flower, r)
    for (let k = 0; k < 5; k++) {
      const a = r() * Math.PI * 2
      b.add(f, fc, mat4([x + Math.cos(a) * 0.45, y + 0.45 + r() * 0.25, z + Math.sin(a) * 0.45]), 0.15, 0)
    }
    f.dispose()
  }
}

export function flowerPatch(b: Builder, x: number, y: number, z: number, r: () => number) {
  const f = new THREE.IcosahedronGeometry(0.07, 0)
  const stem = new THREE.CylinderGeometry(0.015, 0.015, 0.22, 3)
  stem.translate(0, 0.11, 0)
  const fc = pick(C.flower, r)
  for (let k = 0; k < 6; k++) {
    const px = x + (r() - 0.5) * 0.9
    const pz = z + (r() - 0.5) * 0.9
    b.add(stem, '#4f9f3a', mat4([px, y, pz]), 0.4, 0)
    b.add(f, fc, mat4([px, y + 0.24, pz]), 0.5, 0)
  }
  f.dispose()
  stem.dispose()
}

export function rock(b: Builder, x: number, y: number, z: number, r: () => number, size = 1) {
  const g = new THREE.IcosahedronGeometry(1, 0)
  const s = size * (0.5 + r() * 0.8)
  b.add(g, pick(C.rock, r), mat4([x, y + s * 0.15, z], [r() * 3, r() * 3, r() * 3], [s, s * (0.55 + r() * 0.3), s * (0.8 + r() * 0.3)]), 0, 0.1)
  g.dispose()
}

export function starfish(b: Builder, x: number, y: number, z: number, r: () => number) {
  const shape = new THREE.Shape()
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2
    const rad = k % 2 ? 0.08 : 0.2
    if (k) shape.lineTo(Math.cos(a) * rad, Math.sin(a) * rad)
    else shape.moveTo(Math.cos(a) * rad, Math.sin(a) * rad)
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  b.add(g, pick(['#ff8a65', '#ff6f91', '#ffb347'], r), mat4([x, y + 0.02, z], [0, r() * 6, 0]))
  g.dispose()
}

export function coral(b: Builder, x: number, y: number, z: number, r: () => number) {
  const color = pick(C.coral, r)
  const s = 0.6 + r() * 0.7
  const type = r()
  if (type < 0.4) {
    // branching coral
    const tip = new THREE.IcosahedronGeometry(0.1 * s, 0)
    for (let k = 0; k < 5; k++) {
      const a = r() * Math.PI * 2
      const lean = 0.25 + r() * 0.5
      const h = (0.5 + r() * 0.6) * s
      const end = new THREE.Vector3(x + Math.cos(a) * lean * h, y + h, z + Math.sin(a) * lean * h)
      strut(b, new THREE.Vector3(x, y, z), end, 0.08 * s, 0.05 * s, color, 5, 0.35)
      b.add(tip, color, mat4(end), 0.4)
    }
    tip.dispose()
  }
  else if (type < 0.65) {
    // brain coral
    const g = new THREE.SphereGeometry(0.5 * s, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2)
    b.add(g, color, mat4([x, y - 0.05, z], [0, r() * 3, 0], [1, 0.65, 1]), 0, 0.12)
    g.dispose()
  }
  else if (type < 0.85) {
    // sea fan
    const g = new THREE.CircleGeometry(0.55 * s, 9, 0, Math.PI)
    b.add(g, color, mat4([x, y, z], [0, r() * 3, 0]), v => Math.min(1, v.y / (0.55 * s)) * 0.6, 0.1)
    g.dispose()
  }
  else {
    // tubes
    for (let k = 0; k < 4; k++) {
      const h = (0.3 + r() * 0.5) * s
      const g = new THREE.CylinderGeometry(0.1 * s, 0.12 * s, h, 6, 1, true)
      b.add(g, color, mat4([x + (r() - 0.5) * 0.4 * s, y + h / 2, z + (r() - 0.5) * 0.4 * s]), 0.25)
      g.dispose()
    }
  }
}

// ───────── buildings ─────────

export interface Lights {
  /** lantern glass and lit windows: drawn unlit */
  glow: Builder
  /** soft halos at night: position, colour, size */
  halos: { p: THREE.Vector3, c: THREE.ColorRepresentation, s: number }[]
}

export function hut(b: Builder, L: Lights, x: number, y: number, z: number, rot: number) {
  const m = (lx: number, ly: number, lz: number, r: [number, number, number] = [0, 0, 0], s: number | [number, number, number] = 1) => {
    const c = Math.cos(rot)
    const sn = Math.sin(rot)
    return mat4([x + lx * c + lz * sn, y + ly, z - lx * sn + lz * c], [r[0], r[1] + rot, r[2]], s)
  }
  const box = new THREE.BoxGeometry(1, 1, 1)
  b.add(box, C.wood[0]!, m(0, 0.15, 0, [0, 0, 0], [2.8, 0.3, 2.4]))
  b.add(box, C.wall, m(0, 1.05, 0, [0, 0, 0], [2.2, 1.5, 1.8]))
  // timber corners
  for (const [cx, cz] of [[-1.1, -0.9], [1.1, -0.9], [-1.1, 0.9], [1.1, 0.9]]) b.add(box, C.wood[1]!, m(cx!, 1.05, cz!, [0, 0, 0], [0.16, 1.5, 0.16]))
  const roof = new THREE.ConeGeometry(1, 1, 4)
  b.add(roof, v => (v.y > 0.1 ? C.roof : C.roofDark), m(0, 2.35, 0, [0, Math.PI / 4, 0], [2.0, 1.25, 1.75]))
  b.add(box, C.stone, m(0.6, 2.6, -0.3, [0, 0, 0], [0.28, 0.7, 0.28]))
  b.add(box, C.door, m(0, 0.75, 0.91, [0, 0, 0], [0.5, 0.95, 0.06]))
  // windows glow at night
  L.glow.add(box, C.glow, m(-1.11, 1.15, 0, [0, Math.PI / 2, 0], [0.5, 0.42, 0.05]))
  L.glow.add(box, C.glow, m(1.11, 1.15, 0, [0, Math.PI / 2, 0], [0.5, 0.42, 0.05]))
  // a lantern by the door
  L.glow.add(box, C.glow, m(0.5, 1.45, 1.0, [0, 0, 0], [0.16, 0.22, 0.16]))
  const lp = m(0.5, 1.45, 1.0)
  L.halos.push({ p: new THREE.Vector3().setFromMatrixPosition(lp), c: '#ffc46b', s: 2.2 })
  box.dispose()
  roof.dispose()
}

/** a crate or a barrel */
export function cargo(b: Builder, x: number, y: number, z: number, r: () => number) {
  if (r() < 0.5) {
    const g = new THREE.BoxGeometry(0.55, 0.55, 0.55)
    b.add(g, C.wood[2]!, mat4([x, y + 0.27, z], [0, r() * 3, 0]))
    g.dispose()
  }
  else {
    const g = new THREE.CylinderGeometry(0.26, 0.26, 0.6, 8)
    b.add(g, v => (Math.abs(v.y) > 0.18 && Math.abs(v.y) < 0.24 ? '#5b3b24' : '#9a6a3f'), mat4([x, y + 0.3, z]))
    g.dispose()
  }
}

export function dock(b: Builder, L: Lights, sx: number, sz: number, dx: number, dz: number, len: number, r: () => number) {
  const ang = Math.atan2(dx, dz)
  const deck = 0.55
  const plank = new THREE.BoxGeometry(1.8, 0.1, 0.3)
  for (let s = 0; s < len; s += 0.36) {
    b.add(plank, pick(C.wood, r), mat4([sx + dx * s, deck + (r() - 0.5) * 0.03, sz + dz * s], [0, ang + (r() - 0.5) * 0.04, 0]))
  }
  plank.dispose()
  const nx = dz
  const nz = -dx
  for (let s = 0.6; s < len; s += 2.2) {
    for (const side of [-1, 1]) {
      const px = sx + dx * s + nx * 0.85 * side
      const pz = sz + dz * s + nz * 0.85 * side
      strut(b, new THREE.Vector3(px, -2.5, pz), new THREE.Vector3(px, deck + 0.35, pz), 0.11, 0.1, C.post, 6)
    }
  }
  // lantern post at the end
  const ex = sx + dx * (len - 0.3) + nx * 0.8
  const ez = sz + dz * (len - 0.3) + nz * 0.8
  strut(b, new THREE.Vector3(ex, deck, ez), new THREE.Vector3(ex, deck + 2.1, ez), 0.07, 0.06, C.post, 5)
  const arm = new THREE.BoxGeometry(0.5, 0.06, 0.06)
  b.add(arm, C.post, mat4([ex - nx * 0.2, deck + 2.05, ez - nz * 0.2], [0, ang + Math.PI / 2, 0]))
  arm.dispose()
  const lantern = new THREE.BoxGeometry(0.22, 0.3, 0.22)
  const lx = ex - nx * 0.4
  const lz = ez - nz * 0.4
  L.glow.add(lantern, C.glow, mat4([lx, deck + 1.82, lz]))
  lantern.dispose()
  L.halos.push({ p: new THREE.Vector3(lx, deck + 1.82, lz), c: '#ffc46b', s: 3 })
  cargo(b, sx + dx * len * 0.55 - nx * 0.5, deck + 0.05, sz + dz * len * 0.55 - nz * 0.5, r)
  if (r() < 0.6) cargo(b, sx + dx * len * 0.6 - nx * 0.45, deck + 0.05, sz + dz * len * 0.6 - nz * 0.1, r)
  // a little rowboat tied up alongside
  const hull = hullGeometry(2.2, 0.95, 0.5)
  b.add(hull, null, mat4([sx + dx * (len - 1.4) - nx * 1.7, 0.05, sz + dz * (len - 1.4) - nz * 1.7], [0, ang + Math.PI, 0.04]), 0, 0.04)
  hull.dispose()
}

export function lighthouse(b: Builder, L: Lights, x: number, y: number, z: number) {
  const base = new THREE.CylinderGeometry(1.05, 1.25, 0.5, 10)
  b.add(base, C.stone, mat4([x, y + 0.2, z]))
  base.dispose()
  const H = 4.4
  const n = 6
  for (let i = 0; i < n; i++) {
    const t0 = i / n
    const t1 = (i + 1) / n
    const g = new THREE.CylinderGeometry(0.85 - 0.3 * t1, 0.85 - 0.3 * t0, H / n, 12)
    b.add(g, i % 2 ? C.white : C.red, mat4([x, y + 0.45 + H * (t0 + t1) / 2, z]))
    g.dispose()
  }
  const door = new THREE.BoxGeometry(0.35, 0.6, 0.1)
  b.add(door, C.door, mat4([x, y + 0.75, z + 0.83]))
  door.dispose()
  const top = y + 0.45 + H
  const deck = new THREE.CylinderGeometry(0.85, 0.85, 0.14, 12)
  b.add(deck, '#9e3b2c', mat4([x, top + 0.07, z]))
  deck.dispose()
  const rail = new THREE.TorusGeometry(0.78, 0.035, 4, 16)
  b.add(rail, '#9e3b2c', mat4([x, top + 0.42, z], [Math.PI / 2, 0, 0]))
  rail.dispose()
  const lamp = new THREE.CylinderGeometry(0.42, 0.42, 0.62, 10)
  L.glow.add(lamp, '#fff1b0', mat4([x, top + 0.45, z]))
  lamp.dispose()
  const roof = new THREE.ConeGeometry(0.62, 0.7, 10)
  b.add(roof, C.red, mat4([x, top + 1.1, z]))
  roof.dispose()
  const ball = new THREE.IcosahedronGeometry(0.1, 1)
  b.add(ball, C.red, mat4([x, top + 1.5, z]))
  ball.dispose()
  L.halos.push({ p: new THREE.Vector3(x, top + 0.45, z), c: '#ffe08a', s: 7 })
  return new THREE.Vector3(x, top + 0.45, z)
}

// ───────── hulls ─────────

/**
 * A wooden hull, bow towards -z: cross-sections lofted along its length, a
 * transom at the stern, a gunwale rim, a lighter inside and two seats.
 * Comes with its own vertex colours: planks, a painted band, the rim.
 */
export function hullGeometry(L = 3.2, W = 1.3, D = 0.75, floorY = D * 0.22) {
  const S = 14
  const K = 8
  const IN = 0.07
  const pos: number[] = []
  const col: number[] = []
  const st: { w: number, g: number, bot: number, z: number }[] = []
  for (let s = 0; s <= S; s++) {
    const u = s / S
    st.push({
      z: -L / 2 + L * u,
      w: (W / 2) * Math.sin(Math.PI * u * 0.62) ** 0.6,
      g: D * (0.9 + 0.4 * (1 - u) ** 3),
      bot: -D * (0.3 + 0.5 * Math.sin(Math.PI * Math.min(1, u * 0.85 + 0.08))),
    })
  }
  const pt = (s: number, k: number, inset = 0) => {
    const { w, g, bot, z } = st[s]!
    const th = (k / K) * Math.PI
    const ww = Math.max(0, w - inset)
    return new THREE.Vector3(-ww * Math.cos(th), g - (g - bot) * Math.sin(th) ** 0.8 + inset * 0.6 * Math.sin(th), z)
  }
  const c = new THREE.Color()
  const tri = (a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3, color: string) => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z)
    c.set(color)
    col.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b)
  }
  const quad = (a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3, e: THREE.Vector3, color: string) => {
    tri(a, b, d, color)
    tri(a, d, e, color)
  }
  const plank = (k: number) => {
    if (k === 0 || k === K - 1) return '#f3efe4'
    if (k === 1 || k === K - 2) return '#d9573f'
    return k % 2 ? '#a8683b' : '#b77744'
  }
  for (let s = 0; s < S; s++) {
    for (let k = 0; k < K; k++) {
      quad(pt(s, k), pt(s + 1, k), pt(s + 1, k + 1), pt(s, k + 1), plank(k))
      quad(pt(s, k, IN), pt(s, k + 1, IN), pt(s + 1, k + 1, IN), pt(s + 1, k, IN), s % 2 ? '#d9a66c' : '#cc9a60')
    }
    quad(pt(s, 0), pt(s, 0, IN), pt(s + 1, 0, IN), pt(s + 1, 0), '#7c4a2a')
    quad(pt(s, K), pt(s + 1, K), pt(s + 1, K, IN), pt(s, K, IN), '#7c4a2a')
  }
  const back = new THREE.Vector3(0, (st[S]!.g + st[S]!.bot) / 2, st[S]!.z)
  for (let k = 0; k < K; k++) tri(back, pt(S, k + 1), pt(S, k), plank(k))
  // seats across the boat
  for (const u of [0.42, 0.78]) {
    const s = st[Math.round(u * S)]!
    const y = s.g - 0.2
    const hw = s.w - 0.06
    const a = new THREE.Vector3(-hw, y, s.z - 0.14)
    const b = new THREE.Vector3(hw, y, s.z - 0.14)
    const d = new THREE.Vector3(hw, y, s.z + 0.14)
    const e = new THREE.Vector3(-hw, y, s.z + 0.14)
    quad(a, e, d, b, '#c48a52')
    quad(a, b, d, e, '#c48a52')
  }
  // a plank floor above the waterline, so the sea doesn't show inside
  const floorHalf = (s: number) => {
    const { w, g, bot } = st[s]!
    for (let i = 0; i <= 40; i++) {
      const th = Math.PI / 2 - (i / 40) * (Math.PI / 2)
      const y = g - (g - bot) * Math.sin(th) ** 0.8 + IN * 0.6 * Math.sin(th)
      if (y >= floorY) return Math.max(0, w - IN) * Math.cos(th)
    }
    return Math.max(0, w - IN)
  }
  for (let s = 0; s < S; s++) {
    const h0 = floorHalf(s)
    const h1 = floorHalf(s + 1)
    const z0 = st[s]!.z
    const z1 = st[s + 1]!.z
    const a = new THREE.Vector3(-h0, floorY, z0)
    const b = new THREE.Vector3(h0, floorY, z0)
    const d = new THREE.Vector3(h1, floorY, z1)
    const e = new THREE.Vector3(-h1, floorY, z1)
    const c = s % 2 ? '#d9a66c' : '#c99558'
    quad(a, e, d, b, c)
    quad(a, b, d, e, c)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

// ───────── decorating an island ─────────

export interface IslandDecor {
  land: THREE.BufferGeometry | null
  sea: THREE.BufferGeometry | null
  glow: THREE.BufferGeometry | null
  halos: Lights['halos']
  beams: THREE.Vector3[]
}

export function decorate(isl: Island, spawn: { x: number, z: number }): IslandDecor {
  const r = rng(isl.seed)
  const land = new Builder(r)
  const sea = new Builder(r)
  const L: Lights = { glow: new Builder(r), halos: [] }
  const beams: THREE.Vector3[] = []
  const placed: { x: number, z: number, r: number }[] = []
  const free = (x: number, z: number, rad: number) => placed.every(p => Math.hypot(p.x - x, p.z - z) > p.r + rad)
  const sample = () => {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * (isl.bound + 10)
    const x = isl.x + Math.cos(a) * d
    const z = isl.z + Math.sin(a) * d
    const sd = islandSdf(isl, x, z)
    return { x, z, sd, h: heightFromSdf(sd, isl.kind) }
  }
  const scatter = (n: number, ok: (s: ReturnType<typeof sample>) => boolean, rad: number, put: (s: ReturnType<typeof sample>) => void) => {
    for (let tries = 0, k = 0; k < n && tries < n * 30; tries++) {
      const s = sample()
      if (!ok(s) || !free(s.x, s.z, rad)) continue
      placed.push({ x: s.x, z: s.z, r: rad })
      put(s)
      k++
    }
  }
  /** first point of the coast walking out from the centre */
  const coastAlong = (dx: number, dz: number) => {
    for (let t = 0; t < isl.bound + 12; t += 0.2) {
      if (islandSdf(isl, isl.x + dx * t, isl.z + dz * t) > 0) return t
    }
    return isl.bound
  }

  // a dock with a hut, facing the start on the home island
  const wantsDock = isl.special === 'home' || (isl.kind === 0 && r() < 0.4) || (isl.kind === 1 && !isl.special && r() < 0.25)
  if (wantsDock) {
    let dx: number
    let dz: number
    if (isl.special === 'home') {
      dx = spawn.x - isl.x
      dz = spawn.z - isl.z
    }
    else {
      const a = r() * Math.PI * 2
      dx = Math.cos(a)
      dz = Math.sin(a)
    }
    const l = Math.hypot(dx, dz)
    dx /= l
    dz /= l
    const t = coastAlong(dx, dz)
    const cx = isl.x + dx * t
    const cz = isl.z + dz * t
    dock(land, L, cx - dx * 2, cz - dz * 2, dx, dz, 9, r)
    placed.push({ x: cx, z: cz, r: 2.6 }, { x: cx + dx * 4, z: cz + dz * 4, r: 4.5 })
    const hx = cx - dx * 5.2
    const hz = cz - dz * 5.2
    const hs = islandSdf(isl, hx, hz)
    hut(land, L, hx, heightFromSdf(hs, isl.kind) - 0.05, hz, Math.atan2(dx, dz))
    placed.push({ x: hx, z: hz, r: 2.6 })
    cargo(land, hx + dz * 1.8, heightFromSdf(islandSdf(isl, hx + dz * 1.8, hz - dx * 1.8), isl.kind), hz - dx * 1.8, r)
  }

  // a lighthouse on the highest ground
  if (isl.special === 'lighthouse' || (isl.kind === 1 && r() < 0.35)) {
    let best = { x: isl.x, z: isl.z, sd: 0 }
    for (let k = 0; k < 40; k++) {
      const s = sample()
      if (s.sd < best.sd) best = s
    }
    const h = heightFromSdf(best.sd, isl.kind)
    beams.push(lighthouse(land, L, best.x, h - 0.1, best.z))
    placed.push({ x: best.x, z: best.z, r: 2.4 })
  }

  if (isl.kind === 0 || isl.kind === 2) {
    // palms lean out towards the sea
    const n = isl.kind === 2 ? 1 + Math.floor(r() * 2) : 6 + Math.floor(r() * 8)
    scatter(n, s => s.sd < -1.6 && s.sd > -(isl.bound * 0.9), 1.6, (s) => {
      const ox = s.x - isl.x
      const oz = s.z - isl.z
      const ol = Math.hypot(ox, oz) || 1
      const lean = 0.6 + r() * 1.3
      palm(land, s.x, s.h, s.z, r, (ox / ol) * lean, (oz / ol) * lean, 0.85 + r() * 0.35)
    })
  }
  if (isl.kind === 1) {
    scatter(5 + Math.floor(r() * 5), s => s.h > 2.3, 1.8, s => roundTree(land, s.x, s.h, s.z, r, 0.9 + r() * 0.4))
  }
  if (isl.kind !== 2) {
    scatter(isl.kind === 0 ? 7 + Math.floor(r() * 7) : 6, s => s.h > (isl.kind === 0 ? 0.7 : 2.3), 0.9, s => bush(land, s.x, s.h, s.z, r, r() < 0.4))
    scatter(5 + Math.floor(r() * 6), s => s.h > (isl.kind === 0 ? 0.75 : 2.4), 0.6, s => flowerPatch(land, s.x, s.h, s.z, r))
  }
  // rocks along the shore, some standing in the water
  scatter(isl.kind === 1 ? 9 : 4 + Math.floor(r() * 3), s => s.sd > -0.8 && s.sd < 2.2, 1.0, s => rock(land, s.x, Math.max(s.h, -0.6), s.z, r, isl.kind === 1 ? 1.3 : 0.9))
  if (isl.kind !== 1) scatter(3 + Math.floor(r() * 4), s => s.sd > -2.2 && s.sd < -0.5, 0.5, s => starfish(land, s.x, s.h, s.z, r))
  // coral on the shelf around the island
  scatter(isl.kind === 2 ? 8 : 18 + Math.floor(r() * 14), s => s.sd > 1.2 && s.sd < 9 && s.h > -4.5, 0.8, s => coral(sea, s.x, s.h, s.z, r))

  return { land: land.build(), sea: sea.build(), glow: L.glow.build(), halos: L.halos, beams }
}
