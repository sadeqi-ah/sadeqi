/**
 * Every sound on /guestbook, synthesised with Web Audio — no audio files.
 *
 *  - notes: a glassy bell (sine partials at the inharmonic ratios of a
 *    struck glass) into a soft feedback delay, so a melody rings like it's
 *    being played on the bottle itself
 *  - splash, cork pop, clink: shaped noise and pitch drops
 *  - the sea: brown noise through a lowpass whose cutoff swells and recedes
 *
 * The AudioContext is only created on the first user gesture (browsers
 * refuse to start one before that anyway).
 */
import { MELODY_SCALE, type MelodyStep } from '#shared/utils/bottles'

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12)

export class SeaSynth {
  private ctx?: AudioContext
  private out!: GainNode
  private fx!: GainNode
  private sea?: { gain: GainNode, stop: () => void }
  private noise?: AudioBuffer
  muted = false

  private ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return this.ctx
    }
    const ctx = new AudioContext()
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.gain.value = this.muted ? 0 : 0.9
    const comp = ctx.createDynamicsCompressor()
    this.out.connect(comp).connect(ctx.destination)

    // shared echo: delay → lowpass → back into the delay
    this.fx = ctx.createGain()
    const delay = ctx.createDelay(1)
    delay.delayTime.value = 0.29
    const fb = ctx.createGain()
    fb.gain.value = 0.32
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 2600
    this.fx.connect(delay)
    delay.connect(lp).connect(fb).connect(delay)
    const wet = ctx.createGain()
    wet.gain.value = 0.35
    lp.connect(wet).connect(this.out)

    // 2s of white noise, reused by every noisy sound
    const len = ctx.sampleRate * 2
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    return ctx
  }

  setMuted(m: boolean) {
    this.muted = m
    if (!this.ctx) return
    this.out.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.08)
  }

  /** a bell-like note, `when` seconds from now */
  note(midi: number, when = 0, vel = 1) {
    const ctx = this.ensure()
    const t = ctx.currentTime + when
    const f = midiHz(midi)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(0.22 * vel, t + 0.006)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.8)
    env.connect(this.out)
    env.connect(this.fx)
    // partials of a struck glass: 1, 2.32, 4.25, 6.63 (each dies faster)
    for (const [ratio, amp, decay] of [[1, 1, 1.8], [2.32, 0.28, 0.7], [4.25, 0.12, 0.35], [6.63, 0.05, 0.18]] as const) {
      const o = ctx.createOscillator()
      o.frequency.value = f * ratio
      const g = ctx.createGain()
      g.gain.setValueAtTime(amp, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
      o.connect(g).connect(env)
      o.start(t)
      o.stop(t + decay + 0.05)
    }
  }

  /**
   * Plays a melody once. `onStep(i)` fires as each step sounds (-1 at the end),
   * for the grid to light up in time. Returns a function that stops it.
   */
  play(melody: MelodyStep[], onStep?: (i: number) => void, stepSec = 0.19) {
    this.ensure()
    const timers: number[] = []
    melody.forEach((s, i) => {
      if (s >= 0) this.note(MELODY_SCALE[s]!, 0.05 + i * stepSec, 0.85 + (i % 2 ? 0 : 0.15))
      timers.push(window.setTimeout(() => onStep?.(i), (0.05 + i * stepSec) * 1000))
    })
    timers.push(window.setTimeout(() => onStep?.(-1), (0.05 + melody.length * stepSec) * 1000))
    return () => timers.forEach(clearTimeout)
  }

  private burst(dur: number, filter: BiquadFilterType, from: number, to: number, gain: number, when = 0) {
    const ctx = this.ensure()
    const t = ctx.currentTime + when
    const src = ctx.createBufferSource()
    src.buffer = this.noise!
    src.playbackRate.value = 0.7 + Math.random() * 0.6
    const bp = ctx.createBiquadFilter()
    bp.type = filter
    bp.Q.value = 0.8
    bp.frequency.setValueAtTime(from, t)
    bp.frequency.exponentialRampToValueAtTime(to, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(bp).connect(g).connect(this.out)
    src.start(t, Math.random())
    src.stop(t + dur + 0.05)
  }

  splash(size = 1) {
    this.burst(0.5 + size * 0.3, 'bandpass', 2400, 380, 0.5 * size)
    this.burst(0.25, 'highpass', 5000, 2000, 0.18 * size, 0.04)
    // the drips after
    for (let i = 0; i < 3; i++) this.drop(0.25 + i * 0.13 + Math.random() * 0.1, 0.25 * size)
  }

  private drop(when: number, vel: number) {
    const ctx = this.ensure()
    const t = ctx.currentTime + when
    const o = ctx.createOscillator()
    const f = 900 + Math.random() * 900
    o.frequency.setValueAtTime(f, t)
    o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.05)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.08 * vel, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
    o.connect(g).connect(this.out)
    o.start(t)
    o.stop(t + 0.1)
  }

  pop() {
    const ctx = this.ensure()
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(520, t)
    o.frequency.exponentialRampToValueAtTime(140, t + 0.09)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.35, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    o.connect(g).connect(this.out)
    o.start(t)
    o.stop(t + 0.15)
    this.burst(0.06, 'highpass', 3000, 1500, 0.25)
  }

  /** cork pushed home / glass set down */
  clink() {
    this.note(96, 0, 0.35)
    this.burst(0.05, 'bandpass', 1800, 900, 0.12)
  }

  /** soft paper rustle while a letter rolls or unrolls */
  rustle(dur = 0.7) {
    const steps = 6
    for (let i = 0; i < steps; i++)
      this.burst(0.09, 'bandpass', 5200, 2600, 0.05 + Math.random() * 0.04, (i / steps) * dur)
  }

  whoosh() {
    this.burst(0.55, 'bandpass', 600, 2200, 0.14)
  }

  /** the sea, looping until stopped */
  startSea() {
    if (this.sea) return
    const ctx = this.ensure()
    const len = ctx.sampleRate * 4
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02 // brown noise
      d[i] = last * 3.5
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 500
    // swells: a slow LFO on the cutoff and the level
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.11
    const lfoF = ctx.createGain()
    lfoF.gain.value = 320
    const lfoG = ctx.createGain()
    lfoG.gain.value = 0.12
    lfo.connect(lfoF).connect(lp.frequency)
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.gain.setTargetAtTime(0.28, ctx.currentTime, 1.2)
    lfo.connect(lfoG).connect(gain.gain)
    src.connect(lp).connect(gain).connect(this.out)
    src.start()
    lfo.start()
    this.sea = {
      gain,
      stop: () => {
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4)
        setTimeout(() => { src.stop(); lfo.stop() }, 1500)
      },
    }
  }

  stopSea() {
    this.sea?.stop()
    this.sea = undefined
  }

  private swish?: { gain: GainNode, filter: BiquadFilterNode }

  /** water rushing past the hull: 0 = still, 1 = full sail */
  motion(level: number) {
    if (!this.ctx) return
    if (!this.swish) {
      const ctx = this.ctx
      const src = ctx.createBufferSource()
      src.buffer = this.noise!
      src.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.Q.value = 0.7
      const gain = ctx.createGain()
      gain.gain.value = 0
      src.connect(filter).connect(gain).connect(this.out)
      src.start()
      this.swish = { gain, filter }
    }
    const t = this.ctx.currentTime
    this.swish.gain.gain.setTargetAtTime(level * 0.09, t, 0.25)
    this.swish.filter.frequency.setTargetAtTime(500 + level * 900, t, 0.3)
  }

  /** a gull, somewhere overhead: two or three falling cries */
  gull() {
    const ctx = this.ensure()
    const n = 2 + Math.floor(Math.random() * 2)
    for (let i = 0; i < n; i++) {
      const t = ctx.currentTime + i * 0.22 + Math.random() * 0.05
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      const f = 1500 + Math.random() * 300
      o.frequency.setValueAtTime(f, t)
      o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.18)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1800
      bp.Q.value = 3
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.05, t + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
      o.connect(bp).connect(g).connect(this.out)
      g.connect(this.fx)
      o.start(t)
      o.stop(t + 0.25)
    }
  }

  /** the hull bumping into sand */
  thud() {
    const ctx = this.ensure()
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(55, t + 0.18)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.4, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    o.connect(g).connect(this.out)
    o.start(t)
    o.stop(t + 0.3)
    this.burst(0.2, 'lowpass', 900, 300, 0.2)
  }

  /** wind chimes: a soft pentatonic note or two, now and then */
  chime() {
    const notes = [72, 74, 76, 79, 81, 84]
    const n = 1 + Math.floor(Math.random() * 3)
    let at = 0
    for (let i = 0; i < n; i++) {
      this.note(notes[Math.floor(Math.random() * notes.length)]!, at, 0.18 + Math.random() * 0.1)
      at += 0.25 + Math.random() * 0.35
    }
  }

  dispose() {
    this.stopSea()
    this.ctx?.close()
    this.ctx = undefined
  }
}
