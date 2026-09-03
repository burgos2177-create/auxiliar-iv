import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseRamEnvelope, beamEnvelopeByMember, evaluateBeamEnvelope, evaluateEnvelope } from '../src/core/ramParser.js'
import { analyzeColumn } from '../src/core/columnCalculator.js'
import { computeSectionCapacities } from '../src/core/sectionResults.js'

const here = dirname(fileURLToPath(import.meta.url))
const C1 = readFileSync(join(here, 'fixtures', 'C1.txt'), 'utf-8')
const T2 = readFileSync(join(here, 'fixtures', 'T2.txt'), 'utf-8')

describe('parseRamEnvelope — reportes reales de RAM Elements', () => {
  it('C1.txt: combo, unidades y 2 filas por miembro con P = −axial', () => {
    const r = parseRamEnvelope(C1)
    expect(r.combo).toBe('CD=1.3CM+1.5CV')
    expect(r.unidades).toMatch(/trico/)
    expect(r.warnings).toEqual([])
    const members = new Set(r.points.map((p) => p.member))
    expect(members.size).toBe(23)
    expect(r.points).toHaveLength(46)
    const m1771 = r.points.filter((p) => p.member === '1771')
    expect(m1771[0]).toMatchObject({ tipo: 'Max', axial: -6.06, v2: -0.02, v3: -0.05, tors: 0, m22: -0.01, m33: 0.02 })
    expect(m1771[0].P).toBeCloseTo(6.06, 12)
    expect(m1771[1]).toMatchObject({ tipo: 'Min', axial: -6.25 })
  })

  it('T2.txt: 128 miembros de trabes', () => {
    const r = parseRamEnvelope(T2)
    expect(new Set(r.points.map((p) => p.member)).size).toBe(128)
    const m27 = r.points.filter((p) => p.member === '27')
    expect(m27[0]).toMatchObject({ tipo: 'Max', v2: 2.31, m33: 0.75 })
    expect(m27[1]).toMatchObject({ tipo: 'Min', v2: -2.4, m33: -1.19 })
  })

  it('texto sin filas válidas → aviso y sin puntos', () => {
    const r = parseRamEnvelope('hola\nmundo')
    expect(r.points).toHaveLength(0)
    expect(r.warnings[0]).toMatch(/No se encontraron/)
  })
})

describe('beamEnvelopeByMember', () => {
  it('Mu+ = mayor M33 positivo, Mu− = |menor negativo|, Vu = máx |V2|', () => {
    const r = parseRamEnvelope(T2)
    const g = beamEnvelopeByMember(r.points).find((x) => x.member === '27')
    expect(g.MuP).toBeCloseTo(0.75, 12)
    expect(g.MuN).toBeCloseTo(1.19, 12)
    expect(g.Vu).toBeCloseTo(2.4, 12)
    expect(g.rows).toBe(2)
  })
  it('invertir intercambia Mu+ y Mu−', () => {
    const r = parseRamEnvelope(T2)
    const g = beamEnvelopeByMember(r.points, true).find((x) => x.member === '27')
    expect(g.MuP).toBeCloseTo(1.19, 12)
    expect(g.MuN).toBeCloseTo(0.75, 12)
  })
})

describe('evaluateBeamEnvelope contra una trabe del proyecto', () => {
  const T = {
    nombre: 'T-2', ancho: 20, peralte: 30, recub: 3, fc: 250,
    calSup: '5', cantSup: 4, calInf: '5', cantInf: 3,
    calBastonSup: '5', cantBastonSup: 0, calBastonInf: '5', cantBastonInf: 0,
    calEst: '2.5', sepLcuarto: 8, sepRest: 16,
    calc: { fy: 4200, MuP: 3, MuN: 4, VuTon: 5, varPNum: 5, varPCount: 3, varNNum: 5, varNCount: 4, varEstNum: 2, nramas: 2, L: 4 },
  }
  it('todos los miembros del T2.txt caben en una 20×30 con 4#5/3#5', () => {
    const R = computeSectionCapacities(T)
    const ev = evaluateBeamEnvelope(parseRamEnvelope(T2).points, R)
    expect(ev.total).toBe(128)
    expect(ev.failing).toBe(0)
    expect(ev.allOk).toBe(true)
    expect(ev.critical.util).toBeLessThanOrEqual(1)
    expect(ev.globalMuP).toBeGreaterThan(0)
    expect(ev.globalVu).toBeGreaterThan(0)
  })
  it('sin Vu capturado, Vr sale de los estribos del detalle', () => {
    const R = computeSectionCapacities({ ...T, calc: { ...T.calc, VuTon: 0 } })
    expect(R.resC).toBeTruthy()
    expect(R.resC.desdeDetalle).toBe(true)
    expect(R.resC.Suso).toBe(8)
    expect(R.resC.Vr).toBeGreaterThan(0)
  })
})

describe('evaluateEnvelope contra una columna', () => {
  it('C1.txt sobre una 30×30 con 8#4: todos dentro; sobre una 15×15 mínima, no', () => {
    const pts = parseRamEnvelope(C1).points
    const grande = analyzeColumn({ h: 30, b: 30, r: 3, fc: 250, fy: 4200, lechos: [{ n: 3, num: 4 }, { n: 2, num: 4 }, { n: 3, num: 4 }] })
    const evG = evaluateEnvelope(pts, grande.dirX, grande.dirY)
    expect(evG.total).toBe(46)
    expect(evG.allOk).toBe(true)

    // La 15×15 con 4#3 todavía cubre el C1.txt (M33 máx 0.79 t·m vs MR ≈ 1.3); con los momentos ×6 ya no
    const chica = analyzeColumn({ h: 15, b: 15, r: 3, fc: 250, fy: 4200, lechos: [{ n: 2, num: 3 }, { n: 2, num: 3 }] })
    expect(evaluateEnvelope(pts, chica.dirX, chica.dirY).allOk).toBe(true)
    const pesados = pts.map((p) => ({ ...p, m33: p.m33 * 6, m22: p.m22 * 6 }))
    const evC = evaluateEnvelope(pesados, chica.dirX, chica.dirY)
    expect(evC.failing).toBeGreaterThan(0)
    expect(evC.critical.util).toBeGreaterThan(1)
    // el crítico es el de mayor utilización de todos
    expect(evC.critical.util).toBe(Math.max(...evC.results.map((r) => r.util)))
  })
})
