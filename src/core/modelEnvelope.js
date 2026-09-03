// ══════════════════════════════════════════════════════════════
// Modelo completo de RAM Elements en un solo .txt
//
// El reporte "Máximos esfuerzos en miembros" trae TODOS los miembros del
// modelo pero sólo su número. Aquí se reparten a las trabes / columnas
// del proyecto (asignación manual por rangos, o automática a partir de un
// reporte de datos de miembros que traiga la sección de cada uno) y se
// evalúa cada sección contra su envolvente.
// ══════════════════════════════════════════════════════════════

import { normName } from './constants'
import { parseRamEnvelope, evaluateBeamEnvelope, evaluateEnvelope } from './ramParser'
import { computeSectionCapacities } from './sectionResults'
import { analyzeColumn } from './columnCalculator'

export { parseRamEnvelope }

// ── Rangos de miembros: "47, 52, 57-97 103" → ['47','52','57',…,'103'] ──
export function parseMemberRanges(text) {
  const out = []
  const seen = new Set()
  const push = (v) => { const s = String(v); if (!seen.has(s)) { seen.add(s); out.push(s) } }
  for (const tok of String(text || '').split(/[\s,;]+/)) {
    if (!tok) continue
    const m = /^(\d+)\s*[-–:]\s*(\d+)$/.exec(tok)
    if (m) {
      let a = +m[1], b = +m[2]
      if (a > b) [a, b] = [b, a]
      if (b - a > 5000) continue // rango absurdo
      for (let i = a; i <= b; i++) push(i)
    } else if (/^[A-Za-z0-9_.-]+$/.test(tok)) {
      push(tok)
    }
  }
  return out
}

// ── Reporte de datos de miembros (para asignación automática) ──
// Tolerante al formato: busca una fila de encabezado con "Miembro" y
// alguna columna de sección/descripción, y lee las filas cuyo primer
// token es el número de miembro. Devuelve el texto de la columna de
// sección y, si existe, la descripción.
export function parseRamMemberData(text) {
  const lines = String(text || '').split(/\r?\n/)
  const rows = []
  const warnings = []
  let cols = null // [{name, key, start}]

  const KEYS = [
    { re: /^miembro$|^member$|^elemento$/i, key: 'member' },
    { re: /^secci[oó]n$|^section$|^perfil$|^shape$/i, key: 'seccion' },
    { re: /^descripci[oó]n$|^description$|^nombre$|^name$|^etiqueta$|^label$/i, key: 'descripcion' },
    { re: /^material$/i, key: 'material' },
    { re: /^tipo$|^type$/i, key: 'tipo' },
  ]

  for (const raw of lines) {
    const line = raw.replace(/\t/g, '    ')
    const t = line.trim()
    if (!t || /^-{3,}$/.test(t)) continue

    if (!cols || !/^\d+\b/.test(t)) {
      // ¿encabezado? Debe contener "Miembro" y sección/descripción
      const tokens = [...line.matchAll(/\S+/g)]
      const names = tokens.map((m) => m[0])
      const hasMember = names.some((n) => KEYS[0].re.test(n))
      const hasSec = names.some((n) => KEYS[1].re.test(n) || KEYS[2].re.test(n))
      if (hasMember && hasSec) {
        cols = tokens.map((m) => {
          const k = KEYS.find((K) => K.re.test(m[0]))
          return { name: m[0], key: k ? k.key : null, start: m.index }
        })
        continue
      }
      if (!cols) continue
    }

    if (cols && /^\d+\b/.test(t)) {
      // Fila de datos: partir por columnas del encabezado (posición), con
      // respaldo por tokens cuando las posiciones no cuadran.
      const row = {}
      const tokens = [...line.matchAll(/\S+/g)]
      cols.forEach((c, i) => {
        if (!c.key) return
        const next = cols[i + 1]
        let val = line.slice(c.start, next ? next.start : undefined).trim()
        if (!val && tokens[i]) val = tokens[i][0]
        row[c.key] = val
      })
      if (!row.member) row.member = tokens[0][0]
      row.member = String(row.member).replace(/[^0-9A-Za-z_.-]/g, '')
      if (row.member) rows.push(row)
    }
  }

  if (!cols) warnings.push('No se encontró un encabezado con "Miembro" y "Sección"/"Descripción". Asigna los miembros a mano por rangos.')
  else if (!rows.length) warnings.push('Se encontró el encabezado pero ninguna fila de miembro.')
  return { rows, warnings, columnas: cols ? cols.map((c) => c.name) : [] }
}

// ── Asignación automática por nombre de sección/descripción ──
/**
 * @param memberRows  filas de parseRamMemberData
 * @param sections    trabes del proyecto (nombre)
 * @param columns     columnas del proyecto (nombre)
 * @returns { assignment:{id:{name,kind}}, matched, unmatched:[{member, seccion}] }
 */
export function autoAssign(memberRows, sections, columns) {
  const byName = new Map()
  for (const s of sections || []) if (s?.nombre) byName.set(normName(s.nombre), { name: s.nombre, kind: 'trabe' })
  for (const c of columns || []) if (c?.nombre) byName.set(normName(c.nombre), { name: c.nombre, kind: 'columna' })

  const assignment = {}
  const unmatched = []
  let matched = 0
  for (const r of memberRows || []) {
    const cands = [r.seccion, r.descripcion].filter(Boolean)
    let hit = null
    for (const cand of cands) {
      const n = normName(cand)
      if (byName.has(n)) { hit = byName.get(n); break }
      // "T-1 (20x30)" → contiene el nombre
      for (const [k, v] of byName) if (k && n.includes(k)) { hit = v; break }
      if (hit) break
    }
    if (hit) { assignment[r.member] = { ...hit }; matched++ }
    else unmatched.push({ member: r.member, seccion: cands[0] || '' })
  }
  return { assignment, matched, unmatched }
}

// ── Tipo probable de un miembro (sólo como pista) ──
export function suggestKind(pts) {
  let axial = 0, mom = 0
  for (const p of pts || []) {
    axial = Math.max(axial, Math.abs(p.axial || 0))
    mom = Math.max(mom, Math.abs(p.m33 || 0), Math.abs(p.m22 || 0))
  }
  if (axial >= 0.5 && axial >= 3 * mom) return 'columna'
  if (axial < 0.5 || mom >= axial) return 'trabe'
  return '?'
}

// Agrupa los puntos por miembro (Map id → [pts])
export function groupByMember(points) {
  const m = new Map()
  for (const p of points || []) {
    if (!m.has(p.member)) m.set(p.member, [])
    m.get(p.member).push(p)
  }
  return m
}

// ── Evaluación del modelo completo ──
/**
 * @param model    { points, assignment, opts:{[name]:{invertir, mapping}} }
 * @param sections trabes del proyecto
 * @param columns  columnas del proyecto
 */
export function evaluateModel(model, sections, columns) {
  const points = model?.points || []
  const assignment = model?.assignment || {}
  const opts = model?.opts || {}
  const byMember = groupByMember(points)

  // miembros por sección
  const membersOf = new Map()
  for (const [id, a] of Object.entries(assignment)) {
    if (!a?.name || !byMember.has(id)) continue
    const k = normName(a.name)
    if (!membersOf.has(k)) membersOf.set(k, [])
    membersOf.get(k).push(id)
  }

  const porSeccion = []
  const seenNames = new Set()

  for (const t of sections || []) {
    const k = normName(t.nombre)
    seenNames.add(k)
    const ids = membersOf.get(k) || []
    const entry = { nombre: t.nombre, kind: 'trabe', members: ids, ev: null, ok: null, util: null, hasData: false }
    if (ids.length) {
      const pts = ids.flatMap((id) => byMember.get(id) || [])
      const R = computeSectionCapacities(t)
      entry.hasData = !!(R.resP || R.resN)
      const o = opts[k] || {}
      entry.ev = evaluateBeamEnvelope(pts, R, !!o.invertir)
      entry.ok = entry.hasData ? entry.ev.allOk : null
      entry.util = entry.ev.critical ? entry.ev.critical.util : 0
      entry.cap = { MRP: R.resP?.MRT || 0, MRN: R.resN?.MRT || 0, VR: R.resC?.Vr || 0, vrDesdeDetalle: !!R.resC?.desdeDetalle }
    }
    porSeccion.push(entry)
  }

  for (const c of columns || []) {
    const k = normName(c.nombre)
    seenNames.add(k)
    const ids = membersOf.get(k) || []
    const entry = { nombre: c.nombre, kind: 'columna', members: ids, ev: null, ok: null, util: null, hasData: false }
    if (ids.length) {
      const pts = ids.flatMap((id) => byMember.get(id) || [])
      let an = null
      try { an = analyzeColumn(c) } catch { /* incompleta */ }
      if (an) {
        const o = opts[k] || {}
        entry.hasData = true
        entry.ev = evaluateEnvelope(pts, an.dirX, an.dirY, o.mapping || 'M33X')
        entry.ok = entry.ev.allOk
        entry.util = entry.ev.critical ? entry.ev.critical.util : 0
      }
    }
    porSeccion.push(entry)
  }

  // asignados a nombres que ya no existen en el proyecto
  const huerfanos = []
  for (const [k, ids] of membersOf) if (!seenNames.has(k)) huerfanos.push(...ids)

  const allIds = [...byMember.keys()]
  const asignados = allIds.filter((id) => assignment[id]?.name && seenNames.has(normName(assignment[id].name)))
  const sinAsignar = allIds.filter((id) => !asignados.includes(id))

  const conEnv = porSeccion.filter((s) => s.members.length)
  const evaluadas = conEnv.filter((s) => s.ok !== null)
  const fallan = evaluadas.filter((s) => s.ok === false)
  const ejemplares = conEnv.reduce((n, s) => n + (s.ev?.total || 0), 0)
  const ejemplaresOk = conEnv.reduce((n, s) => n + (s.ev?.passing || 0), 0)
  const utilMax = Math.max(0, ...evaluadas.map((s) => (isFinite(s.util) ? s.util : 99)))

  return {
    porSeccion,
    sinAsignar, huerfanos,
    totalMiembros: allIds.length,
    asignados: asignados.length,
    secciones: porSeccion.length,
    seccionesConEnv: conEnv.length,
    seccionesSinDatos: conEnv.length - evaluadas.length,
    fallan: fallan.length,
    ejemplares, ejemplaresOk,
    utilMax,
    allOk: evaluadas.length > 0 && fallan.length === 0 && sinAsignar.length === 0 && conEnv.length === evaluadas.length,
  }
}
