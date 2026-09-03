import { describe, it, expect } from 'vitest'
import { calcFlexion, calcCortante, optimizeFlexion, beta1, VARILLAS } from '../src/core/sectionCalculator.js'
import { CAL_TO_NUM, NUM_TO_CAL, REBAR_OPTIONS, STIRRUP_OPTIONS } from '../src/core/constants.js'

// Trabe de referencia del proyecto: 20×30, r=3, f'c=250, fy=4200
const base = { fc: 250, fy: 4200, b: 20, h: 30, r: 3 }

describe('calcFlexion — fórmulas NTC', () => {
  it('β1 = 0.85 hasta 280 y decrece después', () => {
    expect(beta1(250)).toBe(0.85)
    expect(beta1(280)).toBe(0.85)
    expect(beta1(350)).toBeCloseTo(0.85 - 0.05 * 70 / 70, 6)
    expect(beta1(1000)).toBe(0.65)
  })

  it('4#5 sin bastones: As, MRT, b_min a mano', () => {
    const R = calcFlexion({ ...base, MuTm: 3.45, varNum: 5, varCount: 4, bastonNum: 5, bastonCount: 0 })
    const d = 27, fcRed = 212.5
    const As = 4 * 1.98
    const a = (As * 4200) / (fcRed * 20)
    const MRT = 0.9 * As * 4200 * (d - a / 2) / 100000
    expect(R.d).toBe(d)
    expect(R.AsTotal).toBeCloseTo(As, 10)
    expect(R.a).toBeCloseTo(a, 10)
    expect(R.MRT).toBeCloseTo(MRT, 10)
    expect(R.bMin).toBeCloseTo(2 * 3 + (2 * 4 - 1) * 1.59, 10)
    expect(R.okMR).toBe(true)
    expect(R.okBmin).toBe(true)
  })

  it('As mínimo y máximo (0.7√f\'c/fy · b·d y 0.9·As_bal)', () => {
    const R = calcFlexion({ ...base, MuTm: 1, varNum: 3, varCount: 2, bastonNum: 3, bastonCount: 0 })
    const bd = 20 * 27
    expect(R.AsMin).toBeCloseTo((0.7 * Math.sqrt(250) / 4200) * bd, 10)
    const rhoBal = (0.85 * 212.5 / 4200) * (6000 / 10200)
    expect(R.AsMax).toBeCloseTo(0.9 * rhoBal * bd, 10)
  })

  it('sección insuficiente devuelve error', () => {
    const R = calcFlexion({ ...base, MuTm: 500, varNum: 5, varCount: 4, bastonNum: 5, bastonCount: 0 })
    expect(R.error).toBeTruthy()
  })

  it('valores de referencia congelados (4#5 + 2#5, Mu = 3.45)', () => {
    const R = calcFlexion({ ...base, MuTm: 3.45, varNum: 5, varCount: 4, bastonNum: 5, bastonCount: 2 })
    expect(R.AsTotal).toBeCloseTo(11.88, 6)
    expect(R.MRT).toBeCloseTo(9.4887, 3)
    expect(R.bMin).toBeCloseTo(17.13, 6)
  })
})

describe('calcFlexion — bastones', () => {
  const run = (nb) => calcFlexion({ ...base, MuTm: 3.45, varNum: 5, varCount: 4, bastonNum: 5, bastonCount: nb })

  it('cada bastón suma su área al As y sube el MR', () => {
    const r0 = run(0), r1 = run(1), r2 = run(2), r4 = run(4)
    expect(r1.AsTotal - r0.AsTotal).toBeCloseTo(1.98, 10)
    expect(r2.AsTotal - r0.AsTotal).toBeCloseTo(2 * 1.98, 10)
    expect(r4.AsTotal - r0.AsTotal).toBeCloseTo(4 * 1.98, 10)
    expect(r1.MRT).toBeGreaterThan(r0.MRT)
    expect(r4.MRT).toBeGreaterThan(r2.MRT)
  })

  it('los bastones NO cambian b_min', () => {
    const bmins = [0, 1, 2, 3, 4].map((nb) => run(nb).bMin)
    for (const bm of bmins) expect(bm).toBeCloseTo(bmins[0], 10)
  })

  it('no puede haber más bastones que varillas del lecho', () => {
    expect(run(9).nBastones).toBe(4)
    expect(run(9).AsTotal).toBeCloseTo(run(4).AsTotal, 10)
    expect(run(-3).nBastones).toBe(0)
  })

  it('con varCount automático, el tope es n_calc', () => {
    const R = calcFlexion({ ...base, MuTm: 3.45, varNum: 4, varCount: null, bastonNum: 4, bastonCount: 50 })
    expect(R.nBastones).toBe(R.nUsed)
  })
})

describe('calcCortante', () => {
  it('Vcr, Va_max y separación con Vu moderado (L/h > 5)', () => {
    const R = calcCortante({ ...base, L: 4, VuTon: 6, AsUsada: 7.92, varEstNum: 2, nramas: 2 })
    const d = 27, FR = 0.75, sq = Math.sqrt(250), bd = 20 * d
    const rho = 7.92 / bd
    const VCRa = FR * 0.5 * sq * bd
    const VCRb = FR * 2 * Math.cbrt(rho) * sq * bd
    const Vcr = Math.min(Math.max(Math.max(VCRa, VCRb), FR * 0.25 * sq * bd), FR * 1.25 * sq * bd)
    expect(R.lhZone).toBe('mayor5')
    expect(R.VcrKg).toBeCloseTo(Vcr, 6)
    expect(R.VaMax).toBeCloseTo((Vcr + FR * 2.2 * sq * bd) / 1000, 9)
    expect(R.Av).toBeCloseTo(2 * 0.32, 10)
    expect(R.Suso).toBeGreaterThanOrEqual(6)
    expect(R.Suso).toBeLessThanOrEqual(Math.min(d / 2, 60))
    expect(R.Vr).toBeCloseTo((R.VcrKg + FR * R.Av * 4200 * d / R.Suso) / 1000, 9)
    expect(R.okVr).toBe(true)
  })

  it('L/h < 4 sin compresión usa 5.3.2', () => {
    const R = calcCortante({ ...base, L: 1, VuTon: 2, AsUsada: 7.92, varEstNum: 2, nramas: 2 })
    expect(R.lhZone).toBe('menor4')
    expect(R.ecVcr).toMatch(/5\.3\.2/)
  })

  it('Vu enorme → sección insuficiente', () => {
    const R = calcCortante({ ...base, L: 4, VuTon: 200, AsUsada: 7.92, varEstNum: 3, nramas: 2 })
    expect(R.seccionInsuficiente).toBe(true)
    expect(R.okVr).toBe(false)
  })
})

describe('optimizeFlexion', () => {
  it('propone un armado que cumple As_req, As_max y b_min', () => {
    const o = optimizeFlexion({ ...base, MuTm: 3.45 })
    expect(o).not.toBeNull()
    const R = calcFlexion({ ...base, MuTm: 3.45, varNum: o.varNum, varCount: o.varCount, bastonNum: o.bastonNum, bastonCount: o.bastonCount })
    expect(R.AsTotal).toBeGreaterThanOrEqual(R.AsReq - 1e-9)
    expect(R.okMax).toBe(true)
    expect(R.okBmin).toBe(true)
    expect(o.bastonCount).toBeLessThanOrEqual(o.varCount)
  })

  it('en sección angosta recurre a bastones', () => {
    // 15 cm de ancho: 4#5 en un lecho no caben (b_min = 17.1) → debe amarrar
    const o = optimizeFlexion({ fc: 250, fy: 4200, b: 15, h: 30, r: 3, MuTm: 6 })
    expect(o).not.toBeNull()
    const vr = VARILLAS.find((v) => v.num === o.varNum)
    expect(2 * 3 + (2 * o.varCount - 1) * vr.diam).toBeLessThanOrEqual(15)
  })
})

describe('calibres del detallador ↔ calculadora', () => {
  it('todo calibre del detallador va y vuelve sin cambiar (incluido el #2.5)', () => {
    for (const cal of [...REBAR_OPTIONS, ...STIRRUP_OPTIONS]) {
      const num = CAL_TO_NUM[cal]
      expect(num, cal).toBeDefined()
      expect(NUM_TO_CAL[num], cal).toBe(cal)
      expect(VARILLAS.some((v) => v.num === num), cal).toBe(true)
    }
  })
  it('el estribo #2.5 se calcula con su área (0.49 cm²), no con la del #2', () => {
    const R25 = calcCortante({ ...base, L: 4, VuTon: 6, AsUsada: 7.92, varEstNum: 2.5, nramas: 2 })
    const R2 = calcCortante({ ...base, L: 4, VuTon: 6, AsUsada: 7.92, varEstNum: 2, nramas: 2 })
    expect(R25.Av).toBeCloseTo(0.98, 10)
    expect(R2.Av).toBeCloseTo(0.64, 10)
    expect(R25.ve.num).toBe(2.5)
  })
})
