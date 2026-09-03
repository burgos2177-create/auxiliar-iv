import { describe, it, expect } from 'vitest'
import { computeGeometry, tieOrder, placeBastones } from '../src/core/beamGeometry.js'
import { DIAM } from '../src/core/constants.js'

const T6 = {
  nombre: 'T-6', ancho: 20, peralte: 30, recub: 3,
  calSup: '5', cantSup: 4, calInf: '5', cantInf: 3,
  calBastonSup: '5', cantBastonSup: 0, calBastonInf: '5', cantBastonInf: 0,
  calEst: '2.5',
}

describe('tieOrder — orden de amarre', () => {
  it('primero las esquinas y luego hacia el centro', () => {
    expect(tieOrder(6, 0)).toEqual([])
    expect(tieOrder(6, 1)).toEqual([0])
    expect(tieOrder(6, 2)).toEqual([0, 5])
    expect(tieOrder(6, 3)).toEqual([0, 5, 1])
    expect(tieOrder(6, 6)).toEqual([0, 5, 1, 2, 3, 4])
  })
  it('recorta al número de varillas', () => {
    expect(tieOrder(4, 9)).toEqual([0, 3, 1, 2])
    expect(tieOrder(1, 3)).toEqual([0])
    expect(tieOrder(0, 3)).toEqual([])
  })
})

describe('computeGeometry — bastones', () => {
  it('con 1 y 2 bastones el dibujo es el de siempre (esquina izq. a 53°, derecha recta)', () => {
    const g1 = computeGeometry({ ...T6, cantBastonSup: 1, cantBastonInf: 1 }, 14)
    const g2 = computeGeometry({ ...T6, cantBastonSup: 2, cantBastonInf: 2 }, 14)
    const rc = 3 * 14
    const rBar = Math.max((DIAM['5'] / 20) * 14, 3.5)
    const rB = rBar
    // superior 1: diagonal a 53° desde la barra 0
    const ang = (53 * Math.PI) / 180
    const off = rBar + rB + 1
    expect(g1.bastonsSup[0].cx).toBeCloseTo(rc + off * Math.cos(ang), 6)
    expect(g1.bastonsSup[0].cy).toBeCloseTo(rc + off * Math.sin(ang), 6)
    // superior 2: bajo la última barra
    const last = g2.supBars[g2.supBars.length - 1]
    expect(g2.bastonsSup[1].cx).toBeCloseTo(last.cx, 6)
    expect(g2.bastonsSup[1].cy).toBeCloseTo(last.cy + rBar + rB + 1.5, 6)
    // inferior 1: sobre la barra 0
    expect(g1.bastonsInf[0].cx).toBeCloseTo(g1.infBars[0].cx, 6)
    expect(g1.bastonsInf[0].cy).toBeCloseTo(g1.infBars[0].cy - (rBar + rB + 1.5), 6)
  })

  it('con 4 bastones hay uno por varilla, sin repetir', () => {
    const g = computeGeometry({ ...T6, cantBastonSup: 4 }, 14)
    expect(g.bastonsSup).toHaveLength(4)
    expect(new Set(g.bastonsSup.map((b) => b.bar)).size).toBe(4)
    // todos dentro del estribo
    for (const b of g.bastonsSup) {
      expect(b.cx - b.r).toBeGreaterThan(g.eiPx)
      expect(b.cx + b.r).toBeLessThanOrEqual(g.bpx - g.eiPx + 1e-9) // el de la esquina queda tangente al estribo, como su varilla
      expect(b.cy - b.r).toBeGreaterThan(g.eiPx)
    }
  })

  it('recorta al número de varillas y la etiqueta cuenta sólo los dibujados', () => {
    const g = computeGeometry({ ...T6, cantBastonSup: 9 }, 14)
    expect(g.cantBSup).toBe(4)
    expect(g.bastonsSup).toHaveLength(4)
    expect(g.totalSup).toBe(8)
  })

  it('el estribo queda tangente al paño de la varilla superior', () => {
    const g = computeGeometry(T6, 14)
    const rBar = (DIAM['5'] / 20) * 14
    expect(g.eiPx).toBeCloseTo(3 * 14 - rBar, 9)
    // borde interior del estribo = borde exterior de la barra de esquina
    expect(g.supBars[0].cx - rBar).toBeCloseTo(g.eiPx, 9)
  })
})

describe('placeBastones — genérico', () => {
  it('las líneas de amarre van del paño de la barra al paño del bastón', () => {
    const bars = [{ cx: 0, cy: 0, r: 5 }, { cx: 100, cy: 0, r: 5 }]
    const [a, b] = placeBastones(bars, 2, 4, { dir: 1, gap: 2, gapDiag: 1, diagFirst: false })
    expect(a).toMatchObject({ cx: 0, cy: 11, bar: 0, ty0: 5, ty1: 7 })
    expect(b).toMatchObject({ cx: 100, cy: 11, bar: 1 })
    const [up] = placeBastones(bars, 1, 4, { dir: -1, gap: 2 })
    expect(up.cy).toBe(-11)
    expect(up.ty0).toBe(-5)
    expect(up.ty1).toBe(-7)
  })
})
