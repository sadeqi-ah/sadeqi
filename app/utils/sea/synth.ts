/**
 * Every sound on /guestbook, synthesised with Web Audio — no audio files.
 *
 *  - the letter's tune: a music box (plucked steel tines over a rolled
 *    chord bed, swung a little) into a soft feedback delay
 *  - chimes and little fx: a glassy bell (sine partials at the inharmonic
 *    ratios of a struck glass)
 *  - splash, cork pop, clink: shaped noise and pitch drops
 *  - the sea: brown noise through a lowpass whose cutoff swells and recedes
 *
 * The AudioContext is only created on the first user gesture (browsers
 * refuse to start one before that anyway).
 */
import { MELODY_SCALE, type MelodyStep } from '#shared/utils/bottles'

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12)

/** the music box plays the melody grid an octave below MELODY_SCALE */
const MUSIC_BOX_SHIFT = -12

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
   * One music-box tine: a steel tooth plucked by a pin. A sine fundamental
   * with a slightly detuned twin (the shimmer of a real comb), the tine's
   * inharmonic overtones (~5.4× and ~13×) that die almost at once, and a tiny
   * metallic tick of the pin. `dest` lets a melody run on its own bus so it
   * can be faded out mid-ring.
   */
  tine(midi: number, when = 0, vel = 1, dest?: AudioNode) {
    const ctx = this.ensure()
    const t = ctx.currentTime + when
    const f = midiHz(midi)
    // low tines ring longer, high ones are short and bright
    const ring = 2.6 - Math.min(1.4, Math.max(0, (midi - 55) / 20))
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(0.2 * vel, t + 0.003)
    env.gain.exponentialRampToValueAtTime(0.0001, t + ring)
    const out = dest ?? this.out
    env.connect(out)
    const send = this.ctx!.createGain()
    send.gain.value = 0.5
    env.connect(send).connect(this.fx)
    for (const [ratio, amp, decay] of [[1, 1, ring], [1.0035, 0.35, ring], [5.4, 0.14, 0.12], [13.2, 0.05, 0.04]] as const) {
      const o = ctx.createOscillator()
      o.frequency.value = f * ratio
      const g = ctx.createGain()
      g.gain.setValueAtTime(amp, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
      o.connect(g).connect(env)
      o.start(t)
      o.stop(t + decay + 0.05)
    }
    // the pin's tick
    const src = ctx.createBufferSource()
    src.buffer = this.noise!
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 6000
    const tg = ctx.createGain()
    tg.gain.setValueAtTime(0.05 * vel, t)
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.012)
    src.connect(hp).connect(tg).connect(out)
    src.start(t, Math.random())
    src.stop(t + 0.03)
  }

  /** a single tine for a row of the melody grid (while composing) */
  melodyNote(row: number) {
    this.tine(MELODY_SCALE[row]! + MUSIC_BOX_SHIFT, 0, 0.9)
  }

  /**
   * Plays a melody once on the music box. The tune sits an octave down from
   * the grid's nominal pitch, swung a little, over a rolled chord bed —
   * C for the first bar, A minor for the second, then back home to C — so
   * any pentatonic doodle sounds like a tune. `onStep(i)` fires as each step
   * sounds (-1 at the end). Returns a function that stops it and fades out
   * whatever is still ringing.
   */
  play(melody: MelodyStep[], onStep?: (i: number) => void, stepSec = 0.26) {
    const ctx = this.ensure()
    const bus = ctx.createGain()
    bus.connect(this.out)
    const timers: number[] = []
    const lead = 0.08
    const swing = stepSec * 0.16
    const at = (i: number) => lead + i * stepSec + (i % 2 ? swing : 0)

    const chords = [[48, 55, 64], [45, 52, 60]] as const
    const bar = melody.length / 2
    chords.forEach((c, b) => c.forEach((m, k) => this.tine(m, at(b * bar) + k * 0.03, 0.34 - k * 0.05, bus)))
    // the final chord, a beat after the last step
    const end = at(melody.length)
    ;[48, 55, 60, 64].forEach((m, k) => this.tine(m, end + k * 0.045, 0.3 - k * 0.04, bus))

    melody.forEach((s, i) => {
      if (s >= 0) this.tine(MELODY_SCALE[s]! + MUSIC_BOX_SHIFT, at(i), i % 4 === 0 ? 1 : i % 2 ? 0.78 : 0.9, bus)
      timers.push(window.setTimeout(() => onStep?.(i), at(i) * 1000))
    })
    timers.push(window.setTimeout(() => onStep?.(-1), end * 1000))
    return () => {
      timers.forEach(clearTimeout)
      bus.gain.setTargetAtTime(0, ctx.currentTime, 0.06)
      setTimeout(() => bus.disconnect(), 600)
    }
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

  /** the boat's horn: two round, slightly wobbly toots */
  horn() {
    const ctx = this.ensure()
    for (const [at, len, f] of [[0, 0.22, 233], [0.3, 0.42, 220]] as const) {
      const t = ctx.currentTime + at
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(700, t)
      lp.frequency.linearRampToValueAtTime(1500, t + 0.06)
      lp.frequency.exponentialRampToValueAtTime(600, t + len)
      lp.Q.value = 4
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.16, t + 0.03)
      g.gain.setValueAtTime(0.16, t + len - 0.06)
      g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.08)
      lp.connect(g).connect(this.out)
      g.connect(this.fx)
      // a little vibrato and a squeaky pitch scoop up into each toot
      const vib = ctx.createOscillator()
      vib.frequency.value = 7
      const vibG = ctx.createGain()
      vibG.gain.value = 4
      vib.connect(vibG)
      for (const [type, mult, amp] of [['sawtooth', 1, 0.5], ['square', 1.5, 0.25], ['triangle', 0.5, 0.6]] as const) {
        const o = ctx.createOscillator()
        o.type = type
        o.frequency.setValueAtTime(f * mult * 0.88, t)
        o.frequency.exponentialRampToValueAtTime(f * mult, t + 0.05)
        vibG.connect(o.frequency)
        const og = ctx.createGain()
        og.gain.value = amp
        o.connect(og).connect(lp)
        o.start(t)
        o.stop(t + len + 0.12)
      }
      vib.start(t)
      vib.stop(t + len + 0.12)
    }
  }

  /** a happy little arpeggio: a bottle fished out */
  tada() {
    ;[72, 76, 79, 84].forEach((m, i) => this.note(m, i * 0.07, 0.55 - i * 0.05))
    this.note(88, 0.32, 0.3)
  }

  /** a soft, rubbery boing for bumping into things */
  boing() {
    const ctx = this.ensure()
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(330, t)
    o.frequency.exponentialRampToValueAtTime(160, t + 0.32)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 16
    const lg = ctx.createGain()
    lg.gain.value = 22
    lfo.connect(lg).connect(o.frequency)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38)
    o.connect(g).connect(this.out)
    o.start(t)
    lfo.start(t)
    o.stop(t + 0.42)
    lfo.stop(t + 0.42)
  }

  /** a tiny blip as an eager bottle hops */
  hop(vel = 1) {
    const ctx = this.ensure()
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(620, t)
    o.frequency.exponentialRampToValueAtTime(1100, t + 0.07)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.05 * vel, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
    o.connect(g).connect(this.out)
    o.start(t)
    o.stop(t + 0.12)
  }

  /** a far-off whale: a long, low, rising-then-falling call */
  whale(dist = 1) {
    const ctx = this.ensure()
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(180, t)
    o.frequency.linearRampToValueAtTime(320, t + 0.9)
    o.frequency.linearRampToValueAtTime(140, t + 2.2)
    const o2 = ctx.createOscillator()
    o2.type = 'triangle'
    o2.frequency.setValueAtTime(181.5, t)
    o2.frequency.linearRampToValueAtTime(323, t + 0.9)
    o2.frequency.linearRampToValueAtTime(141, t + 2.2)
    const g = ctx.createGain()
    const v = 0.07 / Math.max(1, dist)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(v, t + 0.4)
    g.gain.setValueAtTime(v, t + 1.6)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    o.connect(lp)
    o2.connect(lp)
    lp.connect(g)
    g.connect(this.out)
    g.connect(this.fx)
    o.start(t)
    o2.start(t)
    o.stop(t + 2.5)
    o2.stop(t + 2.5)
  }

  /** the spout: a breathy whoosh up */
  spout() {
    this.burst(0.7, 'bandpass', 500, 3000, 0.12)
    this.burst(0.5, 'highpass', 2500, 5000, 0.05, 0.1)
  }

  /** a shooting star: a soft glissando of high bells */
  wish() {
    ;[96, 93, 91, 88, 86].forEach((m, i) => this.note(m, i * 0.06, 0.16))
  }

  private rainNode?: { gain: GainNode }

  /** gentle rain on the sea: 0 = dry, 1 = a proper shower */
  rain(level: number) {
    if (!this.ctx) return
    if (!this.rainNode) {
      const ctx = this.ctx
      const src = ctx.createBufferSource()
      src.buffer = this.noise!
      src.loop = true
      src.playbackRate.value = 0.8
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 1400
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 7000
      const gain = ctx.createGain()
      gain.gain.value = 0
      src.connect(hp).connect(lp).connect(gain).connect(this.out)
      src.start()
      this.rainNode = { gain }
    }
    this.rainNode.gain.gain.setTargetAtTime(level * 0.07, this.ctx.currentTime, 0.4)
  }

  dispose() {
    this.stopSea()
    this.ctx?.close()
    this.ctx = undefined
  }
}
