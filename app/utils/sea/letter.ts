/**
 * The letter's layout, and a canvas drawing of it.
 *
 * The 3D sheet that rolls into (and out of) a bottle wears this drawing; the
 * moment it lies flat, the real HTML letter (SeaLetter.vue) takes over for
 * crisp, selectable, accessible text. Both are laid out from LETTER, so the
 * hand-over is a cross-fade between two near-identical pictures.
 */
import { MELODY_SCALE, MELODY_STEPS, type BottleDraft } from '#shared/utils/bottles'

export const LETTER = {
  width: 360,
  height: 480,
  pad: 26,
  /** top of the first text line */
  textTop: 52,
  line: 28,
  font: 19,
  cell: 11,
  paper: '#f6f1e6',
  ink: '#2a2622',
  faint: '#9b9086',
  rule: 'rgba(120, 96, 70, 0.13)',
} as const

export const FOOTER_H = LETTER.cell * MELODY_SCALE.length

/** the music-box strip in the footer and the crank beside it (SeaMelody.vue) */
export const STRIP = {
  bg: '#ece2cb',
  edge: 'rgba(120, 96, 70, 0.22)',
  line: 'rgba(120, 96, 70, 0.2)',
  hole: '#3a322a',
  /** gap between strip and crank, the crank's box, its drum radius, knob y */
  crankGap: 9,
  crank: 22,
  drum: 6.5,
  knob: 4,
} as const

/** the strip, its punched holes and the crank, at rest */
function drawStrip(ctx: CanvasRenderingContext2D, melody: number[], x: number, y: number) {
  const { cell, ink } = LETTER
  const w = cell * MELODY_STEPS
  const h = FOOTER_H
  ctx.fillStyle = STRIP.edge
  ctx.beginPath()
  ctx.roundRect(x - 3.5, y - 3.5, w + 7, h + 7, 5)
  ctx.fill()
  ctx.fillStyle = STRIP.bg
  ctx.beginPath()
  ctx.roundRect(x - 3, y - 3, w + 6, h + 6, 4.5)
  ctx.fill()
  ctx.fillStyle = STRIP.line
  for (let r = 0; r < MELODY_SCALE.length; r++) ctx.fillRect(x, y + cell * r + cell / 2 - 0.5, w, 1)
  for (let s = 0; s < MELODY_STEPS; s++) {
    const r = melody[s]!
    if (r < 0) continue
    const cx = x + cell * s + cell / 2
    const cy = y + cell * (MELODY_SCALE.length - 1 - r) + cell / 2
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.beginPath()
    ctx.roundRect(cx - 3.5, cy - 1.5, 7, 5, 1.5)
    ctx.fill()
    ctx.fillStyle = STRIP.hole
    ctx.beginPath()
    ctx.roundRect(cx - 3.5, cy - 2.5, 7, 5, 1.5)
    ctx.fill()
  }
  // crank
  const c = STRIP.crank / 2
  const ox = x + w + STRIP.crankGap
  const oy = y + h / 2 - c
  ctx.lineWidth = 1.1
  ctx.strokeStyle = ink
  ctx.fillStyle = '#d8c49b'
  ctx.beginPath()
  ctx.arc(ox + c, oy + c, STRIP.drum, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(ox + c, oy + c)
  ctx.lineTo(ox + c, oy + STRIP.knob + 0.5)
  ctx.stroke()
  ctx.lineWidth = 1
  ctx.fillStyle = '#b5562f'
  ctx.beginPath()
  ctx.arc(ox + c, oy + STRIP.knob, 2.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = ink
  ctx.beginPath()
  ctx.arc(ox + c, oy + c, 1.3, 0, Math.PI * 2)
  ctx.fill()
}

const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/

export function isRtl(text: string) {
  return RTL.test(text)
}

export function formatLetterDate(iso?: string) {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/(\s+)/)) {
      const next = line + word
      if (line && ctx.measureText(next).width > max) {
        lines.push(line.trimEnd())
        line = word.trimStart()
      }
      else line = next
    }
    lines.push(line)
  }
  return lines
}

/**
 * Draws the letter at w×h CSS pixels (times `dpr`) — the size of the HTML
 * letter on screen, so the two line up exactly.
 */
export function drawLetter(note: BottleDraft & { createdAt?: string }, w: number, h: number, dpr = 2) {
  const c = document.createElement('canvas')
  c.width = Math.round(w * dpr)
  c.height = Math.round(h * dpr)
  const ctx = c.getContext('2d')!
  ctx.scale(dpr, dpr)
  const { pad, textTop, line, font } = LETTER

  // paper, a little darker towards the edges, with grain
  ctx.fillStyle = LETTER.paper
  ctx.fillRect(0, 0, w, h)
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75)
  v.addColorStop(0, 'rgba(120, 90, 50, 0)')
  v.addColorStop(1, 'rgba(120, 90, 50, 0.12)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < w * h * 0.02; i++) {
    ctx.fillStyle = `rgba(90, 70, 40, ${Math.random() * 0.06})`
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1)
  }

  const footerTop = h - pad - FOOTER_H
  const textBottom = footerTop - 14

  // ruled lines
  ctx.strokeStyle = LETTER.rule
  ctx.lineWidth = 1
  for (let y = textTop + line; y <= textBottom; y += line) {
    ctx.beginPath()
    ctx.moveTo(pad, y - 0.5)
    ctx.lineTo(w - pad, y - 0.5)
    ctx.stroke()
  }

  // date
  ctx.fillStyle = LETTER.faint
  ctx.font = `11px "Geist Mono", ui-monospace, monospace`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(formatLetterDate(note.createdAt), pad, pad + 10)

  // the note, one baseline per rule
  const rtl = isRtl(note.message)
  ctx.direction = rtl ? 'rtl' : 'ltr'
  ctx.textAlign = rtl ? 'right' : 'left'
  ctx.fillStyle = LETTER.ink
  ctx.font = `${font}px "Instrument Serif", ui-serif, Georgia, serif`
  const lines = wrap(ctx, note.message, w - pad * 2)
  lines.forEach((l, i) => {
    const y = textTop + line * (i + 1) - 7
    if (y < textBottom) ctx.fillText(l, rtl ? w - pad : pad, y)
  })

  // the tune: a music-box strip
  ctx.direction = 'ltr'
  ctx.textAlign = 'left'
  if (note.melody?.some(s => s >= 0)) drawStrip(ctx, note.melody, pad, footerTop)

  // signature
  const sig = `— ${note.name?.trim() || 'a stranger'}`
  ctx.font = `italic 20px "Instrument Serif", ui-serif, Georgia, serif`
  ctx.direction = isRtl(sig) ? 'rtl' : 'ltr'
  ctx.textAlign = 'right'
  ctx.fillStyle = LETTER.ink
  ctx.fillText(sig, w - pad, h - pad - 4)
  return c
}
