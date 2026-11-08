/**
 * The neighbours: a sea turtle that paddles alongside for a while, a pod of
 * dolphins that leaps beside the wake when you sail fast, crabs scuttling
 * sideways along the beaches (they wave their claws when you come close)
 * and, now and then, a whale that surfaces far off, spouts and dives.
 *
 * Everything is low-poly and vertex-coloured on the shared props material,
 * so it bends with the world like the islands do. Parts that move (flippers,
 * claws, the whale's tail) are their own meshes on pivots.
 */
import * as THREE from 'three'
import { Builder, mat4 } from './props'
import { coastNormal, heightFromSdf, islandSdf, islandsNear, worldSdf, type Island } from './world'
import type { SeaSynth } from './synth'
import type { Sparkles } from './fx'

export interface CritterEnv {
  scene: THREE.Scene
  props: THREE.Material
  synth: SeaSynth
  sparkles: Sparkles
  boat: { x: number, z: number, y: number, heading: number, speed: number }
  /** the camera sits this way round from the boat (heading convention, plus π) */
  camYaw: number
  clock: number
  night: number
  reduced: boolean
  seaY: (x: number, z: number) => number
  splash: (x: number, y: number, z: number, count: number, force: number) => void
  drop: (x: number, y: number, z: number, vx: number, vy: number, vz: number) => void
  ripple: (x: number, z: number, strength: number) => void
}

const clamp = THREE.MathUtils.clamp
const lerp = THREE.MathUtils.lerp
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

function mesh(b: Builder, mat: THREE.Material, shadow = true) {
  const m = new THREE.Mesh(b.build()!, mat)
  m.castShadow = shadow
  m.frustumCulled = false
  return m
}

/** two shiny cartoon eyes looking forward (-z) */
function eyes(b: Builder, x: number, y: number, z: number, r: number) {
  const white = new THREE.IcosahedronGeometry(r, 1)
  const pupil = new THREE.IcosahedronGeometry(r * 0.62, 1)
  const glint = new THREE.IcosahedronGeometry(r * 0.22, 0)
  for (const s of [-1, 1]) {
    b.add(white, '#ffffff', mat4([x * s, y, z]), 0, 0)
    b.add(pupil, '#1d1b22', mat4([x * s * 1.04, y, z - r * 0.5]), 0, 0)
    b.add(glint, '#ffffff', mat4([x * s * 1.04 + r * 0.2, y + r * 0.25, z - r * 0.95]), 0, 0)
  }
  ;[white, pupil, glint].forEach(g => g.dispose())
}

/** where along the boat's sides (+right, +ahead) is open water */
function openAt(x: number, z: number, clear = 3) {
  return worldSdf(x, z).d > clear
}

// ───────── turtle ─────────

class Turtle {
  group = new THREE.Group()
  private flippers: THREE.Object3D[] = []
  private head: THREE.Object3D
  private state: 'away' | 'swim' = 'away'
  private wait = 12 + Math.random() * 12
  private t = 0
  private dur = 0
  private x = 0
  private z = 0
  private y = -1.2
  private heading = 0
  private speed = 1.1

  constructor(private env: CritterEnv) {
    const b = new Builder()
    const dome = new THREE.SphereGeometry(0.55, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)
    b.add(dome, (v) => {
      // a patchwork of plates, darker at the rim
      const plate = (Math.floor(v.x * 3.2 + 10) + Math.floor(v.z * 2.6 + 10)) % 2
      return v.y < 0.12 ? '#3f8a49' : plate ? '#5aa85a' : '#7cc46b'
    }, mat4([0, 0, 0], [0, 0, 0], [1, 0.62, 1.2]), 0, 0.08)
    const belly = new THREE.SphereGeometry(0.55, 12, 4)
    b.add(belly, '#efe2b0', mat4([0, -0.01, 0], [0, 0, 0], [0.96, 0.14, 1.16]))
    const tail = new THREE.ConeGeometry(0.07, 0.25, 5)
    b.add(tail, '#94d28a', mat4([0, -0.02, 0.72], [Math.PI / 2, 0, 0]))
    ;[dome, belly, tail].forEach(g => g.dispose())
    this.group.add(mesh(b, env.props))

    const hb = new Builder()
    const skull = new THREE.SphereGeometry(0.2, 10, 8)
    hb.add(skull, '#94d28a', mat4([0, 0.02, -0.16], [0, 0, 0], [1, 0.9, 1.15]))
    eyes(hb, 0.11, 0.09, -0.27, 0.055)
    const cheek = new THREE.IcosahedronGeometry(0.04, 1)
    for (const s of [-1, 1]) hb.add(cheek, '#ff9fae', mat4([0.14 * s, 0.0, -0.26]), 0, 0)
    ;[skull, cheek].forEach(g => g.dispose())
    this.head = new THREE.Group()
    this.head.position.set(0, 0.05, -0.62)
    this.head.add(mesh(hb, env.props))
    this.group.add(this.head)

    const fl = new THREE.SphereGeometry(0.5, 8, 4)
    for (const [x, z, s] of [[0.45, -0.38, 1], [-0.45, -0.38, 1], [0.4, 0.5, 0.65], [-0.4, 0.5, 0.65]] as const) {
      const fb = new Builder()
      fb.add(fl, '#87c97c', mat4([Math.sign(x) * 0.22 * s, 0, 0.05], [0, -Math.sign(x) * 0.5, 0], [0.48 * s, 0.07, 0.2 * s]))
      const pivot = new THREE.Group()
      pivot.position.set(x, 0.0, z)
      pivot.add(mesh(fb, env.props))
      this.group.add(pivot)
      this.flippers.push(pivot)
    }
    fl.dispose()
    this.group.visible = false
    this.group.traverse((o) => { o.frustumCulled = false })
    env.scene.add(this.group)
  }

  step(dt: number) {
    const e = this.env
    const b = e.boat
    if (this.state === 'away') {
      this.wait -= dt
      if (this.wait > 0) return
      // come up somewhere beside the boat, heading roughly the same way
      for (let i = 0; i < 12; i++) {
        const a = b.heading + (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 1.2)
        const r = 7 + Math.random() * 6
        const x = b.x + Math.sin(a) * r
        const z = b.z - Math.cos(a) * r
        if (!openAt(x, z, 4)) continue
        this.x = x
        this.z = z
        this.y = -1.2
        this.heading = b.heading + (Math.random() - 0.5) * 0.8
        this.state = 'swim'
        this.t = 0
        this.dur = 16 + Math.random() * 8
        this.group.visible = true
        return
      }
      this.wait = 3
      return
    }
    this.t += dt
    // keep company: drift towards the boat's course and pace while it's near
    const dx = b.x - this.x
    const dz = b.z - this.z
    const d = Math.hypot(dx, dz)
    let want = this.heading
    if (d < 16 && Math.abs(b.speed) > 0.5) want = b.heading
    if (d > 12) want = Math.atan2(dx, -dz)
    if (d < 3.2) want = Math.atan2(-dx, dz)
    // and keep off the beaches
    const ahead = worldSdf(this.x + Math.sin(this.heading) * 3, this.z - Math.cos(this.heading) * 3).d
    if (ahead < 3) {
      const n = coastNormal(this.x, this.z)
      want = Math.atan2(n.x, -n.z)
    }
    this.heading += clamp(wrap(want - this.heading), -1, 1) * dt * 0.9
    const pace = clamp(Math.abs(b.speed) * 0.55, 0.9, 3.2)
    this.speed += (pace - this.speed) * (1 - Math.exp(-dt * 0.8))
    this.x += Math.sin(this.heading) * this.speed * dt
    this.z -= Math.cos(this.heading) * this.speed * dt

    const rise = smooth(0, 1.8, this.t) * (1 - smooth(this.dur - 2, this.dur, this.t))
    const surface = e.seaY(this.x, this.z) - 0.16
    this.y = lerp(-1.3, surface, rise)
    if (this.t - dt < 1.4 && this.t >= 1.4) e.ripple(this.x, this.z, 0.6)
    const g = this.group
    g.position.set(this.x, this.y, this.z)
    g.rotation.set(Math.sin(e.clock * 1.3) * 0.05 - (1 - rise) * 0.25, -this.heading, Math.sin(e.clock * 0.9) * 0.06, 'YXZ')
    // breaststroke: front flippers sweep, back ones paddle
    const st = e.clock * (2.2 + this.speed * 0.6)
    for (const [i, f] of this.flippers.entries()) {
      const s = i % 2 ? -1 : 1
      const front = i < 2
      f.rotation.y = s * (front ? Math.sin(st) * 0.55 : Math.sin(st + 1.5) * 0.35)
      f.rotation.z = s * (front ? Math.cos(st) * 0.25 : 0)
    }
    // pokes its head up and looks around, curious about you
    const look = d < 9 ? wrap(Math.atan2(dx, -dz) - this.heading) : Math.sin(e.clock * 0.7) * 0.5
    this.head.rotation.y = clamp(-look, -0.7, 0.7)
    this.head.rotation.x = -0.15 - Math.max(0, Math.sin(e.clock * 0.8)) * 0.25
    this.head.position.y = 0.05 + Math.max(0, Math.sin(e.clock * 0.8)) * 0.08

    if (this.t >= this.dur) {
      this.state = 'away'
      this.group.visible = false
      this.wait = 28 + Math.random() * 30
    }
  }
}

// ───────── dolphins ─────────

interface Dolphin { m: THREE.Mesh, side: number, along: number, period: number, phase: number, last: number, out: boolean }

class Pod {
  private dolphins: Dolphin[] = []
  private fast = 0
  private on = false
  private t = 0
  private cool = 6

  constructor(private env: CritterEnv) {
    const b = new Builder()
    const body = new THREE.SphereGeometry(1, 14, 10)
    b.add(body, v => (v.y < -0.25 ? '#e6eff7' : v.y < 0.1 ? '#9cc4e4' : '#6d9ccc'), mat4([0, 0, 0], [0, 0, 0], [0.42, 0.4, 1.3]), 0, 0.03)
    const snout = new THREE.CylinderGeometry(0.1, 0.15, 0.5, 8)
    b.add(snout, '#8ab6dc', mat4([0, -0.08, -1.38], [Math.PI / 2, 0, 0]))
    const fin = new THREE.ConeGeometry(0.22, 0.5, 4)
    b.add(fin, '#5f8fc2', mat4([0, 0.48, 0.1], [-0.55, 0, 0], [0.3, 1, 1]))
    for (const s of [-1, 1]) b.add(fin, '#6d9ccc', mat4([0.38 * s, -0.18, -0.35], [0.4, 0, s * 2.1], [0.25, 0.9, 0.6]))
    const fluke = new THREE.SphereGeometry(0.5, 8, 4)
    for (const s of [-1, 1]) b.add(fluke, '#5f8fc2', mat4([0.25 * s, 0.02, 1.38], [0, s * 0.6, 0], [0.42, 0.05, 0.18]))
    eyes(b, 0.25, 0.08, -0.92, 0.07)
    const smile = new THREE.TorusGeometry(0.12, 0.018, 4, 10, Math.PI * 0.8)
    b.add(smile, '#4b6f96', mat4([0, -0.14, -1.08], [Math.PI / 2 + 0.3, 0, Math.PI * 1.1]), 0, 0)
    ;[body, snout, fin, fluke, smile].forEach(g => g.dispose())
    const geo = b.build()!
    for (const [side, along, period] of [[-3.4, 1.5, 1.75], [3.8, -0.5, 1.9], [-5.2, -3, 1.65]] as const) {
      const m = new THREE.Mesh(geo, env.props)
      m.castShadow = true
      m.frustumCulled = false
      m.visible = false
      m.scale.setScalar(0.85)
      env.scene.add(m)
      this.dolphins.push({ m, side, along, period, phase: Math.random(), last: 0, out: false })
    }
  }

  step(dt: number) {
    const e = this.env
    const b = e.boat
    const fast = b.speed > 4.6
    this.fast = fast ? this.fast + dt : 0
    this.cool -= dt
    if (!this.on && this.fast > 2.2 && this.cool <= 0 && !e.reduced) {
      this.on = true
      this.t = 0
      this.dolphins.forEach((d, i) => { d.phase = -0.4 - i * 0.35 })
    }
    if (!this.on) return
    this.t += dt
    const leaving = this.t > 16 || (this.t > 4 && b.speed < 2.5)
    const fx = Math.sin(b.heading)
    const fz = -Math.cos(b.heading)
    let anyOut = false
    for (const d of this.dolphins) {
      d.phase += dt / d.period
      const p = d.phase - Math.floor(d.phase)
      // the first stretch of each cycle is the leap, the rest under water
      const air = 0.5
      const wasOut = d.out
      d.out = d.phase >= 0 && p < air && !(leaving && p < 0.05 && !wasOut)
      const along = d.along + Math.sin(e.clock * 0.4 + d.side) * 1.2
      const x = b.x + fx * along - fz * d.side
      const z = b.z + fz * along + fx * d.side
      if (d.out && !openAt(x, z, 1.5)) d.out = false
      if (d.out !== wasOut) {
        e.splash(x, 0, z, 9, 0.55)
        e.ripple(x, z, 0.6)
        if (d.out) e.synth.splash(0.12)
      }
      d.m.visible = d.out
      if (!d.out) continue
      anyOut = true
      const k = p / air
      const h = 1.5
      const y = h * Math.sin(Math.PI * k) - 0.35
      const vy = (h * Math.PI * Math.cos(Math.PI * k)) / (air * d.period)
      d.m.position.set(x, y, z)
      d.m.rotation.set(0, -b.heading, 0, 'YXZ')
      d.m.rotation.x = Math.atan2(vy, Math.max(b.speed, 3))
      d.m.rotation.z = Math.sin(e.clock * 3 + d.side) * 0.12
    }
    if (leaving && !anyOut) {
      this.on = false
      this.cool = 45 + Math.random() * 30
      this.dolphins.forEach((d) => { d.m.visible = false; d.out = false })
    }
  }
}

// ───────── crabs ─────────

interface Crab {
  g: THREE.Group
  legs: THREE.Object3D[]
  claws: THREE.Object3D[]
  home: Island | null
  x: number
  z: number
  dir: number
  walk: number
  pause: number
  wave: number
}

class Crabs {
  private crabs: Crab[] = []
  private timer = 0

  constructor(private env: CritterEnv, n: number) {
    const shell = new THREE.SphereGeometry(0.3, 10, 6)
    const stalk = new THREE.CylinderGeometry(0.025, 0.025, 0.18, 5)
    const claw = new THREE.SphereGeometry(0.13, 8, 6)
    const pincer = new THREE.ConeGeometry(0.06, 0.16, 5)
    const leg = new THREE.CylinderGeometry(0.025, 0.02, 0.32, 4)
    for (let i = 0; i < n; i++) {
      const colour = ['#ff6f59', '#ff8c42', '#f25c78'][i % 3]!
      const g = new THREE.Group()
      const b = new Builder()
      b.add(shell, v => (v.y < -0.05 ? '#ffd2b5' : colour), mat4([0, 0.2, 0], [0, 0, 0], [1.25, 0.6, 0.9]))
      for (const s of [-1, 1]) b.add(stalk, colour, mat4([0.1 * s, 0.38, -0.12]))
      eyes(b, 0.1, 0.5, -0.12, 0.065)
      const blush = new THREE.IcosahedronGeometry(0.045, 1)
      for (const s of [-1, 1]) b.add(blush, '#ffb3c1', mat4([0.22 * s, 0.24, -0.25]), 0, 0)
      blush.dispose()
      g.add(mesh(b, env.props))
      const legs: THREE.Object3D[] = []
      for (const s of [-1, 1]) {
        const lb = new Builder()
        for (const z of [-0.12, 0.02, 0.16]) lb.add(leg, colour, mat4([0.4 * s, 0.1, z], [0, 0, s * 1.0]))
        const pivot = new THREE.Group()
        pivot.add(mesh(lb, env.props))
        g.add(pivot)
        legs.push(pivot)
      }
      const claws: THREE.Object3D[] = []
      for (const s of [-1, 1]) {
        const cb = new Builder()
        cb.add(leg, colour, mat4([0, 0.12, -0.04], [0.6, 0, 0]))
        cb.add(claw, colour, mat4([0, 0.26, -0.14], [0, 0, 0], [0.9, 1.1, 0.8]))
        cb.add(pincer, colour, mat4([0.04, 0.38, -0.16], [0, 0, -0.3]))
        cb.add(pincer, colour, mat4([-0.04, 0.38, -0.16], [0, 0, 0.3]))
        const pivot = new THREE.Group()
        pivot.position.set(0.3 * s, 0.18, -0.18)
        pivot.add(mesh(cb, env.props))
        g.add(pivot)
        claws.push(pivot)
      }
      g.scale.setScalar(0.95)
      g.visible = false
      g.traverse((o) => { o.frustumCulled = false })
      env.scene.add(g)
      this.crabs.push({ g, legs, claws, home: null, x: 0, z: 0, dir: 1, walk: 0, pause: Math.random() * 2, wave: 0 })
    }
    ;[shell, stalk, claw, pincer, leg].forEach(g => g.dispose())
  }

  /** a spot on the wet sand of `isl`, at angle `a` from its centre */
  private beachSpot(isl: Island, a: number) {
    const cx = Math.cos(a)
    const cz = Math.sin(a)
    for (let r = 0; r < isl.bound + 14; r += 0.4) {
      const x = isl.x + cx * r
      const z = isl.z + cz * r
      if (islandSdf(isl, x, z) > -1.1) return { x, z }
    }
    return null
  }

  step(dt: number) {
    const e = this.env
    const b = e.boat
    this.timer -= dt
    if (this.timer <= 0) {
      // move crabs from far-away beaches to ones near the boat
      this.timer = 3
      const beaches = islandsNear(b.x, b.z, 45).filter(i => i.kind !== 1).slice(0, 3)
      for (const [i, c] of this.crabs.entries()) {
        const far = !c.home || Math.hypot(c.x - b.x, c.z - b.z) > 70
        if (!far) continue
        const isl = beaches[i % Math.max(beaches.length, 1)]
        if (!isl) {
          c.home = null
          c.g.visible = false
          continue
        }
        // face the boat's side of the island, more or less
        const a = Math.atan2(b.z - isl.z, b.x - isl.x) + (Math.random() - 0.5) * 2.4
        const spot = this.beachSpot(isl, a)
        if (!spot) continue
        c.home = isl
        c.x = spot.x
        c.z = spot.z
        c.g.visible = true
      }
    }
    for (const c of this.crabs) {
      if (!c.home) continue
      const near = Math.hypot(c.x - b.x, c.z - b.z) < 10
      // walk sideways along the waterline, stop, go back the other way
      if (c.pause > 0) {
        c.pause -= dt
        if (c.pause <= 0) {
          c.walk = 0.8 + Math.random() * 1.6
          if (Math.random() < 0.6) c.dir *= -1
        }
      }
      else {
        c.walk -= dt
        if (c.walk <= 0) c.pause = 0.6 + Math.random() * 2.2
      }
      const n = coastNormal(c.x, c.z)
      if (c.pause <= 0 && !near) {
        c.x += -n.z * c.dir * 0.9 * dt
        c.z += n.x * c.dir * 0.9 * dt
      }
      // stay on the line of wet sand
      const d = islandSdf(c.home, c.x, c.z)
      c.x -= n.x * (d + 1.1) * Math.min(1, dt * 4)
      c.z -= n.z * (d + 1.1) * Math.min(1, dt * 4)
      const y = heightFromSdf(Math.min(d, -0.4), c.home.kind)
      const walking = c.pause <= 0 && !near
      const st = e.clock * 16
      c.g.position.set(c.x, y + (walking ? Math.abs(Math.sin(st)) * 0.05 : 0), c.z)
      // face the sea (so walking along the shore is sideways)
      c.g.rotation.set(0, Math.atan2(-n.x, -n.z), walking ? Math.sin(st) * 0.08 : 0, 'YXZ')
      c.legs[0]!.rotation.z = walking ? Math.sin(st) * 0.35 : 0
      c.legs[1]!.rotation.z = walking ? -Math.sin(st + 1) * 0.35 : 0
      // the boat comes by: claws up, snip snip
      c.wave += ((near ? 1 : 0) - c.wave) * (1 - Math.exp(-dt * 5))
      for (const [i, cl] of c.claws.entries()) {
        const s = i ? 1 : -1
        cl.rotation.z = s * -c.wave * (0.9 + Math.sin(e.clock * 9 + i * 1.6) * 0.3)
        cl.rotation.x = -c.wave * 0.4 + (1 - c.wave) * Math.sin(e.clock * 2 + i) * 0.1
      }
    }
  }
}

// ───────── whale ─────────

class Whale {
  private root = new THREE.Group()
  private body = new THREE.Group()
  private tail = new THREE.Group()
  private wait = 30 + Math.random() * 25
  private t = -1
  private x = 0
  private z = 0
  private dir = 0
  private spouted = false
  private dove = false

  constructor(private env: CritterEnv) {
    const b = new Builder()
    const bodyG = new THREE.SphereGeometry(1, 18, 12)
    b.add(bodyG, (v) => {
      if (v.y < -0.35) return (Math.floor((v.x + 2) * 6) % 2) ? '#d8e6f2' : '#c6d8ea'
      return v.y < 0.05 ? '#5c86b8' : '#47709f'
    }, mat4([0, 0, 0], [0, 0, 0], [1.5, 1.15, 3.4]), 0, 0.03)
    const fin = new THREE.SphereGeometry(1, 8, 4)
    for (const s of [-1, 1]) b.add(fin, '#47709f', mat4([1.45 * s, -0.5, -0.9], [0.2, s * 0.5, s * 0.5], [0.9, 0.12, 0.4]))
    eyes(b, 1.18, 0.05, -2.1, 0.16)
    const blush = new THREE.IcosahedronGeometry(0.2, 1)
    for (const s of [-1, 1]) b.add(blush, '#ffb3c1', mat4([1.26 * s, -0.3, -1.95], [0, 0, 0], [0.5, 0.6, 1]), 0, 0)
    const hole = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 8)
    b.add(hole, '#2f4f78', mat4([0, 1.13, -1.1]))
    ;[bodyG, fin, blush, hole].forEach(g => g.dispose())
    this.body.add(mesh(b, env.props))

    const tb = new Builder()
    const stock = new THREE.CylinderGeometry(0.35, 0.65, 1.8, 10)
    tb.add(stock, '#47709f', mat4([0, 0, 0.9], [Math.PI / 2, 0, 0]))
    const fluke = new THREE.SphereGeometry(1, 10, 4)
    for (const s of [-1, 1]) tb.add(fluke, v => (v.y < 0 ? '#c6d8ea' : '#47709f'), mat4([0.85 * s, 0, 1.95], [0, s * 0.45, 0], [1.05, 0.12, 0.45]))
    ;[stock, fluke].forEach(g => g.dispose())
    this.tail.add(mesh(tb, env.props))
    this.tail.position.set(0, 0, 2.9)
    this.body.add(this.tail)
    this.root.add(this.body)
    this.root.visible = false
    this.root.traverse((o) => { o.frustumCulled = false })
    env.scene.add(this.root)
  }

  step(dt: number) {
    const e = this.env
    const b = e.boat
    if (this.t < 0) {
      this.wait -= dt
      if (this.wait > 0 || e.reduced) return
      this.wait = 3
      for (let i = 0; i < 10; i++) {
        // out in front of the camera, where you'll actually see it
        const a = -e.camYaw + (Math.random() - 0.5) * 1.8
        const r = 15 + Math.random() * 8
        const x = b.x + Math.sin(a) * r
        const z = b.z - Math.cos(a) * r
        const dir = a + Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1)
        // it needs plenty of deep water along its path
        if (!openAt(x, z, 9) || !openAt(x + Math.sin(dir) * 9, z - Math.cos(dir) * 9, 8)) continue
        this.x = x
        this.z = z
        this.dir = dir
        this.t = 0
        this.spouted = false
        this.dove = false
        this.root.visible = true
        e.synth.whale(r / 18)
        return
      }
      return
    }
    const DUR = 10
    this.t += dt
    const t = this.t
    this.x += Math.sin(this.dir) * 0.9 * dt
    this.z -= Math.cos(this.dir) * 0.9 * dt
    // up from the deep, a long cruise with the back out, then down tail-first
    const rise = smooth(0, 2, t)
    const dive = smooth(6.2, 9.4, t)
    const y = lerp(-3.6, -0.45, rise) - dive * 3.4 + Math.sin(t * 1.4) * 0.08
    this.root.position.set(this.x, y, this.z)
    this.root.rotation.set(0, -this.dir, 0)
    this.body.rotation.x = -0.12 * (1 - rise) - 0.55 * smooth(6, 8.2, t) + 0.25 * smooth(8.2, 9.6, t)
    this.tail.rotation.x = Math.sin(t * 1.6) * 0.18 * (1 - dive) - 0.9 * smooth(6.6, 8.4, t) * (1 - smooth(8.8, 9.8, t))
    this.root.scale.setScalar(1.15)
    if (!this.spouted && t > 2.2) {
      this.spouted = true
      e.synth.spout()
      e.ripple(this.x, this.z, 1.2)
    }
    // the spout: a fountain from the blowhole for a moment
    if (this.spouted && t < 3.1) {
      const hx = this.x + Math.sin(this.dir) * 1.3
      const hz = this.z - Math.cos(this.dir) * 1.3
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2
        const s = 0.4 + Math.random() * 0.7
        e.drop(hx, y + 1.4, hz, Math.cos(a) * s, 7 + Math.random() * 3, Math.sin(a) * s)
      }
    }
    if (!this.dove && t > 8.6) {
      this.dove = true
      const back = this.dir + Math.PI
      const tx = this.x + Math.sin(back) * 3.5
      const tz = this.z - Math.cos(back) * 3.5
      e.splash(tx, 0, tz, 26, 1)
      e.ripple(tx, tz, 1.4)
      e.synth.splash(0.35)
    }
    if (t >= DUR) {
      this.t = -1
      this.root.visible = false
      this.wait = 55 + Math.random() * 50
    }
  }
}

// ───────── all together ─────────

export class Critters {
  private turtle: Turtle
  private pod: Pod
  private crabs: Crabs
  private whale: Whale

  constructor(env: CritterEnv, mobile: boolean) {
    this.turtle = new Turtle(env)
    this.pod = new Pod(env)
    this.crabs = new Crabs(env, mobile ? 3 : 5)
    this.whale = new Whale(env)
  }

  step(dt: number) {
    this.turtle.step(dt)
    this.pod.step(dt)
    this.crabs.step(dt)
    this.whale.step(dt)
  }
}
