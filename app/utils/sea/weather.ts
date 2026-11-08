/**
 * Moods of the sky: every so often a soft shower drifts over (the light
 * greys, the clouds darken, rain patters on the sea) and, if it's day, a
 * rainbow comes out after it. At night fireflies blink over the islands and
 * now and then a shooting star streaks across the sky.
 *
 * `gloom` (0..1) is how overcast it is; the engine folds it into its
 * lighting.
 */
import * as THREE from 'three'
import { curved, fireflyMaterial, rainbowMaterial, streakMaterial } from './materials'
import { heightFromSdf, islandSdf, islandsNear } from './world'
import type { SeaSynth } from './synth'

export interface WeatherEnv {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  synth: SeaSynth
  haloScale: THREE.IUniform
  reduced: boolean
  /** where the camera looks, and from which way (unit xz, target → camera) */
  target: THREE.Vector3
  camDir: THREE.Vector2
  boat: { x: number, z: number }
  clock: number
  night: number
  /** is there sky (not sea) at this point on screen, in NDC? */
  skyAt: (x: number, y: number) => boolean
}

const clamp = THREE.MathUtils.clamp
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const WIND = new THREE.Vector2(0.8, -0.6).normalize()
const RAIN_BOX = 34
const RAIN_TOP = 22

export class Weather {
  gloom = 0
  private state: 'clear' | 'rain' = 'clear'
  private timer = 55 + Math.random() * 40
  private rain = 0
  private rainGoal = 0
  private drops: THREE.InstancedMesh
  private dropPos: Float32Array
  private rainbow: THREE.Mesh
  private rainbowMat: THREE.ShaderMaterial
  private bow = { t: -1 }
  private flies: THREE.Points
  private flyMat: THREE.ShaderMaterial
  private flyHome: { x: number, z: number, y: number, a: number, b: number, c: number, p: number }[] = []
  private flyTimer = 0
  private streak: THREE.Mesh
  private streakMat: THREE.ShaderMaterial
  private star = { t: -1, wait: 6, x: 0, y: 0, dx: 0, dy: 0, len: 0 }

  constructor(private env: WeatherEnv, mobile: boolean) {
    // rain: thin streaks in a box that follows the view
    const n = mobile ? 260 : 520
    const mat = curved(new THREE.MeshBasicMaterial({ color: '#eaf6ff', transparent: true, opacity: 0.5, depthWrite: false }), { key: 'rain' })
    const geo = new THREE.BoxGeometry(0.035, 0.75, 0.035)
    // lean with the wind
    geo.rotateX(WIND.y * 0.25)
    geo.rotateZ(-WIND.x * 0.25)
    this.drops = new THREE.InstancedMesh(geo, mat, n)
    this.drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.drops.frustumCulled = false
    this.drops.renderOrder = 8
    this.drops.count = 0
    this.dropPos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) this.respawn(i, Math.random() * RAIN_TOP)
    env.scene.add(this.drops)

    this.rainbowMat = rainbowMaterial(19, 23.5)
    this.rainbow = new THREE.Mesh(new THREE.RingGeometry(19, 23.5, 96, 6, 0, Math.PI), this.rainbowMat)
    this.rainbow.frustumCulled = false
    this.rainbow.renderOrder = 3
    this.rainbow.visible = false
    env.scene.add(this.rainbow)

    // fireflies over the islands near the boat
    const nf = mobile ? 36 : 64
    const pos = new Float32Array(nf * 3)
    const phase = new Float32Array(nf)
    for (let i = 0; i < nf; i++) {
      phase[i] = Math.random()
      this.flyHome.push({ x: 1e5, z: 1e5, y: 0, a: 0.3 + Math.random() * 0.5, b: 0.5 + Math.random() * 0.8, c: 0.3 + Math.random() * 0.5, p: Math.random() * 6.28 })
    }
    const fg = new THREE.BufferGeometry()
    fg.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
    fg.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    this.flyMat = fireflyMaterial(env.haloScale)
    this.flies = new THREE.Points(fg, this.flyMat)
    this.flies.frustumCulled = false
    this.flies.renderOrder = 5
    this.flies.visible = false
    env.scene.add(this.flies)

    // a shooting star lives in camera space, far off, so only the sky shows it
    this.streakMat = streakMaterial()
    const sg = new THREE.PlaneGeometry(1, 1)
    sg.translate(-0.5, 0, 0)
    this.streak = new THREE.Mesh(sg, this.streakMat)
    this.streak.frustumCulled = false
    this.streak.renderOrder = -5
    this.streak.visible = false
    env.camera.add(this.streak)
  }

  /** start a shower now (for trying it out) */
  showerNow() {
    this.state = 'rain'
    this.rainGoal = 1
    this.timer = 25
  }

  /** a shooting star now (at night) */
  wishNow() {
    this.star.wait = 0
  }

  private respawn(i: number, y = RAIN_TOP) {
    this.dropPos[i * 3] = (Math.random() - 0.5) * 2 * RAIN_BOX
    this.dropPos[i * 3 + 1] = y
    this.dropPos[i * 3 + 2] = (Math.random() - 0.5) * 2 * RAIN_BOX
  }

  step(dt: number) {
    this.stepCycle(dt)
    this.stepRain(dt)
    this.stepRainbow(dt)
    this.stepFlies(dt)
    this.stepStar(dt)
  }

  private stepCycle(dt: number) {
    this.timer -= dt
    if (this.timer > 0) return
    if (this.state === 'clear') {
      this.state = 'rain'
      this.rainGoal = 0.7 + Math.random() * 0.3
      this.timer = 22 + Math.random() * 14
    }
    else {
      this.state = 'clear'
      this.rainGoal = 0
      this.timer = 90 + Math.random() * 90
      // the sun comes back out: a rainbow
      if (this.env.night < 0.4) this.bow.t = 0
    }
  }

  private stepRain(dt: number) {
    const e = this.env
    this.rain += (this.rainGoal - this.rain) * (1 - Math.exp(-dt * (this.rainGoal > this.rain ? 0.35 : 0.3)))
    if (this.rain < 0.002 && this.rainGoal === 0) this.rain = 0
    this.gloom = smooth(0, 0.8, this.rain)
    e.synth.rain(this.rain)
    const n = this.dropPos.length / 3
    const count = Math.round(n * clamp(this.rain * 1.2, 0, 1))
    this.drops.count = count
    if (!count) return
    const m = new THREE.Matrix4()
    const fall = 17
    const t = e.target
    for (let i = 0; i < count; i++) {
      const j = i * 3
      this.dropPos[j]! += WIND.x * 3 * dt
      this.dropPos[j + 1]! -= fall * dt
      this.dropPos[j + 2]! += WIND.y * 3 * dt
      if (this.dropPos[j + 1]! < 0) this.respawn(i)
      // the box wraps round the view so it never runs out of rain
      let x = this.dropPos[j]!
      let z = this.dropPos[j + 2]!
      x = ((((x + RAIN_BOX - t.x) % (2 * RAIN_BOX)) + 2 * RAIN_BOX) % (2 * RAIN_BOX)) - RAIN_BOX + t.x
      z = ((((z + RAIN_BOX - t.z) % (2 * RAIN_BOX)) + 2 * RAIN_BOX) % (2 * RAIN_BOX)) - RAIN_BOX + t.z
      m.makeTranslation(x, this.dropPos[j + 1]!, z)
      this.drops.setMatrixAt(i, m)
    }
    this.drops.instanceMatrix.needsUpdate = true
    ;(this.drops.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - this.env.night * 0.4)
  }

  private stepRainbow(dt: number) {
    const e = this.env
    const b = this.bow
    if (b.t < 0) {
      this.rainbow.visible = false
      return
    }
    b.t += dt
    const HOLD = 26
    const k = smooth(1.5, 6, b.t) * (1 - smooth(HOLD, HOLD + 6, b.t)) * (1 - e.night) * (1 - this.gloom)
    this.rainbowMat.uniforms.uOpacity!.value = k * 0.55
    this.rainbow.visible = k > 0.003
    // stands far off on the other side of the view, facing the camera
    const d = 46
    this.rainbow.position.set(e.target.x - e.camDir.x * d, -12, e.target.z - e.camDir.y * d)
    this.rainbow.rotation.set(0, Math.atan2(e.camDir.x, e.camDir.y), 0)
    if (b.t > HOLD + 6) b.t = -1
  }

  private stepFlies(dt: number) {
    const e = this.env
    const k = smooth(0.35, 0.9, e.night)
    this.flyMat.uniforms.uOpacity!.value = k
    this.flies.visible = k > 0.01
    if (!this.flies.visible) return
    this.flyTimer -= dt
    if (this.flyTimer <= 0) {
      this.flyTimer = 2
      const isles = islandsNear(e.boat.x, e.boat.z, 40).slice(0, 4)
      if (isles.length) {
        for (const f of this.flyHome) {
          if (Math.hypot(f.x - e.boat.x, f.z - e.boat.z) < 70) continue
          const isl = isles[Math.floor(Math.random() * isles.length)]!
          for (let tries = 0; tries < 8; tries++) {
            const a = Math.random() * Math.PI * 2
            const r = Math.random() * isl.bound
            const x = isl.x + Math.cos(a) * r
            const z = isl.z + Math.sin(a) * r
            const d = islandSdf(isl, x, z)
            if (d > -1.5 || d < -14) continue
            f.x = x
            f.z = z
            f.y = heightFromSdf(d, isl.kind) + 0.6 + Math.random() * 1.6
            break
          }
        }
      }
    }
    const attr = this.flies.geometry.attributes.position as THREE.BufferAttribute
    const t = e.clock
    for (const [i, f] of this.flyHome.entries()) {
      attr.setXYZ(i,
        f.x + Math.sin(t * f.a + f.p) * 1.4 + Math.sin(t * f.b * 1.7) * 0.3,
        f.y + Math.sin(t * f.b + f.p * 2) * 0.45,
        f.z + Math.cos(t * f.c + f.p) * 1.4)
    }
    attr.needsUpdate = true
  }

  private stepStar(dt: number) {
    const e = this.env
    const s = this.star
    if (s.t < 0) {
      if (e.night < 0.8) return
      s.wait -= dt
      if (s.wait > 0) return
      s.wait = 4
      const x = -0.75 + Math.random() * 1.2
      const y = 0.55 + Math.random() * 0.35
      if (!e.skyAt(x, y)) return
      s.wait = 16 + Math.random() * 22
      s.t = 0
      s.x = x
      s.y = y
      const left = Math.random() < 0.3
      const a = -0.35 - Math.random() * 0.25
      s.dx = Math.cos(a) * (left ? -1 : 1)
      s.dy = Math.sin(a)
      s.len = 0.5 + Math.random() * 0.3
      this.streak.visible = true
      e.synth.wish()
      return
    }
    s.t += dt / 1.1
    const k = Math.min(s.t, 1)
    const D = 380
    const halfH = D * Math.tan((e.camera.fov * Math.PI) / 360)
    const halfW = halfH * e.camera.aspect
    const travel = 0.55 * k
    this.streak.position.set((s.x + s.dx * travel) * halfW, (s.y + s.dy * travel) * halfH, -D)
    this.streak.rotation.set(0, 0, Math.atan2(s.dy * halfH, s.dx * halfW))
    this.streak.scale.set(s.len * halfH * Math.min(1, k * 2.5), halfH * 0.012, 1)
    this.streakMat.uniforms.uOpacity!.value = Math.sin(Math.PI * k) * e.night
    if (s.t >= 1) {
      s.t = -1
      this.streak.visible = false
    }
  }
}
