// ══════════════════════════════════════════════════════════════
// Análisis longitudinal de trabes — bastones donde hacen falta
//
// Entrada: reporte de RAM Elements "Envolvente de esfuerzos" por
// estaciones (0%, 11%, … 100%) de todos los miembros de un tipo de
// trabe. Con el armado CORRIDO de la sección se obtiene MR+ y MR−; donde
// el momento actuante rebasa esas líneas hace falta acero adicional
// (bastón) sólo en esa zona y sólo en ese miembro. El módulo:
//   · localiza esas zonas exactamente (el perfil es lineal por tramos),
//   · decide cuántos bastones y qué longitud (NTC-2017 §5.1 y §6.1:
//     prolongar ≥ máx(d, 12db) más allá del punto teórico de corte, y
//     desarrollar Ld desde el punto de momento máximo),
//   · revisa el cortante por zonas de estribos (L/4 y centro),
//   · agrupa los miembros por patrón de bastones para dibujar pocos
//     detalles, y
//   · calcula el acero total para comparar contra el diseño "uniforme"
//     (subir el armado corrido de TODAS las trabes por un caso puntual).
// Unidades: momentos t·m, cortantes t, longitudes en m (L) y cm (sección).
// ══════════════════════════════════════════════════════════════

import { calcFlexion, calcCortante, VARILLAS } from './sectionCalculator'
import { CAL_TO_NUM } from './constants'

const NUM = /(-?\d+(?:[.,]\d+)?)\s+([A-Za-z0-9+*_.-]+)/g
const KG_PER_M_PER_CM2 = 0.785 // acero 7850 kg/m³ → 0.785 kg por metro por cm²

export const fmt2 = (v, d = 2) => (v === null || v === undefined || !isFinite(v) ? '—' : Number(v).toFixed(d))

// ── 1. Parser del reporte por estaciones ─────────────────────
/**
 * @returns {{ combo, unidades, archivo, members: [{ id, stations: [...] , L?: number }], points: [...], warnings }}
 *  stations[i] = { pos (0..1 si el reporte es en %; metros si viene en distancia), axial, v2, v3, tors, m22, m33 }
 *  cada esfuerzo = { max, min } (t o t·m).  `points` es la envolvente por miembro
 *  (filas Max/Min) compatible con parseRamEnvelope, para la revisión existente.
 */
export function parseRamStations(text) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/)
  const members = []
  const warnings = []
  let combo = '', unidades = '', archivo = ''
  let cur = null
  let pendingCombo = false
  let lastStation = null

  const startMember = (id) => { cur = { id, stations: [], isPct: null }; members.push(cur); lastStation = null }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line || /^-{3,}$/.test(line)) continue
    let m
    if ((m = /^Sistema de unidades\s*:\s*(.+)$/i.exec(line))) { unidades = m[1].trim(); continue }
    if ((m = /^Nombre del archivo\s*:\s*(.+)$/i.exec(line))) { archivo = m[1].trim(); continue }
    if (/^Envolvente de esfuerzos para/i.test(line)) { pendingCombo = true; continue }
    if (pendingCombo) { combo = line; pendingCombo = false; continue }
    if ((m = /^MIEMBRO\s+(\S+)/i.exec(line))) { startMember(m[1]); continue }
    if (!cur) continue

    // "0%    Max -0.01 CD  1.45 CD ..."  ·  "      Min -0.01 CD ..."  ·  "0.47  Max ..."
    if ((m = /^(\d+(?:[.,]\d+)?)(%?)\s+Max\b(.*)$/i.exec(line))) {
      const vals = [...m[3].matchAll(NUM)].map((x) => parseFloat(x[1].replace(',', '.')))
      if (vals.length < 6) { warnings.push(`Miembro ${cur.id}: fila "${line.slice(0, 40)}…" con ${vals.length} valores; se esperaban 6.`); continue }
      const isPct = m[2] === '%'
      if (cur.isPct === null) cur.isPct = isPct
      const raw = parseFloat(m[1].replace(',', '.'))
      const st = { raw, isPct, axial: { max: vals[0] }, v2: { max: vals[1] }, v3: { max: vals[2] }, tors: { max: vals[3] }, m22: { max: vals[4] }, m33: { max: vals[5] } }
      cur.stations.push(st)
      lastStation = st
      continue
    }
    if ((m = /^Min\b(.*)$/i.exec(line)) && lastStation) {
      const vals = [...m[1].matchAll(NUM)].map((x) => parseFloat(x[1].replace(',', '.')))
      if (vals.length < 6) { warnings.push(`Miembro ${cur.id}: fila Min con ${vals.length} valores.`); continue }
      const keys = ['axial', 'v2', 'v3', 'tors', 'm22', 'm33']
      keys.forEach((k, i) => { lastStation[k].min = vals[i] })
      lastStation = null
      continue
    }
  }

  // Normaliza posiciones y completa Min faltantes
  for (const mb of members) {
    const n = mb.stations.length
    if (n === 0) continue
    if (mb.isPct) {
      // RAM redondea 11.1% → "11%"; la posición real es i/(n−1)
      mb.stations.forEach((s, i) => { s.pos = n > 1 ? i / (n - 1) : 0 })
      mb.Lreport = null
    } else {
      const L = Math.max(...mb.stations.map((s) => s.raw))
      mb.stations.forEach((s) => { s.pos = L > 0 ? s.raw / L : 0 })
      mb.Lreport = L
    }
    for (const s of mb.stations) {
      for (const k of ['axial', 'v2', 'v3', 'tors', 'm22', 'm33']) if (s[k].min === undefined) s[k].min = s[k].max
    }
  }
  // El mismo .txt puede traer además el reporte "Máximos esfuerzos en miembros"
  // (mismo MIEMBRO sin estaciones): se conserva la primera aparición con estaciones.
  const byId = new Map()
  for (const mb of members) {
    const prev = byId.get(mb.id)
    if (!prev || (prev.stations.length < 2 && mb.stations.length >= 2)) byId.set(mb.id, mb)
  }
  const unique = [...byId.values()]
  const valid = unique.filter((mb) => mb.stations.length >= 2)
  if (unique.length && valid.length < unique.length) warnings.push(`${unique.length - valid.length} miembro(s) sin estaciones legibles se omitieron.`)
  if (!valid.length) warnings.push('No se encontraron miembros con estaciones. Exporta en RAM el reporte «Envolvente de esfuerzos» (por estaciones).')

  // Envolvente compatible (Max/Min por miembro) para la revisión de sección existente
  const points = []
  for (const mb of valid) {
    const agg = (k, f) => f(...mb.stations.map((s) => s[k].max), ...mb.stations.map((s) => s[k].min))
    const mx = { axial: agg('axial', Math.max), v2: agg('v2', Math.max), v3: agg('v3', Math.max), tors: agg('tors', Math.max), m22: agg('m22', Math.max), m33: agg('m33', Math.max) }
    const mn = { axial: agg('axial', Math.min), v2: agg('v2', Math.min), v3: agg('v3', Math.min), tors: agg('tors', Math.min), m22: agg('m22', Math.min), m33: agg('m33', Math.min) }
    points.push({ id: `${mb.id}-Max`, member: mb.id, tipo: 'Max', ...mx, P: -mx.axial, combo })
    points.push({ id: `${mb.id}-Min`, member: mb.id, tipo: 'Min', ...mn, P: -mn.axial, combo })
  }

  return { combo, unidades, archivo, members: valid, points, warnings, formato: 'estaciones' }
}

/** ¿El texto es un reporte por estaciones (y no el de máximos por miembro)? */
export function looksLikeStations(text) {
  return /^\s*\d+(?:[.,]\d+)?%?\s+Max\b/m.test(String(text || '')) && /Estaci[oó]n/i.test(String(text || ''))
}

// ── 2. Perfil de un miembro (lineal por tramos) ──────────────
/**
 * @param member  miembro del parser
 * @param L       longitud en m (si el reporte venía en distancia se usa la suya)
 * @param invertir  true si en el modelo el M33 positivo va al revés
 * @returns { L, x:[m], muP:[t·m], muN:[t·m], vu:[t], stations:[{x, muP, muN, vu}] }
 */
export function memberProfile(member, L, invertir = false) {
  const len = member.Lreport || +L || 0
  const st = member.stations.map((s) => {
    const mx = invertir ? -s.m33.min : s.m33.max
    const mn = invertir ? -s.m33.max : s.m33.min
    return {
      x: s.pos * len, pos: s.pos,
      muP: Math.max(0, mx),                // positivo = tensión abajo
      muN: Math.max(0, -mn),               // negativo = tensión arriba
      vu: Math.max(Math.abs(s.v2.max), Math.abs(s.v2.min)),
      m33max: mx, m33min: mn,
    }
  })
  return {
    L: len, stations: st,
    muPmax: Math.max(0, ...st.map((s) => s.muP)),
    muNmax: Math.max(0, ...st.map((s) => s.muN)),
    vuMax: Math.max(0, ...st.map((s) => s.vu)),
  }
}

/** Interpola el perfil (lineal) en x */
export function profileAt(profile, key, x) {
  const st = profile.stations
  if (x <= st[0].x) return st[0][key]
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1]
    if (x >= a.x && x <= b.x) {
      const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x)
      return a[key] + t * (b[key] - a[key])
    }
  }
  return st[st.length - 1][key]
}

/**
 * Intervalos [xa, xb] donde el perfil (lineal por tramos) supera `limit`.
 * Cruces exactos sobre cada tramo; se devuelven con su pico.
 */
export function exceedZones(profile, key, limit) {
  const st = profile.stations
  const zones = []
  let open = null
  const closeAt = (x) => { if (open) { open.xb = x; zones.push(open); open = null } }
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1]
    const va = a[key] - limit, vb = b[key] - limit
    const dx = b.x - a.x
    if (i === 0 && va > 0) open = { xa: a.x, peakX: a.x, peak: a[key] }
    if (open) {
      if (a[key] > open.peak) { open.peak = a[key]; open.peakX = a.x }
      if (vb <= 0) { closeAt(vb === 0 ? b.x : a.x + dx * (va / (va - vb))) }
      else if (b[key] > open.peak) { open.peak = b[key]; open.peakX = b.x }
    } else if (vb > 0) {
      const xa = va === vb ? a.x : a.x + dx * (va / (va - vb))
      open = { xa: Math.max(a.x, Math.min(b.x, xa)), peakX: b.x, peak: b[key] }
      if (va > 0 && a[key] > open.peak) { open.peak = a[key]; open.peakX = a.x }
    }
  }
  if (open) closeAt(st[st.length - 1].x)
  // Une zonas que se tocan (numéricamente)
  const merged = []
  for (const z of zones) {
    const last = merged[merged.length - 1]
    if (last && z.xa - last.xb < 1e-9) {
      last.xb = z.xb
      if (z.peak > last.peak) { last.peak = z.peak; last.peakX = z.peakX }
    } else merged.push({ ...z })
  }
  return merged
}

// ── 3. Longitud de desarrollo · NTC-2017 §6.1.2.1 ────────────
/**
 * Ldb = as·fy / (3·(c+Ktr)·√f'c) ≥ 0.06·db·fy/√f'c, con (c+Ktr) ≤ 2.5·db.
 * c = menor de: distancia del centro de la barra a la superficie más próxima
 *     y mitad de la separación entre centros (aquí: recubrimiento al centro).
 * Factor 1.3 para barras "altas" (más de 30 cm de concreto colado debajo).
 * @returns cm
 */
export function developmentLength({ area, db, fy = 4200, fc = 250, c = 3, Ktr = 0, top = false, hBelow = 0 }) {
  const cEff = Math.min(c + Ktr, 2.5 * db)
  let Ld = (area * fy) / (3 * cEff * Math.sqrt(fc))
  const Lmin = (0.06 * db * fy) / Math.sqrt(fc)
  Ld = Math.max(Ld, Lmin)
  const f = top && hBelow >= 30 ? 1.3 : 1.0
  return { Ld: Ld * f, Ldb: Ld, factor: f, cEff, Lmin }
}

// ── 4. Capacidades de la sección para el análisis ─────────────
/**
 * MR del armado corrido (sin bastones) y con k bastones, por lecho.
 * @param t sección (detallador) — se usan sus varillas corridas y el calibre de bastón
 */
export function sectionCapacities(t) {
  const calc = t.calc || {}
  const fc = +t.fc || 250, fy = +calc.fy || 4200
  const b = +t.ancho, h = +t.peralte, r = +t.recub || 3
  const d = h - r
  const mk = (calNum, n, calBast) => (k) => {
    const R = calcFlexion({ fc, fy, b, h, r, MuTm: 0.001, varNum: calNum, varCount: n, bastonNum: calBast, bastonCount: k })
    return R.error ? null : R
  }
  const infNum = CAL_TO_NUM[t.calInf] || 3, supNum = CAL_TO_NUM[t.calSup] || 3
  const bInfNum = CAL_TO_NUM[t.calBastonInf] || infNum, bSupNum = CAL_TO_NUM[t.calBastonSup] || supNum
  const nInf = Math.max(1, +t.cantInf || 0), nSup = Math.max(1, +t.cantSup || 0)
  const fInf = mk(infNum, nInf, bInfNum), fSup = mk(supNum, nSup, bSupNum)
  const vInf = VARILLAS.find((v) => v.num === infNum) || VARILLAS[2]
  const vSup = VARILLAS.find((v) => v.num === supNum) || VARILLAS[2]
  const vbInf = VARILLAS.find((v) => v.num === bInfNum) || vInf
  const vbSup = VARILLAS.find((v) => v.num === bSupNum) || vSup

  const baseP = fInf(0), baseN = fSup(0)
  const LdInf = developmentLength({ area: vbInf.area, db: vbInf.diam, fy, fc, c: r, top: false })
  const LdSup = developmentLength({ area: vbSup.area, db: vbSup.diam, fy, fc, c: r, top: true, hBelow: h - r })

  // Cortante por zonas de estribos: extremos (L/4) con sepLcuarto, centro con sepRest
  const varEstNum = +(calc.varEstNum || CAL_TO_NUM[t.calEst] || 2)
  const nramas = +(calc.nramas || 2)
  const AsUsada = Math.max(baseP?.AsTotal || 0, baseN?.AsTotal || 0) || 4.52
  const sL4 = +(calc.SL4 || t.sepLcuarto || 0) || null
  const sRest = +(calc.SLresto || t.sepRest || 0) || null

  return {
    fc, fy, b, h, r, d,
    inf: { num: infNum, n: nInf, bar: vInf, bast: vbInf, base: baseP, withK: fInf, Ld: LdInf, ext: Math.max(d, 12 * vbInf.diam), kMax: nInf },
    sup: { num: supNum, n: nSup, bar: vSup, bast: vbSup, base: baseN, withK: fSup, Ld: LdSup, ext: Math.max(d, 12 * vbSup.diam), kMax: nSup },
    MRP: baseP?.MRT || 0, MRN: baseN?.MRT || 0,
    shear: { varEstNum, nramas, AsUsada, sL4, sRest },
    okBase: !!(baseP && baseN && baseP.okBmin && baseN.okBmin && baseP.okMax && baseN.okMax && baseP.okMin && baseN.okMin),
  }
}

/** Vr (t) para una separación s (cm) — misma fórmula que la calculadora */
export function shearCapacity(caps, L, VuTon, s) {
  const { fc, fy, b, h, r } = caps
  const R = calcCortante({ fc, fy, b, h, r, L, VuTon: Math.max(VuTon, 0.0001), AsUsada: caps.shear.AsUsada, varEstNum: caps.shear.varEstNum, nramas: caps.shear.nramas })
  const Vsr = s ? (R.FR * R.Av * fy * R.d) / s : 0
  return { Vr: (R.VcrKg + Vsr) / 1000, Vcr: R.VcrKg / 1000, VaMax: R.VaMax, Suso: R.Suso, SmaxGeom: R.SmaxGeom, Av: R.Av, FR: R.FR, d: R.d, seccionInsuficiente: R.seccionInsuficiente, SminAlert: R.SminAlert }
}

// ── 5. Bastones de un miembro ─────────────────────────────────
const round5 = (v, up) => (up ? Math.ceil(v * 20 - 1e-9) / 20 : Math.floor(v * 20 + 1e-9) / 20) // m, múltiplos de 5 cm

/**
 * Para un lecho (inf: Mu+, sup: Mu−): zonas donde Mu > MR base, bastones
 * necesarios en cada una y longitud de la barra.
 * @returns { bars:[{x0, x1, len, k, zone:{xa,xb,peak,peakX}, ancla:'I'|'J'|null}], insuficiente:bool, need:[...] }
 */
export function bastonesForLecho(profile, lecho, key, opts = {}) {
  const L = profile.L
  const minLen = opts.minLen ?? 0.6 // m — mínimo práctico de obra (configurable)
  const MR0 = lecho.base?.MRT || 0
  const zones = exceedZones(profile, key, MR0)
  const bars = []
  let insuficiente = false
  const need = []
  for (const z of zones) {
    // cuántos bastones cubren el pico
    let k = null
    for (let kk = 1; kk <= lecho.kMax; kk++) {
      const R = lecho.withK(kk)
      if (R && R.MRT >= z.peak - 1e-9 && R.okMax) { k = kk; break }
    }
    if (k === null) {
      insuficiente = true
      const Rmax = lecho.withK(lecho.kMax)
      need.push({ ...z, MRmax: Rmax?.MRT || 0, kMax: lecho.kMax })
      k = lecho.kMax // se dibuja lo máximo posible y se marca insuficiente
    }
    const extM = lecho.ext / 100, LdM = lecho.Ld.Ld / 100
    let x0 = Math.min(z.xa - extM, z.peakX - LdM)
    let x1 = Math.max(z.xb + extM, z.peakX + LdM)
    const ancla = (x0 <= 0 ? 'I' : '') + (x1 >= L ? 'J' : '')
    // dentro del claro (lo que sobra en el apoyo se resuelve con el anclaje)
    x0 = Math.max(0, x0); x1 = Math.min(L, x1)
    // mínimo práctico: se alarga simétricamente respecto al pico, sin salirse del claro
    if (x1 - x0 < minLen) {
      const falta = minLen - (x1 - x0)
      x0 -= falta / 2; x1 += falta / 2
      if (x0 < 0) { x1 += -x0; x0 = 0 }
      if (x1 > L) { x0 -= x1 - L; x1 = L }
      x0 = Math.max(0, x0)
    }
    x0 = round5(Math.max(0, x0), false)
    x1 = round5(Math.min(L, x1), true)
    bars.push({ x0, x1, len: +(x1 - x0).toFixed(2), k, zone: z, ancla: ancla || null, MR: lecho.withK(k)?.MRT || 0 })
  }
  // Une barras que se traslapan (misma dirección): una sola con k máximo
  bars.sort((a, b) => a.x0 - b.x0)
  const merged = []
  for (const bar of bars) {
    const last = merged[merged.length - 1]
    if (last && bar.x0 <= last.x1 + 1e-9) {
      last.x1 = Math.max(last.x1, bar.x1); last.len = +(last.x1 - last.x0).toFixed(2)
      last.k = Math.max(last.k, bar.k); last.MR = Math.max(last.MR, bar.MR)
      last.zones = [...(last.zones || [last.zone]), bar.zone]
      last.ancla = [last.ancla, bar.ancla].filter(Boolean).join('') || null
    } else merged.push({ ...bar, zones: [bar.zone] })
  }
  return { bars: merged, insuficiente, need, zones, MR0 }
}

/** Revisión de cortante por zonas: extremos L/4 (sepLcuarto) y centro (sepRest) */
export function shearZones(profile, caps) {
  const L = profile.L
  const { sL4, sRest } = caps.shear
  const q = L / 4
  const inZone = (x0, x1) => Math.max(0, ...profile.stations.filter((s) => s.x >= x0 - 1e-9 && s.x <= x1 + 1e-9).map((s) => s.vu),
    profileAt(profile, 'vu', x0), profileAt(profile, 'vu', x1))
  const vEnd = Math.max(inZone(0, q), inZone(L - q, L))
  const vMid = inZone(q, L - q)
  const mk = (Vu, s) => {
    if (!s) return { Vu, s: null, Vr: null, ok: null }
    const c = shearCapacity(caps, L, Vu, s)
    const ok = !c.seccionInsuficiente && c.Vr >= Vu - 1e-9
    // separación necesaria si no pasa
    let sReq = null
    if (!ok && !c.seccionInsuficiente) {
      const VsrNec = Vu * 1000 - c.Vcr * 1000
      sReq = VsrNec > 0 ? Math.max(6, Math.floor(Math.min((c.FR * c.Av * caps.fy * c.d) / VsrNec, c.SmaxGeom))) : c.SmaxGeom
    }
    return { Vu, s, Vr: c.Vr, ok, sReq, insuficiente: c.seccionInsuficiente, sMax: c.SmaxGeom }
  }
  return { extremos: { ...mk(vEnd, sL4), largo: q }, centro: { ...mk(vMid, sRest), largo: L - 2 * q }, vuMax: profile.vuMax }
}

/**
 * Análisis completo de un miembro contra la sección.
 * @returns { id, L, profile, inf, sup, shear, status:'ok'|'baston'|'insuficiente', signature }
 */
export function analyzeMember(member, caps, { L, invertir = false, minLen } = {}) {
  const profile = memberProfile(member, L, invertir)
  const inf = bastonesForLecho(profile, caps.inf, 'muP', { minLen })
  const sup = bastonesForLecho(profile, caps.sup, 'muN', { minLen })
  const shear = shearZones(profile, caps)
  // Corte de barras en zona de tensión (NTC §5.1.4.1 / ACI 12.10.5): en el punto de corte
  // Vu no debe pasar de 2/3·Vr; si pasa, hay que poner estribos adicionales en el tramo.
  const q = profile.L / 4
  const vrAt = (x) => {
    const zone = x < q || x > profile.L - q ? shear.extremos : shear.centro
    return zone.Vr
  }
  for (const bar of [...inf.bars, ...sup.bars]) {
    bar.corteTension = []
    for (const xc of [bar.x0, bar.x1]) {
      if (xc <= 0 || xc >= profile.L) continue // termina en el apoyo: se ancla, no se corta
      const Vu = profileAt(profile, 'vu', xc), Vr = vrAt(xc)
      if (Vr && Vu > (2 / 3) * Vr) bar.corteTension.push({ x: xc, Vu, Vr })
    }
  }
  const insuf = inf.insuficiente || sup.insuficiente || shear.extremos.insuficiente || shear.centro.insuficiente
  const shearFail = shear.extremos.ok === false || shear.centro.ok === false
  const status = insuf ? 'insuficiente' : (inf.bars.length || sup.bars.length) ? 'baston' : 'ok'
  const sig = (bars, tag) => bars.map((b) => `${tag}${b.k}@${b.x0.toFixed(2)}-${b.x1.toFixed(2)}`).join('|')
  const signature = [sig(inf.bars, 'I'), sig(sup.bars, 'S')].filter(Boolean).join('/') || 'base'
  return { id: member.id, L: profile.L, profile, inf, sup, shear, shearFail, status, signature }
}

// ── 6. Grupo completo, patrones y acero ───────────────────────
export const barWeight = (area) => area * KG_PER_M_PER_CM2 // kg/m

/**
 * @param t        sección
 * @param perfil   { members, L, Lpor:{id:L}, invertir }
 */
export function analyzeGroup(t, perfil) {
  const caps = sectionCapacities(t)
  const Ldef = +perfil?.L || 0
  const results = (perfil?.members || []).map((mb) => {
    const L = mb.Lreport || +(perfil?.Lpor?.[mb.id]) || Ldef
    return analyzeMember(mb, caps, { L, invertir: !!perfil?.invertir, minLen: perfil?.minLen })
  })

  // Patrones (misma firma de bastones) → un dibujo por patrón
  const byPattern = new Map()
  for (const r of results) {
    if (!byPattern.has(r.signature)) byPattern.set(r.signature, { signature: r.signature, members: [], sample: r })
    byPattern.get(r.signature).members.push(r.id)
  }
  const patterns = [...byPattern.values()].sort((a, b) => (a.signature === 'base' ? -1 : b.signature === 'base' ? 1 : b.members.length - a.members.length))
  patterns.forEach((p, i) => { p.label = String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : '') })

  // Acero (kg): corrido + bastones · referencia uniforme (sin bastones)
  const wInf = barWeight(caps.inf.bar.area), wSup = barWeight(caps.sup.bar.area)
  const wbInf = barWeight(caps.inf.bast.area), wbSup = barWeight(caps.sup.bast.area)
  let kgBase = 0, kgBast = 0, mTotal = 0
  for (const r of results) {
    mTotal += r.L
    kgBase += r.L * (caps.inf.n * wInf + caps.sup.n * wSup)
    kgBast += r.inf.bars.reduce((s, b) => s + b.k * b.len * wbInf, 0) + r.sup.bars.reduce((s, b) => s + b.k * b.len * wbSup, 0)
  }
  const uniforme = uniformDesign(t, results)
  const kgUniforme = uniforme ? mTotal * (uniforme.inf.n * barWeight(uniforme.inf.bar.area) + uniforme.sup.n * barWeight(uniforme.sup.bar.area)) : null

  const nOk = results.filter((r) => r.status === 'ok').length
  const nBast = results.filter((r) => r.status === 'baston').length
  const nInsuf = results.filter((r) => r.status === 'insuficiente').length
  const nShear = results.filter((r) => r.shearFail).length
  const kMaxInf = Math.max(0, ...results.flatMap((r) => r.inf.bars.map((b) => b.k)))
  const kMaxSup = Math.max(0, ...results.flatMap((r) => r.sup.bars.map((b) => b.k)))

  return {
    caps, results, patterns,
    n: results.length, nOk, nBast, nInsuf, nShear,
    kMaxInf, kMaxSup,
    acero: { base: kgBase, bastones: kgBast, total: kgBase + kgBast, uniforme: kgUniforme, ahorro: kgUniforme != null ? kgUniforme - (kgBase + kgBast) : null, mTotal },
    uniforme,
    allOk: results.length > 0 && nInsuf === 0 && nShear === 0,
  }
}

/**
 * Diseño uniforme de referencia: el menor número de varillas del MISMO
 * calibre corrido que cubre el momento máximo del grupo sin bastones
 * (lo que se haría si no se analizara a lo largo).
 */
export function uniformDesign(t, results) {
  const caps = sectionCapacities(t)
  const MuP = Math.max(0, ...results.map((r) => r.profile.muPmax))
  const MuN = Math.max(0, ...results.map((r) => r.profile.muNmax))
  const pick = (lecho, Mu) => {
    for (let n = lecho.n; n <= 12; n++) {
      const R = calcFlexion({ fc: caps.fc, fy: caps.fy, b: caps.b, h: caps.h, r: caps.r, MuTm: Math.max(Mu, 0.001), varNum: lecho.num, varCount: n, bastonNum: lecho.num, bastonCount: 0 })
      if (R.error) return null
      if (R.MRT >= Mu - 1e-9 && R.okMax && R.okBmin) return { n, bar: lecho.bar, MRT: R.MRT }
      if (!R.okBmin) return null // ya no cabe en el ancho: no hay uniforme con este calibre
    }
    return null
  }
  const inf = pick(caps.inf, MuP), sup = pick(caps.sup, MuN)
  return inf && sup ? { inf, sup, MuP, MuN } : null
}

// ── 7. Optimizador del armado corrido ─────────────────────────
/**
 * Busca, por lecho, el (calibre, n) corrido que minimiza el acero total
 * (corrido + bastones) cubriendo todos los miembros. Bastones del mismo
 * calibre que el corrido, máximo uno por varilla.
 * @returns { inf:[{cal, n, kg, kgBase, kgBast, nBast, nInsuf}], sup:[...], best:{inf, sup} }
 */
export function optimizeBase(t, perfil, { calibres = ['3', '4', '5', '6'], nMax = 8 } = {}) {
  const members = perfil?.members || []
  if (!members.length) return null
  const evalLecho = (lechoKey, cal, n) => {
    const patch = lechoKey === 'inf'
      ? { calInf: cal, cantInf: n, calBastonInf: cal, cantBastonInf: n }
      : { calSup: cal, cantSup: n, calBastonSup: cal, cantBastonSup: n }
    const tt = { ...t, ...patch }
    const caps = sectionCapacities(tt)
    const lecho = caps[lechoKey]
    if (!lecho.base || !lecho.base.okBmin || !lecho.base.okMax || !lecho.base.okMin) return null
    const w = barWeight(lecho.bar.area)
    let kgBase = 0, kgBast = 0, nBast = 0, nInsuf = 0
    for (const mb of members) {
      const L = mb.Lreport || +(perfil?.Lpor?.[mb.id]) || +perfil.L || 0
      const profile = memberProfile(mb, L, !!perfil.invertir)
      const res = bastonesForLecho(profile, lecho, lechoKey === 'inf' ? 'muP' : 'muN', { minLen: perfil?.minLen })
      kgBase += L * n * w
      kgBast += res.bars.reduce((s, b) => s + b.k * b.len * w, 0)
      if (res.bars.length) nBast++
      if (res.insuficiente) nInsuf++
    }
    return { cal, n, kg: kgBase + kgBast, kgBase, kgBast, nBast, nInsuf, MR: lecho.base.MRT }
  }
  const run = (lechoKey) => {
    const out = []
    for (const cal of calibres) for (let n = 2; n <= nMax; n++) {
      const r = evalLecho(lechoKey, cal, n)
      if (r) out.push(r)
    }
    const feasible = out.filter((r) => r.nInsuf === 0)
    feasible.sort((a, b) => a.kg - b.kg || a.nBast - b.nBast || a.n - b.n)
    return { all: out, feasible, best: feasible[0] || null }
  }
  const inf = run('inf'), sup = run('sup')
  return { inf, sup, best: { inf: inf.best, sup: sup.best } }
}

/** Sección con el armado óptimo aplicado (para "Aplicar a la sección") */
export function applyBase(t, opt, kMaxInf, kMaxSup) {
  const patch = {}
  if (opt?.inf) Object.assign(patch, { calInf: opt.inf.cal, cantInf: opt.inf.n, calBastonInf: opt.inf.cal })
  if (opt?.sup) Object.assign(patch, { calSup: opt.sup.cal, cantSup: opt.sup.n, calBastonSup: opt.sup.cal })
  if (kMaxInf !== undefined) patch.cantBastonInf = kMaxInf
  if (kMaxSup !== undefined) patch.cantBastonSup = kMaxSup
  return patch
}
