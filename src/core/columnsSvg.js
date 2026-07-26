// ══════════════════════════════════════════════════════════════
// Columnas como SVG string — para export DXF/SVG y para la memoria.
// Usa el MISMO lenguaje visual y escala (14 px/cm) que BeamCanvas,
// de modo que svgToDxf mapee a las mismas capas por color:
//   #c4517a → CONCRETO · #1a7a5e → ESTRIBOS · #c94f2a → ACERO_SUPERIOR
//   grises → COTAS
// ══════════════════════════════════════════════════════════════

import { barGrid, bdLookup, calcEstribos, lechoDepths } from './columnCalculator'

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Márgenes de celda (px) — espejo de BeamCanvas
const MARGIN_L = 80
const MARGIN_R = 70
const MARGIN_T = 50
const MARGIN_B = 120
const GAP = 30
const COLS = 4

/**
 * Grupo SVG de UNA columna con origen (ox, oy) en la esquina sup.-izq.
 * del rectángulo de concreto. Estilo idéntico al detalle de vigas.
 */
export function columnSectionGroup(col, ox, oy, scale = 14) {
  const b = +col.b || 30, h = +col.h || 30, r = +col.r || 3
  const lechos = col.lechos || []
  const bpx = b * scale, hpx = h * scale
  const fs = Math.max(10, scale * 1.1)

  const est = bdLookup(col.estriboNum || 2.5)
  const sEst = calcEstribos({
    estriboNum: col.estriboNum || 2.5,
    longNum: lechos[0]?.num || 3,
    h, b,
  })

  const bars = barGrid({ h, b, r, lechos })
  const dps = lechoDepths(h, r, lechos.length)

  // Radio de la varilla de esquina (lecho 1) — rige el ajuste del estribo
  const rCornerCm = bdLookup(lechos[0]?.num ?? 3).diam / 2
  const rCornerPx = rCornerCm * scale
  // Estribo: su eje pasa a (recub − radio_varilla) de la cara, es decir
  // TANGENTE al paño exterior de las varillas → el estribo las envuelve.
  // Misma convención que beamGeometry (eiPx = recub − DIAM/20).
  const eiPx = (r - rCornerCm) * scale
  const ew = bpx - 2 * eiPx, eh = hpx - 2 * eiPx
  const er = Math.min(4, ew * 0.08)

  const L = []
  const P = (s) => L.push(s)
  const X = (v) => (ox + v).toFixed(1)
  const Y = (v) => (oy + v).toFixed(1)

  // Concreto
  P(`<rect x="${X(0)}" y="${Y(0)}" width="${bpx.toFixed(1)}" height="${hpx.toFixed(1)}" fill="none" stroke="#c4517a" stroke-width="2"/>`)
  // Estribo + ganchos (como vigas: sobre la barra sup.-izq.)
  P(`<rect x="${X(eiPx)}" y="${Y(eiPx)}" width="${ew.toFixed(1)}" height="${eh.toFixed(1)}" rx="${er.toFixed(1)}" fill="none" stroke="#1a7a5e" stroke-width="1.5"/>`)
  if (bars.length) {
    // Ganchos: nacen en la circunferencia de la varilla de esquina sup.-izq.
    // (anclados en r,r como en vigas) a 160° y 310°, con longitud 1.8·Øest.
    const barCx = r * scale, barCy = r * scale
    const gLen = est.diam * scale * 1.8
    const hx = 0.60, hy = 0.80
    for (const deg of [160, 310]) {
      const a = (Math.PI * deg) / 180
      const x0 = barCx + rCornerPx * Math.cos(a)
      const y0 = barCy + rCornerPx * Math.sin(a)
      P(`<line x1="${X(x0)}" y1="${Y(y0)}" x2="${X(x0 + hx * gLen)}" y2="${Y(y0 + hy * gLen)}" stroke="#1a7a5e" stroke-width="1.5"/>`)
    }
  }
  // Barras
  for (const bar of bars) {
    const rB = Math.max((bar.diam / 2) * scale, 3.5)
    P(`<circle cx="${X(bar.x * scale)}" cy="${Y(bar.y * scale)}" r="${rB.toFixed(1)}" fill="#ffd5c8" stroke="#c94f2a" stroke-width="1.2"/>`)
  }

  // ── Cotas (mismo trazo que vigas: gris, flechas triangulares) ──
  // Recubrimiento: entre el eje del lecho inferior y el paño inferior
  const rcPx = r * scale
  const crx = -fs * 1.6
  const yEje = hpx - rcPx, yPano = hpx
  P(`<line x1="${X(0)}" y1="${Y(yEje)}" x2="${X(crx - 2)}" y2="${Y(yEje)}" stroke="#bbb" stroke-width="0.6" stroke-dasharray="2,2"/>`)
  P(`<line x1="${X(0)}" y1="${Y(yPano)}" x2="${X(crx - 2)}" y2="${Y(yPano)}" stroke="#bbb" stroke-width="0.6" stroke-dasharray="2,2"/>`)
  P(`<line x1="${X(crx)}" y1="${Y(yEje)}" x2="${X(crx)}" y2="${Y(yPano)}" stroke="#aaa" stroke-width="0.9"/>`)
  P(`<polygon points="${X(crx)},${Y(yEje)} ${X(crx - 2)},${Y(yEje + 4)} ${X(crx + 2)},${Y(yEje + 4)}" fill="#aaa"/>`)
  P(`<polygon points="${X(crx)},${Y(yPano)} ${X(crx - 2)},${Y(yPano - 4)} ${X(crx + 2)},${Y(yPano - 4)}" fill="#aaa"/>`)
  P(`<text x="${X(crx - fs * 0.9)}" y="${Y(yEje + rcPx / 2 + fs * 0.35)}" font-size="${Math.round(fs * 0.8)}" fill="#aaa" text-anchor="middle" transform="rotate(-90,${X(crx - fs * 0.9)},${Y(yEje + rcPx / 2 + fs * 0.35)})">r=${r}</text>`)

  const cpx = -fs * 3.8
  P(`<line x1="${X(0)}" y1="${Y(0)}" x2="${X(cpx - 3)}" y2="${Y(0)}" stroke="#bbb" stroke-width="0.6" stroke-dasharray="2,2"/>`)
  P(`<line x1="${X(0)}" y1="${Y(hpx)}" x2="${X(cpx - 3)}" y2="${Y(hpx)}" stroke="#bbb" stroke-width="0.6" stroke-dasharray="2,2"/>`)
  P(`<line x1="${X(cpx)}" y1="${Y(0)}" x2="${X(cpx)}" y2="${Y(hpx)}" stroke="#aaa" stroke-width="0.9"/>`)
  P(`<polygon points="${X(cpx)},${Y(0)} ${X(cpx - 2)},${Y(4)} ${X(cpx + 2)},${Y(4)}" fill="#aaa"/>`)
  P(`<polygon points="${X(cpx)},${Y(hpx)} ${X(cpx - 2)},${Y(hpx - 4)} ${X(cpx + 2)},${Y(hpx - 4)}" fill="#aaa"/>`)
  P(`<text x="${X(cpx - fs * 0.9)}" y="${Y(hpx / 2 + fs * 0.35)}" font-size="${Math.round(fs * 0.9)}" fill="#888" text-anchor="middle" transform="rotate(-90,${X(cpx - fs * 0.9)},${Y(hpx / 2 + fs * 0.35)})">${h}</text>`)

  const cpy = hpx + fs * 2.2
  P(`<line x1="${X(0)}" y1="${Y(hpx)}" x2="${X(0)}" y2="${Y(cpy + 3)}" stroke="#bbb" stroke-width="0.6" stroke-dasharray="2,2"/>`)
  P(`<line x1="${X(bpx)}" y1="${Y(hpx)}" x2="${X(bpx)}" y2="${Y(cpy + 3)}" stroke="#bbb" stroke-width="0.6" stroke-dasharray="2,2"/>`)
  P(`<line x1="${X(0)}" y1="${Y(cpy)}" x2="${X(bpx)}" y2="${Y(cpy)}" stroke="#aaa" stroke-width="0.9"/>`)
  P(`<polygon points="${X(0)},${Y(cpy)} ${X(4)},${Y(cpy - 2)} ${X(4)},${Y(cpy + 2)}" fill="#aaa"/>`)
  P(`<polygon points="${X(bpx)},${Y(cpy)} ${X(bpx - 4)},${Y(cpy - 2)} ${X(bpx - 4)},${Y(cpy + 2)}" fill="#aaa"/>`)
  P(`<text x="${X(bpx / 2)}" y="${Y(cpy + fs * 1.3)}" font-size="${Math.round(fs * 0.9)}" fill="#888" text-anchor="middle">${b}</text>`)

  // ── Etiquetas ──
  // Estribos arriba (verde, como vigas)
  P(`<text x="${X(bpx / 2)}" y="${Y(-fs * 0.5)}" font-size="${Math.round(fs * 0.88)}" fill="#1a7a5e" text-anchor="middle">E #${esc(col.estriboNum)} @ ${sEst.s} cm</text>`)
  // Lechos a la derecha (naranja)
  lechos.forEach((Le, i) => {
    if (!(+Le.n > 0)) return
    P(`<text x="${X(bpx + fs * 0.6)}" y="${Y(dps[i] * scale + fs * 0.35)}" font-size="${Math.round(fs * 0.82)}" fill="#c94f2a" text-anchor="start">${Le.n}Ø#${esc(Le.num)}</text>`)
  })
  // Nombre + datos (bloque inferior, como vigas)
  const Ast = lechos.reduce((s, Le) => s + bdLookup(Le.num).area * (+Le.n || 0), 0)
  P(`<text x="${X(bpx / 2)}" y="${Y(hpx + fs * 5.8)}" text-anchor="middle" font-size="${Math.round(fs * 1.5)}" font-weight="600" fill="#1a1814">${esc(col.nombre || 'COL')}</text>`)
  P(`<text x="${X(bpx / 2)}" y="${Y(hpx + fs * 7.2)}" text-anchor="middle" font-size="${Math.round(fs * 0.95)}" fill="#6b6760">${b} × ${h} cm</text>`)
  // Sin "·": encodeAcadText (DXF) sustituye lo no-ASCII por "?" — dos líneas.
  P(`<text x="${X(bpx / 2)}" y="${Y(hpx + fs * 8.5)}" text-anchor="middle" font-size="${Math.round(fs * 0.85)}" fill="#8a8580">f'c = ${esc(col.fc)} kg/cm2</text>`)
  P(`<text x="${X(bpx / 2)}" y="${Y(hpx + fs * 9.7)}" text-anchor="middle" font-size="${Math.round(fs * 0.85)}" fill="#8a8580">Ast = ${Ast.toFixed(2)} cm2</text>`)

  return L.join('')
}

/**
 * Grid de TODAS las columnas (layout espejo de BeamCanvas: 4 por fila,
 * celdas dimensionadas por columna). Devuelve { inner, W, H } en px.
 */
export function columnsGridSvg(columnsArr, scale = 14) {
  const list = columnsArr || []
  if (!list.length) return { inner: '', W: 0, H: 0 }

  const colCount = Math.min(list.length, COLS)
  const cellW = list.map((c) => (+c.b || 30) * scale + MARGIN_L + MARGIN_R)
  const cellH = list.map((c) => (+c.h || 30) * scale + MARGIN_T + MARGIN_B)

  const colW = []
  for (let c = 0; c < colCount; c++) {
    let mx = 0
    for (let r = 0; r * colCount + c < list.length; r++) mx = Math.max(mx, cellW[r * colCount + c] || 0)
    colW.push(mx + GAP)
  }
  const rowCount = Math.ceil(list.length / colCount)
  const rowH = []
  for (let r = 0; r < rowCount; r++) {
    let mx = 0
    for (let c = 0; c < colCount; c++) {
      const i = r * colCount + c
      if (i < list.length) mx = Math.max(mx, cellH[i])
    }
    rowH.push(mx + GAP)
  }
  const colX = [GAP]
  for (let c = 1; c < colCount; c++) colX.push(colX[c - 1] + colW[c - 1])
  const rowY = [GAP]
  for (let r = 1; r < rowCount; r++) rowY.push(rowY[r - 1] + rowH[r - 1])

  const W = colX[colCount - 1] + colW[colCount - 1]
  const H = rowY[rowCount - 1] + rowH[rowCount - 1]

  const parts = list.map((col, i) => {
    const c = i % colCount, r = Math.floor(i / colCount)
    const bpx = (+col.b || 30) * scale, hpx = (+col.h || 30) * scale
    const cw = colW[c] - GAP, ch = rowH[r] - GAP
    const ox = colX[c] + MARGIN_L + (cw - MARGIN_L - MARGIN_R - bpx) / 2
    const oy = rowY[r] + MARGIN_T + (ch - MARGIN_T - MARGIN_B - hpx) / 2
    return columnSectionGroup(col, ox, oy, scale)
  })

  return { inner: parts.join(''), W, H }
}

/**
 * SVG independiente de una sola columna (para la memoria).
 */
export function columnSectionSvgString(col, scale = 7) {
  const b = +col.b || 30, h = +col.h || 30
  const bpx = b * scale, hpx = h * scale
  const fs = Math.max(10, scale * 1.1)
  const W = MARGIN_L * 0.9 + bpx + MARGIN_R * 0.9
  const H = fs * 2 + hpx + fs * 10.6
  const inner = columnSectionGroup(col, MARGIN_L * 0.9 * 0.85, fs * 2, scale)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" width="${W.toFixed(0)}" height="${H.toFixed(0)}" font-family="'DM Mono','Courier New',monospace">${inner}</svg>`
}

/**
 * Diagrama de interacción P–M como SVG string (para la memoria).
 */
export function interactionSvgString(analysis, { Mu = 0, Pu = 0, check = null, color = '#2563a8', title = '' } = {}) {
  const width = 430, height = 350
  const PAD = { l: 56, r: 18, t: 26, b: 42 }
  const iw = width - PAD.l - PAD.r
  const ih = height - PAD.t - PAD.b

  const curve = analysis.curve
  const Ms = curve.map((p) => p.M).concat([+Mu || 0])
  const Ps = curve.map((p) => p.P).concat([+Pu || 0])
  const Mmax = Math.max(...Ms, 0.1) * 1.12
  const Pmin = Math.min(...Ps, 0) * 1.12
  const Pmax = Math.max(...Ps) * 1.08
  const xs = (M) => PAD.l + (M / Mmax) * iw
  const ys = (P) => PAD.t + ((Pmax - P) / (Pmax - Pmin)) * ih

  const sorted = [...curve].sort((a, b) => b.P - a.P)
  const path = sorted.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(p.M).toFixed(1)},${ys(p.P).toFixed(1)}`).join(' ')
  const nice = (v) => Number(v.toPrecision(2))
  const xT = [0, 0.25, 0.5, 0.75, 1].map((t) => nice(Mmax * t))
  const yT = [Pmin, 0, Pmax * 0.33, Pmax * 0.66, Pmax].map(nice)

  const L = []
  L.push(`<text x="${PAD.l}" y="14" font-size="11" font-weight="700" fill="${color}">${esc(title)}</text>`)
  for (const p of yT) {
    L.push(`<line x1="${PAD.l}" y1="${ys(p).toFixed(1)}" x2="${width - PAD.r}" y2="${ys(p).toFixed(1)}" stroke="${p === 0 ? '#b8b2a6' : '#eceae4'}" stroke-width="${p === 0 ? 1.2 : 1}"/>`)
    L.push(`<text x="${PAD.l - 6}" y="${(ys(p) + 3).toFixed(1)}" font-size="9" fill="#8a8580" text-anchor="end">${p}</text>`)
  }
  for (const m of xT) {
    L.push(`<text x="${xs(m).toFixed(1)}" y="${height - PAD.b + 14}" font-size="9" fill="#8a8580" text-anchor="middle">${m}</text>`)
  }
  L.push(`<text x="${PAD.l + iw / 2}" y="${height - 6}" font-size="10" fill="#6b6760" text-anchor="middle">M (ton·m)</text>`)
  L.push(`<text x="12" y="${PAD.t + ih / 2}" font-size="10" fill="#6b6760" text-anchor="middle" transform="rotate(-90,12,${PAD.t + ih / 2})">P (ton)</text>`)
  L.push(`<path d="${path} L${xs(0).toFixed(1)},${ys(sorted[sorted.length - 1].P).toFixed(1)} L${xs(0).toFixed(1)},${ys(sorted[0].P).toFixed(1)} Z" fill="${color}" opacity="0.07"/>`)
  L.push(`<path d="${path}" fill="none" stroke="${color}" stroke-width="2"/>`)
  for (const pt of analysis.canonical) {
    L.push(`<circle cx="${xs(pt.M).toFixed(1)}" cy="${ys(pt.P).toFixed(1)}" r="3.6" fill="#fff" stroke="${color}" stroke-width="1.5"/>`)
  }
  const okCol = check?.ok ? '#15803d' : '#dc2626'
  const dx = xs(+Mu || 0), dy = ys(+Pu || 0)
  L.push(`<line x1="${(dx - 7).toFixed(1)}" y1="${dy.toFixed(1)}" x2="${(dx + 7).toFixed(1)}" y2="${dy.toFixed(1)}" stroke="${okCol}" stroke-width="2"/>`)
  L.push(`<line x1="${dx.toFixed(1)}" y1="${(dy - 7).toFixed(1)}" x2="${dx.toFixed(1)}" y2="${(dy + 7).toFixed(1)}" stroke="${okCol}" stroke-width="2"/>`)
  L.push(`<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="4.5" fill="${okCol}" stroke="#fff" stroke-width="1.5"/>`)
  L.push(`<text x="${(dx + 9).toFixed(1)}" y="${(dy - 8).toFixed(1)}" font-size="10" font-weight="700" fill="#1a1814">(Mu, Pu)</text>`)
  if (check) {
    L.push(`<text x="${width - PAD.r}" y="14" font-size="10" font-weight="800" fill="${okCol}" text-anchor="end">${check.ok ? 'DENTRO' : 'FUERA'} · MR=${check.MR.toFixed(2)} t·m</text>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="'DM Mono','Courier New',monospace">${L.join('')}</svg>`
}
