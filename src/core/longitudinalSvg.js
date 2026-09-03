// ══════════════════════════════════════════════════════════════
// Dibujos del análisis longitudinal
//   · elevationSvg: alzado de la trabe a escala real (14 px/cm, igual
//     que las secciones) con varillas corridas, bastones acotados,
//     zonas de estribos y apoyos. Mismos colores que BeamCanvas para
//     que svgToDxf asigne las mismas capas.
//   · diagramSvg: diagrama de momento (Mu+ abajo, Mu− arriba) y cortante
//     con las líneas de MR del armado corrido y con bastones.
// ══════════════════════════════════════════════════════════════

import { DIAM } from './constants'

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const C = {
  concrete: '#c4517a', stirrup: '#1a7a5e',
  top: '#c94f2a', bot: '#2563a8',
  dim: '#9a958c', ink: '#1a1814', muted: '#6b6760',
  ok: '#15803d', bad: '#c62828', zone: '#f59e0b',
}
const f2 = (v) => Number(v).toFixed(2)

/**
 * Alzado de un miembro (o patrón) a escala real.
 * @param t       sección
 * @param r       resultado de analyzeMember (usa r.L, r.inf.bars, r.sup.bars, r.shear)
 * @param opts    { scale=14 px/cm, title, subtitle, members:[ids] }
 * @returns { inner, W, H, svg }  inner = contenido sin <svg>, para apilar en el export
 */
export function elevationSvg(t, r, opts = {}) {
  const scale = opts.scale || 14
  const Lcm = r.L * 100
  const h = +t.peralte, rc = +t.recub || 3
  const Lpx = Lcm * scale, hpx = h * scale
  const rcPx = rc * scale
  const SUP = 22 * scale / 14 // apoyo (columna) dibujado a cada lado, cm→px equivalentes a 22 cm
  const ML = 60 + SUP, MR = 60 + SUP, MT = 70, MB = 120
  const W = ML + Lpx + MR, H = MT + hpx + MB
  const ox = ML, oy = MT
  const X = (m) => (ox + m * 100 * scale)
  const Y = (cm) => (oy + cm * scale)
  const out = []
  const P = (s) => out.push(s)
  const fs = Math.max(11, scale * 0.9)

  // Apoyos (columnas) — trazo de concreto
  P(`<rect x="${(ox - SUP).toFixed(1)}" y="${(oy - 10).toFixed(1)}" width="${SUP.toFixed(1)}" height="${(hpx + 20 + 30).toFixed(1)}" fill="none" stroke="${C.concrete}" stroke-width="1.2" stroke-dasharray="6,4"/>`)
  P(`<rect x="${(ox + Lpx).toFixed(1)}" y="${(oy - 10).toFixed(1)}" width="${SUP.toFixed(1)}" height="${(hpx + 20 + 30).toFixed(1)}" fill="none" stroke="${C.concrete}" stroke-width="1.2" stroke-dasharray="6,4"/>`)
  // Trabe
  P(`<rect x="${ox.toFixed(1)}" y="${oy.toFixed(1)}" width="${Lpx.toFixed(1)}" height="${hpx.toFixed(1)}" fill="#fff" stroke="${C.concrete}" stroke-width="2"/>`)

  // Varillas corridas (a rc del paño, prolongadas al apoyo con gancho)
  const dSup = (DIAM[t.calSup] || 9.5) / 10, dInf = (DIAM[t.calInf] || 9.5) / 10
  const ySup = Y(rc), yInf = Y(h - rc)
  const hook = 12 * scale / 14 * 1.5
  P(`<line x1="${(ox - SUP * 0.6).toFixed(1)}" y1="${ySup.toFixed(1)}" x2="${(ox + Lpx + SUP * 0.6).toFixed(1)}" y2="${ySup.toFixed(1)}" stroke="${C.top}" stroke-width="${Math.max(2, dSup * scale * 0.6).toFixed(1)}"/>`)
  P(`<line x1="${(ox - SUP * 0.6).toFixed(1)}" y1="${yInf.toFixed(1)}" x2="${(ox + Lpx + SUP * 0.6).toFixed(1)}" y2="${yInf.toFixed(1)}" stroke="${C.bot}" stroke-width="${Math.max(2, dInf * scale * 0.6).toFixed(1)}"/>`)
  // ganchos de las corridas
  for (const [x, dir] of [[ox - SUP * 0.6, 1], [ox + Lpx + SUP * 0.6, 1]]) {
    P(`<line x1="${x.toFixed(1)}" y1="${ySup.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(ySup + hook * dir).toFixed(1)}" stroke="${C.top}" stroke-width="2"/>`)
    P(`<line x1="${x.toFixed(1)}" y1="${yInf.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(yInf - hook * dir).toFixed(1)}" stroke="${C.bot}" stroke-width="2"/>`)
  }
  const supLbl = `${t.cantSup}#${t.calSup} corridas`
  const infLbl = `${t.cantInf}#${t.calInf} corridas`
  P(`<text x="${(ox + 6).toFixed(1)}" y="${(ySup - 6).toFixed(1)}" font-size="${fs}" font-weight="600" fill="${C.top}">${esc(supLbl)}</text>`)
  P(`<text x="${(ox + 6).toFixed(1)}" y="${(yInf + fs + 4).toFixed(1)}" font-size="${fs}" font-weight="600" fill="${C.bot}">${esc(infLbl)}</text>`)

  // Bastones: segunda capa (a un diámetro hacia adentro), acotados desde el apoyo I
  const off = Math.max(2.2, dSup) * scale
  const drawBars = (bars, color, yBase, dir, cal) => {
    bars.forEach((b, i) => {
      const y = yBase + dir * off * (1 + (i % 2) * 0.9)
      const x0 = X(b.x0), x1 = X(b.x1)
      P(`<line x1="${x0.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="${Math.max(2.5, ((DIAM[cal] || 12.7) / 10) * scale * 0.7).toFixed(1)}"/>`)
      // ganchos si ancla en apoyo
      if (b.ancla?.includes('I')) P(`<line x1="${x0.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x0.toFixed(1)}" y2="${(y + dir * hook).toFixed(1)}" stroke="${color}" stroke-width="2.5"/>`)
      if (b.ancla?.includes('J')) P(`<line x1="${x1.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${(y + dir * hook).toFixed(1)}" stroke="${color}" stroke-width="2.5"/>`)
      // etiqueta
      const lbl = `${b.k}#${cal} L=${f2(b.len)} m${b.ancla ? ` (anclar en ${b.ancla})` : ''}`
      const ty = dir > 0 ? y + fs + 3 : y - 5
      P(`<text x="${((x0 + x1) / 2).toFixed(1)}" y="${ty.toFixed(1)}" font-size="${fs}" font-weight="700" fill="${color}" text-anchor="middle">${esc(lbl)}</text>`)
      // cotas del bastón (debajo de la trabe, escalonadas)
      const dy = oy + hpx + 40 + i * 16
      if (b.x0 > 0) {
        P(`<line x1="${ox.toFixed(1)}" y1="${dy}" x2="${x0.toFixed(1)}" y2="${dy}" stroke="${C.dim}" stroke-width="0.9"/>`)
        P(`<line x1="${ox.toFixed(1)}" y1="${dy - 4}" x2="${ox.toFixed(1)}" y2="${dy + 4}" stroke="${C.dim}" stroke-width="0.9"/>`)
        P(`<text x="${((ox + x0) / 2).toFixed(1)}" y="${dy - 3}" font-size="${fs - 1}" fill="${C.muted}" text-anchor="middle">${f2(b.x0)}</text>`)
      }
      P(`<line x1="${x0.toFixed(1)}" y1="${dy}" x2="${x1.toFixed(1)}" y2="${dy}" stroke="${color}" stroke-width="1.1"/>`)
      P(`<line x1="${x0.toFixed(1)}" y1="${dy - 4}" x2="${x0.toFixed(1)}" y2="${dy + 4}" stroke="${color}" stroke-width="0.9"/>`)
      P(`<line x1="${x1.toFixed(1)}" y1="${dy - 4}" x2="${x1.toFixed(1)}" y2="${dy + 4}" stroke="${color}" stroke-width="0.9"/>`)
      P(`<text x="${((x0 + x1) / 2).toFixed(1)}" y="${dy - 3}" font-size="${fs - 1}" font-weight="600" fill="${color}" text-anchor="middle">${f2(b.len)}</text>`)
    })
  }
  drawBars(r.sup.bars, C.top, ySup, 1, t.calBastonSup || t.calSup)
  drawBars(r.inf.bars, C.bot, yInf, -1, t.calBastonInf || t.calInf)

  // Estribos por zonas en cada claro: L/4 @ sepLcuarto, centro @ sepRest (separación real)
  const sups = (r.supports && r.supports.length >= 2) ? r.supports : [0, r.L]
  const zones = []
  for (let i = 0; i < sups.length - 1; i++) {
    const a = sups[i], b = sups[i + 1], qs = (b - a) / 4
    if (b - a <= 0) continue
    zones.push([a, a + qs, t.sepLcuarto], [a + qs, b - qs, t.sepRest], [b - qs, b, t.sepLcuarto])
  }
  // apoyos interiores (columnas / trabes principales detectadas por el salto de cortante)
  for (const xs of sups.slice(1, -1)) {
    const xp = X(xs)
    P(`<polygon points="${(xp - 9).toFixed(1)},${(oy + hpx + 22).toFixed(1)} ${(xp + 9).toFixed(1)},${(oy + hpx + 22).toFixed(1)} ${xp.toFixed(1)},${(oy + hpx + 4).toFixed(1)}" fill="none" stroke="${C.concrete}" stroke-width="1.4"/>`)
    P(`<line x1="${xp.toFixed(1)}" y1="${oy.toFixed(1)}" x2="${xp.toFixed(1)}" y2="${(oy + hpx).toFixed(1)}" stroke="${C.concrete}" stroke-width="1" stroke-dasharray="4,3"/>`)
  }
  // nudos entre miembros (elemento formado por varios miembros de RAM)
  if (r.members && r.members.length > 1) {
    for (const m of r.members) {
      const xp = X(m.x0)
      P(`<text x="${(xp + 3).toFixed(1)}" y="${(oy + hpx / 2 + 4).toFixed(1)}" font-size="${fs - 2}" fill="${C.muted}">M-${esc(m.id)}</text>`)
      if (m.x0 > 0) P(`<line x1="${xp.toFixed(1)}" y1="${(oy + hpx * 0.35).toFixed(1)}" x2="${xp.toFixed(1)}" y2="${(oy + hpx * 0.65).toFixed(1)}" stroke="${C.muted}" stroke-width="0.8" stroke-dasharray="2,2"/>`)
    }
  }
  const eiPx = (rc - dSup / 2) * scale
  for (const [za, zb, s] of zones) {
    const sM = (+s || 0) / 100
    if (!(sM > 0)) continue
    let x = za + 0.05
    const step = sM
    let n = 0
    while (x <= zb - 0.02 && n < 400) {
      const xp = X(x)
      P(`<line x1="${xp.toFixed(1)}" y1="${(oy + eiPx).toFixed(1)}" x2="${xp.toFixed(1)}" y2="${(oy + hpx - eiPx).toFixed(1)}" stroke="${C.stirrup}" stroke-width="1"/>`)
      x += step; n++
    }
    P(`<text x="${X((za + zb) / 2).toFixed(1)}" y="${(oy - 26).toFixed(1)}" font-size="${fs}" font-weight="600" fill="${C.stirrup}" text-anchor="middle">E#${esc(t.calEst)} @ ${esc(s)}</text>`)
    P(`<line x1="${X(za).toFixed(1)}" y1="${(oy - 18).toFixed(1)}" x2="${X(zb).toFixed(1)}" y2="${(oy - 18).toFixed(1)}" stroke="${C.stirrup}" stroke-width="0.9"/>`)
    P(`<line x1="${X(za).toFixed(1)}" y1="${(oy - 22).toFixed(1)}" x2="${X(za).toFixed(1)}" y2="${(oy - 14).toFixed(1)}" stroke="${C.stirrup}" stroke-width="0.9"/>`)
    P(`<line x1="${X(zb).toFixed(1)}" y1="${(oy - 22).toFixed(1)}" x2="${X(zb).toFixed(1)}" y2="${(oy - 14).toFixed(1)}" stroke="${C.stirrup}" stroke-width="0.9"/>`)
    P(`<text x="${X((za + zb) / 2).toFixed(1)}" y="${(oy - 6).toFixed(1)}" font-size="${fs - 2}" fill="${C.stirrup}" text-anchor="middle">${f2(zb - za)}</text>`)
  }

  // Cota de peralte (izquierda) y de longitud (abajo del todo)
  const hx = ox - SUP - 22
  P(`<line x1="${hx}" y1="${oy.toFixed(1)}" x2="${hx}" y2="${(oy + hpx).toFixed(1)}" stroke="${C.dim}" stroke-width="0.9"/>`)
  P(`<line x1="${hx - 4}" y1="${oy.toFixed(1)}" x2="${hx + 4}" y2="${oy.toFixed(1)}" stroke="${C.dim}" stroke-width="0.9"/>`)
  P(`<line x1="${hx - 4}" y1="${(oy + hpx).toFixed(1)}" x2="${hx + 4}" y2="${(oy + hpx).toFixed(1)}" stroke="${C.dim}" stroke-width="0.9"/>`)
  P(`<text x="${hx - 6}" y="${(oy + hpx / 2).toFixed(1)}" font-size="${fs}" fill="${C.muted}" text-anchor="middle" transform="rotate(-90,${hx - 6},${(oy + hpx / 2).toFixed(1)})">${esc(t.peralte)}</text>`)
  const nBars = Math.max(r.sup.bars.length, r.inf.bars.length)
  const ly = oy + hpx + 40 + nBars * 16 + 14
  P(`<line x1="${ox.toFixed(1)}" y1="${ly}" x2="${(ox + Lpx).toFixed(1)}" y2="${ly}" stroke="${C.dim}" stroke-width="0.9"/>`)
  P(`<line x1="${ox.toFixed(1)}" y1="${ly - 4}" x2="${ox.toFixed(1)}" y2="${ly + 4}" stroke="${C.dim}" stroke-width="0.9"/>`)
  P(`<line x1="${(ox + Lpx).toFixed(1)}" y1="${ly - 4}" x2="${(ox + Lpx).toFixed(1)}" y2="${ly + 4}" stroke="${C.dim}" stroke-width="0.9"/>`)
  P(`<text x="${(ox + Lpx / 2).toFixed(1)}" y="${ly - 3}" font-size="${fs}" fill="${C.muted}" text-anchor="middle">L = ${f2(r.L)} m</text>`)
  P(`<text x="${(ox - SUP / 2).toFixed(1)}" y="${(oy + hpx + 60).toFixed(1)}" font-size="${fs - 1}" fill="${C.muted}" text-anchor="middle">apoyo I</text>`)
  P(`<text x="${(ox + Lpx + SUP / 2).toFixed(1)}" y="${(oy + hpx + 60).toFixed(1)}" font-size="${fs - 1}" fill="${C.muted}" text-anchor="middle">apoyo J</text>`)

  // Título
  const title = opts.title || `${t.nombre || 'TRABE'} · ${r.isElement ? 'E ' : 'M-'}${r.id}`
  P(`<text x="${(ox + Lpx / 2).toFixed(1)}" y="${ly + fs + 12}" font-size="${fs + 4}" font-weight="700" fill="${C.ink}" text-anchor="middle">${esc(title)}</text>`)
  if (opts.subtitle) P(`<text x="${(ox + Lpx / 2).toFixed(1)}" y="${ly + 2 * fs + 16}" font-size="${fs - 1}" fill="${C.muted}" text-anchor="middle">${esc(opts.subtitle)}</text>`)

  const Htot = ly + 2 * fs + 30
  const inner = out.join('')
  return {
    inner, W, H: Htot,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${Htot.toFixed(0)}" width="${W.toFixed(0)}" height="${Htot.toFixed(0)}" font-family="'DM Mono','Courier New',monospace">${inner}</svg>`,
  }
}

/** Alzados de todos los patrones de un grupo, apilados en un solo <g> (para el export) */
export function elevationsGridSvg(t, group, scale = 14) {
  let y = 0, W = 0
  const parts = []
  for (const p of group.patterns) {
    const ids = p.members
    const title = `${t.nombre || 'TRABE'} · patrón ${p.label} (${ids.length} miembro${ids.length !== 1 ? 's' : ''})`
    const pre = p.sample.isElement ? 'E ' : 'M-'
    const subtitle = ids.length <= 12 ? ids.map((i) => pre + i).join(', ') : `${ids.slice(0, 12).map((i) => pre + i).join(', ')} … (+${ids.length - 12})`
    const e = elevationSvg(t, p.sample, { scale, title, subtitle })
    parts.push(`<g transform="translate(0,${y.toFixed(1)})">${e.inner}</g>`)
    y += e.H + 20
    W = Math.max(W, e.W)
  }
  return { inner: parts.join(''), W, H: y }
}

/**
 * Diagrama de momento y cortante de un miembro con las líneas de MR.
 * Mu+ hacia abajo (convención de trabes), Mu− hacia arriba.
 */
export function diagramSvg(r, caps, opts = {}) {
  const W = opts.width || 720, HM = 210, HV = 120
  const PAD = { l: 52, r: 16, t: 26, b: 26 }
  const plotW = W - PAD.l - PAD.r
  const L = r.L
  const xs = (x) => PAD.l + (x / L) * plotW
  const out = []
  const P = (s) => out.push(s)

  // ── momento ──
  const MRP = caps.MRP, MRN = caps.MRN
  const kInf = Math.max(0, ...r.inf.bars.map((b) => b.k)), kSup = Math.max(0, ...r.sup.bars.map((b) => b.k))
  const MRPk = kInf ? caps.inf.withK(kInf)?.MRT || MRP : MRP
  const MRNk = kSup ? caps.sup.withK(kSup)?.MRT || MRN : MRN
  const maxM = Math.max(r.profile.muPmax, r.profile.muNmax, MRPk, MRNk, 0.1) * 1.12
  const y0 = PAD.t + HM / 2
  const ym = (m) => y0 + (m / maxM) * (HM / 2) // positivo hacia abajo
  P(`<rect x="0" y="0" width="${W}" height="${HM + HV + PAD.t + PAD.b + 30}" fill="#fff"/>`)
  P(`<text x="${PAD.l}" y="${PAD.t - 10}" font-size="11" font-weight="700" fill="${C.ink}">Momento (t·m) · ${r.isElement ? 'E ' : 'M-'}${esc(r.id)} · L = ${f2(L)} m${r.supports && r.supports.length > 2 ? ` · ${r.supports.length - 2} apoyo(s) interior(es)` : ''}</text>`)
  // zonas de bastón sombreadas
  for (const b of r.inf.bars) P(`<rect x="${xs(b.x0).toFixed(1)}" y="${y0.toFixed(1)}" width="${(xs(b.x1) - xs(b.x0)).toFixed(1)}" height="${(HM / 2).toFixed(1)}" fill="${C.bot}" opacity="0.08"/>`)
  for (const b of r.sup.bars) P(`<rect x="${xs(b.x0).toFixed(1)}" y="${PAD.t}" width="${(xs(b.x1) - xs(b.x0)).toFixed(1)}" height="${(HM / 2).toFixed(1)}" fill="${C.top}" opacity="0.08"/>`)
  // eje
  P(`<line x1="${PAD.l}" y1="${y0}" x2="${W - PAD.r}" y2="${y0}" stroke="#b8b2a6" stroke-width="1.2"/>`)
  // MR líneas
  const mrLine = (m, color, label, dashed) => {
    const y = ym(m)
    P(`<line x1="${PAD.l}" y1="${y.toFixed(1)}" x2="${W - PAD.r}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="1.2" ${dashed ? 'stroke-dasharray="5,4"' : ''}/>`)
    // etiqueta al centro-derecha, fuera de los apoyos donde suelen estar los picos
    P(`<text x="${(PAD.l + plotW * 0.62).toFixed(1)}" y="${(y + (m > 0 ? -3 : 11)).toFixed(1)}" font-size="9.5" fill="${color}" text-anchor="start">${esc(label)}</text>`)
  }
  // etiqueta de pico: anclada hacia adentro del diagrama
  const peakAnchor = (x) => (x < 0.25 * L ? ['start', 3] : x > 0.75 * L ? ['end', -3] : ['middle', 0])
  mrLine(MRP, C.bot, `MR+ corridas ${f2(MRP)}`, true)
  if (kInf) mrLine(MRPk, C.bot, `MR+ con ${kInf} bastón(es) ${f2(MRPk)}`, false)
  mrLine(-MRN, C.top, `MR− corridas ${f2(MRN)}`, true)
  if (kSup) mrLine(-MRNk, C.top, `MR− con ${kSup} bastón(es) ${f2(MRNk)}`, false)
  // curvas (lineal por tramos, como el reporte)
  const st = r.profile.stations
  const path = (key, sign) => st.map((s, i) => `${i === 0 ? 'M' : 'L'}${xs(s.x).toFixed(1)},${ym(sign * s[key]).toFixed(1)}`).join(' ')
  P(`<path d="${path('muP', 1)} L${xs(L).toFixed(1)},${y0} L${xs(0).toFixed(1)},${y0} Z" fill="${C.bot}" opacity="0.12"/>`)
  P(`<path d="${path('muP', 1)}" fill="none" stroke="${C.bot}" stroke-width="2"/>`)
  P(`<path d="${path('muN', -1)} L${xs(L).toFixed(1)},${y0} L${xs(0).toFixed(1)},${y0} Z" fill="${C.top}" opacity="0.12"/>`)
  P(`<path d="${path('muN', -1)}" fill="none" stroke="${C.top}" stroke-width="2"/>`)
  // picos
  const pk = st.reduce((a, s) => (s.muP > a.muP ? s : a), st[0])
  const nk = st.reduce((a, s) => (s.muN > a.muN ? s : a), st[0])
  if (pk.muP > 0) { const [an, dx] = peakAnchor(pk.x); P(`<text x="${(xs(pk.x) + dx).toFixed(1)}" y="${(ym(pk.muP) + 12).toFixed(1)}" font-size="9.5" font-weight="700" fill="${C.bot}" text-anchor="${an}">Mu+ ${f2(pk.muP)} @ ${f2(pk.x)} m</text>`) }
  if (nk.muN > 0) { const [an, dx] = peakAnchor(nk.x); P(`<text x="${(xs(nk.x) + dx).toFixed(1)}" y="${(ym(-nk.muN) - 4).toFixed(1)}" font-size="9.5" font-weight="700" fill="${C.top}" text-anchor="${an}">Mu− ${f2(nk.muN)} @ ${f2(nk.x)} m</text>`) }
  // barras de bastón (líneas gruesas a la altura del eje)
  for (const b of r.inf.bars) P(`<line x1="${xs(b.x0).toFixed(1)}" y1="${(y0 + 4).toFixed(1)}" x2="${xs(b.x1).toFixed(1)}" y2="${(y0 + 4).toFixed(1)}" stroke="${C.bot}" stroke-width="4"/>`)
  for (const b of r.sup.bars) P(`<line x1="${xs(b.x0).toFixed(1)}" y1="${(y0 - 4).toFixed(1)}" x2="${xs(b.x1).toFixed(1)}" y2="${(y0 - 4).toFixed(1)}" stroke="${C.top}" stroke-width="4"/>`)
  // eje y ticks
  P(`<line x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${PAD.t + HM}" stroke="#b8b2a6" stroke-width="1"/>`)
  for (const m of [-maxM / 1.12, -maxM / 2.24, 0, maxM / 2.24, maxM / 1.12]) {
    const lbl = m === 0 ? '0' : `${m < 0 ? '−' : '+'}${Math.abs(m).toFixed(2)}`
    P(`<text x="${PAD.l - 5}" y="${(ym(m) + 3).toFixed(1)}" font-size="9" fill="#8a8580" text-anchor="end">${lbl}</text>`)
  }
  P(`<text x="${PAD.l - 5}" y="${(PAD.t + 2).toFixed(1)}" font-size="8" fill="#8a8580" text-anchor="end">M−</text>`)
  P(`<text x="${PAD.l - 5}" y="${(PAD.t + HM + 2).toFixed(1)}" font-size="8" fill="#8a8580" text-anchor="end">M+</text>`)

  // ── cortante ──
  const yv0 = PAD.t + HM + 30 + HV / 2
  const maxV = Math.max(r.profile.vuMax, r.shear.extremos.Vr || 0, 0.1) * 1.15
  const yv = (v) => yv0 - (v / maxV) * (HV / 2)
  P(`<text x="${PAD.l}" y="${PAD.t + HM + 22}" font-size="11" font-weight="700" fill="${C.ink}">Cortante |V2| (t) · estribos E#${esc(caps.shear?.varEstNum ?? '')} @ ${esc(r.shear.extremos.s ?? '—')} / ${esc(r.shear.centro.s ?? '—')}</text>`)
  P(`<line x1="${PAD.l}" y1="${yv0}" x2="${W - PAD.r}" y2="${yv0}" stroke="#b8b2a6" stroke-width="1.2"/>`)
  const q = L / 4
  const vrSeg = (x0, x1, Vr, ok) => {
    if (Vr == null) return
    P(`<line x1="${xs(x0).toFixed(1)}" y1="${yv(Vr).toFixed(1)}" x2="${xs(x1).toFixed(1)}" y2="${yv(Vr).toFixed(1)}" stroke="${ok === false ? C.bad : C.stirrup}" stroke-width="1.4" stroke-dasharray="5,4"/>`)
  }
  vrSeg(0, q, r.shear.extremos.Vr, r.shear.extremos.ok)
  vrSeg(L - q, L, r.shear.extremos.Vr, r.shear.extremos.ok)
  vrSeg(q, L - q, r.shear.centro.Vr, r.shear.centro.ok)
  P(`<text x="${W - PAD.r - 2}" y="${(yv(r.shear.extremos.Vr || 0) - 3).toFixed(1)}" font-size="9.5" fill="${C.stirrup}" text-anchor="end">Vr L/4 ${f2(r.shear.extremos.Vr || 0)} · centro ${f2(r.shear.centro.Vr || 0)}</text>`)
  const vpath = st.map((s, i) => `${i === 0 ? 'M' : 'L'}${xs(s.x).toFixed(1)},${yv(s.vu).toFixed(1)}`).join(' ')
  P(`<path d="${vpath} L${xs(L).toFixed(1)},${yv0} L${xs(0).toFixed(1)},${yv0} Z" fill="#9333ea" opacity="0.10"/>`)
  P(`<path d="${vpath}" fill="none" stroke="#9333ea" stroke-width="2"/>`)
  P(`<line x1="${xs(q).toFixed(1)}" y1="${yv0 - HV / 2}" x2="${xs(q).toFixed(1)}" y2="${yv0}" stroke="#d6d0c6" stroke-width="1" stroke-dasharray="3,3"/>`)
  P(`<line x1="${xs(L - q).toFixed(1)}" y1="${yv0 - HV / 2}" x2="${xs(L - q).toFixed(1)}" y2="${yv0}" stroke="#d6d0c6" stroke-width="1" stroke-dasharray="3,3"/>`)
  // eje x en m
  for (let i = 0; i <= 8; i++) {
    const x = (L * i) / 8
    P(`<text x="${xs(x).toFixed(1)}" y="${yv0 + 14}" font-size="9" fill="#8a8580" text-anchor="middle">${f2(x)}</text>`)
  }
  const Htot = HM + HV + PAD.t + PAD.b + 30
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Htot}" width="${W}" height="${Htot}" font-family="'DM Mono','Courier New',monospace">${out.join('')}</svg>`
}
