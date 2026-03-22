// ══════════════════════════════════════════════════════════════
// BD Global de Trabes — infraestructura
// ══════════════════════════════════════════════════════════════

import fabricaData from '../data/vigas_malla_v4.json'

const LS_KEY = 'iv_global_db'

// ── calcGID — hash técnico único ─────────────────────────────
export function calcGID(e) {
  const bP = e.bP ? `_${e.bP[0]}b${e.bP[1]}` : ''
  const bN = e.bN ? `_${e.bN[0]}b${e.bN[1]}` : ''
  const s = `${e.b}x${e.h}_${e.MuP}/${e.MuN}_${e.nP}#${e.vP}${bP}_${e.nN}#${e.vN}${bN}`
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
  return 'G' + (Math.abs(h) >>> 0).toString(36).toUpperCase().slice(0, 6)
}

// ── Singleton DB ─────────────────────────────────────────────
let DB = { vigas: [], meta: null, ready: false }
let listeners = []

export function getDB() { return DB }
export function onDBChange(fn) { listeners.push(fn); return () => { listeners = listeners.filter(f => f !== fn) } }
function notify() { listeners.forEach(fn => fn(DB)) }

// ── Persistence ──────────────────────────────────────────────
export function persistDB() {
  try {
    // Only persist user vigas to save space (factory ones reload from import)
    const userVigas = DB.vigas.filter(v => v.origen === 'usuario' || v.origen === 'importado')
    localStorage.setItem(LS_KEY, JSON.stringify({ userVigas }))
  } catch { /* quota exceeded — silent */ }
}

function loadFromLS() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

// ── Init — load factory + user vigas ─────────────────────────
export function initGlobalDB() {
  // 1) Factory vigas from imported JSON
  const factory = (fabricaData.vigas || []).map(v => ({
    ...v,
    origen: 'fabrica',
    gid: calcGID(v),
  }))

  // 2) User vigas from localStorage
  const saved = loadFromLS()
  const userVigas = (saved?.userVigas || []).map(v => ({
    ...v,
    gid: v.gid || calcGID(v),
  }))

  // 3) Merge (user vigas override factory by gid)
  const gidSet = new Set(userVigas.map(v => v.gid))
  const combined = [...factory.filter(v => !gidSet.has(v.gid)), ...userVigas]

  DB = { vigas: combined, meta: fabricaData.meta || null, ready: true }
  notify()
  return DB
}

// ── Merge imported DB ────────────────────────────────────────
export function mergeDB(incoming) {
  const existing = new Set(DB.vigas.map(v => v.gid))
  let added = 0, skipped = 0
  for (const v of incoming.vigas || incoming || []) {
    const gid = v.gid || calcGID(v)
    if (existing.has(gid)) { skipped++; continue }
    DB.vigas.push({ ...v, gid, origen: v.origen || 'importado' })
    existing.add(gid)
    added++
  }
  if (added > 0) { persistDB(); notify() }
  return { added, skipped }
}

// ── Add single viga ──────────────────────────────────────────
export function addViga(entry) {
  const gid = calcGID(entry)
  if (DB.vigas.some(v => v.gid === gid)) return { added: false, gid, reason: 'duplicate' }
  DB.vigas.push({ ...entry, gid, origen: 'usuario' })
  persistDB()
  notify()
  return { added: true, gid }
}

// ── Remove user vigas ────────────────────────────────────────
export function clearUserVigas() {
  DB.vigas = DB.vigas.filter(v => v.origen === 'fabrica')
  persistDB()
  notify()
}

// ── Export full DB ───────────────────────────────────────────
export function exportDB() {
  return {
    meta: { ...DB.meta, exportado: new Date().toISOString() },
    vigas: DB.vigas,
  }
}

// ── Match logic ──────────────────────────────────────────────
// Compares current section against DB
export function matchSection(sec) {
  const b = +sec.ancho, h = +sec.peralte
  const nP = +sec.cantInf, vP = +sec.calInf
  const nN = +sec.cantSup, vN = +sec.calSup
  const nBastP = +sec.cantBastonInf || 0, vBastP = +sec.calBastonInf || 0
  const nBastN = +sec.cantBastonSup || 0, vBastN = +sec.calBastonSup || 0

  let exactMatch = null
  let partialMatch = null
  let partialDist = Infinity

  for (const v of DB.vigas) {
    if (v.b !== b || v.h !== h) continue

    // Check exact rebar match
    const vbP = v.bP || [0, 0]
    const vbN = v.bN || [0, 0]
    const exactRebar =
      v.nP === nP && +v.vP === +vP &&
      v.nN === nN && +v.vN === +vN &&
      (vbP[0] || 0) === nBastP && (+vbP[1] || 0) === +vBastP &&
      (vbN[0] || 0) === nBastN && (+vbN[1] || 0) === +vBastN

    if (exactRebar) {
      exactMatch = v
      break
    }

    // Partial: same b,h but different rebar — find closest by As
    const asV = (v.AsP || 0) + (v.AsN || 0)
    const dist = Math.abs(asV - 0) // just track first partial
    if (!partialMatch || dist < partialDist) {
      partialMatch = v
      partialDist = dist
    }
  }

  if (exactMatch) return { status: 'db_match', gid: exactMatch.gid, entry: exactMatch }
  if (partialMatch) return { status: 'db_partial', gid: partialMatch.gid, entry: partialMatch }
  return { status: 'new_design', gid: null, entry: null }
}

// ── Search: find vigas that cover given moments ──────────────
export function searchByMoments(MuP, MuN, opts = {}) {
  const { restrictB, restrictH, limit = 5 } = opts
  const passing = DB.vigas.filter(v => {
    if (v.MRT_P < MuP || v.MRT_N < MuN) return false
    if (restrictB && restrictB.size > 0 && !restrictB.has(v.b)) return false
    if (restrictH && restrictH.size > 0 && !restrictH.has(v.h)) return false
    return true
  })

  // Group by section, keep best (most efficient = highest ratio)
  const bySecMap = new Map()
  passing.forEach(d => {
    const key = `${d.b}x${d.h}`
    const ratio = Math.max(MuP / d.MRT_P, MuN / d.MRT_N)
    if (!bySecMap.has(key) || ratio > bySecMap.get(key).ratio) {
      bySecMap.set(key, { ...d, ratio })
    }
  })

  // Sort by lowest As total
  return [...bySecMap.values()]
    .sort((a, b) => (a.AsP + a.AsN) - (b.AsP + b.AsN))
    .slice(0, limit)
}

// ── Rebar area lookup ─────────────────────────────────────────
const AREA_MAP = { 2: 0.32, 3: 0.71, 4: 1.27, 5: 1.98, 6: 2.85, 7: 3.88, 8: 5.07, 9: 6.45, 10: 8.19 }
function totalAs(v) {
  const asP = (v.nP || 0) * (AREA_MAP[v.vP] || 0) + (v.bP ? v.bP[0] * (AREA_MAP[v.bP[1]] || 0) : 0)
  const asN = (v.nN || 0) * (AREA_MAP[v.vN] || 0) + (v.bN ? v.bN[0] * (AREA_MAP[v.bN[1]] || 0) : 0)
  return asP + asN
}

// ── Smart suggestions: 3 curated picks ────────────────────────
// 1) Menor peralte posible  2) Menor acero posible  3) Mejor balance
// Avoids suggesting oversized sections (e.g. 15×50 for Mu=0.5)
export function smartSuggestions(MuP, MuN, opts = {}) {
  const { restrictB, restrictH } = opts
  const passing = DB.vigas.filter(v => {
    if (v.MRT_P < MuP || v.MRT_N < MuN) return false
    if (restrictB && restrictB.size > 0 && !restrictB.has(v.b)) return false
    if (restrictH && restrictH.size > 0 && !restrictH.has(v.h)) return false
    return true
  })
  if (passing.length === 0) return []

  // Enrich with computed steel area and utilization ratio
  const enriched = passing.map(d => {
    const as = totalAs(d)
    const util = Math.max(MuP / (d.MRT_P || 1), MuN / (d.MRT_N || 1)) // closer to 1 = better fit
    return { ...d, _as: as, _util: util }
  })

  // Best per unique rebar config (keep highest utilization per config)
  const byKey = new Map()
  enriched.forEach(d => {
    const key = `${d.b}x${d.h}_${d.nP}#${d.vP}_${d.nN}#${d.vN}`
    if (!byKey.has(key) || d._util > byKey.get(key)._util) {
      byKey.set(key, d)
    }
  })
  const pool = [...byKey.values()]

  // Filter out grossly oversized sections: keep only those where
  // utilization ratio ≥ 0.25 (concrete doesn't do >75% of the work alone)
  const minH = Math.min(...pool.map(v => v.h))
  const reasonable = pool.filter(v => v._util >= 0.25 || v.h === minH)
  const effective = reasonable.length > 0 ? reasonable : pool

  // 1) Menor peralte — among those with min h, pick highest utilization
  const minHPool = effective.filter(v => v.h === minH)
  minHPool.sort((a, b) => b._util - a._util)
  const pick1 = minHPool[0]

  // 2) Menor acero — among sections with h ≤ 1.5× min h, pick least As
  const hCap = minH * 1.5
  const asPool = effective.filter(v => v.h <= hCap && v !== pick1)
  asPool.sort((a, b) => a._as - b._as)
  const pick2 = asPool[0] || effective.find(v => v !== pick1) || effective[0]

  // 3) Mejor balance — score = high utilization + low area + reasonable h
  const maxAs = Math.max(...effective.map(v => v._as)) || 1
  const hRange = Math.max(...effective.map(v => v.h)) - minH || 1
  const scored = effective.map(v => {
    const utilScore = v._util                                 // 0–1, higher=better fit
    const asPenalty = (v._as / maxAs) * 0.3                   // penalize high steel
    const hPenalty = ((v.h - minH) / hRange) * 0.4            // penalize tall sections
    return { ...v, _score: utilScore - asPenalty - hPenalty }
  })
  scored.sort((a, b) => b._score - a._score)
  const pick3 = scored.find(v => v !== pick1 && v !== pick2) || scored[0]

  // Deduplicate and tag
  const results = []
  const seen = new Set()
  const add = (v, tag) => {
    const k = `${v.b}x${v.h}_${v.nP}#${v.vP}_${v.nN}#${v.vN}`
    if (seen.has(k)) return
    seen.add(k)
    results.push({ ...v, tag, _as: v._as })
  }
  add(pick1, 'h mín')
  add(pick2, 'As mín')
  add(pick3, 'balance')

  return results
}

// ── Available dimensions ─────────────────────────────────────
export function getAvailableDims() {
  const bs = [...new Set(DB.vigas.map(v => v.b))].sort((a, b) => a - b)
  const hs = [...new Set(DB.vigas.map(v => v.h))].sort((a, b) => a - b)
  return { bs, hs }
}

// ── Stats ────────────────────────────────────────────────────
export function getStats() {
  const total = DB.vigas.length
  const fabrica = DB.vigas.filter(v => v.origen === 'fabrica').length
  const usuario = DB.vigas.filter(v => v.origen === 'usuario' || v.origen === 'importado').length
  return { total, fabrica, usuario }
}
