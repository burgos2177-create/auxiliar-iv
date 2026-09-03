import { describe, it, expect } from 'vitest'
import { analyzeColumn, excentricidad, calcEstribos, checkPoint, checkBiaxial, barGrid, lechoDepths, beta1Col } from '../src/core/columnCalculator.js'

// Caso de la hoja "Columnas" de DISEN_O_DE_CONCRETO_v2.xlsx:
// h=15, b=15, r=3, f'c=250, 2 lechos × 2#3, Mu=0.109, Pu=4.28.
// Los valores esperados son los de las celdas del Excel (29 valores dorados).
const colExcel = {
  h: 15, b: 15, r: 3, fc: 250, fy: 4200, E: 2e6, epsC: 0.003,
  lechos: [{ n: 2, num: 3 }, { n: 2, num: 3 }],
}

describe('columnCalculator — réplica exacta del Excel', () => {
  const { dirX, dirY } = analyzeColumn(colExcel)

  it('POC y profundidades del eje neutro', () => {
    expect(dirX.POC).toBeCloseTo(59.13699999999999, 9)
    expect(dirX.cD).toBeCloseTo(7.058823529411765, 12)
    expect(dirX.c1).toBeCloseTo(11.029411764705882, 12)
    expect(dirX.c2).toBeCloseTo(5.2058823529411775, 12)
    expect(dirX.c3).toBeCloseTo(3.3529411764705888, 12)
    expect(dirX.cM0).toBe(1.5)
  })

  it('puntos canónicos (P, M)', () => {
    const [, P1, D, P2, P3, M0] = dirX.canonical
    expect(P1.P).toBeCloseTo(35.097052500000004, 9); expect(P1.M).toBeCloseTo(1.1425733015625, 9)
    expect(D.P).toBeCloseTo(18.060000000000006, 9); expect(D.M).toBeCloseTo(1.34946, 9)
    expect(P2.P).toBeCloseTo(11.750856991525428, 9); expect(P2.M).toBeCloseTo(1.1766229786811442, 9)
    expect(P3.P).toBeCloseTo(4.0172171052631604, 9); expect(P3.M).toBeCloseTo(0.8606136759868421, 9)
    expect(M0.P).toBeCloseTo(-7.8639375000000005, 9); expect(M0.M).toBeCloseTo(0.2788962890625, 9)
  })

  it('detalle del punto balanceado D (fuerzas por lecho + bloque de concreto)', () => {
    const D = dirX.canonical[2].detail
    expect(D.capas[0].eps).toBeCloseTo(0.001725, 12)
    expect(D.capas[0].f).toBeCloseTo(3450, 9)
    expect(D.capas[0].F).toBeCloseTo(4.899, 9)
    expect(D.capas[0].Z).toBeCloseTo(4.5, 12)
    expect(D.capas[0].M).toBeCloseTo(0.220455, 9)
    expect(D.capas[1].eps).toBeCloseTo(-0.0021, 12)
    expect(D.capas[1].f).toBeCloseTo(-4200, 9)
    expect(D.CC).toBeCloseTo(19.125, 9)
    expect(D.Zcc).toBeCloseTo(4.5, 12)
    expect(D.Mcc).toBeCloseTo(0.860625, 9)
  })

  it('excentricidad y modo de revisión', () => {
    const ex = excentricidad(0.109, 4.28, 15, 15)
    expect(ex.e).toBeCloseTo(0.02546728971962617, 12)
    expect(ex.eLim).toBeCloseTo(0.015, 12)
    expect(ex.modo).toMatch(/flexocompresión/)
  })

  it('estribos con las fórmulas de la hoja (área·16, área·48, mín(h,b))', () => {
    const est = calcEstribos({ estriboNum: 2.5, longNum: 3, h: 15, b: 15 })
    expect(est.s1).toBeCloseTo(7.84, 9)
    expect(est.s2).toBeCloseTo(34.08, 9)
    expect(est.s3).toBe(15)
    expect(est.s).toBe(7)
  })

  it('columna cuadrada 2×2 → dirección Y idéntica a X', () => {
    expect(dirY.POC).toBeCloseTo(dirX.POC, 9)
    expect(dirY.canonical[2].P).toBeCloseTo(dirX.canonical[2].P, 9)
    expect(dirY.canonical[2].M).toBeCloseTo(dirX.canonical[2].M, 9)
  })

  it('la curva es continua, termina en POC y tiene puntos de sobra', () => {
    expect(dirX.curve.length).toBeGreaterThan(60)
    const last = dirX.curve[dirX.curve.length - 1]
    expect(last.P).toBeCloseTo(dirX.POC, 9)
    expect(last.M).toBe(0)
  })
})

describe('columnCalculator — utilidades', () => {
  it('β1 de la hoja: 0.85 hasta 280, 1.05 − f\'c/1400 después', () => {
    expect(beta1Col(250)).toBe(0.85)
    expect(beta1Col(300)).toBeCloseTo(1.05 - 300 / 1400, 12)
  })
  it('lechos equiespaciados entre r y h−r', () => {
    expect(lechoDepths(40, 3, 3)).toEqual([3, 20, 37])
    expect(lechoDepths(40, 3, 1)).toEqual([20])
  })
  it('barGrid reparte n barras a lo ancho con las extremas a r', () => {
    const bars = barGrid({ h: 30, b: 30, r: 3, lechos: [{ n: 3, num: 4 }, { n: 2, num: 4 }] })
    expect(bars).toHaveLength(5)
    expect(bars.filter((b) => b.y === 3).map((b) => b.x)).toEqual([3, 15, 27])
    expect(bars.filter((b) => b.y === 27).map((b) => b.x)).toEqual([3, 27])
  })
})

describe('checkPoint / checkBiaxial', () => {
  const { dirX, dirY } = analyzeColumn({ ...colExcel, lechos: [{ n: 3, num: 3 }, { n: 3, num: 3 }] })

  it('punto dentro y fuera del diagrama', () => {
    const inside = checkPoint(dirX.curve, 10, 0.5)
    expect(inside.ok).toBe(true)
    expect(inside.MR).toBeGreaterThan(0.5)
    const outside = checkPoint(dirX.curve, 10, 5)
    expect(outside.ok).toBe(false)
    expect(outside.ratio).toBeGreaterThan(1)
  })
  it('fuera del rango de P falla en ambas direcciones', () => {
    expect(checkPoint(dirX.curve, 500, 0).ok).toBe(false)
    expect(checkPoint(dirX.curve, -100, 0).ok).toBe(false)
  })
  it('biaxial elíptico: (Mux/MRx)² + (Muy/MRy)²', () => {
    const b = checkBiaxial(dirX, dirY, 10, 0.5, 0.5)
    const exp = (0.5 / b.checkX.MR) ** 2 + (0.5 / b.checkY.MR) ** 2
    expect(b.valor).toBeCloseTo(exp, 12)
    expect(b.ok).toBe(exp <= 1)
  })
})
