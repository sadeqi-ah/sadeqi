/**
 * Little bursts of joy: stars that pop out when the boat bumps into a beach,
 * confetti when a bottle is fished out, bubbles fizzing behind the hull.
 *
 * One InstancedMesh per kind (one draw call each); particles live in flat
 * typed arrays and are recycled round-robin, like the splash drops.
 */
import * as THREE from 'three'
import { curved } from './materials'

export type SparkKind = 'star' | 'confetti' | 'bubble'

const PALETTE: Record<SparkKind, string[]> = {
  star: ['#ffe066', '#fff3b0', '#ffd23f', '#ffffff'],
  confetti: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff8fd8', '#ffffff', '#b28dff'],
  bubble: ['#ffffff', '#e9fbff'],
}

function starGeometry() {
  const s = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2
    const r = i % 2 ? 0.45 : 1
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 1 })
  g.center()
  return g
}

interface Pool {
  kind: SparkKind
  mesh: THREE.InstancedMesh
  pos: Float32Array
  vel: Float32Array
  rot: Float32Array
  spin: Float32Array
  life: Float32Array
  dur: Float32Array
  size: Float32Array
  grav: Float32Array
  next: number
  alive: number
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _c = new THREE.Color()
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export class Sparkles {
  private pools: Record<SparkKind, Pool>

  constructor(scene: THREE.Scene, mobile: boolean) {
    const make = (kind: SparkKind, geo: THREE.BufferGeometry, mat: THREE.Material, n: number): Pool => {
      const mesh = new THREE.InstancedMesh(geo, mat, n)
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false
      mesh.renderOrder = 4
      _m.makeScale(0, 0, 0)
      for (let i = 0; i < n; i++) {
        mesh.setMatrixAt(i, _m)
        mesh.setColorAt(i, _c.set('#ffffff'))
      }
      scene.add(mesh)
      return {
        kind, mesh, next: 0, alive: 0,
        pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), rot: new Float32Array(n * 3), spin: new Float32Array(n * 3),
        life: new Float32Array(n).fill(1), dur: new Float32Array(n).fill(1), size: new Float32Array(n), grav: new Float32Array(n),
      }
    }
    const k = mobile ? 0.6 : 1
    this.pools = {
      star: make('star', starGeometry(), curved(new THREE.MeshBasicMaterial({ toneMapped: false }), { key: 'spark-star' }), Math.round(60 * k)),
      confetti: make('confetti', new THREE.PlaneGeometry(0.16, 0.26), curved(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), { key: 'spark-confetti' }), Math.round(160 * k)),
      bubble: make('bubble', new THREE.IcosahedronGeometry(0.11, 1), curved(new THREE.MeshLambertMaterial({ emissive: '#bfefff', emissiveIntensity: 0.55, transparent: true, opacity: 0.8 }), { key: 'spark-bubble' }), Math.round(80 * k)),
    }
  }

  /**
   * `count` particles of `kind` from (x, y, z). `force` scales how hard they
   * fly out; `up` how much of that goes upwards.
   */
  emit(kind: SparkKind, x: number, y: number, z: number, count: number, force = 1, up = 1) {
    const p = this.pools[kind]
    const n = p.life.length
    const pal = PALETTE[kind]
    for (let c = 0; c < count; c++) {
      const i = p.next
      p.next = (p.next + 1) % n
      const a = Math.random() * Math.PI * 2
      const out = (kind === 'bubble' ? 0.15 : 1.2 + Math.random() * 2.2) * force
      const vy = kind === 'bubble' ? 0.25 + Math.random() * 0.2 : (3 + Math.random() * 3.5) * force * up
      p.pos.set([x + Math.cos(a) * 0.15, y, z + Math.sin(a) * 0.15], i * 3)
      p.vel.set([Math.cos(a) * out, vy, Math.sin(a) * out], i * 3)
      p.rot.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3)
      const sp = kind === 'confetti' ? 9 : kind === 'star' ? 5 : 0
      p.spin.set([(Math.random() - 0.5) * sp, (Math.random() - 0.5) * sp, (Math.random() - 0.5) * sp], i * 3)
      p.life[i] = 0
      p.dur[i] = kind === 'confetti' ? 2.2 + Math.random() * 1.2 : kind === 'star' ? 0.9 + Math.random() * 0.4 : 0.9 + Math.random() * 0.8
      p.size[i] = kind === 'star' ? 0.13 + Math.random() * 0.1 : kind === 'bubble' ? 0.5 + Math.random() * 0.7 : 0.8 + Math.random() * 0.5
      p.grav[i] = kind === 'confetti' ? 5 : kind === 'star' ? 7 : 0
      p.mesh.setColorAt(i, _c.set(pal[Math.floor(Math.random() * pal.length)]!))
    }
    p.alive = Math.max(p.alive, 1)
    if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true
  }

  step(dt: number) {
    for (const p of Object.values(this.pools)) {
      if (!p.alive) continue
      let any = 0
      const n = p.life.length
      for (let i = 0; i < n; i++) {
        if (p.life[i]! >= p.dur[i]!) continue
        any++
        const j = i * 3
        p.life[i]! += dt
        const k = Math.min(1, p.life[i]! / p.dur[i]!)
        // confetti flutters: lots of air drag, and a sideways sway as it falls
        const drag = p.kind === 'confetti' ? 2.6 : p.kind === 'star' ? 1.2 : 3
        const damp = Math.exp(-drag * dt)
        p.vel[j]! *= damp
        p.vel[j + 2]! *= damp
        p.vel[j + 1]! = p.vel[j + 1]! * (p.kind === 'confetti' ? damp : 1) - p.grav[i]! * dt
        if (p.kind === 'confetti') p.vel[j]! += Math.sin(p.life[i]! * 6 + i) * dt * 3
        p.pos[j]! += p.vel[j]! * dt
        p.pos[j + 1]! += p.vel[j + 1]! * dt
        p.pos[j + 2]! += p.vel[j + 2]! * dt
        // anything that lands on the water floats there
        if (p.pos[j + 1]! < 0.04 && p.vel[j + 1]! < 0) {
          p.pos[j + 1] = 0.04
          p.vel[j + 1] = 0
          p.vel[j]! *= 0.5
          p.vel[j + 2]! *= 0.5
          p.spin[j]! *= 0.9
          p.spin[j + 2]! *= 0.9
        }
        p.rot[j]! += p.spin[j]! * dt
        p.rot[j + 1]! += p.spin[j + 1]! * dt
        p.rot[j + 2]! += p.spin[j + 2]! * dt

        let s = p.size[i]!
        if (p.kind === 'star') s *= smooth(0, 0.12, k) * (1 + 0.35 * Math.sin(Math.min(k / 0.25, 1) * Math.PI)) * (1 - smooth(0.6, 1, k))
        else if (p.kind === 'confetti') s *= smooth(0, 0.05, k) * (1 - smooth(0.75, 1, k))
        else s *= k < 0.88 ? 0.5 + 0.5 * smooth(0, 0.3, k) : 1 + (k - 0.88) * 6 * (k < 0.97 ? 1 : 0)
        if (p.kind === 'bubble' && k >= 0.97) s = 0

        _e.set(p.rot[j]!, p.rot[j + 1]!, p.rot[j + 2]!)
        _q.setFromEuler(_e)
        _m.compose(_p.set(p.pos[j]!, p.pos[j + 1]!, p.pos[j + 2]!), _q, _s.setScalar(Math.max(s, 0)))
        if (p.life[i]! >= p.dur[i]!) _m.makeScale(0, 0, 0)
        p.mesh.setMatrixAt(i, _m)
      }
      p.mesh.instanceMatrix.needsUpdate = true
      p.alive = any
    }
  }
}
