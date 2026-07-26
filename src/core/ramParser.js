// ══════════════════════════════════════════════════════════════
// Parser de envolventes de RAM Elements (reporte de texto)
// "Máximos esfuerzos en miembros": por cada MIEMBRO dos filas
// (Max / Min) con: Axial · Cortante V2 · Cortante V3 · Torsión · M22 · M33
// Convención RAM: axial negativo = COMPRESIÓN → P = −axial.
// ══════════════════════════════════════════════════════════════

import { checkPoint, checkBiaxial } from './columnCalculator'

const NUM = /[-+]?\d+(?:[.,]\d+)?/g

/**
 * @param {string} text contenido del .txt
 * @returns {{combo, unidades, archivo, points:Array, warnings:Array}}
 */
export function parseRamEnvelope(text) {
  const lines = String(text || '').split(/\r?\n/)
  const points = []
  const warnings = []
  let combo = ''
  let unidades = ''
  let archivo = ''
  let member = null
  let sawHeader = false

  for (const raw of lines) {
    const line = raw.trim()
    if (!line || /^-{3,}$/.test(line)) continue

    let m
    if ((m = /^Sistema de unidades\s*:\s*(.+)$/i.exec(line))) { unidades = m[1].trim(); continue }
    if ((m = /^Nombre del archivo\s*:\s*(.+)$/i.exec(line))) { archivo = m[1].trim(); continue }
    if ((m = /^Estado\s*:\s*(.+)$/i.exec(line))) { combo = m[1].trim(); continue }
    // Fila de encabezado de columnas
    if (/Axial/i.test(line) && /M22|M33/i.test(line)) { sawHeader = true; continue }
    // Fila de unidades: [Ton] [Ton] ...
    if (/^\[/.test(line)) {
      if (!/ton/i.test(line)) warnings.push(`Unidades no reconocidas como Ton: "${line}". Los valores se toman tal cual.`)
      continue
    }
    if ((m = /^MIEMBRO\s+(\S+)/i.exec(line))) { member = m[1]; continue }
    if ((m = /^(Max|Min)\b(.*)$/i.exec(line))) {
      const nums = (m[2].match(NUM) || []).map((s) => parseFloat(s.replace(',', '.')))
      if (!member) continue
      if (nums.length < 6) {
        warnings.push(`Fila "${line}" ignorada: se esperaban 6 valores y hay ${nums.length}.`)
        continue
      }
      const [axial, v2, v3, tors, m22, m33] = nums
      points.push({
        id: `${member}-${m[1]}`,
        member, tipo: m[1],
        axial, v2, v3, tors, m22, m33,
        P: -axial, // compresión positiva
        combo,
      })
      continue
    }
  }

  if (!points.length) {
    warnings.push('No se encontraron filas Max/Min con 6 valores. Verifica que sea un reporte de "Máximos esfuerzos en miembros".')
  } else if (!sawHeader) {
    warnings.push('No se encontró el encabezado de columnas; se asumió el orden Axial · V2 · V3 · Torsión · M22 · M33.')
  }

  return { combo, unidades, archivo, points, warnings }
}

/**
 * Evalúa cada punto de la envolvente contra el diagrama de la columna.
 * @param mapping 'M33X' → Mux=|M33|, Muy=|M22| · 'M22X' → invertido
 */
export function evaluateEnvelope(points, anX, anY, mapping = 'M33X') {
  const out = (points || []).map((pt) => {
    const Mux = Math.abs(mapping === 'M33X' ? pt.m33 : pt.m22)
    const Muy = Math.abs(mapping === 'M33X' ? pt.m22 : pt.m33)
    const Pu = pt.P
    const cx = checkPoint(anX.curve, Pu, Mux)
    const cy = checkPoint(anY.curve, Pu, Muy)
    const bi = checkBiaxial(anX, anY, Pu, Mux, Muy)
    const util = isFinite(bi.valor) ? Math.sqrt(bi.valor) : Infinity
    return { ...pt, Pu, Mux, Muy, cx, cy, bi, util, ok: bi.ok && cx.ok && cy.ok }
  })
  const sorted = [...out].sort((a, b) => (b.util === Infinity ? 1 : a.util === Infinity ? -1 : b.util - a.util))
  const failing = out.filter((r) => !r.ok)
  return {
    results: out,
    critical: sorted[0] || null,
    total: out.length,
    passing: out.length - failing.length,
    failing: failing.length,
    allOk: failing.length === 0,
  }
}
