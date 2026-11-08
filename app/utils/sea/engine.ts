/**
 * The guestbook game: sail an endless archipelago in a little wooden boat,
 * fish messages in bottles out of the sea and read them, write your own and
 * throw it overboard.
 *
 * Framework-free. Game.vue owns the DOM (HUD, the letter) and drives this
 * through a few async methods — open / close / seal / throwHeld — each of
 * which resolves when its animation has finished; the engine reports back
 * through `events`.
 *
 * Space: world units are metres, y up, sea level 0. The boat's heading `a`
 * points along (sin a, -cos a). The world is bent around the camera's target
 * (see materials.ts), so anything compared with what's on screen — picking,
 * the off-screen bottle pointer — goes through `bent()`. Things "in your
 * hands" are parented to the camera and drawn without the bend.
 */
import * as THREE from 'three'
import type { Bottle } from '#shared/utils/bottles'
import { idHash } from '#shared/utils/bottles'
import { MAX_ISLES, SPAWN, coastNormal, islandsNear, worldSdf } from './world'
import {
  MAX_RINGS, MAX_RIPPLES, MAX_TRAIL, U, curved, haloMaterial, paperShader, propsMaterial, setBend,
  skyMaterial, skyU, terrainColors, terrainMaterial, waterColors, waterMaterial, waterU,
} from './materials'
import { Builder, decorate, mat4 } from './props'
import { createBoat, type BoatModel } from './boat'
import { CORK_Y, INNER, createBottle, disposeBottle, type BottleMesh } from './bottle'
import { sampleSurface, type SurfacePoint } from './waves'
import type { SeaSynth } from './synth'

// ───────── tuning ─────────
const CAM_YAW = 0.6
const CAM_PITCH = 0.92
const ZOOM = { min: 15, max: 58, start: 30 }
const MAX_SPEED = 7.5
const BOOST = 1.5
const TURN = 1.7
const PICK_DIST = 4.8
const HOLD_DEPTH = 4
const HOLD_SCALE = 0.62
const GRID = { n: 240, inner: 30, extent: 130 }
const SNAP = GRID.inner / (GRID.n / 4)
const WIND = new THREE.Vector2(0.8, -0.6).normalize()

// ───────── palette ─────────
const DAY = {
  skyTop: '#55b4ff', fog: '#cdeeff', sunGlow: '#fff2c9',
  shallow: '#a2f7ea', mid: '#3fd8d2', deep: '#1fa9d8', ocean: '#1677c4', foam: '#ffffff', skyRefl: '#e6fbff', spec: '#ffffff',
  sun: '#fff1da', sunI: 2.7, hemiSky: '#cfeeff', hemiGround: '#ffe3b8', hemiI: 1.3,
  caustic: 1, beacon: '#fff1b8', cloudGlow: 0.32, exposure: 1.0,
}
const NIGHT = {
  skyTop: '#050a22', fog: '#172a50', sunGlow: '#000000',
  shallow: '#3c8aa3', mid: '#22618c', deep: '#17487a', ocean: '#0d2b57', foam: '#c4ecff', skyRefl: '#3d5a8c', spec: '#c8d6ff',
  sun: '#9db4ff', sunI: 1.0, hemiSky: '#2c4277', hemiGround: '#0e1930', hemiI: 0.85,
  caustic: 0.3, beacon: '#9ff2ff', cloudGlow: 0.04, exposure: 1.1,
}
const SUN_DIR = new THREE.Vector3(0.35, 0.8, -0.5).normalize()
const MOON_DIR = new THREE.Vector3(-0.45, 0.72, -0.55).normalize()

// ───────── helpers ─────────
const ease = {
  out: (t: number) => 1 - (1 - t) ** 3,
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  in: (t: number) => t * t * t,
  back: (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2,
  lin: (t: number) => t,
}
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const clamp = THREE.MathUtils.clamp
const lerp = THREE.MathUtils.lerp

interface Tween { t: number, dur: number, fn: (k: number) => void, done: () => void }
interface Pose { pos: THREE.Vector3, quat: THREE.Quaternion, scale: number }

interface Floating {
  id: string
  mesh: BottleMesh
  state: 'float' | 'away'
  x: number
  z: number
  y: number
  vy: number
  vx: number
  vz: number
  sq: number
  sqv: number
  yaw: number
  seed: number
  delay: number
  hover: number
  read: boolean
  beacon: number
}

interface Gull {
  g: THREE.Group
  wl: THREE.Object3D
  wr: THREE.Object3D
  cx: number
  cz: number
  tx: number
  tz: number
  r: number
  h: number
  a: number
  w: number
  phase: number
}

interface Cloud { mesh: THREE.Mesh, mat: THREE.MeshLambertMaterial, x: number, z: number, y: number, speed: number }

export interface SeaEvents {
  ready?: () => void
  /** the boat is (or no longer is) close enough to fish a bottle out */
  near?: (id: string | null) => void
  pick?: (id: string) => void
  landed?: (id: string) => void
  /** first time the player steers */
  moved?: () => void
  /** every bottle out here has been read */
  needMore?: () => void
}

export interface SeaOptions {
  synth: SeaSynth
  reducedMotion: boolean
  events: SeaEvents
  /** off-screen pointer to the nearest unread bottle */
  hud: { pointer: HTMLElement, label: HTMLElement }
}

/** a grid in xz: even 0.5 m spacing in the middle, stretching out towards the edges */
function warpedGrid() {
  const { n, inner, extent } = GRID
  const half = n / 2
  const i0 = n / 4
  const s = inner / i0
  const m = half - i0
  const b = (extent - inner - s * m) / (m * m)
  const f = (i: number) => {
    const a = Math.abs(i)
    const v = a <= i0 ? a * s : inner + s * (a - i0) + b * (a - i0) ** 2
    return Math.sign(i) * v
  }
  const pos = new Float32Array((n + 1) * (n + 1) * 3)
  const nrm = new Float32Array((n + 1) * (n + 1) * 3)
  let k = 0
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      nrm[k + 1] = 1
      pos[k++] = f(i - half)
      pos[k++] = 0
      pos[k++] = f(j - half)
    }
  }
  const idx: number[] = []
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i
      idx.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  g.setIndex(idx)
  return g
}

export class SeaEngine {
  static supported() {
    try {
      return !!document.createElement('canvas').getContext('webgl2')
    }
    catch { return false }
  }

  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(40, 1, 0.3, 900)
  private fog: THREE.Fog
  private sun = new THREE.DirectionalLight()
  private hemi = new THREE.HemisphereLight()
  private sky: THREE.Mesh
  private terrain: THREE.Mesh
  private water: THREE.Mesh
  private propsMat: THREE.MeshLambertMaterial
  private glowMat: THREE.MeshBasicMaterial
  private haloMat: THREE.ShaderMaterial
  private beamMat: THREE.MeshBasicMaterial
  private decor = new Map<string, { group: THREE.Group, beams: THREE.Object3D[] }>()
  private streamKey = ''
  private boatModel: BoatModel
  private boat = { x: SPAWN.x, z: SPAWN.z, y: 0, heading: SPAWN.heading, speed: 0, turn: 0, lastTrail: 0, lastThud: -9 }
  private keys = new Set<string>()
  private dest: THREE.Vector2 | null = null
  private destStop = 1.6
  private marker: THREE.Mesh
  private markerMat: THREE.MeshBasicMaterial
  private camTarget = new THREE.Vector3(SPAWN.x, 0, SPAWN.z)
  private zoom = ZOOM.start
  private zoomGoal = ZOOM.start
  private shake = 0
  private bottles = new Map<string, Floating>()
  private nearId: string | null = null
  private hoverId: string | null = null
  private trail: THREE.Vector4[]
  private trailIdx = 0
  private ripples: THREE.Vector4[]
  private rippleIdx = 0
  private drops: { mesh: THREE.InstancedMesh, pos: Float32Array, vel: Float32Array, life: Float32Array, next: number }
  private clouds: Cloud[] = []
  private gulls: Gull[] = []
  private fish: { mesh: THREE.Mesh, t: number, wait: number, from: THREE.Vector2, dir: THREE.Vector2 }
  private tweens = new Set<Tween>()
  private raycaster = new THREE.Raycaster()
  private surf: SurfacePoint = { y: 0, nx: 0, ny: 1, nz: 0 }
  private night = 0
  private nightTarget = 0
  private clock = 0
  private waveTime = 0
  private raf = 0
  private running = false
  private started = false
  private disposed = false
  private visible = true
  private last = 0
  private paper?: { mesh: THREE.Mesh, mat: THREE.ShaderMaterial, w: number, h: number }
  private held?: Floating
  private reading?: Floating
  private gesture?: { id: number, x: number, y: number, t: number, samples: { x: number, y: number, t: number }[], moved: boolean }
  private pinch?: { d: number, zoom: number }
  private pointers = new Map<number, { x: number, y: number }>()
  private controls = true
  private hasMoved = false
  private ro: ResizeObserver
  private io: IntersectionObserver
  private dpr: number
  private frameTimes: number[] = []
  private timers = { relocate: 0, chime: 6, gull: 9, more: 0 }
  phase: 'idle' | 'busy' | 'holding' = 'idle'

  constructor(private canvas: HTMLCanvasElement, private opts: SeaOptions) {
    const mobile = matchMedia('(pointer: coarse)').matches
    this.dpr = Math.min(devicePixelRatio, mobile ? 1.5 : 1.75)

    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    r.setPixelRatio(this.dpr)
    r.outputColorSpace = THREE.SRGBColorSpace
    r.toneMapping = THREE.NeutralToneMapping
    r.shadowMap.enabled = true
    r.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer = r

    this.fog = new THREE.Fog(DAY.fog, 58, 128)
    this.scene.fog = this.fog
    this.scene.background = this.fog.color
    this.scene.add(this.camera)

    // light: a warm sun with soft shadows, sky-blue fill from above, sand-warm from below
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048)
    const sc = this.sun.shadow.camera
    sc.left = -40
    sc.right = 40
    sc.top = 40
    sc.bottom = -40
    sc.near = 1
    sc.far = 220
    this.sun.shadow.bias = -0.0005
    this.sun.shadow.normalBias = 0.04
    this.scene.add(this.sun, this.sun.target, this.hemi)

    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMaterial())
    this.sky.renderOrder = -10
    this.sky.frustumCulled = false
    this.scene.add(this.sky)

    const grid = warpedGrid()
    this.terrain = new THREE.Mesh(grid, terrainMaterial())
    this.terrain.receiveShadow = true
    this.terrain.frustumCulled = false
    this.water = new THREE.Mesh(grid, waterMaterial())
    this.water.renderOrder = 1
    this.water.frustumCulled = false
    this.scene.add(this.terrain, this.water)

    this.propsMat = propsMaterial()
    this.glowMat = curved(new THREE.MeshBasicMaterial({ vertexColors: true }), { key: 'glow' })
    this.haloMat = haloMaterial()
    this.beamMat = curved(new THREE.MeshBasicMaterial({
      color: '#fff1b0', transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }), { key: 'beam' })

    this.boatModel = createBoat(this.propsMat, this.glowMat)
    this.boatModel.tilt.add(this.halo([{ p: this.boatModel.lantern, c: '#ffc46b', s: 2.4 }]))
    this.scene.add(this.boatModel.group)

    this.trail = waterU.uTrail.value
    this.ripples = waterU.uRipples.value
    this.drops = this.makeDrops(mobile ? 120 : 200)
    this.makeClouds(mobile ? 9 : 13)
    this.makeGulls(4)
    this.fish = { mesh: this.makeFish(), t: -1, wait: 4, from: new THREE.Vector2(), dir: new THREE.Vector2() }

    this.markerMat = curved(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }), { key: 'marker' })
    const ring = new THREE.RingGeometry(0.55, 0.8, 32)
    ring.rotateX(-Math.PI / 2)
    this.marker = new THREE.Mesh(ring, this.markerMat)
    this.marker.renderOrder = 2
    this.marker.frustumCulled = false
    this.scene.add(this.marker)

    this.stream(true)
    this.applyNight(0)
    this.updateCamera(1)

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(canvas)
    this.io = new IntersectionObserver(([e]) => {
      this.visible = !!e?.isIntersecting
      this.updateRunning()
    })
    this.io.observe(canvas)
    document.addEventListener('visibilitychange', this.updateRunning)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    canvas.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })

    this.resize()
    // compile every shader up front so the first seconds don't stutter —
    // but never keep anyone waiting more than a few seconds for it
    const wait = new Promise(res => setTimeout(res, 3500))
    Promise.race([r.compileAsync(this.scene, this.camera), wait]).catch(() => {}).finally(() => {
      if (this.disposed) return
      this.started = true
      this.updateRunning()
      requestAnimationFrame(() => requestAnimationFrame(() => this.opts.events.ready?.()))
    })
  }

  // ───────── public API ─────────

  setNight(dark: boolean, immediate = false) {
    this.nightTarget = dark ? 1 : 0
    if (immediate) {
      this.night = this.nightTarget
      this.applyNight(this.night)
    }
  }

  /** float these bottles (keeps the ones already out there); `read` ones get no beacon */
  setBottles(list: Bottle[], read: Set<string>) {
    const fresh = list.filter(b => !this.bottles.has(b.id))
    const first = this.bottles.size === 0
    fresh.forEach((b, i) => {
      // the first batch: one right ahead, a few nearby, the rest further out
      const [r0, r1, spread] = first
        ? i === 0 ? [13, 18, 0.5] : i < 4 ? [20, 46, 2.2] : [36, 115, Math.PI]
        : [70, 110, 1.3]
      const spot = this.findSpot(this.boat.x, this.boat.z, r0, r1, this.boat.heading + (first && i === 0 ? 0.35 : 0), spread)
      const f = this.addFloating(b.id, spot.x, spot.y, read.has(b.id))
      f.delay = 0.6 + i * 0.12
    })
  }

  markRead(id: string) {
    const f = this.bottles.get(id)
    if (f) f.read = true
  }

  /** fish out the bottle next to the boat (Space / the button) */
  pickNear() {
    if (this.phase === 'idle' && this.nearId) this.opts.events.pick?.(this.nearId)
  }

  /** the HUD can lock steering while a letter is open */
  setControls(on: boolean) {
    this.controls = on
    if (!on) {
      this.keys.clear()
      this.dest = null
    }
  }

  /** a bottle hops out of the water into your hands, uncorks, its letter unrolls over `rect` */
  async open(id: string, rect: DOMRect, letter: HTMLCanvasElement) {
    const f = this.bottles.get(id)
    if (!f || this.phase !== 'idle') return
    this.phase = 'busy'
    this.setControls(false)
    this.reading = f
    f.state = 'away'
    this.setNear(null)

    await this.tween(0.16, (k) => { this.squash(f, 1 - 0.3 * k) }, ease.out)
    this.addRipple(f.x, f.z, 1)
    this.emitSplash(f.x, f.y, f.z, 22, 0.9)
    this.opts.synth.splash(0.45)
    this.camera.attach(f.mesh.holder)
    setBend(f.mesh.holder, false)
    f.mesh.beacon.visible = false
    await this.flyToHand(f, 0.8)
    await this.popCork(f.mesh, true)

    const paper = this.makePaper(letter, rect)
    paper.mat.uniforms.uProgress!.value = 1
    this.setPose(paper.mesh, this.paperInBottlePose(f.mesh, paper))
    paper.mesh.visible = true
    f.mesh.paper.visible = false
    await this.tweenPose(paper.mesh, this.paperInBottlePose(f.mesh, paper, 0.55), 0.38, ease.out)

    const h = f.mesh.holder
    const p0 = h.position.clone()
    const down = p0.clone().add(new THREE.Vector3(0, -2.6, 0))
    void this.tween(0.6, k => h.position.lerpVectors(p0, down, k), ease.in)
    await this.tweenPose(paper.mesh, this.rectPose(rect), 0.62, ease.inOut)
    this.opts.synth.rustle(0.7)
    await this.tween(0.75, k => { paper.mat.uniforms.uProgress!.value = 1 - k }, ease.out)
  }

  /** hide the 3D letter once the HTML one is showing on top of it */
  releasePaper() {
    if (this.paper) this.paper.mesh.visible = false
  }

  /** roll the letter back up, cork it, and drop the bottle back over the side */
  async close(rect: DOMRect) {
    const f = this.reading
    const paper = this.paper
    if (!f || !paper) return
    this.setPose(paper.mesh, this.rectPose(rect))
    paper.mesh.visible = true
    this.opts.synth.rustle(0.6)
    const h = f.mesh.holder
    const p0 = h.position.clone()
    await Promise.all([
      this.tween(0.7, k => h.position.lerpVectors(p0, this.holdPos(), k), ease.back),
      this.tween(0.7, k => { paper.mat.uniforms.uProgress!.value = k }, ease.inOut),
    ])
    await this.stowPaper(f.mesh, paper)
    await this.popCork(f.mesh, false)
    this.reading = undefined
    f.read = true
    // over the side, a few metres off
    const side = idHash(f.id, 5) < 0.5 ? -1 : 1
    const fx = Math.sin(this.boat.heading)
    const fz = -Math.cos(this.boat.heading)
    const spot = this.openWater(this.boat.x - fz * side * 4 + fx * 2, this.boat.z + fx * side * 4 + fz * 2)
    await this.toss(f, spot.x, spot.y, 0.3)
    this.phase = 'idle'
    this.setControls(true)
  }

  /** the letter at `rect` rolls up into a new bottle, which you then hold */
  async seal(b: Bottle, rect: DOMRect, letter: HTMLCanvasElement) {
    if (this.phase !== 'idle') return
    this.phase = 'busy'
    this.setControls(false)
    const f = this.addFloating(b.id, this.boat.x, this.boat.z, true)
    f.state = 'away'
    const m = f.mesh
    this.scene.remove(m.holder)
    this.camera.add(m.holder)
    setBend(m.holder, false)
    m.beacon.visible = false
    m.holder.quaternion.identity()
    m.holder.scale.setScalar(HOLD_SCALE)
    m.group.quaternion.copy(this.holdQuat())
    m.holder.position.copy(this.holdPos()).add(new THREE.Vector3(0, -2.6, 0))
    m.paper.visible = false
    m.cork.position.y = CORK_Y + 0.5
    this.setCorkOpacity(m, 0)

    const paper = this.makePaper(letter, rect)
    this.setPose(paper.mesh, this.rectPose(rect))
    paper.mesh.visible = true
    this.opts.synth.rustle(0.8)
    const p0 = m.holder.position.clone()
    await Promise.all([
      this.tween(0.9, k => m.holder.position.lerpVectors(p0, this.holdPos(), k), ease.back),
      this.tween(0.85, k => { paper.mat.uniforms.uProgress!.value = k }, ease.inOut),
    ])
    await this.stowPaper(m, paper)
    await this.popCork(m, false)
    this.held = f
    this.phase = 'holding'
    this.setControls(true)
    this.canvas.style.cursor = 'grab'
  }

  /**
   * Throw the bottle you're holding, ahead of the boat. vx, vy: release
   * velocity of a flick in px/s (screen y down); without them, a good lob.
   */
  async throwHeld(vx = 0, vy = -1500) {
    const f = this.held
    if (!f || this.phase !== 'holding') return
    this.phase = 'busy'
    this.held = undefined
    this.canvas.style.cursor = ''
    const power = clamp((-vy - 200) / 2400, 0, 1)
    const aim = clamp(vx / 2000, -1, 1)
    const fx = Math.sin(this.boat.heading)
    const fz = -Math.cos(this.boat.heading)
    const dist = 6 + power * 10
    const spot = this.openWater(this.boat.x + fx * dist - fz * aim * 4, this.boat.z + fz * dist + fx * aim * 4)
    this.opts.synth.whoosh()
    await this.toss(f, spot.x, spot.y, power)
    this.phase = 'idle'
    this.opts.events.landed?.(f.id)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.running = false
    this.ro.disconnect()
    this.io.disconnect()
    document.removeEventListener('visibilitychange', this.updateRunning)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerUp)
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.opts.synth.motion(0)
    this.bottles.forEach(f => disposeBottle(f.mesh))
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      for (const x of Array.isArray(mat) ? mat : mat ? [mat] : []) x.dispose()
    })
    this.renderer.dispose()
  }

  // ───────── the world around the boat ─────────

  /** upload the islands near the boat to the GPU; grow and drop their scenery */
  private stream(force = false) {
    const key = `${Math.floor(this.boat.x / 24)},${Math.floor(this.boat.z / 24)}`
    if (!force && key === this.streamKey) return
    this.streamKey = key
    const near = islandsNear(this.boat.x, this.boat.z, 165)
    const n = Math.min(near.length, MAX_ISLES)
    for (let i = 0; i < n; i++) {
      const isl = near[i]!
      U.uIsles.value[i]!.set(isl.x, isl.z, isl.bound, isl.kind)
      U.uIsleWob.value[i]!.set(...isl.wob)
      for (let j = 0; j < 4; j++) U.uCircles.value[i * 4 + j]!.set(...isl.circles[j]!)
    }
    U.uIsleCount.value = n
    const keep = new Set<string>()
    for (const isl of near.slice(0, MAX_ISLES)) {
      if (Math.hypot(isl.x - this.boat.x, isl.z - this.boat.z) > 175) continue
      keep.add(isl.key)
      if (this.decor.has(isl.key)) continue
      const d = decorate(isl, SPAWN)
      const group = new THREE.Group()
      if (d.land) {
        const m = new THREE.Mesh(d.land, this.propsMat)
        m.castShadow = true
        m.receiveShadow = true
        group.add(m)
      }
      if (d.sea) {
        const m = new THREE.Mesh(d.sea, this.propsMat)
        m.receiveShadow = true
        group.add(m)
      }
      if (d.glow) group.add(new THREE.Mesh(d.glow, this.glowMat))
      if (d.halos.length) group.add(this.halo(d.halos))
      const beams: THREE.Object3D[] = []
      for (const p of d.beams) beams.push(this.beam(group, p))
      group.traverse((o) => { o.frustumCulled = false })
      this.scene.add(group)
      this.decor.set(isl.key, { group, beams })
    }
    for (const [k, d] of this.decor) {
      if (keep.has(k)) continue
      d.group.traverse((o) => { (o as THREE.Mesh).geometry?.dispose() })
      this.scene.remove(d.group)
      this.decor.delete(k)
    }
  }

  private halo(list: { p: THREE.Vector3, c: THREE.ColorRepresentation, s: number }[]) {
    const pos = new Float32Array(list.length * 3)
    const col = new Float32Array(list.length * 3)
    const size = new Float32Array(list.length)
    const c = new THREE.Color()
    list.forEach((h, i) => {
      pos.set([h.p.x, h.p.y, h.p.z], i * 3)
      c.set(h.c)
      col.set([c.r, c.g, c.b], i * 3)
      size[i] = h.s
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    const pts = new THREE.Points(g, this.haloMat)
    pts.frustumCulled = false
    pts.renderOrder = 5
    return pts
  }

  /** two long soft cones sweeping round from a lighthouse lamp */
  private beam(parent: THREE.Object3D, at: THREE.Vector3) {
    const pivot = new THREE.Group()
    pivot.position.copy(at)
    const geo = new THREE.ConeGeometry(1.6, 22, 24, 1, true)
    geo.translate(0, -11, 0)
    geo.rotateZ(Math.PI / 2)
    for (const a of [0, Math.PI]) {
      const m = new THREE.Mesh(a ? geo.clone() : geo, this.beamMat)
      m.rotation.y = a
      m.renderOrder = 6
      pivot.add(m)
    }
    parent.add(pivot)
    return pivot
  }

  /** a spot in open water near (x, z) */
  private openWater(x: number, z: number) {
    const p = new THREE.Vector2(x, z)
    for (let i = 0; i < 12; i++) {
      const d = worldSdf(p.x, p.y).d
      if (d > 2.5) break
      const n = coastNormal(p.x, p.y)
      p.x += n.x * (3 - d)
      p.y += n.z * (3 - d)
    }
    return p
  }

  /** somewhere in open water rMin..rMax from (x, z), around heading `angle` ± `spread` */
  private findSpot(x: number, z: number, rMin: number, rMax: number, angle: number, spread: number) {
    let best = new THREE.Vector2(x + Math.sin(angle) * rMin, z - Math.cos(angle) * rMin)
    for (let i = 0; i < 40; i++) {
      const a = angle + (Math.random() - 0.5) * 2 * spread
      const r = lerp(rMin, rMax, Math.random())
      const px = x + Math.sin(a) * r
      const pz = z - Math.cos(a) * r
      if (worldSdf(px, pz).d < 5) continue
      let clear = true
      for (const f of this.bottles.values()) {
        if (Math.hypot(f.x - px, f.z - pz) < 9) {
          clear = false
          break
        }
      }
      best = new THREE.Vector2(px, pz)
      if (clear) break
    }
    return best
  }

  // ───────── bottles ─────────

  private addFloating(id: string, x: number, z: number, read: boolean) {
    const mesh = createBottle(id)
    mesh.paperMat.emissiveIntensity = this.night * 0.6
    ;(mesh.beaconMat.uniforms.uColor!.value as THREE.Color).set(DAY.beacon).lerp(new THREE.Color(NIGHT.beacon), this.night)
    const seed = idHash(id, 4)
    const f: Floating = {
      id, mesh, state: 'float', x, z, y: -1, vy: 0, vx: 0, vz: 0, sq: 1, sqv: 0,
      yaw: seed * Math.PI * 2, seed, delay: 0, hover: 0, read, beacon: 0,
    }
    this.bottles.set(id, f)
    this.scene.add(mesh.holder)
    return f
  }

  private squash(f: Floating, sq: number) {
    f.sq = sq
    const side = 1 / Math.sqrt(sq)
    f.mesh.holder.scale.set(side, sq, side)
  }

  private stepBottles(dt: number) {
    const rings = waterU.uRings.value
    const qYaw = new THREE.Quaternion()
    const qLay = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2 + 0.22))
    const qAlign = new THREE.Quaternion()
    const id = new THREE.Quaternion()
    const n = new THREE.Vector3()
    const wig = new THREE.Quaternion()
    const X = new THREE.Vector3(1, 0, 0)
    const UPV = new THREE.Vector3(0, 1, 0)
    let near: string | null = null
    let nearD = PICK_DIST
    const list: { f: Floating, d: number }[] = []
    for (const f of this.bottles.values()) {
      if (f.state !== 'float') continue
      const h = f.mesh.holder
      const db = Math.hypot(f.x - this.boat.x, f.z - this.boat.z)
      if (f.delay > 0) {
        f.delay -= dt
        h.visible = f.delay < 0.05
        if (f.delay <= 0) {
          f.sq = 0.55
          this.addRipple(f.x, f.z, 0.7)
        }
        continue
      }
      h.visible = true
      list.push({ f, d: db })

      // drift: a slow wander, steered away from beaches and nudged by the hull
      const head = f.seed * 6.283 + Math.sin(this.clock * 0.05 + f.seed * 40) * 1.5
      let ax = Math.cos(head) * 0.22 - f.vx
      let az = Math.sin(head) * 0.22 - f.vz
      const sd = worldSdf(f.x, f.z).d
      if (sd < 4) {
        const cn = coastNormal(f.x, f.z)
        ax += cn.x * (4 - sd) * 0.9
        az += cn.z * (4 - sd) * 0.9
      }
      if (db < 2.6) {
        const k = (2.6 - db) * 2.5
        ax += ((f.x - this.boat.x) / (db || 1)) * k
        az += ((f.z - this.boat.z) / (db || 1)) * k
      }
      f.vx += ax * dt * 0.8
      f.vz += az * dt * 0.8
      f.x += f.vx * dt
      f.z += f.vz * dt

      const s = sampleSurface(f.x, f.z, this.waveTime, this.surf)
      f.vy += ((s.y * waterU.uWaveAmp.value + 0.12 - f.y) * 40 - f.vy * 5.5) * dt
      f.y += f.vy * dt
      f.sqv += ((1 - f.sq) * 220 - f.sqv * 11) * dt
      f.sq += f.sqv * dt

      const hot = this.nearId === f.id || this.hoverId === f.id ? 1 : 0
      f.hover += (hot - f.hover) * (1 - Math.exp(-dt * 8))
      f.mesh.glass.uniforms.uHover!.value = f.hover
      h.position.set(f.x, f.y + f.hover * 0.25, f.z)
      const side = 1 / Math.sqrt(f.sq)
      const big = 1 + f.hover * 0.12
      h.scale.set(side * big, f.sq * big, side * big)
      h.quaternion.slerp(id, 1 - Math.exp(-dt * 4))

      const targetYaw = Math.atan2(-f.vz, f.vx)
      f.yaw += wrap(targetYaw - f.yaw) * (1 - Math.exp(-dt * 0.8))
      qYaw.setFromAxisAngle(UPV, f.yaw)
      qAlign.setFromUnitVectors(UPV, n.set(s.nx * 1.5, s.ny, s.nz * 1.5).normalize())
      wig.setFromAxisAngle(X, Math.sin(this.clock * 12) * 0.12 * f.hover)
      f.mesh.group.quaternion.slerp(qAlign.multiply(qYaw).multiply(qLay).multiply(wig), 1 - Math.exp(-dt * 3.5))
      const gs = f.mesh.group.scale.x
      f.mesh.group.scale.setScalar(gs + (f.mesh.scale - gs) * (1 - Math.exp(-dt * 6)))

      // the beacon: bright from afar, gone once read (or when you're right there)
      const want = f.read ? 0 : lerp(0.55, 1, this.night) * clamp((db - 3) / 7, 0.12, 1)
      f.beacon += (want - f.beacon) * (1 - Math.exp(-dt * 3))
      f.mesh.beaconMat.uniforms.uOpacity!.value = f.beacon
      f.mesh.beacon.visible = f.beacon > 0.01

      if (db < nearD && this.phase === 'idle') {
        near = f.id
        nearD = db
      }
    }
    list.sort((a, b) => a.d - b.d)
    for (let i = 0; i < Math.min(list.length, MAX_RINGS); i++) {
      const f = list[i]!.f
      rings[i]!.set(f.x, f.z, 0.5 * f.mesh.scale)
    }
    waterU.uRingCount.value = Math.min(list.length, MAX_RINGS)
    this.setNear(near)
  }

  private setNear(id: string | null) {
    if (id === this.nearId) return
    if (id) this.opts.synth.note(84 + Math.floor(idHash(id, 7) * 3) * 2, 0, 0.3)
    this.nearId = id
    this.opts.events.near?.(id)
  }

  /** keep unread bottles within reach as you sail on; ask for more when all are read */
  private tideKeeping(dt: number) {
    this.timers.relocate -= dt
    if (this.timers.relocate > 0) return
    this.timers.relocate = 1.5
    let unread = 0
    for (const f of [...this.bottles.values()]) {
      if (f.state !== 'float') continue
      const d = Math.hypot(f.x - this.boat.x, f.z - this.boat.z)
      if (!f.read) unread++
      if (!f.read && d > 180) {
        const spot = this.findSpot(this.boat.x, this.boat.z, 75, 115, this.boat.heading, 1.2)
        f.x = spot.x
        f.z = spot.y
        f.vx = 0
        f.vz = 0
        f.delay = 0.1
      }
      else if (f.read && d > 240) {
        this.scene.remove(f.mesh.holder)
        disposeBottle(f.mesh)
        this.bottles.delete(f.id)
      }
    }
    this.timers.more -= 1.5
    if (unread === 0 && this.timers.more <= 0 && this.phase === 'idle') {
      this.timers.more = 25
      this.opts.events.needMore?.()
    }
  }

  // ───────── choreography (letters in and out of bottles) ─────────

  private holdPos() {
    return new THREE.Vector3(0, this.camera.aspect < 0.8 ? -0.3 : -0.45, -HOLD_DEPTH)
  }

  /** in your hands: lying across the view, neck to the right, turned a little */
  private holdQuat() {
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, -0.4, -Math.PI / 2 + 0.1))
  }

  private async flyToHand(f: Floating, dur: number) {
    const h = f.mesh.holder
    const g = f.mesh.group
    const p0 = h.position.clone()
    const q0 = h.quaternion.clone()
    const g0 = g.quaternion.clone()
    const s0 = h.scale.x
    const p1 = this.holdPos()
    const q1 = this.holdQuat()
    const idq = new THREE.Quaternion()
    await this.tween(dur, (k) => {
      h.position.lerpVectors(p0, p1, ease.out(k))
      h.position.y += Math.sin(k * Math.PI) * 1.2
      h.quaternion.slerpQuaternions(q0, idq, ease.out(k))
      g.quaternion.slerpQuaternions(g0, q1, ease.inOut(k))
      const st = k < 0.7 ? 1 + 0.25 * Math.sin((k / 0.7) * Math.PI) : 1 - 0.12 * Math.sin(((k - 0.7) / 0.3) * Math.PI)
      const s = s0 + (HOLD_SCALE - s0) * ease.out(k)
      h.scale.set(s / Math.sqrt(st), s * st, s / Math.sqrt(st))
    }, ease.lin)
  }

  /** camera-space pose that puts a flat sheet exactly over a DOM rect */
  private rectPose(rect: DOMRect): Pose {
    const c = this.canvas.getBoundingClientRect()
    const viewH = 2 * HOLD_DEPTH * Math.tan((this.camera.fov * Math.PI) / 360)
    const s = viewH / c.height
    const x = (rect.left + rect.width / 2 - c.left - c.width / 2) * s
    const y = -(rect.top + rect.height / 2 - c.top - c.height / 2) * s
    return { pos: new THREE.Vector3(x, y, -HOLD_DEPTH), quat: new THREE.Quaternion(), scale: 1 }
  }

  private makePaper(letter: HTMLCanvasElement, rect: DOMRect) {
    if (this.paper) {
      this.camera.remove(this.paper.mesh)
      this.paper.mesh.geometry.dispose()
      ;(this.paper.mat.uniforms.uMap!.value as THREE.Texture).dispose()
      this.paper.mat.dispose()
    }
    const c = this.canvas.getBoundingClientRect()
    const s = (2 * HOLD_DEPTH * Math.tan((this.camera.fov * Math.PI) / 360)) / c.height
    const w = rect.width * s
    const h = rect.height * s
    const tex = new THREE.CanvasTexture(letter)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    // shrunk to the bottle's letter, the scroll is exactly as thick as it
    const r0 = INNER.radius * (w / INNER.length)
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: tex },
        uProgress: { value: 0 },
        uH: { value: h },
        uR0: { value: r0 },
        uRMin: { value: r0 * 0.3 },
        uBack: { value: new THREE.Color('#f1e4c8') },
        uLight: { value: lerp(1, 0.9, this.night) },
        uOpacity: { value: 1 },
      },
      vertexShader: paperShader.vertex,
      fragmentShader: paperShader.fragment,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 120), mat)
    mesh.frustumCulled = false
    mesh.renderOrder = 20
    mesh.visible = false
    this.camera.add(mesh)
    this.paper = { mesh, mat, w, h }
    return this.paper
  }

  /** camera-space pose of the rolled sheet, lined up with the letter inside the bottle (or `out` past the neck) */
  private paperInBottlePose(b: BottleMesh, paper: { w: number, h: number, mat: THREE.ShaderMaterial }, out = 0): Pose {
    this.camera.updateMatrixWorld()
    b.group.updateMatrixWorld(true)
    const rel = this.camera.matrixWorld.clone().invert().multiply(b.group.matrixWorld)
    const pos = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const scl = new THREE.Vector3()
    rel.decompose(pos, q, scl)
    const scale = (INNER.length / paper.w) * scl.y
    const quat = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2))
    const centre = new THREE.Vector3(0, (INNER.y + out) * scl.y, 0).applyQuaternion(q).add(pos)
    const local = new THREE.Vector3(0, -paper.h / 2, paper.mat.uniforms.uR0!.value as number).multiplyScalar(scale).applyQuaternion(quat)
    return { pos: centre.sub(local), quat, scale }
  }

  private async stowPaper(b: BottleMesh, paper: NonNullable<SeaEngine['paper']>) {
    await this.tweenPose(paper.mesh, this.paperInBottlePose(b, paper, 0.55), 0.5, ease.inOut)
    await this.tweenPose(paper.mesh, this.paperInBottlePose(b, paper), 0.28, ease.in)
    paper.mesh.visible = false
    b.paper.visible = true
  }

  private setCorkOpacity(b: BottleMesh, a: number) {
    b.corkMat.opacity = a
    b.cork.visible = a > 0.01
  }

  private async popCork(b: BottleMesh, out: boolean) {
    const cork = b.cork
    cork.rotation.set(0, 0, 0)
    if (out) {
      this.opts.synth.pop()
      await this.tween(0.55, (k) => {
        cork.position.y = CORK_Y + k * 0.7 - k * k * 0.25
        cork.position.x = k * 0.3
        cork.rotation.z = -k * 4
        this.setCorkOpacity(b, 1 - ease.in(k))
      }, ease.out)
    }
    else {
      cork.position.x = 0
      await this.tween(0.3, (k) => {
        cork.position.y = CORK_Y + (1 - k) * 0.45
        this.setCorkOpacity(b, Math.min(1, k * 2))
      }, ease.in)
      this.opts.synth.clink()
      const h = b.holder
      const s = h.scale.x
      await this.tween(0.32, (k) => {
        const sq = 1 - 0.14 * Math.sin(k * Math.PI) * (1 - k)
        h.scale.set(s / Math.sqrt(sq), s * sq, s / Math.sqrt(sq))
      }, ease.lin)
      h.scale.setScalar(s)
    }
  }

  private bendAt(x: number, z: number) {
    const c = U.uCurveCenter.value
    return ((x - c.x) ** 2 + (z - c.y) ** 2) * U.uCurve.value
  }

  /** a cartoon lob from the hands to (tx, tz) on the water */
  private async toss(f: Floating, tx: number, tz: number, power: number) {
    const h = f.mesh.holder
    this.scene.attach(h)
    const p0 = h.position.clone()
    const q0 = h.quaternion.clone()
    const s0 = h.scale.x
    const ty = sampleSurface(tx, tz, this.waveTime, this.surf).y * waterU.uWaveAmp.value
    const p1 = new THREE.Vector3(tx, ty, tz)
    // from the hands (up by the camera) down to the water: along the line of
    // sight with a little hop on top, so it stays on screen the whole way
    const hop = 1.6 + power * 1.8
    const dur = 0.95 + power * 0.35
    const axis = new THREE.Vector3(-(p1.z - p0.z), 0, p1.x - p0.x).normalize()
    const spins = 1 + Math.round(power * 2)
    const rot = new THREE.Quaternion()
    await this.tween(dur, (k) => {
      h.position.lerpVectors(p0, p1, 1 - (1 - k) ** 1.6)
      h.position.y += hop * 4 * k * (1 - k)
      // the bend is off while it's airborne: fade it in by hand
      h.position.y -= this.bendAt(h.position.x, h.position.z) * ease.inOut(k)
      h.quaternion.copy(rot.setFromAxisAngle(axis, spins * Math.PI * 2 * ease.out(k)).multiply(q0))
      h.scale.setScalar(s0 + (1 - s0) * k)
    }, ease.lin)
    h.position.copy(p1)
    setBend(h, true)
    f.x = tx
    f.z = tz
    f.y = p1.y - 0.2
    f.vy = -2.6 - power * 1.5
    f.vx = 0
    f.vz = 0
    f.delay = 0
    f.state = 'float'
    f.sq = 0.55
    f.sqv = 0
    this.addRipple(tx, tz, 1.2 + power * 0.4)
    this.emitSplash(tx, p1.y, tz, 28 + Math.round(power * 20), 1 + power * 0.5)
    this.opts.synth.splash(0.6 + power * 0.6)
  }

  // ───────── boat ─────────

  private stepBoat(dt: number) {
    const b = this.boat
    let throttle = 0
    let desired: number | null = null
    const ix = (this.keys.has('right') ? 1 : 0) - (this.keys.has('left') ? 1 : 0)
    const iy = (this.keys.has('up') ? 1 : 0) - (this.keys.has('down') ? 1 : 0)
    if (this.controls && (ix || iy)) {
      // keys steer in screen terms: up is "away from the camera"
      this.dest = null
      const dx = -Math.sin(CAM_YAW) * iy + Math.cos(CAM_YAW) * ix
      const dz = -Math.cos(CAM_YAW) * iy - Math.sin(CAM_YAW) * ix
      desired = Math.atan2(dx, -dz)
      throttle = 1
      this.markMoved()
    }
    else if (this.dest && this.controls) {
      const dx = this.dest.x - b.x
      const dz = this.dest.y - b.z
      const dist = Math.hypot(dx, dz)
      if (dist < this.destStop) this.dest = null
      else {
        desired = Math.atan2(dx, -dz)
        throttle = clamp((dist - this.destStop) / 6, 0.25, 1)
      }
    }
    let steer = 0
    if (desired !== null) {
      const diff = wrap(desired - b.heading)
      steer = clamp(diff * 2.4, -1, 1)
      throttle *= 1 - Math.min(Math.abs(diff) / Math.PI, 0.7)
    }
    const max = MAX_SPEED * (this.keys.has('boost') ? BOOST : 1)
    b.speed += (throttle * max - b.speed) * (1 - Math.exp(-dt * (throttle > 0 ? 0.9 : 0.6)))
    const turnScale = 0.35 + 0.65 * Math.min(1, Math.abs(b.speed) / 3)
    b.turn += (steer * TURN * turnScale - b.turn) * (1 - Math.exp(-dt * 5))
    b.heading += b.turn * dt

    const fx = Math.sin(b.heading)
    const fz = -Math.cos(b.heading)
    let nx = b.x + fx * b.speed * dt
    let nz = b.z + fz * b.speed * dt
    // the beach: bump, stop, back off a little
    if (b.speed > 0 && worldSdf(nx + fx * 1.6, nz + fz * 1.6).d < 0.5) {
      if (b.speed > 2.2 && this.clock - b.lastThud > 0.8) {
        b.lastThud = this.clock
        this.opts.synth.thud()
        this.shake = 0.35
        this.emitSplash(nx + fx * 1.6, 0, nz + fz * 1.6, 10, 0.6)
        this.addRipple(nx + fx * 1.4, nz + fz * 1.4, 0.8)
      }
      b.speed *= -0.25
      nx = b.x
      nz = b.z
    }
    const mid = worldSdf(nx, nz).d
    if (mid < 1.3) {
      const cn = coastNormal(nx, nz)
      nx += cn.x * (1.3 - mid)
      nz += cn.z * (1.3 - mid)
    }
    b.x = nx
    b.z = nz

    // ride the swell: height from the centre, pitch and roll from bow/stern/sides
    const amp = waterU.uWaveAmp.value
    const sy = (x: number, z: number) => sampleSurface(x, z, this.waveTime, this.surf).y * amp
    const yC = sy(b.x, b.z)
    const pitch = Math.atan2(sy(b.x + fx * 1.3, b.z + fz * 1.3) - sy(b.x - fx * 1.3, b.z - fz * 1.3), 2.6)
    const roll = Math.atan2(sy(b.x - fz * 0.7, b.z + fx * 0.7) - sy(b.x + fz * 0.7, b.z - fx * 0.7), 1.4)
    b.y += (yC - b.y) * (1 - Math.exp(-dt * 8))
    const m = this.boatModel
    m.group.position.set(b.x, b.y - 0.04, b.z)
    m.group.rotation.y = -b.heading
    const speed01 = clamp(Math.abs(b.speed) / MAX_SPEED, 0, 1)
    m.tilt.rotation.x = pitch * 0.9 + speed01 * 0.035
    m.tilt.rotation.z = roll * 0.9 + b.turn * speed01 * 0.12
    m.billow.value = 0.15 + 0.85 * speed01

    // wake and spray
    if (Math.abs(b.speed) > 0.7 && this.clock - b.lastTrail > 0.12) {
      b.lastTrail = this.clock
      this.trail[this.trailIdx]!.set(b.x - fx * 1.5, b.z - fz * 1.5, this.clock, speed01)
      waterU.uTrailHead.value = this.trailIdx
      this.trailIdx = (this.trailIdx + 1) % MAX_TRAIL
    }
    if (b.speed > 4.5 && Math.random() < speed01 * 0.8) {
      const side = Math.random() < 0.5 ? -1 : 1
      this.emitDrop(b.x + fx * 1.4 - fz * side * 0.45, 0.1, b.z + fz * 1.4 + fx * side * 0.45, -fz * side * 1.4 + fx * b.speed * 0.25, 1.6 + Math.random(), fx * side * 1.4 + fz * b.speed * 0.25)
    }
    waterU.uBoat.value.set(b.x, b.z, b.heading, speed01)
    this.opts.synth.motion(speed01)

    // the course marker fades once we're there
    const show = this.dest ? 0.85 : 0
    this.markerMat.opacity += (show - this.markerMat.opacity) * (1 - Math.exp(-dt * 6))
    if (this.dest) this.marker.position.set(this.dest.x, 0.08, this.dest.y)
    this.marker.scale.setScalar(1 + Math.sin(this.clock * 5) * 0.08)
    this.marker.visible = this.markerMat.opacity > 0.01
  }

  private markMoved() {
    if (this.hasMoved) return
    this.hasMoved = true
    this.opts.events.moved?.()
  }

  // ───────── camera ─────────

  private updateCamera(dt: number) {
    const b = this.boat
    const look = b.speed * 0.6
    const gx = b.x + Math.sin(b.heading) * look
    const gz = b.z - Math.cos(b.heading) * look
    const k = 1 - Math.exp(-dt * 2.2)
    this.camTarget.x += (gx - this.camTarget.x) * k
    this.camTarget.z += (gz - this.camTarget.z) * k
    this.camTarget.y = b.y * 0.5
    this.zoom += (this.zoomGoal - this.zoom) * (1 - Math.exp(-dt * 6))
    const pitch = CAM_PITCH - (1 - (this.zoom - ZOOM.min) / (ZOOM.max - ZOOM.min)) * 0.12
    const off = new THREE.Vector3(Math.sin(CAM_YAW) * Math.cos(pitch), Math.sin(pitch), Math.cos(CAM_YAW) * Math.cos(pitch)).multiplyScalar(this.zoom)
    this.camera.position.copy(this.camTarget).add(off)
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt)
      const s = this.shake * 0.4
      this.camera.position.x += (Math.random() - 0.5) * s
      this.camera.position.y += (Math.random() - 0.5) * s
    }
    this.camera.lookAt(this.camTarget)
    U.uCurveCenter.value.set(this.camTarget.x, this.camTarget.z)
    this.sky.position.copy(this.camera.position)
    const sx = Math.round(this.camTarget.x / SNAP) * SNAP
    const sz = Math.round(this.camTarget.z / SNAP) * SNAP
    this.terrain.position.set(sx, 0, sz)
    this.water.position.set(sx, 0, sz)
    // the shadow camera follows, snapped to its texels so shadows don't crawl
    const texel = 80 / this.sun.shadow.mapSize.x
    const tx = Math.round(this.camTarget.x / texel) * texel
    const tz = Math.round(this.camTarget.z / texel) * texel
    this.sun.target.position.set(tx, 0, tz)
    this.sun.position.set(tx, 0, tz).addScaledVector(U.uSunDir.value, 90)
  }

  // ───────── life: clouds, gulls, a fish, splashes ─────────

  private makeClouds(n: number) {
    for (let i = 0; i < n; i++) {
      const b = new Builder()
      const puffs = 5 + Math.floor(Math.random() * 4)
      const blob = new THREE.IcosahedronGeometry(1, 2)
      for (let k = 0; k < puffs; k++) {
        const s = 1.2 + Math.random() * 1.3
        const x = (k - puffs / 2) * 1.5 + (Math.random() - 0.5)
        b.add(blob, v => (v.y < -0.3 ? '#dbe8f4' : '#ffffff'), mat4([x, Math.random() * 0.8 + (Math.abs(x) < 2 ? 0.8 : 0), (Math.random() - 0.5) * 2.4], [0, 0, 0], [s, s * 0.82, s]), 0, 0.02)
      }
      blob.dispose()
      const mat = curved(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: DAY.cloudGlow, transparent: true }), { key: 'cloud' })
      const mesh = new THREE.Mesh(b.build()!, mat)
      mesh.castShadow = true
      mesh.frustumCulled = false
      mesh.renderOrder = 7
      const a = Math.random() * Math.PI * 2
      const r = 18 + Math.random() * 70
      mesh.rotation.y = Math.random() * 3
      this.clouds.push({ mesh, mat, x: SPAWN.x + Math.cos(a) * r, z: SPAWN.z + Math.sin(a) * r, y: 9 + Math.random() * 3.5, speed: 0.8 + Math.random() * 0.8 })
      this.scene.add(mesh)
    }
  }

  private stepClouds(dt: number) {
    const cam = this.camera.position
    const t = this.camTarget
    const dir = t.clone().sub(cam).normalize()
    for (const c of this.clouds) {
      c.x += WIND.x * c.speed * dt
      c.z += WIND.y * c.speed * dt
      const dx = c.x - t.x
      const dz = c.z - t.z
      if (dx * dx + dz * dz > 100 * 100) {
        // blown out of sight: come back in upwind
        const a = Math.atan2(-WIND.y, -WIND.x) + (Math.random() - 0.5) * 2.2
        const r = 70 + Math.random() * 25
        c.x = t.x + Math.cos(a) * r
        c.z = t.z + Math.sin(a) * r
      }
      c.mesh.position.set(c.x, c.y, c.z)
      // fade a cloud that drifts between the camera and the boat
      const toC = c.mesh.position.clone().sub(cam)
      const along = toC.dot(dir)
      const off = toC.clone().addScaledVector(dir, -along).length()
      // gone when it would block the boat, or drifts right up to the camera
      const block = along > 0 && along < this.zoom + 4 ? 1 - clamp((off - 6) / 7, 0, 1) : 0
      const close = 1 - clamp((toC.length() - 14) / 8, 0, 1)
      c.mat.opacity += (1 - Math.max(block, close) - c.mat.opacity) * (1 - Math.exp(-dt * 5))
      c.mat.depthWrite = c.mat.opacity > 0.98
      c.mesh.visible = c.mat.opacity > 0.02
    }
  }

  private makeGulls(n: number) {
    const white = curved(new THREE.MeshLambertMaterial({ color: '#ffffff' }), { key: 'gull' })
    const grey = curved(new THREE.MeshLambertMaterial({ color: '#8f9aa6' }), { key: 'gull' })
    const beak = curved(new THREE.MeshLambertMaterial({ color: '#ffb347' }), { key: 'gull' })
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group()
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), white)
      body.scale.set(0.8, 0.75, 1.6)
      g.add(body)
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), white)
      head.position.set(0, 0.1, -0.36)
      g.add(head)
      const bk = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6), beak)
      bk.rotation.x = -Math.PI / 2
      bk.position.set(0, 0.08, -0.52)
      g.add(bk)
      const wing = (side: number) => {
        const pivot = new THREE.Group()
        pivot.position.set(0.12 * side, 0.06, -0.05)
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.03, 0.32), white)
        w.position.x = 0.38 * side
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.24), grey)
        tip.position.x = 0.9 * side
        tip.rotation.y = 0.25 * side
        pivot.add(w, tip)
        g.add(pivot)
        return pivot
      }
      const wl = wing(-1)
      const wr = wing(1)
      g.traverse((o) => {
        o.frustumCulled = false
        if ((o as THREE.Mesh).isMesh) o.castShadow = true
      })
      this.scene.add(g)
      this.gulls.push({ g, wl, wr, cx: SPAWN.x, cz: SPAWN.z - 20, tx: SPAWN.x, tz: SPAWN.z - 20, r: 7 + Math.random() * 8, h: 8 + Math.random() * 4, a: Math.random() * 6.28, w: (0.28 + Math.random() * 0.14) * (i % 2 ? 1 : -1), phase: Math.random() * 6 })
    }
  }

  private stepGulls(dt: number) {
    for (const [i, gl] of this.gulls.entries()) {
      // every so often, pick an island near the boat (or the boat itself) to circle
      if (Math.floor((this.clock + i * 3) / 9) !== Math.floor((this.clock + i * 3 - dt) / 9)) {
        const isl = islandsNear(this.boat.x, this.boat.z, 50)[i % 2]
        gl.tx = isl ? isl.x : this.boat.x + (Math.random() - 0.5) * 20
        gl.tz = isl ? isl.z : this.boat.z + (Math.random() - 0.5) * 20
      }
      gl.cx += (gl.tx - gl.cx) * (1 - Math.exp(-dt * 0.25))
      gl.cz += (gl.tz - gl.cz) * (1 - Math.exp(-dt * 0.25))
      gl.a += gl.w * dt
      const x = gl.cx + Math.cos(gl.a) * gl.r
      const z = gl.cz + Math.sin(gl.a) * gl.r
      const y = gl.h + Math.sin(gl.a * 2 + gl.phase) * 0.6
      const vx = -Math.sin(gl.a) * gl.w
      const vz = Math.cos(gl.a) * gl.w
      gl.g.position.set(x, y, z)
      gl.g.rotation.set(0, Math.atan2(-vx, -vz), -Math.sign(gl.w) * 0.35)
      // flap, then glide
      const gliding = Math.sin(this.clock * 0.6 + gl.phase) > 0.2
      const flap = gliding ? Math.sin(this.clock * 2 + gl.phase) * 0.08 + 0.1 : Math.sin(this.clock * 9 + gl.phase) * 0.7
      gl.wl.rotation.z = flap
      gl.wr.rotation.z = -flap
    }
  }

  private makeFish() {
    const b = new Builder()
    const body = new THREE.SphereGeometry(0.2, 12, 8)
    b.add(body, v => (v.y < -0.05 ? '#ffd2a8' : '#ff8f5a'), mat4([0, 0, 0], [0, 0, 0], [0.75, 0.95, 1.7]))
    const tail = new THREE.ConeGeometry(0.16, 0.26, 4)
    b.add(tail, '#ff7444', mat4([0, 0, 0.42], [Math.PI / 2, 0, 0], [0.3, 1, 1]))
    const fin = new THREE.ConeGeometry(0.07, 0.16, 4)
    b.add(fin, '#ff7444', mat4([0, 0.2, 0], [0, 0, 0], [0.4, 1, 1]))
    const eye = new THREE.IcosahedronGeometry(0.045, 1)
    const pupil = new THREE.IcosahedronGeometry(0.025, 0)
    for (const x of [-0.12, 0.12]) {
      b.add(eye, '#ffffff', mat4([x, 0.05, -0.22]))
      b.add(pupil, '#23201e', mat4([x * 1.25, 0.06, -0.25]))
    }
    ;[body, tail, fin, eye, pupil].forEach(g => g.dispose())
    const m = new THREE.Mesh(b.build()!, this.propsMat)
    m.castShadow = true
    m.visible = false
    m.frustumCulled = false
    this.scene.add(m)
    return m
  }

  /** every so often a fish leaps out of the water near the boat */
  private stepFish(dt: number) {
    const f = this.fish
    if (f.t < 0) {
      f.wait -= dt
      if (f.wait > 0 || this.opts.reducedMotion) return
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2
        const r = 8 + Math.random() * 12
        const p = new THREE.Vector2(this.boat.x + Math.cos(a) * r, this.boat.z + Math.sin(a) * r)
        const d = new THREE.Vector2(Math.cos(a + 1.7), Math.sin(a + 1.7))
        if (worldSdf(p.x, p.y).d > 3 && worldSdf(p.x + d.x * 2.4, p.y + d.y * 2.4).d > 3) {
          f.from.copy(p)
          f.dir.copy(d)
          f.t = 0
          f.mesh.visible = true
          this.addRipple(p.x, p.y, 0.7)
          this.emitSplash(p.x, 0, p.y, 10, 0.6)
          this.opts.synth.splash(0.18)
          return
        }
      }
      f.wait = 1
      return
    }
    f.t += dt / 1.05
    const k = Math.min(f.t, 1)
    const x = f.from.x + f.dir.x * 2.4 * k
    const z = f.from.y + f.dir.y * 2.4 * k
    const y = 1.5 * 4 * k * (1 - k) - 0.15
    f.mesh.position.set(x, y, z)
    const slope = (1.5 * 4 * (1 - 2 * k)) / 2.4
    f.mesh.rotation.set(0, Math.atan2(-f.dir.x, -f.dir.y), 0)
    f.mesh.rotateX(Math.atan(slope))
    if (f.t >= 1) {
      f.t = -1
      f.wait = 5 + Math.random() * 7
      f.mesh.visible = false
      this.addRipple(x, z, 0.8)
      this.emitSplash(x, 0, z, 12, 0.7)
      this.opts.synth.splash(0.22)
    }
  }

  private makeDrops(n: number) {
    const mat = curved(new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#bfefff', emissiveIntensity: 0.3 }), { key: 'drops' })
    const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 1), mat, n)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = false
    const zero = new THREE.Matrix4().makeScale(0, 0, 0)
    for (let i = 0; i < n; i++) mesh.setMatrixAt(i, zero)
    this.scene.add(mesh)
    return { mesh, pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), life: new Float32Array(n).fill(1), next: 0 }
  }

  private emitDrop(x: number, y: number, z: number, vx: number, vy: number, vz: number) {
    const d = this.drops
    const j = d.next
    d.next = (d.next + 1) % d.life.length
    d.pos.set([x, y, z], j * 3)
    d.vel.set([vx, vy, vz], j * 3)
    d.life[j] = 0
  }

  private emitSplash(x: number, y: number, z: number, count: number, force: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const r = (0.4 + Math.random() * 1) * force
      this.emitDrop(x + Math.cos(a) * 0.2, y + 0.05, z + Math.sin(a) * 0.2, Math.cos(a) * r, (2.2 + Math.random() * 2.4) * force, Math.sin(a) * r)
    }
  }

  private stepDrops(dt: number) {
    const d = this.drops
    const m = new THREE.Matrix4()
    let any = false
    for (let i = 0; i < d.life.length; i++) {
      if (d.life[i]! >= 1) continue
      any = true
      d.vel[i * 3 + 1]! -= 9.8 * dt
      d.pos[i * 3]! += d.vel[i * 3]! * dt
      d.pos[i * 3 + 1]! += d.vel[i * 3 + 1]! * dt
      d.pos[i * 3 + 2]! += d.vel[i * 3 + 2]! * dt
      d.life[i] = Math.min(1, d.life[i]! + dt / 1.2)
      if (d.pos[i * 3 + 1]! < -0.15 && d.vel[i * 3 + 1]! < 0) d.life[i] = 1
      const s = d.life[i]! >= 1 ? 0 : 1 - d.life[i]! * 0.6
      m.makeScale(s, s, s).setPosition(d.pos[i * 3]!, d.pos[i * 3 + 1]!, d.pos[i * 3 + 2]!)
      d.mesh.setMatrixAt(i, m)
    }
    if (any) d.mesh.instanceMatrix.needsUpdate = true
  }

  private addRipple(x: number, z: number, strength: number) {
    this.ripples[this.rippleIdx]!.set(x, z, this.clock, strength)
    this.rippleIdx = (this.rippleIdx + 1) % MAX_RIPPLES
  }

  // ───────── day & night ─────────

  private applyNight(k: number) {
    const c = (a: string, b: string) => new THREE.Color(a).lerp(new THREE.Color(b), k)
    this.fog.color.copy(c(DAY.fog, NIGHT.fog))
    this.fog.color.getRGB(U.uFogColor.value, THREE.SRGBColorSpace)
    skyU.uTop.value.copy(c(DAY.skyTop, NIGHT.skyTop))
    skyU.uHorizon.value.copy(this.fog.color)
    skyU.uSunGlow.value.copy(c(DAY.sunGlow, NIGHT.sunGlow))
    waterColors.uShallow.value.copy(c(DAY.shallow, NIGHT.shallow))
    waterColors.uMid.value.copy(c(DAY.mid, NIGHT.mid))
    waterColors.uDeep.value.copy(c(DAY.deep, NIGHT.deep))
    waterColors.uOcean.value.copy(c(DAY.ocean, NIGHT.ocean))
    waterColors.uFoam.value.copy(c(DAY.foam, NIGHT.foam))
    waterColors.uSkyRefl.value.copy(c(DAY.skyRefl, NIGHT.skyRefl))
    waterColors.uSpec.value.copy(c(DAY.spec, NIGHT.spec))
    this.sun.color.copy(c(DAY.sun, NIGHT.sun))
    this.sun.intensity = lerp(DAY.sunI, NIGHT.sunI, k)
    this.hemi.color.copy(c(DAY.hemiSky, NIGHT.hemiSky))
    this.hemi.groundColor.copy(c(DAY.hemiGround, NIGHT.hemiGround))
    this.hemi.intensity = lerp(DAY.hemiI, NIGHT.hemiI, k)
    U.uSunDir.value.copy(SUN_DIR).lerp(MOON_DIR, k).normalize()
    U.uNight.value = k
    terrainColors.uCaustic.value = lerp(DAY.caustic, NIGHT.caustic, k)
    this.renderer.toneMappingExposure = lerp(DAY.exposure, NIGHT.exposure, k)
    // lanterns, windows and the lighthouse come on
    this.glowMat.color.setRGB(lerp(0.9, 1.6, k), lerp(0.9, 1.45, k), lerp(0.88, 1.2, k))
    this.haloMat.uniforms.uOpacity!.value = k
    this.beamMat.opacity = k * 0.2
    for (const cl of this.clouds) cl.mat.emissiveIntensity = lerp(DAY.cloudGlow, NIGHT.cloudGlow, k)
    const beacon = c(DAY.beacon, NIGHT.beacon)
    for (const f of this.bottles.values()) {
      f.mesh.paperMat.emissiveIntensity = k * 0.6
      ;(f.mesh.beaconMat.uniforms.uColor!.value as THREE.Color).copy(beacon)
    }
    if (this.paper) this.paper.mat.uniforms.uLight!.value = lerp(1, 0.9, k)
  }

  // ───────── HUD: where's the nearest unread bottle? ─────────

  private bent(v: THREE.Vector3) {
    const out = v.clone()
    out.y -= this.bendAt(v.x, v.z)
    return out
  }

  private stepPointer() {
    const { pointer, label } = this.opts.hud
    let best: Floating | null = null
    let bestD = Infinity
    for (const f of this.bottles.values()) {
      if (f.read || f.state !== 'float' || f.delay > 0) continue
      const d = Math.hypot(f.x - this.boat.x, f.z - this.boat.z)
      if (d < bestD) {
        best = f
        bestD = d
      }
    }
    if (!best || this.phase === 'busy') {
      pointer.style.opacity = '0'
      return
    }
    const p = this.bent(new THREE.Vector3(best.x, best.y + 1, best.z)).project(this.camera)
    const behind = p.z > 1
    let x = behind ? -p.x : p.x
    let y = behind ? -p.y : p.y
    if (!behind && Math.abs(x) < 0.9 && Math.abs(y) < 0.85) {
      pointer.style.opacity = '0'
      return
    }
    // clamp the direction to a box inside the screen edges
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    const mx = 1 - 56 / (w / 2)
    const my = 1 - 72 / (h / 2)
    const s = Math.max(Math.abs(x) / mx, Math.abs(y) / my, 1e-6)
    x /= s
    y /= s
    const px = (x * w) / 2
    const py = (-y * h) / 2
    pointer.style.opacity = '1'
    pointer.style.transform = `translate(${px}px, ${py}px)`
    pointer.style.setProperty('--angle', `${Math.atan2(py, px)}rad`)
    label.textContent = `${Math.round(bestD)} m`
  }

  // ───────── frame ─────────

  private resize() {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    if (!w || !h) return
    this.renderer.setPixelRatio(this.dpr)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.fov = w / h < 0.8 ? 52 : 40
    this.camera.updateProjectionMatrix()
    this.haloMat.uniforms.uScale!.value = (h * this.dpr) / (2 * Math.tan((this.camera.fov * Math.PI) / 360))
    if (!this.running) this.render()
  }

  private updateRunning = () => {
    const should = this.started && this.visible && document.visibilityState === 'visible'
    if (should === this.running) return
    this.running = should
    if (should) {
      this.last = performance.now()
      this.raf = requestAnimationFrame(this.frame)
    }
    else {
      cancelAnimationFrame(this.raf)
      this.opts.synth.motion(0)
    }
  }

  private frame = (now: number) => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.frame)
    const raw = (now - this.last) / 1000
    const dt = Math.min(raw, 1 / 20)
    this.last = now
    this.adapt(raw)
    this.step(dt)
    this.render()
  }

  /** drop the resolution a notch if frames are consistently slow */
  private adapt(raw: number) {
    this.frameTimes.push(raw)
    if (this.frameTimes.length < 90) return
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
    this.frameTimes = []
    if (avg > 1 / 40 && this.dpr > 0.85) {
      this.dpr = Math.max(0.85, this.dpr - 0.25)
      this.resize()
    }
  }

  private step(dt: number) {
    this.clock += dt
    this.waveTime += dt * (this.opts.reducedMotion ? 0.5 : 1)
    U.uClock.value = this.clock
    U.uTime.value = this.waveTime

    for (const tw of [...this.tweens]) {
      tw.t = Math.min(1, tw.t + dt / tw.dur)
      tw.fn(tw.t)
      if (tw.t >= 1) {
        this.tweens.delete(tw)
        tw.done()
      }
    }
    if (Math.abs(this.night - this.nightTarget) > 0.001) {
      this.night += (this.nightTarget - this.night) * (1 - Math.exp(-dt * 2.2))
      if (Math.abs(this.night - this.nightTarget) < 0.002) this.night = this.nightTarget
      this.applyNight(this.night)
    }

    this.stepBoat(dt)
    this.stream()
    this.updateCamera(dt)
    this.stepBottles(dt)
    this.tideKeeping(dt)
    this.stepClouds(dt)
    this.stepGulls(dt)
    this.stepFish(dt)
    this.stepDrops(dt)
    if (this.held) this.stepHeld()
    for (const d of this.decor.values()) for (const b of d.beams) b.rotation.y += dt * 0.8
    this.stepPointer()

    // a gull now and then, chimes on the breeze
    this.timers.gull -= dt
    if (this.timers.gull < 0) {
      this.timers.gull = 9 + Math.random() * 14
      if (this.night < 0.5) this.opts.synth.gull()
    }
    this.timers.chime -= dt
    if (this.timers.chime < 0) {
      this.timers.chime = 7 + Math.random() * 9
      if (this.phase !== 'busy') this.opts.synth.chime()
    }
  }

  private stepHeld() {
    const f = this.held!
    const h = f.mesh.holder
    const bob = this.opts.reducedMotion ? 0 : Math.sin(this.clock * 2) * 0.03
    let dx = 0
    let dy = 0
    const g = this.gesture
    if (g && g.samples.length) {
      const s = g.samples.at(-1)!
      const c = this.canvas.getBoundingClientRect()
      dx = clamp((s.x - g.x) / c.height, -0.4, 0.4)
      dy = clamp((s.y - g.y) / c.height, -0.4, 0.4)
    }
    h.position.copy(this.holdPos()).add(new THREE.Vector3(dx * 2, bob - dy * 2, 0))
    f.mesh.group.quaternion.copy(this.holdQuat())
    f.mesh.group.rotateZ(dx * 0.8)
  }

  private render() {
    this.renderer.render(this.scene, this.camera)
  }

  // ───────── input ─────────

  private static KEYS: Record<string, string> = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ShiftLeft: 'boost', ShiftRight: 'boost',
  }

  private typing(e: Event) {
    const t = e.target as HTMLElement | null
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.typing(e)) return
    const k = SeaEngine.KEYS[e.code]
    if (k && this.controls) {
      this.keys.add(k)
      if (k !== 'boost') e.preventDefault()
      return
    }
    if (e.code === 'Space' || e.code === 'KeyE') {
      if (this.phase === 'holding') {
        e.preventDefault()
        void this.throwHeld()
      }
      else if (this.nearId && this.phase === 'idle' && this.controls) {
        e.preventDefault()
        this.pickNear()
      }
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    const k = SeaEngine.KEYS[e.code]
    if (k) this.keys.delete(k)
  }

  private onBlur = () => this.keys.clear()

  private ndc(x: number, y: number) {
    const r = this.canvas.getBoundingClientRect()
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
  }

  /** the bottle under the pointer, judged on screen (where the bend has put it) */
  private bottleAt(x: number, y: number) {
    const r = this.canvas.getBoundingClientRect()
    let best: Floating | null = null
    let bestD = Infinity
    for (const f of this.bottles.values()) {
      if (f.state !== 'float' || f.delay > 0) continue
      const w = this.bent(new THREE.Vector3(f.x, f.y + 0.3, f.z))
      const dist = w.distanceTo(this.camera.position)
      const p = w.project(this.camera)
      if (p.z > 1) continue
      const sx = r.left + ((p.x + 1) / 2) * r.width
      const sy = r.top + ((1 - p.y) / 2) * r.height
      const rad = Math.max(26, (900 / dist) * (r.height / 800))
      const d = Math.hypot(sx - x, sy - y)
      if (d < rad && d < bestD) {
        best = f
        bestD = d
      }
    }
    return best
  }

  /** where the pointer meets the (curved) sea, in flat world coordinates */
  private seaAt(x: number, y: number) {
    this.raycaster.setFromCamera(this.ndc(x, y), this.camera)
    const o = this.raycaster.ray.origin
    const d = this.raycaster.ray.direction
    const f = (t: number) => o.y + d.y * t + this.bendAt(o.x + d.x * t, o.z + d.z * t)
    let a = 0
    for (let t = 1; t < 400; t += 1.5) {
      if (f(t) <= 0) {
        let lo = a
        let hi = t
        for (let i = 0; i < 20; i++) {
          const m = (lo + hi) / 2
          if (f(m) > 0) lo = m
          else hi = m
        }
        return new THREE.Vector2(o.x + d.x * hi, o.z + d.z * hi)
      }
      a = t
    }
    return null
  }

  private setCourse(x: number, y: number) {
    const p = this.seaAt(x, y)
    if (!p) return
    this.dest = p
    this.destStop = 1.6
    this.markMoved()
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      this.pinch = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), zoom: this.zoomGoal }
      this.gesture = undefined
      return
    }
    if (!this.controls && this.phase !== 'holding') return
    this.canvas.setPointerCapture?.(e.pointerId)
    this.gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), samples: [{ x: e.clientX, y: e.clientY, t: performance.now() }], moved: false }
    if (this.phase === 'holding') this.canvas.style.cursor = 'grabbing'
  }

  private onPointerMove = (e: PointerEvent) => {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y)
      this.zoomGoal = clamp(this.pinch.zoom * (this.pinch.d / Math.max(d, 1)), ZOOM.min, ZOOM.max)
      return
    }
    const g = this.gesture
    if (g && g.id === e.pointerId) {
      g.samples.push({ x: e.clientX, y: e.clientY, t: performance.now() })
      if (g.samples.length > 14) g.samples.shift()
      if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 8) g.moved = true
      // hold and drag to steer, like a finger in the water
      if (g.moved && this.phase !== 'holding' && this.controls) this.setCourse(e.clientX, e.clientY)
      return
    }
    if (e.target !== this.canvas || e.pointerType !== 'mouse') return
    const f = this.phase === 'idle' ? this.bottleAt(e.clientX, e.clientY) : null
    this.hoverId = f?.id ?? null
    this.canvas.style.cursor = f ? 'pointer' : this.phase === 'holding' ? 'grab' : ''
  }

  private onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId)
    if (this.pinch) {
      if (this.pointers.size < 2) this.pinch = undefined
      return
    }
    const g = this.gesture
    if (!g || g.id !== e.pointerId) return
    this.gesture = undefined
    if (this.phase === 'holding') this.canvas.style.cursor = 'grab'
    g.samples.push({ x: e.clientX, y: e.clientY, t: performance.now() })
    // a flick upwards throws the bottle you're holding
    if (this.phase === 'holding') {
      const end = g.samples.at(-1)!
      const start = g.samples.find(s => end.t - s.t < 90) ?? g.samples[0]!
      const dt = Math.max((end.t - start.t) / 1000, 0.016)
      const vy = (end.y - start.y) / dt
      if (vy < -350) return void this.throwHeld((end.x - start.x) / dt, vy)
    }
    if (g.moved || !this.controls) return
    // a tap: a bottle within reach is fished out, a far one becomes the course
    const f = this.phase === 'idle' ? this.bottleAt(e.clientX, e.clientY) : null
    if (f) {
      const d = Math.hypot(f.x - this.boat.x, f.z - this.boat.z)
      if (d < PICK_DIST + 0.5) return void this.opts.events.pick?.(f.id)
      this.dest = new THREE.Vector2(f.x, f.z)
      this.destStop = 2.6
      this.markMoved()
      return
    }
    this.setCourse(e.clientX, e.clientY)
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    this.zoomGoal = clamp(this.zoomGoal * Math.exp(e.deltaY * 0.0012), ZOOM.min, ZOOM.max)
  }

  // ───────── tweens ─────────

  private tween(dur: number, fn: (k: number) => void, e: (t: number) => number = ease.inOut) {
    return new Promise<void>((resolve) => {
      if (!this.running) {
        fn(e(1))
        return resolve()
      }
      this.tweens.add({ t: 0, dur: Math.max(0.01, dur * (this.opts.reducedMotion ? 0.6 : 1)), fn: t => fn(e(t)), done: resolve })
    })
  }

  private setPose(o: THREE.Object3D, p: Pose) {
    o.position.copy(p.pos)
    o.quaternion.copy(p.quat)
    o.scale.setScalar(p.scale)
  }

  private tweenPose(o: THREE.Object3D, to: Pose, dur: number, e = ease.inOut) {
    const p0 = o.position.clone()
    const q0 = o.quaternion.clone()
    const s0 = o.scale.x
    return this.tween(dur, (k) => {
      o.position.lerpVectors(p0, to.pos, k)
      o.quaternion.slerpQuaternions(q0, to.quat, k)
      o.scale.setScalar(s0 + (to.scale - s0) * k)
    }, e)
  }
}
