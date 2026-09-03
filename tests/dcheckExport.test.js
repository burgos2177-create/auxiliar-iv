import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildDcheck, markFromRatios } from '../src/core/dcheckExport.js'
import { parseRamEnvelope, evaluateModel } from '../src/core/modelEnvelope.js'

const here = dirname(fileURLToPath(import.meta.url))
const T2 = readFileSync(join(here, 'fixtures', 'T2.txt'), 'utf-8')
const C1 = readFileSync(join(here, 'fixtures', 'C1.txt'), 'utf-8')

const trabe = {
  nombre: 'T-2', ancho: 20, peralte: 30, recub: 3, fc: 250,
  calSup: '5', cantSup: 4, calInf: '5', cantInf: 3,
  calBastonSup: '5', cantBastonSup: 0, calBastonInf: '5', cantBastonInf: 0,
  calEst: '2.5', sepLcuarto: 8, sepRest: 16,
  calc: { fy: 4200, MuP: 3, MuN: 4, VuTon: 5, varPNum: 5, varPCount: 3, varNNum: 5, varNCount: 4, varEstNum: 2, nramas: 2, L: 4 },
}
const columna = { nombre: 'C-1', b: 30, h: 30, r: 3, fc: 250, fy: 4200, lechos: [{ n: 3, num: '4' }, { n: 2, num: '4' }, { n: 3, num: '4' }], estriboNum: '3', Pu: 10, MuX: 1, MuY: 0.5 }

describe('markFromRatios — misma regla que el Double Check', () => {
  it('≤0.9 ok · ≤1 warn · >1 bad · sin datos null', () => {
    expect(markFromRatios([0.5, 0.9])).toBe('ok')
    expect(markFromRatios([0.95])).toBe('warn')
    expect(markFromRatios([0.2, 1.01])).toBe('bad')
    expect(markFromRatios([null, undefined])).toBeNull()
  })
})

describe('buildDcheck', () => {
  it('formato del Double Check con resistencias de la calculadora y demanda del punto capturado', () => {
    const d = buildDcheck({ projectName: 'Prueba', sections: [trabe], columns: [columna] })
    expect(d.format).toBe('sogrub-dcheck')
    expect(d.version).toBe(1)
    expect(d.meta.proyecto).toBe('Prueba')
    expect(d.sections).toHaveLength(2)
    const t = d.sections[0]
    expect(t.name).toBe('T-2')
    expect(+t.ma).toBeCloseTo(3, 6)
    expect(+t.man).toBeCloseTo(4, 6)
    expect(+t.va).toBeCloseTo(5, 6)
    expect(+t.mr).toBeGreaterThan(+t.ma)
    expect(+t.mrn).toBeGreaterThan(+t.man)
    expect(+t.vr).toBeGreaterThan(0)
    expect(t.un).toBe('ton·m'); expect(t.unv).toBe('ton')
    expect(t.mark).toBe('ok')
    expect(t.obs).toMatch(/punto capturado/)
    for (const k of ['imgA', 'imgB', 'imgC', 'imgD']) expect(t[k]).toBeNull()
    const c = d.sections[1]
    expect(c.name).toBe('C-1')
    expect(+c.ma).toBeCloseTo(1, 6)
    expect(+c.man).toBeCloseTo(0.5, 6)
    expect(+c.mr).toBeGreaterThan(1)
    expect(c.obs).toMatch(/Pu = 10/)
    expect(c.mark).toBe('ok')
  })

  it('con el modelo cargado, la demanda es la envolvente global de cada sección', () => {
    const points = [...parseRamEnvelope(T2).points, ...parseRamEnvelope(C1).points]
    const assignment = {}
    for (const p of points) assignment[p.member] = p.axial < -1 ? { name: 'C-1', kind: 'columna' } : { name: 'T-2', kind: 'trabe' }
    const modelEval = evaluateModel({ points, assignment }, [trabe], [columna])
    const d = buildDcheck({ projectName: 'Modelo', sections: [trabe], columns: [columna], modelEval })
    const t = d.sections[0]
    const evT = modelEval.porSeccion.find((s) => s.nombre === 'T-2').ev
    expect(+t.ma).toBeCloseTo(evT.globalMuP, 3)
    expect(+t.man).toBeCloseTo(evT.globalMuN, 3)
    expect(+t.va).toBeCloseTo(evT.globalVu, 3)
    expect(t.obs).toMatch(/modelo \(128 miembros\)/)
    const c = d.sections[1]
    expect(c.obs).toMatch(/46 ejemplares dentro/)
    expect(c.mark).toBe('ok')
  })
})
