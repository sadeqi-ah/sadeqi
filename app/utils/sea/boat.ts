/**
 * The player's boat: a little wooden sailboat with a striped mainsail and a
 * jib, a pennant at the masthead, a lantern on the stern and a crate of
 * spare bottles. The sails billow with speed and flutter at the edges.
 *
 * Bow points to -z. `group` carries position and heading, `tilt` the
 * pitch and roll from the waves.
 */
import * as THREE from 'three'
import { Builder, hullGeometry, mat4 } from './props'
import { clothMaterial, curved } from './materials'

export interface BoatModel {
  group: THREE.Group
  tilt: THREE.Group
  billow: { value: number }
  /** lantern position in boat space, for its halo */
  lantern: THREE.Vector3
  /** the ship's cat, in a captain's hat */
  captain: Captain
  /** top of the mast in boat space, where a gull can perch */
  masthead: THREE.Vector3
}

/** which way the cat faces, as a heading in boat space (0 = bow, clockwise) */
export const CAPTAIN_FACING = 2.5

export interface Captain {
  root: THREE.Group
  head: THREE.Group
  arms: [THREE.Group, THREE.Group]
  tail: THREE.Group
}

/**
 * A little orange cat with a white muzzle, a navy-and-white captain's hat,
 * paws it can wave and a tail that swishes. Faces the bow (-z); feet at y 0.
 */
function createCaptain(props: THREE.Material): Captain {
  const fur = '#ffa94d'
  const pale = '#fff1dc'
  const root = new THREE.Group()
  const sphere = new THREE.SphereGeometry(1, 12, 9)
  const cone = new THREE.ConeGeometry(1, 1, 4)
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 14)
  const mk = (b: Builder) => {
    const m = new THREE.Mesh(b.build()!, props)
    m.castShadow = true
    return m
  }

  const body = new Builder()
  body.add(sphere, v => (v.z < -0.45 && v.y < 0.4 ? pale : fur), mat4([0, 0.24, 0], [0, 0, 0], [0.2, 0.24, 0.18]))
  for (const s of [-1, 1]) body.add(sphere, pale, mat4([0.09 * s, 0.03, -0.08], [0, 0, 0], [0.07, 0.04, 0.09]))
  root.add(mk(body))

  const head = new THREE.Group()
  head.position.set(0, 0.5, 0)
  const hb = new Builder()
  hb.add(sphere, fur, mat4([0, 0.13, 0], [0, 0, 0], [0.21, 0.18, 0.19]))
  hb.add(sphere, pale, mat4([0, 0.07, -0.14], [0, 0, 0], [0.11, 0.07, 0.07]))
  hb.add(sphere, '#ff8fa3', mat4([0, 0.11, -0.2], [0, 0, 0], [0.025, 0.018, 0.02]))
  for (const s of [-1, 1]) {
    hb.add(cone, fur, mat4([0.12 * s, 0.3, 0], [0, 0, s * -0.35], [0.07, 0.14, 0.05]))
    hb.add(cone, '#ffc2cf', mat4([0.12 * s, 0.29, -0.012], [0, 0, s * -0.35], [0.04, 0.09, 0.03]))
    hb.add(sphere, '#26222a', mat4([0.075 * s, 0.17, -0.165], [0, 0, 0], [0.032, 0.04, 0.02]), 0, 0)
    hb.add(sphere, '#ffffff', mat4([0.075 * s + 0.012, 0.185, -0.18], [0, 0, 0], [0.01, 0.01, 0.01]), 0, 0)
    hb.add(sphere, '#ffb0bf', mat4([0.13 * s, 0.09, -0.13], [0, 0, 0], [0.035, 0.022, 0.015]), 0, 0)
  }
  // the hat: white crown, navy band and peak, a gold anchor-ish badge
  hb.add(cyl, '#ffffff', mat4([0, 0.33, 0.01], [-0.12, 0, 0], [0.17, 0.09, 0.17]))
  hb.add(cyl, '#25355e', mat4([0, 0.29, 0.01], [-0.12, 0, 0], [0.175, 0.035, 0.175]))
  hb.add(sphere, '#25355e', mat4([0, 0.28, -0.13], [-0.25, 0, 0], [0.13, 0.015, 0.08]))
  hb.add(sphere, '#ffd23f', mat4([0, 0.31, -0.16], [0, 0, 0], [0.03, 0.03, 0.015]), 0, 0)
  head.add(mk(hb))
  root.add(head)

  const arms: THREE.Group[] = []
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group()
    pivot.position.set(0.16 * s, 0.36, -0.04)
    const ab = new Builder()
    ab.add(sphere, fur, mat4([0.02 * s, -0.1, 0], [0, 0, 0], [0.05, 0.11, 0.05]))
    ab.add(sphere, pale, mat4([0.025 * s, -0.2, 0], [0, 0, 0], [0.055, 0.045, 0.055]))
    pivot.add(mk(ab))
    root.add(pivot)
    arms.push(pivot)
  }

  const tail = new THREE.Group()
  tail.position.set(0, 0.1, 0.16)
  const tb = new Builder()
  for (let i = 0; i < 5; i++) {
    const t = i / 4
    tb.add(sphere, i === 4 ? pale : fur, mat4([0, 0.05 + t * 0.32, 0.06 + Math.sin(t * 2.4) * 0.12], [0, 0, 0], 0.045 - t * 0.006))
  }
  tail.add(mk(tb))
  root.add(tail)
  ;[sphere, cone, cyl].forEach(g => g.dispose())
  return { root, head, arms: arms as [THREE.Group, THREE.Group], tail }
}

/** a triangle of cloth between three corners, as a fine grid with billow weights */
function sailGeometry(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, stripe: [number, number], N = 10) {
  const pos: number[] = []
  const col: number[] = []
  const billow: number[] = []
  const flutter: number[] = []
  const white = new THREE.Color('#fbf6ea')
  const red = new THREE.Color('#e35d45')
  const vert = (i: number, j: number) => {
    // i: up the luff (a→b), j: out along the foot (a→c)
    const v = i / N
    const u = j / N
    const p = a.clone().addScaledVector(b.clone().sub(a), v).addScaledVector(c.clone().sub(a), u)
    const span = Math.max(1 - v, 1e-3)
    const w = Math.sin(Math.PI * Math.min(1, u / span)) * Math.sin(Math.PI * Math.min(1, v + 0.15))
    return { p, w, f: u / span, v }
  }
  const push = (q: ReturnType<typeof vert>) => {
    pos.push(q.p.x, q.p.y, q.p.z)
    const cc = q.v > stripe[0] && q.v < stripe[1] ? red : white
    col.push(cc.r, cc.g, cc.b)
    billow.push(q.w)
    flutter.push(q.f * q.f)
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N - i; j++) {
      const p00 = vert(i, j)
      const p10 = vert(i + 1, j)
      const p01 = vert(i, j + 1)
      push(p00); push(p01); push(p10)
      if (j < N - i - 1) {
        const p11 = vert(i + 1, j + 1)
        push(p01); push(p11); push(p10)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('aBillow', new THREE.Float32BufferAttribute(billow, 1))
  g.setAttribute('aFlutter', new THREE.Float32BufferAttribute(flutter, 1))
  g.computeVertexNormals()
  return g
}

function flagGeometry(at: THREE.Vector3, len: number, h: number) {
  const pos: number[] = []
  const flutter: number[] = []
  const N = 6
  const col: number[] = []
  const red = new THREE.Color('#e35d45')
  for (let i = 0; i < N; i++) {
    const u0 = i / N
    const u1 = (i + 1) / N
    // a pennant: tapers to a point
    const h0 = h * (1 - u0)
    const h1 = h * (1 - u1)
    const A = [at.x, at.y, at.z + len * u0]
    const B = [at.x, at.y - h0, at.z + len * u0]
    const Cc = [at.x, at.y, at.z + len * u1]
    const D = [at.x, at.y - h1, at.z + len * u1]
    pos.push(...A, ...B, ...Cc, ...B, ...D, ...Cc)
    flutter.push(u0, u0, u1, u0, u1, u1)
    for (let k = 0; k < 6; k++) col.push(red.r, red.g, red.b)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('aFlutter', new THREE.Float32BufferAttribute(flutter.map(f => f * 2.2), 1))
  g.setAttribute('aBillow', new THREE.Float32BufferAttribute(new Array(flutter.length).fill(0), 1))
  g.computeVertexNormals()
  return g
}

export function createBoat(props: THREE.Material, glow: THREE.Material): BoatModel {
  const group = new THREE.Group()
  const tilt = new THREE.Group()
  group.add(tilt)

  const b = new Builder()
  const L = 3.2
  const D = 0.72
  b.add(hullGeometry(L, 1.36, D), null, new THREE.Matrix4(), 0, 0.03)
  // mast, boom, a ball on top
  const mast = new THREE.CylinderGeometry(0.055, 0.075, 3.35, 8)
  b.add(mast, '#8a5a35', mat4([0, 0.1 + 3.35 / 2, -0.32]))
  const boom = new THREE.CylinderGeometry(0.045, 0.045, 1.85, 6)
  b.add(boom, '#8a5a35', mat4([0, 1.0, -0.32 + 0.9], [Math.PI / 2, 0, 0]))
  const ball = new THREE.IcosahedronGeometry(0.08, 1)
  b.add(ball, '#e3b34a', mat4([0, 3.5, -0.32]))
  // rudder and tiller
  const box = new THREE.BoxGeometry(1, 1, 1)
  b.add(box, '#8a5a35', mat4([0, -0.1, L / 2 + 0.06], [0, 0, 0], [0.06, 0.75, 0.3]))
  b.add(box, '#7c4a2a', mat4([0, 0.62, L / 2 - 0.3], [0.2, 0, 0], [0.05, 0.05, 0.7]))
  // a crate of bottles waiting to be thrown
  b.add(box, '#c99a62', mat4([-0.2, 0.25, 0.95], [0, 0.15, 0], [0.55, 0.32, 0.42]))
  const bottle = new THREE.CylinderGeometry(0.07, 0.08, 0.3, 8)
  const neck = new THREE.CylinderGeometry(0.03, 0.035, 0.12, 6)
  for (const [x, z, c] of [[-0.32, 0.88, '#6fdcaa'], [-0.15, 1.02, '#7cc4ff'], [-0.05, 0.86, '#ffc46b']] as const) {
    b.add(bottle, c, mat4([x, 0.5, z]))
    b.add(neck, c, mat4([x, 0.7, z]))
  }
  // lantern post on the stern
  const post = new THREE.CylinderGeometry(0.035, 0.04, 1.0, 6)
  b.add(post, '#7c4a2a', mat4([0.42, 0.95, L / 2 - 0.2]))
  b.add(box, '#3b2a20', mat4([0.42, 1.48, L / 2 - 0.2], [0, 0, 0], [0.2, 0.05, 0.2]))
  const lantern = new THREE.Vector3(0.42, 1.34, L / 2 - 0.2)
  const hull = new THREE.Mesh(b.build()!, props)
  hull.castShadow = true
  hull.receiveShadow = true
  tilt.add(hull)
  ;[mast, boom, ball, box, bottle, neck, post].forEach(g => g.dispose())

  const lg = new Builder()
  lg.add(new THREE.BoxGeometry(0.16, 0.22, 0.16), '#ffe39a', mat4(lantern))
  tilt.add(new THREE.Mesh(lg.build()!, glow))

  // sails: billow grows with speed, the edges flutter
  const billow = { value: 0.2 }
  const sailMat = clothMaterial('sail', billow)
  const main = sailGeometry(new THREE.Vector3(0, 1.08, -0.26), new THREE.Vector3(0, 3.3, -0.26), new THREE.Vector3(0, 1.08, 1.45), [0.48, 0.58])
  const jib = sailGeometry(new THREE.Vector3(0, 1.0, -0.4), new THREE.Vector3(0, 3.0, -0.4), new THREE.Vector3(0, 0.95, -1.62), [0.48, 0.58], 8)
  for (const g of [main, jib]) {
    const m = new THREE.Mesh(g, sailMat)
    m.castShadow = true
    tilt.add(m)
  }
  const flag = new THREE.Mesh(flagGeometry(new THREE.Vector3(0, 3.48, -0.3), 0.65, 0.3), clothMaterial('flag', { value: 0 }))
  tilt.add(flag)

  // a rope from masthead to bow, for the jib
  const stay = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 3.38, -0.32), new THREE.Vector3(0, 0.9, -1.62)])
  tilt.add(new THREE.Line(stay, curved(new THREE.LineBasicMaterial({ color: '#5a4030' }))))

  const captain = createCaptain(props)
  captain.root.position.set(0.36, 0.17, 0.5)
  captain.root.scale.setScalar(1.5)
  // turned back over its shoulder, towards the camera (which sits behind and to starboard)
  captain.root.rotation.y = -CAPTAIN_FACING
  tilt.add(captain.root)

  group.traverse((o) => { o.frustumCulled = false })
  return { group, tilt, billow, lantern, captain, masthead: new THREE.Vector3(0, 3.6, -0.32) }
}
