// ══════════════════════════════════════════════════════════════
// Column Calculator — Diseño por flexocompresión
// Réplica exacta de la hoja "Columnas" de DISEN_O_DE_CONCRETO_v2.xlsx
// (fórmulas celda a celda), generalizada a N lechos y barrido fino
// del eje neutro para un diagrama de interacción continuo.
// ══════════════════════════════════════════════════════════════

// ── Tabla BD (hoja "BD" del Excel — diámetro cm / área cm²) ──
// Nota: difiere ligeramente de VARILLAS del módulo de vigas en #9/#10
// (6.41 vs 6.45, 7.92 vs 8.19); se conservan los valores del Excel.
export const BD_VARILLAS = [
  { num: 2,   diam: 0.64, area: 0.32 },
  { num: 2.5, diam: 0.79, area: 0.49 },
  { num: 3,   diam: 0.95, area: 0.71 },
  { num: 4,   diam: 1.27, area: 1.27 },
  { num: 5,   diam: 1.59, area: 1.98 },
  { num: 6,   diam: 1.90, area: 2.85 },
  { num: 7,   diam: 2.22, area: 3.88 },
  { num: 8,   diam: 2.54, area: 5.07 },
  { num: 9,   diam: 2.86, area: 6.41 },
  { num: 10,  diam: 3.18, area: 7.92 },
  { num: 11,  diam: 3.49, area: 9.58 },
  { num: 12,  diam: 3.81, area: 11.40 },
]
export const bdLookup = (num) => BD_VARILLAS.find((v) => +v.num === +num) || BD_VARILLAS[2]

// ── β1 · Excel D18: =IF(f'c>280, 1.05−f'c/1400, 0.85) ─────────
export function beta1Col(fc) {
  return fc > 280 ? 1.05 - fc / 1400 : 0.85
}

// ── Posiciones de lechos · Excel F25/F26…: dp_i = ((h−2r)/(Le−1))·(i−1)+r
export function lechoDepths(h, r, nLechos) {
  if (nLechos <= 1) return [h / 2]
  const step = (h - 2 * r) / (nLechos - 1)
  return Array.from({ length: nLechos }, (_, i) => r + step * i)
}

/**
 * Normaliza los parámetros de una dirección de análisis.
 * lechos: [{ n, num }] del lecho 1 (cara de compresión) al último.
 */
function prepare({ h, b, r, fc, fy = 4200, E = 2e6, epsC = 0.003, lechos }) {
  const b1 = beta1Col(fc)
  const d = h - r
  // εs de fluencia · Excel D56 = 0.0021 (= 4200/2e6). Generalizado: fy/E.
  const epsY = fy / E
  const dps = lechoDepths(h, r, lechos.length)
  const capas = lechos.map((L, i) => ({
    n: +L.n || 0,
    num: L.num,
    area: bdLookup(L.num).area * (+L.n || 0), // Excel E25 = LOOKUP(ϕ)·n
    dp: L.dp !== undefined ? L.dp : dps[i],   // dp explícito (dirección Y) o distribuido
  }))
  const Ast = capas.reduce((s, c) => s + c.area, 0)
  return { h, b, r, fc, fy, E, epsC, epsY, b1, d, capas, Ast }
}

// ── POC · Excel D35: ((0.85·((h·b)−Ast)·f'c)+(Ast·fy))/1000 [ton]
export function calcPOC(P) {
  return ((0.85 * (P.h * P.b - P.Ast) * P.fc) + P.Ast * P.fy) / 1000
}

/**
 * Punto (P, M) para una profundidad de eje neutro c.
 * Réplica de las tablas "Fuerzas resistentes por lecho" del Excel:
 *   ε_i = εc·(c−dp_i)/c                        [C44]
 *   f_i = |ε_i|>εy ? fy·sign(ε_i) : E·ε_i      [D44]
 *   F_i = f_i·As_i/1000                        [E44]  (+ = compresión)
 *   Z_i = h/2 − dp_i                           [F44]
 *   M_i = F_i·Z_i·0.01                         [G44]
 *   CC  = 0.85·f'c·β1·c·b/1000                 [E49]
 *   Zcc = h/2 − β1·c/2                         [F49]
 *   P = ΣF + CC · M = ΣM + CC·Zcc·0.01         [D51/D52]
 */
export function pointForC(c, P) {
  const capas = P.capas.map((L) => {
    const eps = (P.epsC * (c - L.dp)) / c
    const f = Math.abs(eps) > P.epsY ? P.fy * Math.sign(eps) : P.E * eps
    const F = (f * L.area) / 1000
    const Z = P.h / 2 - L.dp
    const M = F * Z * 0.01
    return { ...L, eps, f, F, Z, M }
  })
  const CC = (0.85 * P.fc * P.b1 * c * P.b) / 1000
  const Zcc = P.h / 2 - (c * P.b1) / 2
  const Mcc = CC * Zcc * 0.01
  const Pt = capas.reduce((s, L) => s + L.F, 0) + CC
  const Mt = capas.reduce((s, L) => s + L.M, 0) + Mcc
  return { c, capas, CC, Zcc, Mcc, P: Pt, M: Mt }
}

/**
 * Análisis completo de una dirección (el "Excel" completo):
 * puntos canónicos + barrido fino para la curva.
 */
export function analyzeDirection(input, opts = {}) {
  const P = prepare(input)
  const { nSweep = 80 } = opts

  const POC = calcPOC(P)
  // cD · Excel D58: (d·εc)/(εs+εc)
  const cD = (P.d * P.epsC) / (P.epsY + P.epsC)
  // c del punto M0 · Excel D109: h/10
  const cM0 = P.h / 10
  // c del punto 1 · Excel D39: (h−cD)/2 + cD
  const c1 = (P.h - cD) / 2 + cD
  // c puntos 2 y 3 · Excel D75/D92: tercios entre cM0 y cD
  const c2 = ((cD - cM0) / 3) * 2 + cM0
  const c3 = ((cD - cM0) / 3) * 1 + cM0

  const canonical = [
    { key: 'POC', label: 'POC', c: null, P: POC, M: 0, detail: null },
    { key: 'P1', label: 'Punto 1', ...ptWrap(pointForC(c1, P)) },
    { key: 'D', label: 'D (balanceada)', ...ptWrap(pointForC(cD, P)) },
    { key: 'P2', label: 'Punto 2', ...ptWrap(pointForC(c2, P)) },
    { key: 'P3', label: 'Punto 3', ...ptWrap(pointForC(c3, P)) },
    { key: 'M0', label: 'M0', ...ptWrap(pointForC(cM0, P)) },
  ]

  // ── Barrido fino: de c pequeño (h/20) a c_max = h/β1 (a = h) ──
  // El bloque a = β1·c no puede exceder h; más allá la curva se une a POC.
  const cMax = P.h / P.b1
  const cMin = P.h / 20
  const curve = []
  for (let i = 0; i <= nSweep; i++) {
    const c = cMin + ((cMax - cMin) * i) / nSweep
    const pt = pointForC(c, P)
    curve.push({ c, P: pt.P, M: pt.M })
  }
  // Empalme final hacia compresión pura
  curve.push({ c: null, P: POC, M: 0 })

  return { params: P, POC, cD, cM0, c1, c2, c3, canonical, curve }
}

function ptWrap(pt) {
  return { c: pt.c, P: pt.P, M: pt.M, detail: pt }
}

/**
 * Retícula de barras (para dibujo y para la dirección Y).
 * Cada lecho reparte sus n barras uniformemente a lo ancho, con las
 * extremas a r de cada cara (n=1 → centrada).
 * Devuelve [{x, y, num, area, diam}] con y = dp del lecho (desde cara sup.)
 */
export function barGrid({ h, b, r, lechos }) {
  const dps = lechoDepths(h, r, lechos.length)
  const bars = []
  lechos.forEach((L, i) => {
    const n = +L.n || 0
    if (n <= 0) return
    const v = bdLookup(L.num)
    for (let j = 0; j < n; j++) {
      const x = n === 1 ? b / 2 : r + ((b - 2 * r) * j) / (n - 1)
      bars.push({ x, y: dps[i], num: +L.num, area: v.area, diam: v.diam })
    }
  })
  return bars
}

/**
 * Lechos equivalentes para la dirección Y (flexión alrededor del otro eje):
 * las barras se agrupan por su coordenada x → capas con dp = x, peralte = b.
 */
export function lechosY(input) {
  const bars = barGrid(input)
  const groups = new Map()
  for (const bar of bars) {
    const key = bar.x.toFixed(4)
    if (!groups.has(key)) groups.set(key, { dp: bar.x, area: 0, bars: [] })
    const g = groups.get(key)
    g.area += bar.area
    g.bars.push(bar)
  }
  return [...groups.values()].sort((a, b2) => a.dp - b2.dp)
    .map((g) => ({
      n: g.bars.length,
      num: g.bars[0].num, // representativo (puede haber mezcla)
      dp: g.dp,
      areaOverride: g.area,
    }))
}

/**
 * Análisis biaxial completo de la columna.
 *  - X: flexión que trabaja el peralte h (la hoja de Excel tal cual)
 *  - Y: sección girada 90° (h↔b) con capas agrupadas por x
 */
export function analyzeColumn(col, opts = {}) {
  const base = {
    h: +col.h, b: +col.b, r: +col.r, fc: +col.fc,
    fy: +col.fy || 4200, E: +col.E || 2e6, epsC: +col.epsC || 0.003,
  }
  const lechos = (col.lechos || []).map((L) => ({ n: +L.n || 0, num: L.num }))

  const dirX = analyzeDirection({ ...base, lechos }, opts)

  // Dirección Y: swap h↔b, capas desde la retícula real
  const capasY = lechosY({ h: base.h, b: base.b, r: base.r, lechos })
    .map((L) => ({ n: L.n, num: L.num, dp: L.dp }))
  // áreas exactas del agrupado (mezcla de calibres posible)
  const lechosYExact = lechosY({ h: base.h, b: base.b, r: base.r, lechos })
  const dirY = analyzeDirection(
    { ...base, h: base.b, b: base.h, lechos: capasY },
    opts,
  )
  // Corrige áreas de capas Y con las áreas agrupadas exactas
  dirY.params.capas.forEach((c, i) => {
    if (lechosYExact[i]) c.area = lechosYExact[i].areaOverride
  })

  return { dirX, dirY }
}

// ── Excentricidad y modo de revisión · Excel D8/B10 ───────────
export function excentricidad(Mu, Pu, b, h) {
  const e = Pu > 0 ? Mu / Pu : Infinity
  const eLim = 0.1 * (Math.min(b, h) / 100)
  return {
    e, eLim,
    modo: e < eLim ? 'Realizar revisión por compresión' : 'Realizar revisión por flexocompresión',
  }
}

/**
 * ¿El punto de demanda (Mu, Pu) queda dentro del diagrama?
 * Para el nivel Pu se interpola el M máximo de la frontera.
 */
export function checkPoint(curve, Pu, Mu) {
  // Curva ordenada por P ascendente (M0 tension → POC)
  const pts = [...curve].sort((a, b) => a.P - b.P)
  const Pmin = pts[0].P, Pmax = pts[pts.length - 1].P
  if (Pu < Pmin || Pu > Pmax) return { ok: false, MR: 0, ratio: Infinity, Pmin, Pmax }
  let MR = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    if (Pu >= a.P && Pu <= b.P) {
      const t = b.P === a.P ? 0 : (Pu - a.P) / (b.P - a.P)
      MR = Math.max(MR, a.M + t * (b.M - a.M))
    }
  }
  const ratio = MR > 0 ? Mu / MR : (Mu > 0 ? Infinity : 0)
  return { ok: Mu <= MR, MR, ratio, Pmin, Pmax }
}

/**
 * Revisión biaxial (referencia, contorno elíptico α=2):
 * (Mux/MRx)² + (Muy/MRy)² ≤ 1 al nivel Pu.
 */
export function checkBiaxial(anX, anY, Pu, Mux, Muy) {
  const cx = checkPoint(anX.curve, Pu, Mux)
  const cy = checkPoint(anY.curve, Pu, Muy)
  const ux = cx.MR > 0 ? Mux / cx.MR : (Mux > 0 ? Infinity : 0)
  const uy = cy.MR > 0 ? Muy / cy.MR : (Muy > 0 ? Infinity : 0)
  const val = ux * ux + uy * uy
  return { checkX: cx, checkY: cy, valor: val, ok: val <= 1 }
}

// ── Estribos · Excel D163–D167 (fórmulas exactas de la hoja) ───
// s1 = LOOKUP(ϕest → área BD)·16 · s2 = LOOKUP(ϕ lecho 1 → área BD)·48
// s3 = min(h, b) · s = ROUNDDOWN(min(s1,s2,s3))
export function calcEstribos({ estriboNum, longNum, h, b }) {
  const s1 = bdLookup(estriboNum).area * 16
  const s2 = bdLookup(longNum).area * 48
  const s3 = Math.min(+h, +b)
  const s = Math.floor(Math.min(s1, s2, s3))
  return { s1, s2, s3, s }
}
