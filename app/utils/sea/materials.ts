/**
 * Materials for the archipelago.
 *
 * The world is curved like a tiny planet: every vertex is pushed down by the
 * square of its distance from the boat, so the sea rolls away towards a soft
 * horizon wherever you sail. Built-in materials get this through
 * `curved()`, which patches three's `project_vertex` chunk; custom shaders
 * call `bendWorld()` themselves. Shadows are computed before the bend (in
 * flat-world space) on both ends, so they stay glued to what casts them.
 *
 * Custom shaders finish like three's own: tone mapping, output colour space,
 * then fog towards an sRGB fog colour — so water, sky and terrain all melt
 * into exactly the same horizon.
 */
import * as THREE from 'three'
import { MAX_ISLES, WORLD_GLSL } from './world'
import { SEA_GLSL } from './waves'

export const MAX_TRAIL = 24
export const MAX_RIPPLES = 10
export const MAX_RINGS = 16

// ───────── shared uniforms ─────────

export const U = {
  uClock: { value: 0 },
  uTime: { value: 0 },
  uNight: { value: 0 },
  uWind: { value: 1 },
  uCurve: { value: 0.006 },
  uCurveCenter: { value: new THREE.Vector2() },
  uSunDir: { value: new THREE.Vector3(0.45, 0.75, 0.35).normalize() },
  /** sRGB, like three's own fogColor (it is mixed in after output conversion) */
  uFogColor: { value: new THREE.Color() },
  uFogNear: { value: 50 },
  uFogFar: { value: 100 },
  // islands near the boat
  uIsles: { value: Array.from({ length: MAX_ISLES }, () => new THREE.Vector4()) },
  uIsleWob: { value: Array.from({ length: MAX_ISLES }, () => new THREE.Vector3()) },
  uCircles: { value: Array.from({ length: MAX_ISLES * 4 }, () => new THREE.Vector3()) },
  uIsleCount: { value: 0 },
}

const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
`

const BEND = /* glsl */ `
uniform float uCurve;
uniform vec2 uCurveCenter;
uniform float uBendOn;
vec4 bendWorld(vec4 w) {
  vec2 d = w.xz - uCurveCenter;
  w.y -= dot(d, d) * uCurve * uBendOn;
  return w;
}
`

const BEND_PROJECT = /* glsl */ `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = viewMatrix * bendWorld(modelMatrix * mvPosition);
gl_Position = projectionMatrix * mvPosition;
`

/** the end of every custom fragment shader: like three's own materials */
const FINISH = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, smoothstep(uFogNear, uFogFar, vFogDepth));
`
const FOG_DECL = /* glsl */ `
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
varying float vFogDepth;
`

// ───────── patching built-in materials ─────────

interface Patch {
  /** unique per kind of patch: three caches programs by this */
  key: string
  uniforms?: Record<string, THREE.IUniform>
  vertexHead?: string
  vertexBegin?: string
  fragmentHead?: string
  fragmentColor?: string
}

/** bend a built-in material into the curved world, plus optional extras */
export function curved<M extends THREE.Material>(mat: M, patch: Patch = { key: 'plain' }): M {
  const bendOn = { value: 1 }
  mat.userData.bendOn = bendOn
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, {
      uCurve: U.uCurve, uCurveCenter: U.uCurveCenter, uBendOn: bendOn,
      uClock: U.uClock, uWind: U.uWind, uNight: U.uNight,
    }, patch.uniforms ?? {})
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\n${BEND}\nuniform float uClock;\nuniform float uWind;\n${patch.vertexHead ?? ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${patch.vertexBegin ?? ''}`)
      .replace('#include <project_vertex>', BEND_PROJECT)
    if (patch.fragmentHead || patch.fragmentColor) {
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', `#include <common>\nuniform float uClock;\nuniform float uNight;\n${patch.fragmentHead ?? ''}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${patch.fragmentColor ?? ''}`)
    }
  }
  mat.customProgramCacheKey = () => `curved:${patch.key}`
  return mat
}

/** switch the bend off for things held in front of the camera */
export function setBend(obj: THREE.Object3D, on: boolean) {
  obj.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
    for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
      const u = (mat.userData.bendOn ?? (mat as THREE.ShaderMaterial).uniforms?.uBendOn) as THREE.IUniform | undefined
      if (u) u.value = on ? 1 : 0
    }
  })
}

// ───────── props: vertex-coloured low poly, leaves sway in the wind ─────────

export function propsMaterial() {
  return curved(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }), {
    key: 'props',
    vertexHead: 'attribute float sway;',
    vertexBegin: /* glsl */ `
      vec4 swW = modelMatrix * vec4(transformed, 1.0);
      float swP = uClock * 1.6 + swW.x * 0.35 + swW.z * 0.21;
      transformed.x += sin(swP) * 0.1 * sway * uWind;
      transformed.z += cos(swP * 0.8 + 1.3) * 0.08 * sway * uWind;
      transformed.y += sin(swP * 1.3) * 0.03 * sway;
    `,
  })
}

// ───────── terrain: the sea floor and the islands, displaced on the GPU ─────────

export const terrainColors = {
  uSand: { value: new THREE.Color('#f8e7c3') },
  uWetSand: { value: new THREE.Color('#e5cb98') },
  uSeabed: { value: new THREE.Color('#d9d2a6') },
  uSeabedDeep: { value: new THREE.Color('#4f8f97') },
  uGrass: { value: new THREE.Color('#8ed35f') },
  uGrass2: { value: new THREE.Color('#62b84a') },
  uRock: { value: new THREE.Color('#b3a698') },
  uCaustic: { value: 1 },
}

const CAUSTICS = /* glsl */ `
float voroEdge(vec2 p, float t) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = 0.5 + 0.42 * sin(t + 6.2831 * hash22(i + g));
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return d2 - d1;
}
/** light focused by the waves into a dancing net on the sea floor */
float caustics(vec2 p, float t) {
  float a = voroEdge(p * 0.45, t * 0.9);
  float b = voroEdge(p * 0.62 + 3.7, -t * 0.75);
  return (1.0 - smoothstep(0.0, 0.14, a)) * 0.65 + (1.0 - smoothstep(0.0, 0.12, b)) * 0.45;
}
`

export function terrainMaterial() {
  return curved(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), {
    key: 'terrain',
    uniforms: { ...terrainColors, uIsles: U.uIsles, uIsleWob: U.uIsleWob, uCircles: U.uCircles, uIsleCount: U.uIsleCount },
    vertexHead: `${WORLD_GLSL}\nvarying vec3 vTW;\nvarying float vTSdf;\nvarying float vTKind;`,
    vertexBegin: /* glsl */ `
      vec4 tw0 = modelMatrix * vec4(transformed, 1.0);
      float tk;
      float td = worldSdf(tw0.xz, tk);
      transformed.y = terrainH(td, tk);
      vTW = vec3(tw0.x, transformed.y, tw0.z);
      vTSdf = td;
      vTKind = tk;
    `,
    fragmentHead: /* glsl */ `
      ${NOISE}
      ${CAUSTICS}
      uniform vec3 uSand; uniform vec3 uWetSand; uniform vec3 uSeabed; uniform vec3 uSeabedDeep;
      uniform vec3 uGrass; uniform vec3 uGrass2; uniform vec3 uRock; uniform float uCaustic;
      varying vec3 vTW;
      varying float vTSdf;
      varying float vTKind;
    `,
    fragmentColor: /* glsl */ `
      {
        vec3 w = vTW;
        float h = w.y;
        float n = vnoise(w.xz * 0.35);
        float n2 = vnoise(w.xz * 1.7);
        vec3 fn = normalize(cross(dFdx(vTW), dFdy(vTW)));
        float slope = abs(fn.y);
        vec3 col;
        if (h < -0.02) {
          // sea floor: pale sand in the shallows, bluer further down
          float depth = -h;
          col = mix(uSand, uSeabed, smoothstep(0.3, 3.5, depth));
          col = mix(col, uSeabedDeep, smoothstep(3.0, 8.0, depth));
          col *= 0.93 + 0.1 * n2;
          col *= 0.96 + 0.05 * sin(w.x * 2.1 + w.z * 0.9 + n * 4.0);
          if (depth < 5.5) col += uCaustic * caustics(w.xz, uClock) * (1.0 - smoothstep(0.2, 5.5, depth)) * 0.38;
        } else {
          col = uSand * (0.95 + 0.08 * n2);
          col = mix(uWetSand, col, smoothstep(0.02, 0.2, h));
          float gEdge = vTKind < 0.5 ? 0.62 : vTKind < 1.5 ? 2.25 : 9.0;
          float g = smoothstep(gEdge - 0.05, gEdge + 0.05, h + (n - 0.5) * 0.28);
          vec3 grass = mix(uGrass, uGrass2, smoothstep(0.3, 0.75, n)) * (0.94 + 0.1 * n2);
          col = mix(col, grass, g);
          if (vTKind > 0.5 && vTKind < 1.5) {
            float cliff = (1.0 - smoothstep(0.5, 0.78, slope)) * step(0.1, h);
            vec3 rock = uRock * (step(0.5, fract(h * 2.2 + n * 0.5)) * 0.14 + 0.86) * (0.95 + 0.1 * n2);
            col = mix(col, rock, cliff);
          }
        }
        diffuseColor.rgb = col;
      }
    `,
  })
}

// ───────── water ─────────

export const waterColors = {
  uShallow: { value: new THREE.Color('#a2f7ea') },
  uMid: { value: new THREE.Color('#3fd8d2') },
  uDeep: { value: new THREE.Color('#1fa9d8') },
  uOcean: { value: new THREE.Color('#1677c4') },
  uFoam: { value: new THREE.Color('#ffffff') },
  uGlow: { value: new THREE.Color('#5ff2ff') },
  uSkyRefl: { value: new THREE.Color('#e6fbff') },
  uSpec: { value: new THREE.Color('#ffffff') },
}

export const waterU = {
  uTrail: { value: Array.from({ length: MAX_TRAIL }, () => new THREE.Vector4(0, 0, -99, 0)) },
  uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0)) },
  uRings: { value: Array.from({ length: MAX_RINGS }, () => new THREE.Vector3()) },
  uRingCount: { value: 0 },
  /** index of the newest trail point (the trail is a ring buffer) */
  uTrailHead: { value: 0 },
  /** lighthouses: lamp x, z, beam angle, how far out the beam meets the sea */
  uBeams: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
  uBeamColor: { value: new THREE.Color('#ffe7a6') },
  /** x, z, heading, speed 0..1 */
  uBoat: { value: new THREE.Vector4() },
  uWaveAmp: { value: 1 },
}

export function waterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, ...waterColors, ...waterU, uBendOn: { value: 1 } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uWaveAmp;
      ${SEA_GLSL}
      ${BEND}
      varying vec3 vW;
      varying vec3 vN;
      varying float vFogDepth;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        float h = seaHeight(w.xz, uTime) * uWaveAmp;
        float e = 0.3;
        float hx = seaHeight(w.xz + vec2(e, 0.0), uTime) * uWaveAmp;
        float hz = seaHeight(w.xz + vec2(0.0, e), uTime) * uWaveAmp;
        w.y = h;
        vW = w.xyz;
        vN = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
        vec4 mv = viewMatrix * bendWorld(w);
        vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE}
      ${WORLD_GLSL}
      ${FOG_DECL}
      uniform float uClock;
      uniform float uNight;
      uniform vec3 uSunDir;
      uniform vec3 uShallow; uniform vec3 uMid; uniform vec3 uDeep; uniform vec3 uOcean;
      uniform vec3 uFoam; uniform vec3 uGlow; uniform vec3 uSkyRefl; uniform vec3 uSpec;
      uniform vec4 uTrail[${MAX_TRAIL}];
      uniform int uTrailHead;
      uniform vec4 uBeams[4];
      uniform vec3 uBeamColor;
      uniform vec4 uRipples[${MAX_RIPPLES}];
      uniform vec3 uRings[${MAX_RINGS}];
      uniform int uRingCount;
      uniform vec4 uBoat;
      varying vec3 vW;
      varying vec3 vN;

      void main() {
        vec2 p = vW.xz;
        float t = uClock;
        float kind;
        float d = worldSdf(p, kind);
        float depth = max(0.0, -terrainH(d, kind));

        // colour by depth: glassy aqua over sand, turquoise, azure, deep blue
        vec3 col = mix(uShallow, uMid, smoothstep(0.0, 1.4, depth));
        col = mix(col, uDeep, smoothstep(1.2, 4.5, depth));
        col = mix(col, uOcean, smoothstep(4.5, 8.5, depth));
        float alpha = mix(0.3, 0.9, smoothstep(0.0, 3.2, depth));
        alpha = mix(alpha, 1.0, smoothstep(5.0, 8.5, depth));

        vec3 V = normalize(cameraPosition - vW);
        vec3 N = normalize(vN);

        // open water isn't one flat blue: slow, broad patches of lighter and darker
        float drift = vnoise(p * 0.035 + vec2(t * 0.01, 0.0));
        col *= 0.94 + 0.12 * drift;
        col = mix(col, col * vec3(0.9, 1.04, 1.06), smoothstep(0.4, 0.8, vnoise(p * 0.06 + 11.0)) * smoothstep(3.0, 7.0, depth));
        // thin painted highlight lines drifting over it
        vec2 q = p * 0.2;
        q += vec2(vnoise(q * 0.8 + t * 0.03), vnoise(q * 0.8 - t * 0.025 + 7.0)) * 2.4;
        float streak = smoothstep(0.965, 0.995, sin(q.x * 3.0 + q.y * 1.3 + t * 0.45)) * smoothstep(0.35, 0.7, vnoise(p * 0.07 + 3.0));
        col = mix(col, uSkyRefl, streak * 0.16 * smoothstep(1.0, 4.0, depth));

        // a little sky in it at glancing angles, and the sun's glitter
        float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
        col = mix(col, uSkyRefl, fres * 0.4);
        vec3 R = reflect(-V, N);
        float sd = max(dot(R, uSunDir), 0.0);
        vec2 g = p * 1.4 + vec2(t * 0.15, 0.0);
        float hg = hash12(floor(g));
        float tw = 0.5 + 0.5 * sin(t * 3.0 + hg * 40.0);
        float spark = step(0.88, hg) * step(length(fract(g) - 0.5), 0.13 * tw);
        col += uSpec * (pow(sd, 700.0) * 0.7 + spark * smoothstep(0.6, 0.97, sd) * 0.75) * (1.0 - uNight);

        // night: the moon's path — a faint glow with a slow shimmer
        if (uNight > 0.01) {
          vec2 along = normalize(uSunDir.xz + vec2(1e-4));
          vec2 across = vec2(-along.y, along.x);
          // where a calm sea would mirror the moon: a column stretching away towards it
          float column = pow(max(dot(reflect(-V, vec3(0.0, 1.0, 0.0)), uSunDir), 0.0), 50.0);
          // soft, slow shimmer: smooth noise stretched across the path, no hard edges
          vec2 mq = vec2(dot(p, across) * 0.35, dot(p, along) * 1.6);
          float shimmer = vnoise(mq + vec2(t * 0.15, -t * 0.6)) * 0.6 + vnoise(mq * 2.3 - vec2(0.0, t * 0.9)) * 0.4;
          col += uSpec * column * (0.08 + smoothstep(0.35, 0.95, shimmer) * 0.28) * uNight;
        }

        // ── foam ──
        float foam = 0.0;
        float wob = (vnoise(p * 1.3 + t * 0.4) - 0.5) * 0.35;
        // the lip where water meets sand
        foam = max(foam, step(-0.2, d) * step(d, 0.42 + wob));
        // waves washing ashore: two rings breathing in towards the beach
        for (int k = 0; k < 2; k++) {
          float ph = fract(t * 0.2 + float(k) * 0.5);
          float rr = 3.4 * (1.0 - ph) + 0.45;
          float w = 0.05 + 0.2 * ph;
          float band = 1.0 - smoothstep(w * 0.55, w, abs(d - rr + wob * 0.6));
          foam = max(foam, band * smoothstep(0.0, 0.2, ph) * step(0.0, d) * (0.55 + 0.45 * ph));
        }
        // rings around floating bottles
        for (int i = 0; i < ${MAX_RINGS}; i++) {
          if (i >= uRingCount) break;
          vec3 r = uRings[i];
          float rr = r.z + sin(t * 2.0 + r.x) * 0.05;
          foam = max(foam, 1.0 - smoothstep(0.05, 0.1, abs(length(p - r.xy) - rr + wob * 0.25)));
        }
        // splashes
        for (int i = 0; i < ${MAX_RIPPLES}; i++) {
          vec4 rp = uRipples[i];
          float age = t - rp.z;
          if (rp.w <= 0.0 || age < 0.0 || age > 2.0) continue;
          float rad = 0.3 + age * 1.7 * rp.w;
          float w = 0.13 * (1.0 - age / 2.0) * rp.w + 0.02;
          foam = max(foam, (1.0 - smoothstep(w * 0.5, w, abs(length(p - rp.xy) - rad))) * (1.0 - age / 2.0));
        }
        // the wake: walk the boat's recent track, newest first. Two arms of
        // foam open out into a V as the track ages; churned water in between.
        for (int i = 0; i < ${MAX_TRAIL - 1}; i++) {
          int ia = (uTrailHead - i + ${MAX_TRAIL}) % ${MAX_TRAIL};
          int ib = (ia - 1 + ${MAX_TRAIL}) % ${MAX_TRAIL};
          vec4 A = uTrail[ia];
          vec4 B = uTrail[ib];
          if (A.w <= 0.0 || B.w <= 0.0 || t - A.z > 3.2) break;
          vec2 ab = B.xy - A.xy;
          float L2 = dot(ab, ab);
          if (L2 < 1e-4) continue;
          // only alongside the segment: clamping would put a round cap (a ring) on every point
          float h = dot(p - A.xy, ab) / L2;
          if (h < -0.2 || h > 1.2) continue;
          float lat = length(p - (A.xy + ab * h));
          float age = mix(t - A.z, t - B.z, h);
          float life = 1.0 - age / 3.2;
          if (life <= 0.0) continue;
          float strength = mix(A.w, B.w, h);
          float arm = 0.6 + age * 1.15;
          float vband = 1.0 - smoothstep(0.03, 0.05 + 0.12 * life, abs(lat - arm + wob * 0.5));
          float churn = (1.0 - smoothstep(0.0, 0.5 * life + 0.12, lat)) * step(0.45, vnoise(p * 3.0 + t * 1.5));
          foam = max(foam, max(vband * life, churn * life * 0.85) * strength);
        }
        // around the hull
        vec2 bp = p - uBoat.xy;
        vec2 bl = vec2(dot(bp, vec2(cos(uBoat.z), sin(uBoat.z))), dot(bp, vec2(sin(uBoat.z), -cos(uBoat.z))));
        float hull = length(bl / vec2(0.95, 1.85)) - 1.0;
        float hullFoam = 1.0 - smoothstep(0.0, 0.1 + 0.18 * uBoat.w, abs(hull - 0.04 + wob * 0.25));
        foam = max(foam, hullFoam * (0.55 + 0.45 * uBoat.w));

        // a soft oval of light where each lighthouse beam meets the sea
        float lamp = 0.0;
        for (int i = 0; i < 4; i++) {
          vec4 bm = uBeams[i];
          if (bm.w <= 0.0) continue;
          vec2 dir = vec2(cos(bm.z), -sin(bm.z));
          vec2 side = vec2(-dir.y, dir.x);
          for (int k = 0; k < 2; k++) {
            vec2 dv = p - (bm.xy + dir * bm.w * (k == 0 ? 1.0 : -1.0));
            float a = dot(dv, dir) / 3.2;
            float b = dot(dv, side) / 2.0;
            lamp += exp(-(a * a + b * b));
          }
        }
        col += uBeamColor * min(lamp, 1.0) * uNight * 0.45;

        foam = clamp(foam, 0.0, 1.0);
        col = mix(col, uFoam, foam);
        alpha = max(alpha, foam);
        // at night, anything that stirs the water lights up the plankton
        col += uGlow * foam * uNight * 0.55;

        gl_FragColor = vec4(col, alpha);
        ${FINISH}
        gl_FragColor.a = mix(gl_FragColor.a, 1.0, smoothstep(uFogNear, uFogFar, vFogDepth));
      }
    `,
  })
}

// ───────── sky ─────────

export const skyU = {
  uTop: { value: new THREE.Color('#58b6ff') },
  uHorizon: { value: new THREE.Color('#d4f0ff') },
  uSunGlow: { value: new THREE.Color('#fff2c9') },
  uMoonDir: { value: new THREE.Vector3(-0.5, 0.5, -0.7).normalize() },
}

export function skyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, ...skyU },
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      varying float vFogDepth;
      void main() {
        vDir = position;
        vFogDepth = 0.0;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE}
      ${FOG_DECL}
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunGlow;
      uniform vec3 uSunDir; uniform vec3 uMoonDir;
      uniform float uNight; uniform float uClock;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uTop, pow(smoothstep(-0.02, 0.55, h), 0.7));
        float sd = max(dot(d, uSunDir), 0.0);
        col += uSunGlow * (pow(sd, 6.0) * 0.35 + smoothstep(0.996, 0.998, sd) * 1.2) * (1.0 - uNight);
        // night: a moon and a sky full of stars
        float md = max(dot(d, uMoonDir), 0.0);
        col += vec3(0.9, 0.95, 1.0) * (smoothstep(0.9985, 0.9992, md) * 1.1 + pow(md, 40.0) * 0.12) * uNight;
        vec2 sg = vec2(atan(d.z, d.x) * 90.0, h * 90.0);
        float hs = hash12(floor(sg));
        float star = step(0.985, hs) * step(length(fract(sg) - 0.5), 0.18) * (0.6 + 0.4 * sin(uClock * 2.0 + hs * 50.0));
        col += vec3(1.0, 0.97, 0.88) * star * uNight * smoothstep(0.02, 0.2, h);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        // melt into the fog at the horizon
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, 1.0 - smoothstep(-0.02, 0.16, h));
      }
    `,
  })
}

// ───────── bottles: cartoon glass, and a beam of light so you can find them ─────────

export function glassMaterial(tint: THREE.Color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...U,
      uTint: { value: tint },
      uHover: { value: 0 },
      uOpacity: { value: 1 },
      uBendOn: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      ${BEND}
      varying vec3 vN;
      varying vec3 vView;
      varying float vFogDepth;
      void main() {
        vec4 mv = viewMatrix * bendWorld(modelMatrix * vec4(position, 1.0));
        vN = normalize(normalMatrix * normal);
        vView = -mv.xyz;
        vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      ${FOG_DECL}
      uniform vec3 uTint;
      uniform float uHover;
      uniform float uOpacity;
      uniform float uNight;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(vView);
        float ndv = max(dot(N, V), 0.0);
        float lit = dot(N, normalize(vec3(-0.3, 0.8, 0.5))) > 0.0 ? 1.0 : 0.85;
        vec3 col = uTint * lit * (1.0 + uHover * 0.25);
        float a = 0.6 + 0.3 * (1.0 - ndv);
        // painted highlights: a stripe and a dot, plus a bright rim
        float stripe = step(0.36, N.x) * step(N.x, 0.54) * step(-0.3, N.y);
        float dot2 = step(length(N.xy - vec2(0.6, 0.45)), 0.1);
        float hi = max(stripe, dot2);
        col = mix(col, vec3(1.0), hi * 0.9);
        col = mix(col, vec3(1.0), pow(1.0 - ndv, 3.0) * 0.6);
        a = max(a, hi * 0.95);
        gl_FragColor = vec4(col, a * uOpacity);
        ${FINISH}
      }
    `,
  })
}

/** a soft column of light standing over an unread bottle */
export function beaconMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uColor: { value: new THREE.Color('#fff3c4') }, uOpacity: { value: 0.6 }, uBendOn: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      ${BEND}
      varying vec2 vUv;
      varying float vFogDepth;
      void main() {
        vUv = uv;
        // cylindrical billboard: always faces the camera, stays upright
        vec4 base = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec3 toCam = cameraPosition - base.xyz;
        vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x));
        float sx = length(modelMatrix[0].xyz);
        vec4 w = vec4(base.xyz + right * position.x * sx + vec3(0.0, position.y * sx, 0.0), 1.0);
        vec4 mv = viewMatrix * bendWorld(w);
        vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      ${FOG_DECL}
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uClock;
      varying vec2 vUv;
      void main() {
        float x = 1.0 - abs(vUv.x * 2.0 - 1.0);
        float y = 1.0 - vUv.y;
        float a = pow(x, 2.5) * pow(y, 1.6) * uOpacity * (0.8 + 0.2 * sin(uClock * 2.4));
        gl_FragColor = vec4(uColor * a, 1.0);
        float f = smoothstep(uFogNear, uFogFar, vFogDepth);
        gl_FragColor.rgb *= 1.0 - f;
        #include <colorspace_fragment>
      }
    `,
  })
}

/**
 * A lighthouse beam: a cone of light with no hard edge. Brightest at the
 * lamp, fading along its length, and fading towards its silhouette (where
 * you look through less of it), so it reads as lit air, not a solid tube.
 */
export function beamMaterial(length: number) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uColor: { value: new THREE.Color('#ffe7a6') }, uOpacity: { value: 0 }, uLen: { value: length }, uBendOn: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      ${BEND}
      uniform float uLen;
      varying float vAlong;
      varying vec3 vN;
      varying vec3 vView;
      varying float vFogDepth;
      void main() {
        vAlong = clamp(position.x / uLen, 0.0, 1.0);
        vec4 mv = viewMatrix * bendWorld(modelMatrix * vec4(position, 1.0));
        vN = normalize(normalMatrix * normal);
        vView = -mv.xyz;
        vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      ${FOG_DECL}
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlong;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        float face = abs(dot(normalize(vN), normalize(vView)));
        float a = pow(face, 2.2) * pow(1.0 - vAlong, 1.4) * smoothstep(0.0, 0.06, vAlong) * uOpacity;
        a *= 1.0 - smoothstep(uFogNear, uFogFar, vFogDepth);
        gl_FragColor = vec4(uColor * a, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
}

/** soft glowing dots around lanterns at night (additive sprites) */
export function haloMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uOpacity: { value: 0 }, uScale: { value: 500 }, uBendOn: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      ${BEND}
      uniform float uScale;
      uniform float uClock;
      attribute float aSize;
      attribute vec3 color;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mv = viewMatrix * bendWorld(modelMatrix * vec4(position, 1.0));
        gl_PointSize = aSize * uScale / -mv.z * (0.92 + 0.08 * sin(uClock * 3.0 + position.x));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(max(1.0 - d, 0.0), 2.2) * uOpacity;
        gl_FragColor = vec4(vColor * a, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
}

// ───────── the letter (held in front of the camera, never bent) ─────────

/**
 * A sheet of paper that rolls up from its top edge into a scroll, text side
 * in. uProgress 0 = flat, 1 = rolled. The rolled part follows a spiral
 * (radius shrinking from uR0 to uRMin towards the core) so the layers never
 * intersect.
 */
export const paperShader = {
  vertex: /* glsl */ `
    uniform float uProgress;
    uniform float uH;
    uniform float uR0;
    uniform float uRMin;
    varying vec2 vUv;
    varying vec3 vN;
    void main() {
      vUv = uv;
      vec3 p = position;
      float y = -p.y;
      float f = mix(-uH * 0.5, uH * 0.5, uProgress);
      float s = f - y;
      vN = vec3(0.0, 0.0, 1.0);
      if (s > 0.0) {
        float a = (uR0 - uRMin) / uH;
        float r = uR0 - a * s;
        float th = log(uR0 / r) / a;
        p.y = -(f - r * sin(th));
        p.z = uR0 - r * cos(th);
        vN = vec3(0.0, -sin(th), cos(th));
      }
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      vN = normalize(normalMatrix * vN);
    }
  `,
  fragment: /* glsl */ `
    uniform sampler2D uMap;
    uniform vec3 uBack;
    uniform float uLight;
    uniform float uOpacity;
    varying vec2 vUv;
    varying vec3 vN;
    void main() {
      vec3 n = gl_FrontFacing ? vN : -vN;
      vec3 base = gl_FrontFacing ? texture2D(uMap, vUv).rgb : uBack;
      float l = 0.72 + 0.28 * max(dot(n, normalize(vec3(0.25, 0.7, 0.65))), 0.0);
      gl_FragColor = vec4(base * l * uLight, uOpacity);
      #include <colorspace_fragment>
    }
  `,
}

// ───────── sail & flag: cloth that billows and flutters ─────────

export function clothMaterial(key: string, billow: THREE.IUniform) {
  return curved(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: '#fff6ea', emissiveIntensity: 0.22 }), {
    key: `cloth-${key}`,
    uniforms: { uBillow: billow },
    vertexHead: 'attribute float aBillow;\nattribute float aFlutter;\nuniform float uBillow;',
    vertexBegin: /* glsl */ `
      transformed.x += aBillow * uBillow * 0.55;
      transformed.x += sin(uClock * 9.0 - position.z * 5.0 - position.y * 2.0) * 0.06 * aFlutter * (0.4 + uBillow);
    `,
  })
}
