// ══════════════════════════════════════════════════════════════
// Resultados de una trabe — fuente única de verdad.
// Lo usan el informe detallado, la memoria, la pestaña Modelo y las
// pruebas. (Vivía dentro de generateDetailedHTML; se movió aquí para
// poder importarlo sin arrastrar el generador de HTML.)
// ══════════════════════════════════════════════════════════════

import { calcFlexion, calcCortante } from './sectionCalculator'
import { CAL_TO_NUM } from './constants'

export function computeSectionResults(t) {
  const calc = t.calc || {}
  const fc = +t.fc || 250
  const fy = +calc.fy || 4200
  const b = +t.ancho, h = +t.peralte, r = +t.recub || 3
  const MuP = +(calc.MuP || t.muPos || 0)
  const MuN = +(calc.MuN || t.muNeg || 0)
  const VuTon = +(calc.VuTon || t.vu || 0)
  const L = +(calc.L || 0)
  const varEstNum = +(calc.varEstNum || CAL_TO_NUM[t.calEst] || 2)
  const nramas = +(calc.nramas || 2)

  let resP = null, resN = null
  if (MuP > 0 || +t.cantInf > 0) {
    resP = calcFlexion({
      fc, fy, b, h, r, MuTm: MuP,
      varNum: +(calc.varPNum || CAL_TO_NUM[t.calInf] || 3),
      varCount: +(calc.varPCount || t.cantInf || 0) || null,
      bastonNum: +(calc.bastonPNum || CAL_TO_NUM[t.calBastonInf] || 3),
      bastonCount: +(calc.bastonPCount || t.cantBastonInf || 0),
    })
    if (resP.error) resP = null
  }
  if (MuN > 0 || +t.cantSup > 0) {
    resN = calcFlexion({
      fc, fy, b, h, r, MuTm: MuN,
      varNum: +(calc.varNNum || CAL_TO_NUM[t.calSup] || 3),
      varCount: +(calc.varNCount || t.cantSup || 0) || null,
      bastonNum: +(calc.bastonNNum || CAL_TO_NUM[t.calBastonSup] || 3),
      bastonCount: +(calc.bastonNCount || t.cantBastonSup || 0),
    })
    if (resN.error) resN = null
  }

  const AsUsada = +(calc.asManual != null ? calc.asManual :
    Math.max(resP?.AsTotal || 0, resN?.AsTotal || 0) || 4.52)

  let resC = null
  if (VuTon > 0) {
    resC = calcCortante({
      fc, fy, b, h, r, L, VuTon, AsUsada,
      varEstNum, nramas,
      conCompresion: calc.conCompresion, MuCorte: +(calc.MuCorte || 0),
    })
  }

  const hasFlex = !!(resP || resN)
  const hasCort = !!(resC && resC.Vr > 0)
  const flexOk = (!resP || (resP.okMR && resP.okMin && resP.okMax && resP.okBmin)) &&
    (!resN || (resN.okMR && resN.okMin && resN.okMax && resN.okBmin))
  const cortOk = !hasCort || resC.okVr
  const allOk = flexOk && cortOk
  const hasData = hasFlex || hasCort

  return {
    calc, fc, fy, b, h, r, MuP, MuN, VuTon, L, varEstNum, nramas,
    resP, resN, AsUsada, resC, hasFlex, hasCort, flexOk, cortOk, allOk, hasData,
  }
}

/**
 * Resistencias de la sección para evaluar una envolvente aunque la trabe
 * no tenga Vu capturado: el cortante se calcula con el estribo y la
 * separación del detalle (sepLcuarto) para obtener un Vr comparable.
 */
export function computeSectionCapacities(t) {
  const R = computeSectionResults(t)
  if (R.resC) return R
  const calc = t.calc || {}
  const sep = +(calc.SL4 || t.sepLcuarto || 0)
  if (!(sep > 0) || !(R.b > 0) || !(R.h > 0)) return R
  // Vr con la separación del detalle: Vcr + FR·Av·fy·d/s
  const resC0 = calcCortante({
    fc: R.fc, fy: R.fy, b: R.b, h: R.h, r: R.r, L: R.L || 0, VuTon: 0.0001,
    AsUsada: R.AsUsada, varEstNum: R.varEstNum, nramas: R.nramas,
    conCompresion: calc.conCompresion, MuCorte: +(calc.MuCorte || 0),
  })
  const VsrKg = (resC0.FR * resC0.Av * R.fy * resC0.d) / sep
  const Vr = (resC0.VcrKg + VsrKg) / 1000
  return { ...R, resC: { ...resC0, Suso: sep, VsrReal: VsrKg / 1000, Vr, okVr: true, desdeDetalle: true } }
}
