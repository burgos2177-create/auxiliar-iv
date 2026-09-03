// ══════════════════════════════════════════════════════════════
// Geometría del modelo RAM: longitudes de miembros
//   · Reporte "Datos de Geometría → Miembros" (.txt): Miembro, NJ, NK,
//     Descripción, Sección, Material…
//   · Coordenadas de nudos: tabla Nudo, X, Y, Z (.xlsx exportado de RAM,
//     o .txt/.csv con el reporte de nudos)
// Con ambos, L = distancia NJ–NK de cada miembro, en metros.
// El .xlsx se lee sin librerías de hojas de cálculo: es un zip (JSZip ya
// viene con docx) con sheet1.xml y, si hay textos, sharedStrings.xml.
// ══════════════════════════════════════════════════════════════

import JSZip from 'jszip'

const num = (s) => { const v = parseFloat(String(s).replace(',', '.')); return Number.isFinite(v) ? v : null }

/** "15 x 20", "15X25", "RcBeam 15X20", "T 20x30" → { b, h } (cm) o null */
export function sectionDims(label) {
  const m = /(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)/.exec(String(label || ''))
  return m ? { b: num(m[1]), h: num(m[2]) } : null
}

/** Reporte "Datos de Geometría → Miembros" */
export function parseMemberGeometry(text) {
  const rows = []
  const warnings = []
  let sawHeader = false
  for (const raw of String(text || '').replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (/^Miembro\b/i.test(line) && /\bNJ\b/i.test(line) && /\bNK\b/i.test(line)) { sawHeader = true; continue }
    const m = /^([A-Za-z0-9_.-]+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(line)
    if (!m || !/^\d/.test(m[1])) continue
    const rest = m[4].trim().split(/\s{2,}/)
    rows.push({ member: m[1], nj: m[2], nk: m[3], descripcion: rest[0] || '', seccion: rest[1] || '', material: rest[2] || '' })
  }
  if (!rows.length) warnings.push('No se encontraron filas "Miembro NJ NK …". Exporta en RAM Datos de geometría → Miembros.')
  else if (!sawHeader) warnings.push('No se encontró el encabezado "Miembro NJ NK"; se leyeron las filas por su forma.')
  return { rows, warnings }
}

/** Tabla de nudos en texto: líneas con id x y z (con o sin encabezado) */
export function parseNodeText(text) {
  const nodes = new Map()
  for (const raw of String(text || '').replace(/^﻿/, '').split(/\r?\n/)) {
    const t = raw.trim().replace(/[;\t]+/g, ' ')
    if (!t) continue
    const parts = t.split(/[\s,]+/)
    if (parts.length < 4) continue
    const id = parts[0].replace(/[^0-9A-Za-z_.-]/g, '')
    const x = num(parts[1]), y = num(parts[2]), z = num(parts[3])
    if (!id || !/^\d/.test(id) || x === null || y === null || z === null) continue
    nodes.set(id, { x, y, z })
  }
  return nodes
}

/** Tabla de nudos en .xlsx (ArrayBuffer/Uint8Array/Buffer): primera hoja, columnas id, X, Y, Z */
export async function parseNodeXlsx(data) {
  const zip = await JSZip.loadAsync(data)
  const sheetName = Object.keys(zip.files).find((n) => /^xl\/worksheets\/sheet1\.xml$/.test(n))
    || Object.keys(zip.files).find((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
  if (!sheetName) throw new Error('El .xlsx no tiene hojas.')
  const xml = await zip.file(sheetName).async('string')
  let shared = []
  const ssFile = zip.file('xl/sharedStrings.xml')
  if (ssFile) {
    const ss = await ssFile.async('string')
    shared = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''))
  }
  const nodes = new Map()
  for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [...row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map((c) => {
      const attrs = c[1], body = c[2] || ''
      const t = /\bt="([^"]+)"/.exec(attrs)?.[1]
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
      if (t === 's') return shared[+v] ?? ''
      if (t === 'inlineStr') return /<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1] ?? ''
      return v ?? ''
    })
    if (cells.length < 4) continue
    const id = String(cells[0]).trim().replace(/\.0+$/, '')
    const x = num(cells[1]), y = num(cells[2]), z = num(cells[3])
    if (!/^\d/.test(id) || x === null || y === null || z === null) continue // encabezado u otra cosa
    nodes.set(id, { x, y, z })
  }
  return nodes
}

/** Longitudes de los miembros del reporte de geometría a partir de los nudos */
export function memberLengths(geomRows, nodes) {
  const Lpor = {}
  const secPor = {}
  const missing = []
  for (const r of geomRows) {
    const a = nodes.get(r.nj), b = nodes.get(r.nk)
    secPor[r.member] = r.seccion
    if (!a || !b) { missing.push(r.member); continue }
    const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    Lpor[r.member] = +L.toFixed(4)
  }
  return { Lpor, secPor, missing }
}

/**
 * Compara la sección de cada miembro (reporte) con la trabe del proyecto.
 * @returns { distintos:[{member, seccion}], resumen:{ [seccion]: n } }
 */
export function sectionMismatches(secPor, memberIds, t) {
  const bT = +t.ancho, hT = +t.peralte
  const distintos = []
  const resumen = {}
  for (const id of memberIds) {
    const sec = secPor[id]
    if (sec === undefined) continue
    const d = sectionDims(sec)
    resumen[sec] = (resumen[sec] || 0) + 1
    if (d && (d.b !== bT || d.h !== hT)) distintos.push({ member: id, seccion: sec })
  }
  return { distintos, resumen }
}

// ── Cadenas de miembros colineales = elemento físico ─────────
/**
 * RAM parte una trabe física en varios miembros (en cada nudo donde llega
 * una trabe secundaria o una columna). Aquí se vuelven a unir: miembros
 * que comparten nudo y son colineales (coseno ≥ tolCos) forman una cadena
 * ordenada de I a J, con la posición x0 de cada miembro y si va invertido.
 * @param geomRows  filas de parseMemberGeometry
 * @param nodes     Map id → {x,y,z}
 * @param ids       miembros a considerar (los del reporte de estaciones)
 * @returns [{ id, members:[{id, x0, L, reversed, nj, nk}], L, nodes:[ids] }]
 */
export function chainMembers(geomRows, nodes, ids, { tolCos = 0.995 } = {}) {
  const want = new Set((ids || []).map(String))
  const geom = new Map()
  for (const r of geomRows) if (want.has(String(r.member)) && nodes.has(r.nj) && nodes.has(r.nk)) geom.set(String(r.member), r)
  const dir = (r) => {
    const a = nodes.get(r.nj), b = nodes.get(r.nk)
    const d = [b.x - a.x, b.y - a.y, b.z - a.z]
    const n = Math.hypot(...d) || 1
    return d.map((v) => v / n)
  }
  const len = (r) => { const a = nodes.get(r.nj), b = nodes.get(r.nk); return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) }
  const adj = new Map()
  for (const r of geom.values()) {
    for (const n of [r.nj, r.nk]) { if (!adj.has(n)) adj.set(n, []); adj.get(n).push(r) }
  }
  const cos = (a, b) => Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2])
  const visited = new Set()
  const chains = []
  // orden estable: por id numérico
  const ordered = [...geom.values()].sort((a, b) => (+a.member || 0) - (+b.member || 0))
  for (const start of ordered) {
    if (visited.has(start.member)) continue
    visited.add(start.member)
    // cadena como lista de {r, reversed}; se extiende hacia adelante (desde nk) y hacia atrás (desde nj)
    let chain = [{ r: start, reversed: false }]
    const extend = (forward) => {
      let cur = forward ? chain[chain.length - 1] : chain[0]
      for (;;) {
        const endNode = forward ? (cur.reversed ? cur.r.nj : cur.r.nk) : (cur.reversed ? cur.r.nk : cur.r.nj)
        const dcur = dir(cur.r)
        const cands = (adj.get(endNode) || []).filter((m) => !visited.has(m.member) && cos(dir(m), dcur) >= tolCos)
        if (cands.length !== 1) break // fin de línea, o ambigüedad (cruce) → no se une
        const nxt = cands[0]
        visited.add(nxt.member)
        // orientación: si al avanzar hacia adelante el siguiente empieza en endNode va derecho; si termina ahí, invertido
        const reversed = forward ? nxt.nj !== endNode : nxt.nk !== endNode
        const item = { r: nxt, reversed }
        if (forward) chain.push(item); else chain.unshift(item)
        cur = item
      }
    }
    extend(true); extend(false)
    // posiciones
    let x = 0
    const members = chain.map((c) => {
      const L = len(c.r)
      const m = { id: c.r.member, x0: +x.toFixed(4), L: +L.toFixed(4), reversed: c.reversed, nj: c.reversed ? c.r.nk : c.r.nj, nk: c.reversed ? c.r.nj : c.r.nk }
      x += L
      return m
    })
    const nodeIds = [members[0].nj, ...members.map((m) => m.nk)]
    chains.push({ id: members.length === 1 ? members[0].id : `${members[0].id}…${members[members.length - 1].id}`, members, L: +x.toFixed(4), nodes: nodeIds })
  }
  return chains
}
