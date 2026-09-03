import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseRamEnvelope, parseMemberRanges, parseRamMemberData, autoAssign, suggestKind, groupByMember, evaluateModel } from '../src/core/modelEnvelope.js'

const here = dirname(fileURLToPath(import.meta.url))
const C1 = readFileSync(join(here, 'fixtures', 'C1.txt'), 'utf-8')
const T2 = readFileSync(join(here, 'fixtures', 'T2.txt'), 'utf-8')

const trabe = {
  nombre: 'T-2', ancho: 20, peralte: 30, recub: 3, fc: 250,
  calSup: '5', cantSup: 4, calInf: '5', cantInf: 3,
  calBastonSup: '5', cantBastonSup: 0, calBastonInf: '5', cantBastonInf: 0,
  calEst: '2.5', sepLcuarto: 8, sepRest: 16,
  calc: { fy: 4200, MuP: 3, MuN: 4, VuTon: 5, varPNum: 5, varPCount: 3, varNNum: 5, varNCount: 4, varEstNum: 2, nramas: 2, L: 4 },
}
const columna = { nombre: 'C-1', b: 30, h: 30, r: 3, fc: 250, fy: 4200, lechos: [{ n: 3, num: '4' }, { n: 2, num: '4' }, { n: 3, num: '4' }], estriboNum: '3' }

describe('parseMemberRanges', () => {
  it('listas, rangos y separadores mezclados', () => {
    expect(parseMemberRanges('47, 52, 57-59 103')).toEqual(['47', '52', '57', '58', '59', '103'])
    expect(parseMemberRanges('10-8')).toEqual(['8', '9', '10'])
    expect(parseMemberRanges('a1;a2')).toEqual(['a1', 'a2'])
    expect(parseMemberRanges('')).toEqual([])
    expect(parseMemberRanges('5,5,5')).toEqual(['5'])
  })
})

describe('parseRamMemberData — reporte de datos de miembros (tolerante)', () => {
  const txt = `
Miembros

Datos de miembros

Miembro   Nudo I   Nudo J   Sección        Material   Descripción
------------------------------------------------------------------
27        1        2        T-2 20x30      CONC250    Trabe eje A
28        2        3        T-2 20x30      CONC250    Trabe eje A
1771      9        10       C-1 30x30      CONC250    Columna
47        11       12       C1             CONC250
`
  it('lee la columna de sección por posición del encabezado', () => {
    const r = parseRamMemberData(txt)
    expect(r.warnings).toEqual([])
    expect(r.rows).toHaveLength(4)
    expect(r.rows[0]).toMatchObject({ member: '27', seccion: 'T-2 20x30', descripcion: 'Trabe eje A' })
    expect(r.rows[3]).toMatchObject({ member: '47', seccion: 'C1' })
  })
  it('sin encabezado reconocible avisa', () => {
    const r = parseRamMemberData('nada que ver\n1 2 3')
    expect(r.rows).toHaveLength(0)
    expect(r.warnings[0]).toMatch(/encabezado/)
  })
  it('autoAssign empata por nombre normalizado (T-2 ≡ "T-2 20x30", C1 ≡ C-1)', () => {
    const r = parseRamMemberData(txt)
    const a = autoAssign(r.rows, [trabe], [columna])
    expect(a.matched).toBe(4)
    expect(a.assignment['27']).toEqual({ name: 'T-2', kind: 'trabe' })
    expect(a.assignment['1771']).toEqual({ name: 'C-1', kind: 'columna' })
    expect(a.assignment['47']).toEqual({ name: 'C-1', kind: 'columna' })
    expect(a.unmatched).toEqual([])
  })
})

describe('suggestKind', () => {
  it('columnas del C1.txt → columna; trabes del T2.txt → trabe', () => {
    const cols = groupByMember(parseRamEnvelope(C1).points)
    for (const pts of cols.values()) expect(suggestKind(pts)).toBe('columna')
    const beams = groupByMember(parseRamEnvelope(T2).points)
    let trabes = 0
    for (const pts of beams.values()) if (suggestKind(pts) === 'trabe') trabes++
    expect(trabes / beams.size).toBeGreaterThan(0.9)
  })
})

describe('evaluateModel — todo el modelo en un .txt', () => {
  const points = [...parseRamEnvelope(C1).points, ...parseRamEnvelope(T2).points]
  const colIds = [...new Set(parseRamEnvelope(C1).points.map((p) => p.member))]
  const beamIds = [...new Set(parseRamEnvelope(T2).points.map((p) => p.member))]

  it('reparte por asignación y evalúa cada sección con su motor', () => {
    const assignment = {}
    for (const id of colIds) assignment[id] = { name: 'C-1', kind: 'columna' }
    for (const id of beamIds) assignment[id] = { name: 'T-2', kind: 'trabe' }
    const ev = evaluateModel({ points, assignment }, [trabe], [columna])
    expect(ev.totalMiembros).toBe(colIds.length + beamIds.length)
    expect(ev.sinAsignar).toEqual([])
    expect(ev.asignados).toBe(ev.totalMiembros)
    const t = ev.porSeccion.find((s) => s.nombre === 'T-2')
    const c = ev.porSeccion.find((s) => s.nombre === 'C-1')
    expect(t.members).toHaveLength(128)
    expect(t.ev.allOk).toBe(true)
    expect(c.members).toHaveLength(23)
    expect(c.ev.total).toBe(46)
    expect(c.ev.allOk).toBe(true)
    expect(ev.allOk).toBe(true)
    expect(ev.ejemplares).toBe(128 + 46)
    expect(ev.ejemplaresOk).toBe(ev.ejemplares)
  })

  it('miembros sin asignar y huérfanos impiden el "todo cubierto"', () => {
    const assignment = { [beamIds[0]]: { name: 'T-2', kind: 'trabe' }, [beamIds[1]]: { name: 'T-99', kind: 'trabe' } }
    const ev = evaluateModel({ points, assignment }, [trabe], [columna])
    expect(ev.allOk).toBe(false)
    expect(ev.sinAsignar.length).toBe(ev.totalMiembros - 1)
    expect(ev.huerfanos).toEqual([beamIds[1]])
    expect(ev.porSeccion.find((s) => s.nombre === 'C-1').members).toEqual([])
  })

  it('una sección chica reprueba y se cuenta', () => {
    const chica = { ...columna, nombre: 'C-1', b: 15, h: 15, lechos: [{ n: 2, num: '3' }, { n: 2, num: '3' }] }
    const assignment = {}
    for (const id of colIds) assignment[id] = { name: 'C-1', kind: 'columna' }
    const pesados = parseRamEnvelope(C1).points.map((p) => ({ ...p, m33: p.m33 * 6, m22: p.m22 * 6 }))
    const ev = evaluateModel({ points: pesados, assignment }, [], [chica])
    expect(ev.fallan).toBe(1)
    expect(ev.allOk).toBe(false)
    expect(ev.utilMax).toBeGreaterThan(1)
  })
})
