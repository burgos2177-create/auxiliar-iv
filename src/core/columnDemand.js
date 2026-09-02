// ══════════════════════════════════════════════════════════════
// Fuente de demanda de una columna — punto único de decisión.
//
// Una columna puede tener DOS orígenes de elementos mecánicos:
//   · el punto capturado a mano en el formulario (Pu, MuX, MuY)
//   · la envolvente del modelo (reporte RAM) con N ejemplares
//
// Cuando hay envolvente, ella manda: el veredicto sale de TODOS sus
// ejemplares y el punto manual queda sólo como referencia. Así la
// insignia del encabezado, el informe resumido, el detallado y la
// memoria dicen siempre lo mismo.
// ══════════════════════════════════════════════════════════════

import { checkPoint, checkBiaxial, excentricidad } from './columnCalculator'
import { evaluateEnvelope } from './ramParser'

/**
 * @param {object} col  columna del store
 * @param {object} an   resultado de analyzeColumn(col) — puede ser null
 * @returns {{
 *   fuente:'envolvente'|'manual'|'ninguna', fuenteLabel:string, evaluado:boolean,
 *   env:object|null, manual:object|null,
 *   okX:boolean, okY:boolean, okBi:boolean, ok:boolean
 * }}
 */
export function columnDemand(col, an) {
  const Pu = +col?.Pu || 0, MuX = +col?.MuX || 0, MuY = +col?.MuY || 0
  const hayManual = Pu !== 0 || MuX !== 0 || MuY !== 0

  const manual = an
    ? {
      Pu, MuX, MuY, hayManual,
      cx: checkPoint(an.dirX.curve, Pu, MuX),
      cy: checkPoint(an.dirY.curve, Pu, MuY),
      bi: checkBiaxial(an.dirX, an.dirY, Pu, MuX, MuY),
      ex: excentricidad(MuX, Pu, +col?.b, +col?.h),
    }
    : null

  const envRaw = col?.envelope
  const env = an && envRaw?.points?.length
    ? evaluateEnvelope(envRaw.points, an.dirX, an.dirY, envRaw.mapping || 'M33X')
    : null

  if (env) {
    return {
      fuente: 'envolvente',
      fuenteLabel: `envolvente · ${env.total} ejemplares`,
      evaluado: true,
      env, manual,
      okX: env.results.every((r) => r.cx.ok),
      okY: env.results.every((r) => r.cy.ok),
      okBi: env.results.every((r) => r.bi.ok),
      ok: env.allOk,
    }
  }

  if (manual && hayManual) {
    return {
      fuente: 'manual',
      fuenteLabel: 'punto capturado',
      evaluado: true,
      env: null, manual,
      okX: manual.cx.ok, okY: manual.cy.ok, okBi: manual.bi.ok,
      ok: manual.cx.ok && manual.cy.ok && manual.bi.ok,
    }
  }

  return {
    fuente: 'ninguna',
    fuenteLabel: 'sin demanda',
    evaluado: false,
    env: null, manual,
    okX: true, okY: true, okBi: true, ok: true,
  }
}

/**
 * Caso que representa el veredicto (para tablas de "Verificaciones").
 * Con envolvente → el ejemplar crítico; si no → el punto capturado.
 */
export function demandCase(D) {
  if (D?.fuente === 'envolvente' && D.env?.critical) {
    const c = D.env.critical
    return {
      Pu: c.Pu, Mux: c.Mux, Muy: c.Muy,
      cx: c.cx, cy: c.cy, bi: c.bi,
      etiqueta: `envolvente — ejemplar crítico ${c.member} (${c.tipo})`,
      corto: `crítico ${c.member}`,
    }
  }
  if (D?.manual) {
    const m = D.manual
    return {
      Pu: m.Pu, Mux: m.MuX, Muy: m.MuY,
      cx: m.cx, cy: m.cy, bi: m.bi,
      etiqueta: D.fuente === 'ninguna' ? 'sin demanda capturada' : 'punto capturado manualmente',
      corto: D.fuente === 'ninguna' ? 'sin demanda' : 'punto capturado',
    }
  }
  return null
}
