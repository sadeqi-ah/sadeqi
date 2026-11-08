/**
 * A message in a bottle: chunky cartoon glass (see materials → glass), a
 * rolled letter tied with string inside, a cork in the neck — and, while
 * nobody has read it yet, a soft beam of light standing over it so it can be
 * spotted from across the water.
 */
import * as THREE from 'three'
import { idHash } from '#shared/utils/bottles'
import { beaconMaterial, curved, glassMaterial } from './materials'

/** bottle-local height of the centre of mass: the group pivots here */
export const PIVOT = 0.4
/** the letter inside: centre (from the pivot), length, radius */
export const INNER = { y: 0.27 - PIVOT, length: 0.34, radius: 0.115 }
/** where the cork sits, from the pivot */
export const CORK_Y = 0.9 - PIVOT
/** how big bottles are in the world */
export const BOTTLE_SCALE = 1.45

// radius, height: a short, round, friendly bottle
const PROFILE: [number, number][] = [
  [0, 0], [0.19, 0], [0.245, 0.025], [0.27, 0.08], [0.272, 0.42], [0.255, 0.51],
  [0.2, 0.585], [0.14, 0.63], [0.112, 0.68], [0.11, 0.8], [0.128, 0.815],
  [0.13, 0.85], [0.115, 0.865], [0.1, 0.87],
]
const TINTS = ['#6fdcaa', '#ffc46b', '#7cc4ff', '#ff9fbe', '#b5a3ff', '#b2e56f']

const glassGeo = new THREE.LatheGeometry(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 32)
const paperGeo = new THREE.CylinderGeometry(INNER.radius, INNER.radius, INNER.length, 20)
const twineGeo = new THREE.TorusGeometry(INNER.radius + 0.006, 0.014, 6, 20)
const corkGeo = new THREE.CylinderGeometry(0.135, 0.105, 0.17, 14)
const beaconGeo = new THREE.PlaneGeometry(1.5, 9)
beaconGeo.translate(0, 4.5, 0)

export interface BottleMesh {
  /** position only; squash & stretch happen here, in world-up terms */
  holder: THREE.Group
  /** the bottle itself, rotated (its axis is local y) */
  group: THREE.Group
  glass: THREE.ShaderMaterial
  paper: THREE.Mesh
  paperMat: THREE.MeshLambertMaterial
  cork: THREE.Mesh
  corkMat: THREE.MeshLambertMaterial
  beacon: THREE.Mesh
  beaconMat: THREE.ShaderMaterial
  scale: number
}

export function createBottle(id: string): BottleMesh {
  const tint = new THREE.Color(TINTS[Math.floor(idHash(id, 1) * TINTS.length)])
  const glass = glassMaterial(tint)
  const paperMat = curved(new THREE.MeshLambertMaterial({ color: '#fff4dc', emissive: new THREE.Color('#ffb15e'), emissiveIntensity: 0 }))
  const corkMat = curved(new THREE.MeshLambertMaterial({ color: '#c98a52', transparent: true }))

  const holder = new THREE.Group()
  const group = new THREE.Group()
  holder.add(group)
  const inner = new THREE.Group()
  inner.position.y = -PIVOT
  group.add(inner)

  const glassMesh = new THREE.Mesh(glassGeo, glass)
  glassMesh.renderOrder = 3
  inner.add(glassMesh)

  const paper = new THREE.Mesh(paperGeo, paperMat)
  paper.position.y = INNER.y
  paper.castShadow = true
  const twine = new THREE.Mesh(twineGeo, curved(new THREE.MeshLambertMaterial({ color: '#d0603f' })))
  twine.rotation.x = Math.PI / 2
  paper.add(twine)
  group.add(paper)

  const cork = new THREE.Mesh(corkGeo, corkMat)
  cork.position.y = CORK_Y
  cork.castShadow = true
  group.add(cork)

  const scale = BOTTLE_SCALE * (0.92 + idHash(id, 2) * 0.16)
  group.scale.setScalar(scale)

  const beaconMat = beaconMaterial()
  const beacon = new THREE.Mesh(beaconGeo, beaconMat)
  beacon.renderOrder = 4
  holder.add(beacon)

  holder.userData.id = id
  holder.traverse((o) => { o.frustumCulled = false })
  return { holder, group, glass, paper, paperMat, cork, corkMat, beacon, beaconMat, scale }
}

export function disposeBottle(b: BottleMesh) {
  b.glass.dispose()
  b.paperMat.dispose()
  b.corkMat.dispose()
  b.beaconMat.dispose()
}
