// ══════════════════════════════════════════════════════════════
// Section detail as standalone SVG string (for the memoria / print)
// Reuses computeGeometry — mirrors the on-screen BeamCanvas detail,
// styled for paper (callouts, dimensions, title).
// ══════════════════════════════════════════════════════════════

import { computeGeometry } from './beamGeometry'

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Colors — consistent with the app's BeamCanvas
const C = {
  concrete: '#c4517a',
  stirrup: '#1a7a5e',
  topStroke: '#c94f2a', topFill: '#ffd5c8',
  botStroke: '#2563a8', botFill: '#cfe0f7',
  dim: '#9a958c', ink: '#1a1814', muted: '#6b6760',
}

/**
 * Build an SVG string for one beam cross-section.
 * @param {object} t      section data (ancho, peralte, recub, calSup, ...)
 * @param {object} opts   { scale }
 * @returns {string} self-contained <svg> markup
 */
export function sectionSvgString(t, opts = {}) {
  const scale = opts.scale || 7
  const g = computeGeometry(t, scale)
  const { bpx, hpx, rcPx, eiPx, ew, eh, er, supBars, infBars, hook1, hook2,
    bastonsSup, bastonsInf, cantBSup, cantBInf } = g

  // Layout margins around the section (room for callouts + dims)
  const ML = 150, MR = 200, MT = 30, MB = 78
  const W = ML + bpx + MR
  const H = MT + hpx + MB
  const ox = ML, oy = MT // section origin inside the canvas

  const lines = []
  const P = (s) => lines.push(s)

  // ── helpers (coords are absolute on the canvas) ──
  const X = (x) => (ox + x).toFixed(1)
  const Y = (y) => (oy + y).toFixed(1)

  // Concrete outline
  P(`<rect x="${X(0)}" y="${Y(0)}" width="${bpx.toFixed(1)}" height="${hpx.toFixed(1)}" fill="#fff" stroke="${C.concrete}" stroke-width="2"/>`)
  // Stirrup
  P(`<rect x="${X(eiPx)}" y="${Y(eiPx)}" width="${ew.toFixed(1)}" height="${eh.toFixed(1)}" rx="${er.toFixed(1)}" fill="none" stroke="${C.stirrup}" stroke-width="1.4"/>`)
  P(`<line x1="${X(hook1.x0)}" y1="${Y(hook1.y0)}" x2="${X(hook1.x1)}" y2="${Y(hook1.y1)}" stroke="${C.stirrup}" stroke-width="1.4"/>`)
  P(`<line x1="${X(hook2.x0)}" y1="${Y(hook2.y0)}" x2="${X(hook2.x1)}" y2="${Y(hook2.y1)}" stroke="${C.stirrup}" stroke-width="1.4"/>`)

  // Bars
  supBars.forEach((b) => P(`<circle cx="${X(b.cx)}" cy="${Y(b.cy)}" r="${b.r.toFixed(1)}" fill="${C.topFill}" stroke="${C.topStroke}" stroke-width="1.1"/>`))
  infBars.forEach((b) => P(`<circle cx="${X(b.cx)}" cy="${Y(b.cy)}" r="${b.r.toFixed(1)}" fill="${C.botFill}" stroke="${C.botStroke}" stroke-width="1.1"/>`))
  // Bastones
  bastonsSup.forEach((b) => {
    P(`<line x1="${X(b.tx0)}" y1="${Y(b.ty0)}" x2="${X(b.tx1)}" y2="${Y(b.ty1)}" stroke="${C.topStroke}" stroke-width="0.9"/>`)
    P(`<circle cx="${X(b.cx)}" cy="${Y(b.cy)}" r="${b.r.toFixed(1)}" fill="none" stroke="${C.topStroke}" stroke-width="1.1"/>`)
  })
  bastonsInf.forEach((b) => {
    P(`<line x1="${X(b.tx0)}" y1="${Y(b.ty0)}" x2="${X(b.tx1)}" y2="${Y(b.ty1)}" stroke="${C.botStroke}" stroke-width="0.9"/>`)
    P(`<circle cx="${X(b.cx)}" cy="${Y(b.cy)}" r="${b.r.toFixed(1)}" fill="none" stroke="${C.botStroke}" stroke-width="1.1"/>`)
  })

  // ── Dimensions ──
  // Height (left)
  const hdx = ox - 26
  P(`<line x1="${hdx}" y1="${Y(0)}" x2="${hdx}" y2="${Y(hpx)}" stroke="${C.dim}" stroke-width="0.9"/>`)
  P(`<line x1="${hdx - 3}" y1="${Y(0)}" x2="${hdx + 3}" y2="${Y(0)}" stroke="${C.dim}" stroke-width="0.9"/>`)
  P(`<line x1="${hdx - 3}" y1="${Y(hpx)}" x2="${hdx + 3}" y2="${Y(hpx)}" stroke="${C.dim}" stroke-width="0.9"/>`)
  P(`<text x="${hdx - 6}" y="${(oy + hpx / 2).toFixed(1)}" font-size="13" fill="${C.muted}" text-anchor="middle" transform="rotate(-90,${hdx - 6},${(oy + hpx / 2).toFixed(1)})">${esc(t.peralte)}</text>`)
  // Width (bottom)
  const wdy = oy + hpx + 22
  P(`<line x1="${X(0)}" y1="${wdy}" x2="${X(bpx)}" y2="${wdy}" stroke="${C.dim}" stroke-width="0.9"/>`)
  P(`<line x1="${X(0)}" y1="${wdy - 3}" x2="${X(0)}" y2="${wdy + 3}" stroke="${C.dim}" stroke-width="0.9"/>`)
  P(`<line x1="${X(bpx)}" y1="${wdy - 3}" x2="${X(bpx)}" y2="${wdy + 3}" stroke="${C.dim}" stroke-width="0.9"/>`)
  P(`<text x="${(ox + bpx / 2).toFixed(1)}" y="${wdy + 14}" font-size="13" fill="${C.muted}" text-anchor="middle">${esc(t.ancho)}</text>`)

  // ── Callouts ──
  // Top steel (upper-left)
  const topLbl = cantBSup > 0 && t.calBastonSup !== t.calSup
    ? `${t.cantSup}Ø#${t.calSup} + ${cantBSup}Ø#${t.calBastonSup}`
    : `${(Number(t.cantSup) || 0) + cantBSup}Ø#${t.calSup}`
  if (supBars.length) {
    const b0 = supBars[0]
    const lx = ox - 6, ly = oy - 8
    P(`<line x1="${X(b0.cx)}" y1="${Y(b0.cy)}" x2="${lx}" y2="${ly}" stroke="${C.topStroke}" stroke-width="0.8"/>`)
    P(`<text x="${ox - 30}" y="${oy - 6}" font-size="12.5" font-weight="600" fill="${C.topStroke}" text-anchor="end">Lecho sup. ${esc(topLbl)}</text>`)
  }
  // Bottom steel (lower-right)
  const botLbl = cantBInf > 0 && t.calBastonInf !== t.calInf
    ? `${t.cantInf}Ø#${t.calInf} + ${cantBInf}Ø#${t.calBastonInf}`
    : `${(Number(t.cantInf) || 0) + cantBInf}Ø#${t.calInf}`
  if (infBars.length) {
    const bl = infBars[infBars.length - 1]
    const lx = ox + bpx + 14, ly = oy + hpx + 6
    P(`<line x1="${X(bl.cx)}" y1="${Y(bl.cy)}" x2="${lx}" y2="${ly}" stroke="${C.botStroke}" stroke-width="0.8"/>`)
    P(`<text x="${lx + 4}" y="${ly + 4}" font-size="12.5" font-weight="600" fill="${C.botStroke}" text-anchor="start">Lecho inf. ${esc(botLbl)}</text>`)
  }
  // Stirrups (right, mid-height)
  {
    const lx = ox + bpx + 14, ly = oy + hpx * 0.42
    P(`<line x1="${X(bpx)}" y1="${Y(hpx * 0.42)}" x2="${lx}" y2="${ly}" stroke="${C.stirrup}" stroke-width="0.8"/>`)
    P(`<text x="${lx + 4}" y="${ly - 4}" font-size="12.5" font-weight="600" fill="${C.stirrup}" text-anchor="start">Estribos #${esc(t.calEst)}</text>`)
    P(`<text x="${lx + 4}" y="${ly + 12}" font-size="11" fill="${C.stirrup}" text-anchor="start">@ ${esc(t.sepLcuarto)} cm en L/4</text>`)
    P(`<text x="${lx + 4}" y="${ly + 26}" font-size="11" fill="${C.stirrup}" text-anchor="start">@ ${esc(t.sepRest)} cm al L restante</text>`)
  }

  // Title
  const cx = ox + bpx / 2
  P(`<text x="${cx.toFixed(1)}" y="${oy + hpx + 48}" font-size="15" font-weight="700" fill="${C.ink}" text-anchor="middle">${esc(t.nombre || 'TRABE')}</text>`)
  P(`<text x="${cx.toFixed(1)}" y="${oy + hpx + 64}" font-size="11.5" fill="${C.muted}" text-anchor="middle">${esc(t.ancho)} × ${esc(t.peralte)} cm · f'c = ${esc(t.fc)} kg/cm²</text>`)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" width="${W.toFixed(0)}" height="${H.toFixed(0)}" font-family="'DM Mono','Courier New',monospace">${lines.join('')}</svg>`
}
