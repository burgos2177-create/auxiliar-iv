// ══════════════════════════════════════════════════════════════
// Exportar a Double Check Estructural (.dcheck) desde la app.
//
// El Double Check se llenaba a mano: nombre, Mr, Mr−, Vr y los Mu/Vu
// copiados de RAM. Todo eso ya vive aquí: las resistencias salen de la
// calculadora y las demandas de la envolvente (modelo → sección → punto
// capturado, en ese orden). Sólo quedan por poner las capturas.
// Formato: el mismo que guarda double_check_estructural.html
// (format 'sogrub-dcheck', version 1).
// ══════════════════════════════════════════════════════════════

import { computeSectionCapacities } from './sectionResults'
import { evaluateBeamEnvelope } from './ramParser'
import { analyzeColumn } from './columnCalculator'
import { columnDemand, demandCase } from './columnDemand'
import { normName } from './constants'

const num = (v, d = 3) => (v === null || v === undefined || !isFinite(v) || v === 0 ? '' : String(Number(v.toFixed(d))))

// Misma regla que recalc() del Double Check: peor ratio ≤ 0.9 ok · ≤ 1 revisar · > 1 no pasa
export function markFromRatios(ratios) {
  const rs = ratios.filter((r) => r !== null && r !== undefined && isFinite(r))
  if (!rs.length) return null
  const worst = Math.max(...rs)
  return worst <= 0.9 ? 'ok' : worst <= 1 ? 'warn' : 'bad'
}

/**
 * @param modelEval  resultado de evaluateModel (opcional) — manda sobre la envolvente por sección
 */
export function buildDcheck({ projectName = '', reviso = '', sections = [], columns = [], modelEval = null } = {}) {
  const porNombre = new Map()
  for (const s of modelEval?.porSeccion || []) if (s.ev) porNombre.set(normName(s.nombre), s)

  const out = []

  for (const t of sections) {
    const R = computeSectionCapacities(t)
    const MRP = R.resP?.MRT || 0
    const MRN = R.resN?.MRT || 0
    const VR = R.resC?.Vr || 0

    // Demanda: modelo → envolvente de la sección → punto capturado
    let MuP = R.MuP, MuN = R.MuN, Vu = R.VuTon
    let fuente = 'punto capturado'
    const fromModel = porNombre.get(normName(t.nombre))
    if (fromModel?.ev) {
      MuP = fromModel.ev.globalMuP; MuN = fromModel.ev.globalMuN; Vu = fromModel.ev.globalVu
      fuente = `modelo (${fromModel.ev.total} miembros)`
    } else if (t.envelope?.points?.length) {
      const ev = evaluateBeamEnvelope(t.envelope.points, R, !!t.envelope.invertir)
      MuP = ev.globalMuP; MuN = ev.globalMuN; Vu = ev.globalVu
      fuente = `envolvente ${t.envelope.archivo || ''} (${ev.total} miembros)`
    }

    const ratios = [
      MRP > 0 && MuP > 0 ? MuP / MRP : null,
      MRN > 0 && MuN > 0 ? MuN / MRN : null,
      VR > 0 && Vu > 0 ? Vu / VR : null,
    ]
    const mark = markFromRatios(ratios)
    const arm = `${t.cantInf}#${t.calInf}${+t.cantBastonInf > 0 ? `+${t.cantBastonInf}#${t.calBastonInf}` : ''} / ${t.cantSup}#${t.calSup}${+t.cantBastonSup > 0 ? `+${t.cantBastonSup}#${t.calBastonSup}` : ''}`
    out.push({
      name: t.nombre || '',
      ma: num(MuP), mr: num(MRP), un: 'ton·m',
      man: num(MuN), mrn: num(MRN),
      va: num(Vu), vr: num(VR), unv: 'ton',
      obs: `Trabe ${t.ancho}×${t.peralte} cm · ${arm} · E#${t.calEst}@${t.sepLcuarto}/${t.sepRest} · demanda: ${fuente}${R.resC?.desdeDetalle ? ' · Vr con estribos del detalle' : ''}`,
      mark, manual: false, geo: false,
      imgA: null, imgB: null, imgC: null, imgD: null,
    })
  }

  for (const c of columns) {
    let an = null
    try { an = analyzeColumn(c) } catch { /* incompleta */ }
    if (!an) {
      out.push({ name: c.nombre || '', ma: '', mr: '', un: 'ton·m', man: '', mrn: '', va: '', vr: '', unv: 'ton',
        obs: 'Columna con datos incompletos', mark: null, manual: false, geo: false, imgA: null, imgB: null, imgC: null, imgD: null })
      continue
    }
    // Con el modelo cargado, el crítico de la envolvente del modelo; si no, columnDemand
    let D = columnDemand(c, an)
    const fromModel = porNombre.get(normName(c.nombre))
    if (fromModel?.ev) {
      D = { ...D, fuente: 'envolvente', env: fromModel.ev, ok: fromModel.ev.allOk, evaluado: true }
    }
    const caso = demandCase(D)
    const ratios = [
      caso.cx.MR > 0 && caso.Mux > 0 ? caso.Mux / caso.cx.MR : null,
      caso.cy.MR > 0 && caso.Muy > 0 ? caso.Muy / caso.cy.MR : null,
      isFinite(caso.bi.valor) && caso.bi.valor > 0 ? Math.sqrt(caso.bi.valor) : null,
    ]
    const arm = (c.lechos || []).map((L, i) => `L${i + 1}:${L.n}#${L.num}`).join(' ')
    const envTxt = D.fuente === 'envolvente' ? ` · ${D.env.passing}/${D.env.total} ejemplares dentro` : ''
    out.push({
      name: c.nombre || '',
      ma: num(caso.Mux), mr: num(caso.cx.MR), un: 'ton·m',
      man: num(caso.Muy), mrn: num(caso.cy.MR),
      va: '', vr: '', unv: 'ton',
      obs: `Columna ${c.b}×${c.h} cm · ${arm} · E#${c.estriboNum} · Pu = ${num(caso.Pu, 2) || '0'} t · Mx→M(+), My→M(−) · biaxial (Mux/MRx)²+(Muy/MRy)² = ${isFinite(caso.bi.valor) ? caso.bi.valor.toFixed(3) : '∞'} · ${caso.etiqueta}${envTxt}`,
      mark: D.evaluado ? (D.ok ? markFromRatios(ratios) || 'ok' : 'bad') : null,
      manual: false, geo: false,
      imgA: null, imgB: null, imgC: null, imgD: null,
    })
  }

  return {
    format: 'sogrub-dcheck', version: 1,
    meta: {
      proyecto: projectName || '',
      reviso: reviso || '',
      fecha: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }),
    },
    sections: out,
  }
}
