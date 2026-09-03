import { describe, it, expect } from 'vitest'
import { analyzeColumn } from '../src/core/columnCalculator.js'
import { columnDemand, demandCase } from '../src/core/columnDemand.js'

const base = {
  nombre: 'C-2', b: 15, h: 15, r: 3, fc: 250, fy: 4200, E: 2000000, epsC: 0.003,
  nLechos: 2, lechos: [{ n: 3, num: '3' }, { n: 3, num: '3' }],
  estriboNum: '2.5', Pu: 0, MuX: 0, MuY: 0, envelope: null,
}
const an = analyzeColumn(base)
const mk = (member, axial, m22, m33) => ({ id: `${member}-Max`, member, tipo: 'Max', axial, v2: 0, v3: 0, tors: 0, m22, m33, P: -axial, combo: 'ENV' })
const env = { archivo: 'C1.txt', combo: 'ENV', mapping: 'M33X', points: [mk('M1', -24, 0.30, 0.64), mk('M2', -5.81, 1.0, 0.01), mk('M3', -12, 0.2, 0.2)] }

describe('columnDemand — quién decide el veredicto', () => {
  it('sin demanda ni envolvente: no se evalúa (no es un falso CUMPLE)', () => {
    const D = columnDemand(base, an)
    expect(D.fuente).toBe('ninguna')
    expect(D.evaluado).toBe(false)
  })
  it('punto capturado que pasa / que no pasa', () => {
    expect(columnDemand({ ...base, Pu: 24, MuX: 0.64, MuY: 0.3 }, an)).toMatchObject({ fuente: 'manual', ok: true, okX: true, okY: true, okBi: true })
    const D = columnDemand({ ...base, Pu: 24, MuX: 9, MuY: 0.3 }, an)
    expect(D).toMatchObject({ fuente: 'manual', ok: false, okX: false, okY: true, okBi: false })
  })
  it('con envolvente cargada manda la envolvente, no el punto manual (el bug de "Mx ✗ / 82/82 dentro")', () => {
    const D = columnDemand({ ...base, Pu: 24, MuX: 9, MuY: 0.3, envelope: env }, an)
    expect(D.fuente).toBe('envolvente')
    expect(D.ok).toBe(true)
    expect(D.okX && D.okY && D.okBi).toBe(true)
    expect(D.env.passing).toBe(3)
    expect(D.manual.hayManual).toBe(true) // el punto manual sigue disponible como referencia
    const c = demandCase(D)
    expect(c.corto).toMatch(/crítico M2/)
    expect(c.Pu).toBeCloseTo(5.81, 9)
  })
  it('un ejemplar fuera de la envolvente sí reprueba', () => {
    const D = columnDemand({ ...base, envelope: { ...env, points: [...env.points, mk('M9', -24, 0.3, 9)] } }, an)
    expect(D.ok).toBe(false)
    expect(D.okX).toBe(false)
    expect(D.env.failing).toBe(1)
    expect(demandCase(D).corto).toMatch(/M9/)
  })
})
