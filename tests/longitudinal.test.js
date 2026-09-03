import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  parseRamStations, looksLikeStations, memberProfile, profileAt, exceedZones, developmentLength,
  sectionCapacities, bastonesForLecho, analyzeMember, analyzeGroup, optimizeBase, applyBase, barWeight, uniformDesign,
  capacityAt, capacityProfile, capacityViolations, mrForAs,
} from '../src/core/longitudinal.js'
import { elevationSvg, diagramSvg, elevationsGridSvg } from '../src/core/longitudinalSvg.js'
import { calcFlexion } from '../src/core/sectionCalculator.js'

const here = dirname(fileURLToPath(import.meta.url))
const T4 = readFileSync(join(here, 'fixtures', 'T4_estaciones.txt'), 'utf-8')
const T2 = readFileSync(join(here, 'fixtures', 'T2.txt'), 'utf-8')

// Sección T-4 del proyecto: 20×30, r = 3, f'c = 250
const secc = (over = {}) => ({
  nombre: 'T-4', ancho: 20, peralte: 30, recub: 3, fc: 250,
  calSup: '4', cantSup: 2, calInf: '4', cantInf: 2,
  calBastonSup: '4', cantBastonSup: 0, calBastonInf: '4', cantBastonInf: 0,
  calEst: '2.5', sepLcuarto: 8, sepRest: 16,
  calc: { fy: 4200, varEstNum: 2.5, nramas: 2 },
  ...over,
})

// Perfil sintético: parábola Mu+ = 4·Mmax·ξ(1−ξ) en 11 estaciones, sin negativo
const parabola = (Mmax, n = 11, V = 0) => ({
  id: 'P', Lreport: null,
  stations: Array.from({ length: n }, (_, i) => {
    const xi = i / (n - 1)
    return { pos: xi, m33: { max: 4 * Mmax * xi * (1 - xi), min: 0 }, v2: { max: V * (1 - 2 * xi), min: V * (1 - 2 * xi) } }
  }),
})

describe('parseRamStations — reporte real de RAM por estaciones', () => {
  const P = parseRamStations(T4)
  it('detecta el formato y lee combo, miembros y estaciones', () => {
    expect(looksLikeStations(T4)).toBe(true)
    expect(looksLikeStations(T2)).toBe(false)
    expect(P.combo).toBe('CD=1.3CM+1.5CV+3.12PM')
    expect(P.formato).toBe('estaciones')
    expect(P.warnings).toEqual([])
    expect(P.members).toHaveLength(98) // el .txt trae además "Máximos esfuerzos": mismos ids, se deduplican
    expect(P.points).toHaveLength(196)
  })
  it('estaciones 0…1 en pasos de 1/9 (RAM imprime 11 %, 22 %…)', () => {
    const m9 = P.members.find((m) => m.id === '9')
    expect(m9.stations).toHaveLength(10)
    m9.stations.forEach((s, i) => expect(s.pos).toBeCloseTo(i / 9, 12))
    expect(m9.stations[0].m33.max).toBe(-1.24)
    expect(m9.stations[4].m33.max).toBe(1.4)
    expect(m9.stations[9].m33.max).toBe(-1.21)
    expect(m9.stations[0].v2.max).toBe(3.38)
    expect(m9.Lreport).toBeNull()
  })
  it('los puntos Max/Min por miembro son compatibles con la envolvente de sección', () => {
    const mx = P.points.find((p) => p.id === '9-Max'), mn = P.points.find((p) => p.id === '9-Min')
    expect(mx.m33).toBe(1.4); expect(mn.m33).toBe(-1.24)
    const m9 = P.members.find((m) => m.id === '9')
    expect(mx.v2).toBe(3.38); expect(mn.v2).toBe(Math.min(...m9.stations.map((s) => s.v2.min)))
    expect(mx.P).toBeCloseTo(-0.23, 12) // axial +0.23 (tensión) → P = −0.23
  })
  it('reporte en distancia (no %): usa la longitud del reporte', () => {
    const txt = `MIEMBRO 7\n0.00  Max 0.0 CD 1.0 CD 0.0 CD 0.0 CD 0.0 CD -1.0 CD\n      Min 0.0 CD 1.0 CD 0.0 CD 0.0 CD 0.0 CD -1.0 CD\n2.50  Max 0.0 CD 0.0 CD 0.0 CD 0.0 CD 0.0 CD 2.0 CD\n      Min 0.0 CD 0.0 CD 0.0 CD 0.0 CD 0.0 CD 2.0 CD\n5.00  Max 0.0 CD -1.0 CD 0.0 CD 0.0 CD 0.0 CD -1.0 CD\n      Min 0.0 CD -1.0 CD 0.0 CD 0.0 CD 0.0 CD -1.0 CD\n`
    const r = parseRamStations(txt)
    expect(r.members).toHaveLength(1)
    expect(r.members[0].Lreport).toBe(5)
    expect(r.members[0].stations.map((s) => s.pos)).toEqual([0, 0.5, 1])
    const prof = memberProfile(r.members[0], 99)
    expect(prof.L).toBe(5) // manda el reporte, no la L capturada
    expect(prof.muPmax).toBe(2); expect(prof.muNmax).toBe(1)
  })
})

describe('perfil e intersecciones', () => {
  it('interpola linealmente entre estaciones', () => {
    const prof = memberProfile(parabola(2), 5)
    expect(prof.L).toBe(5)
    expect(prof.muPmax).toBe(2)
    expect(profileAt(prof, 'muP', 2.5)).toBeCloseTo(2, 12)
    expect(profileAt(prof, 'muP', 0)).toBe(0)
    expect(profileAt(prof, 'muP', 0.25)).toBeCloseTo(0.5 * (4 * 2 * 0.1 * 0.9), 12) // mitad del primer tramo
  })
  it('invertir intercambia Mu+ y Mu−', () => {
    const p = memberProfile(parabola(2), 5, true)
    expect(p.muPmax).toBe(0); expect(p.muNmax).toBe(2)
  })
  it('exceedZones: cruces exactos sobre los tramos y pico', () => {
    const prof = memberProfile(parabola(2), 5)
    const z = exceedZones(prof, 'muP', 1.5)
    expect(z).toHaveLength(1)
    expect(z[0].peak).toBe(2); expect(z[0].peakX).toBe(2.5)
    // 4·2·ξ(1−ξ) = 1.5 → ξ = 0.25 / 0.75 exactos, pero lineal por tramos: cruce dentro del tramo 0.2–0.3
    expect(z[0].xa).toBeGreaterThan(1.0); expect(z[0].xa).toBeLessThan(1.5)
    expect(z[0].xb).toBeGreaterThan(3.5); expect(z[0].xb).toBeLessThan(4.0)
    expect(z[0].xb - 2.5).toBeCloseTo(2.5 - z[0].xa, 9) // simétrico
    expect(exceedZones(prof, 'muP', 5)).toEqual([])
    expect(exceedZones(prof, 'muN', 0.1)).toEqual([])
  })
  it('exceedZones: zona abierta en el apoyo (momento negativo en el extremo)', () => {
    const P = parseRamStations(T4)
    const prof = memberProfile(P.members.find((m) => m.id === '1107'), 4)
    const z = exceedZones(prof, 'muN', 1.412)
    expect(z[0].xa).toBe(0)
    expect(z[0].peakX).toBe(0)
    expect(z[0].peak).toBe(1.78)
    expect(z[0].xb).toBeGreaterThan(0); expect(z[0].xb).toBeLessThan(0.5)
  })
})

describe('longitud de desarrollo NTC-2017 §6.1.2.1', () => {
  it('#4 abajo con c = 3 cm: as·fy/(3c√f\'c) = 37.5 cm; arriba con >30 cm de concreto debajo ×1.3', () => {
    const d = developmentLength({ area: 1.27, db: 1.27, fy: 4200, fc: 250, c: 3 })
    expect(d.Ld).toBeCloseTo((1.27 * 4200) / (3 * 3 * Math.sqrt(250)), 9)
    expect(d.Lmin).toBeCloseTo((0.06 * 1.27 * 4200) / Math.sqrt(250), 9)
    expect(developmentLength({ area: 1.27, db: 1.27, c: 3, top: true, hBelow: 27 }).factor).toBe(1)
    expect(developmentLength({ area: 1.27, db: 1.27, c: 3, top: true, hBelow: 37 }).Ld).toBeCloseTo(d.Ld * 1.3, 9)
  })
  it('c + Ktr se acota a 2.5·db y rige el mínimo 0.06·db·fy/√f\'c cuando aplica', () => {
    const d = developmentLength({ area: 0.71, db: 0.95, c: 10 })
    expect(d.cEff).toBeCloseTo(2.5 * 0.95, 12)
    const big = developmentLength({ area: 5.07, db: 2.54, c: 20 }) // #8: cEff = 6.35 → Ldb = 5.07·4200/(3·6.35·15.8) = 70.7 ≥ mín 40.5
    expect(big.Ld).toBeGreaterThanOrEqual(big.Lmin)
  })
})

describe('bastones de un miembro', () => {
  const caps = sectionCapacities(secc())
  it('MR base sale de calcFlexion con las corridas y sin bastones', () => {
    const R = calcFlexion({ fc: 250, fy: 4200, b: 20, h: 30, r: 3, MuTm: 0.001, varNum: 4, varCount: 2, bastonNum: 4, bastonCount: 0 })
    expect(caps.MRP).toBeCloseTo(R.MRT, 12)
    expect(caps.inf.ext).toBe(27) // máx(d = 27, 12·1.27 = 15.2)
    expect(caps.okBase).toBe(true)
  })
  it('parábola que rebasa MR+: un bastón centrado, prolongado ≥ ext y ≥ Ld desde el pico, a múltiplos de 5 cm', () => {
    const MR = caps.MRP
    const prof = memberProfile(parabola(MR * 1.2), 6)
    const res = bastonesForLecho(prof, caps.inf, 'muP')
    expect(res.insuficiente).toBe(false)
    expect(res.bars).toHaveLength(1)
    const b = res.bars[0], z = res.zones[0]
    expect(b.k).toBe(1)
    expect(b.ancla).toBeNull()
    expect(b.x0).toBeLessThanOrEqual(Math.min(z.xa - 0.27, z.peakX - caps.inf.Ld.Ld / 100) + 1e-9)
    expect(b.x1).toBeGreaterThanOrEqual(Math.max(z.xb + 0.27, z.peakX + caps.inf.Ld.Ld / 100) - 1e-9)
    expect(Math.round(b.x0 * 100) % 5).toBe(0); expect(Math.round(b.x1 * 100) % 5).toBe(0)
    expect(b.len).toBeCloseTo(b.x1 - b.x0, 9)
    expect(b.MR).toBeGreaterThanOrEqual(z.peak)
  })
  it('dos bastones cuando uno no alcanza; insuficiente cuando ni con uno por varilla', () => {
    const MR1 = caps.inf.withK(1).MRT, MR2 = caps.inf.withK(2).MRT
    const r2 = bastonesForLecho(memberProfile(parabola((MR1 + MR2) / 2), 6), caps.inf, 'muP')
    expect(r2.bars[0].k).toBe(2)
    const r3 = bastonesForLecho(memberProfile(parabola(MR2 * 1.5), 6), caps.inf, 'muP')
    expect(r3.insuficiente).toBe(true)
    expect(r3.need[0].MRmax).toBeCloseTo(MR2, 9)
  })
  it('longitud mínima práctica y anclaje en apoyo', () => {
    const P = parseRamStations(T4)
    const c3 = sectionCapacities(secc({ calSup: '3', cantSup: 2, calBastonSup: '3', calInf: '3', cantInf: 2, calBastonInf: '3' }))
    const prof = memberProfile(P.members.find((m) => m.id === '1106'), 4) // Mu− 1.47 en el apoyo J
    const r = bastonesForLecho(prof, c3.sup, 'muN', { minLen: 0.6 })
    expect(r.bars).toHaveLength(1)
    expect(r.bars[0].ancla).toBe('J')
    expect(r.bars[0].x1).toBe(4)
    expect(r.bars[0].len).toBeGreaterThanOrEqual(0.6)
    const r0 = bastonesForLecho(prof, c3.sup, 'muN', { minLen: 0 })
    expect(r0.bars[0].len).toBeLessThan(0.6)
  })
})

describe('grupo completo con el T-4 real', () => {
  const P = parseRamStations(T4)
  it('con 2#4 corridas todo pasa sin bastón; uniforme = mismo armado', () => {
    const G = analyzeGroup(secc(), { members: P.members, L: 4 })
    expect(G.n).toBe(98)
    expect(G.nOk).toBe(98); expect(G.nBast).toBe(0); expect(G.nInsuf).toBe(0); expect(G.nShear).toBe(0)
    expect(G.allOk).toBe(true)
    expect(G.patterns).toHaveLength(1)
    expect(G.patterns[0].signature).toBe('base')
    expect(G.acero.mTotal).toBe(392)
    expect(G.acero.base).toBeCloseTo(392 * 4 * barWeight(1.27), 6)
    expect(G.acero.bastones).toBe(0)
    expect(G.acero.uniforme).toBeCloseTo(G.acero.base, 6)
  })
  it('con 2#3 corridas: 8 miembros necesitan bastón, el armado corrido no cumple As mín y se avisa', () => {
    const t = secc({ calSup: '3', cantSup: 2, calBastonSup: '3', calInf: '3', cantInf: 2, calBastonInf: '3' })
    const G = analyzeGroup(t, { members: P.members, L: 4, minLen: 0.6 })
    expect(G.caps.okBase).toBe(false) // 2#3 = 1.42 cm² < As mín 1.423
    expect(G.nBast).toBe(8); expect(G.nInsuf).toBe(0)
    expect(G.kMaxInf).toBe(1); expect(G.kMaxSup).toBe(1)
    expect(G.patterns.length).toBeGreaterThan(1)
    expect(G.patterns[0].signature).toBe('base'); expect(G.patterns[0].members).toHaveLength(90)
    const m1107 = G.results.find((r) => r.id === '1107')
    expect(m1107.status).toBe('baston')
    expect(m1107.sup.bars[0]).toMatchObject({ x0: 0, k: 1, ancla: 'I' })
    expect(m1107.sup.bars[0].len).toBeGreaterThanOrEqual(0.6)
    const m1060 = G.results.find((r) => r.id === '1060')
    expect(m1060.inf.bars[0].ancla).toBeNull() // pico al centro
    // uniforme (3#3 en ambos lechos) pesa más que corridas + bastones
    expect(G.uniforme.inf.n).toBe(3); expect(G.uniforme.sup.n).toBe(3)
    expect(G.acero.ahorro).toBeGreaterThan(0)
  })
  it('sin L el análisis no inventa metros', () => {
    const G = analyzeGroup(secc(), { members: P.members, L: 0 })
    expect(G.results.every((r) => r.L === 0)).toBe(true)
  })
  it('cortante por zonas: con estribos muy abiertos falla el centro', () => {
    const t = secc({ sepLcuarto: 8, sepRest: 60 })
    const r = analyzeMember(P.members.find((m) => m.id === '1107'), sectionCapacities(t), { L: 4 })
    expect(r.shear.extremos.ok).toBe(true)
    expect(r.shear.centro.s).toBe(60)
    // Vu al centro de M-1107 ≈ 2.5 t; Vr con @60 ≈ Vcr + poco → si falla debe proponer separación
    if (r.shear.centro.ok === false) expect(r.shear.centro.sReq).toBeGreaterThanOrEqual(6)
    expect(typeof r.shear.centro.Vr).toBe('number')
  })
})

describe('optimizador y aplicar', () => {
  const P = parseRamStations(T4)
  it('elige por lecho el armado de mínimo acero que cubre todos los miembros', () => {
    const opt = optimizeBase(secc(), { members: P.members, L: 4 }, { calibres: ['3', '4', '5'], nMax: 5 })
    expect(opt.best.inf).toBeTruthy(); expect(opt.best.sup).toBeTruthy()
    for (const k of ['inf', 'sup']) {
      const f = opt[k].feasible
      expect(f.every((r) => r.nInsuf === 0)).toBe(true)
      for (let i = 1; i < f.length; i++) expect(f[i].kg).toBeGreaterThanOrEqual(f[i - 1].kg)
      expect(f.some((r) => r.cal === '3' && r.n === 2)).toBe(false) // 2#3 no cumple As mín
    }
    const patch = applyBase(secc(), opt.best, 1, 0)
    expect(patch.cantInf).toBe(opt.best.inf.n); expect(patch.calInf).toBe(opt.best.inf.cal)
    expect(patch.cantBastonInf).toBe(1); expect(patch.cantBastonSup).toBe(0)
  })
  it('uniformDesign: no propone armados que no caben en el ancho', () => {
    const u = uniformDesign(secc({ ancho: 15, calInf: '8', calSup: '8' }), [{ profile: { muPmax: 30, muNmax: 30 } }])
    expect(u).toBeNull()
  })
})

describe('dibujos', () => {
  const P = parseRamStations(T4)
  const t = secc({ calSup: '3', cantSup: 2, calBastonSup: '3', calInf: '3', cantInf: 2, calBastonInf: '3' })
  const G = analyzeGroup(t, { members: P.members, L: 4 })
  it('alzado a escala real: la trabe mide L×h en px y trae bastones acotados', () => {
    const r = G.results.find((x) => x.id === '1107')
    const e = elevationSvg(t, r, { scale: 14 })
    expect(e.svg).toMatch(/<svg /)
    const m = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="#fff" stroke="#c4517a"/.exec(e.svg)
    expect(+m[3]).toBeCloseTo(400 * 14, 3)
    expect(+m[4]).toBeCloseTo(30 * 14, 3)
    expect(e.svg).toMatch(/1#3 L=\d\.\d\d m \(anclar en I\)/)
    expect(e.svg).toMatch(/2#3 corridas/)
    expect(e.svg).toMatch(/E#2\.5 @ 8/)
  })
  it('un alzado por patrón, apilados', () => {
    const g = elevationsGridSvg(t, G, 14)
    expect((g.inner.match(/patrón [A-Z]/g) || []).length).toBe(G.patterns.length)
    expect(g.H).toBeGreaterThan(G.patterns.length * 400)
  })
  it('diagrama con líneas MR y picos', () => {
    const r = G.results.find((x) => x.id === '1107')
    const d = diagramSvg(r, G.caps)
    expect(d).toMatch(/MR− corridas 1\.41/)
    expect(d).toMatch(/MR− con 1 bastón/)
    expect(d).toMatch(/Mu− 1\.78 @ 0\.00 m/)
    expect(d).toMatch(/Cortante/)
  })
})

describe('envolvente de resistencia desarrollada (rampas de Ld)', () => {
  const caps = sectionCapacities(secc())
  it('mrForAs reproduce el MRT de calcFlexion', () => {
    const R = calcFlexion({ fc: 250, fy: 4200, b: 20, h: 30, r: 3, MuTm: 0.001, varNum: 4, varCount: 3, bastonNum: 4, bastonCount: 0 })
    expect(mrForAs(caps, 3 * 1.27)).toBeCloseTo(R.MRT, 9)
    expect(mrForAs(caps, 0)).toBe(0)
  })
  it('sube linealmente en As a lo largo de Ld desde cada extremo y baja al final', () => {
    const prof = memberProfile(parabola(caps.MRP * 1.2), 6)
    const res = bastonesForLecho(prof, caps.inf, 'muP', { caps })
    const b = res.bars[0], Ld = caps.inf.Ld.Ld / 100
    const at = (x) => capacityAt(caps, caps.inf, res.bars, x, prof.L)
    expect(at(b.x0 - 0.01)).toBeCloseTo(caps.MRP, 9)          // antes del bastón: sólo corridas
    expect(at(b.x0)).toBeCloseTo(caps.MRP, 9)                 // en su extremo aún no aporta
    expect(at(b.x0 + Ld / 2)).toBeCloseTo(mrForAs(caps, caps.inf.base.AsTotal + 0.5 * 1.27), 9)
    expect(at(b.x0 + Ld)).toBeCloseTo(caps.inf.withK(1).MRT, 9) // desarrollado
    expect(at((b.x0 + b.x1) / 2)).toBeCloseTo(caps.inf.withK(1).MRT, 9)
    expect(at(b.x1 - Ld / 2)).toBeCloseTo(at(b.x0 + Ld / 2), 9) // simétrico
    expect(at(b.x1)).toBeCloseTo(caps.MRP, 9)
    const cap = capacityProfile(caps, caps.inf, res.bars, prof)
    expect(cap[0].x).toBe(0); expect(cap[cap.length - 1].x).toBe(prof.L)
    expect(cap.every((p, i) => i === 0 || p.x >= cap[i - 1].x)).toBe(true)
  })
  it('un bastón anclado en el apoyo se toma desarrollado desde el paño', () => {
    const P = parseRamStations(T4)
    const c3 = sectionCapacities(secc({ calSup: '3', cantSup: 2, calBastonSup: '3', calInf: '3', cantInf: 2, calBastonInf: '3' }))
    const prof = memberProfile(P.members.find((m) => m.id === '1107'), 4)
    const r = bastonesForLecho(prof, c3.sup, 'muN', { caps: c3 })
    expect(r.bars[0].ancla).toBe('I')
    expect(capacityAt(c3, c3.sup, r.bars, 0, 4)).toBeCloseTo(c3.sup.withK(1).MRT, 9)
  })
  it('tras colocar (y alargar si hace falta) Mu ≤ MR desarrollado en toda la longitud', () => {
    const P = parseRamStations(T4)
    for (const t of [secc(), secc({ calSup: '3', cantSup: 3, calBastonSup: '3', calInf: '3', cantInf: 2, calBastonInf: '3' })]) {
      const G = analyzeGroup(t, { members: P.members, L: 4 })
      for (const r of G.results) {
        if (r.status === 'insuficiente') continue
        expect(r.inf.capViol).toEqual([])
        expect(r.sup.capViol).toEqual([])
        expect(capacityViolations(G.caps, G.caps.inf, r.inf.bars, r.profile, 'muP')).toEqual([])
      }
    }
  })
  it('el diagrama dibuja la envolvente desarrollada como curva', () => {
    const P = parseRamStations(T4)
    const t = secc({ calSup: '3', cantSup: 2, calBastonSup: '3', calInf: '3', cantInf: 2, calBastonInf: '3' })
    const G = analyzeGroup(t, { members: P.members, L: 4 })
    const r = G.results.find((x) => x.id === '1107')
    const d = diagramSvg(r, G.caps)
    expect(d).toMatch(/envolvente desarrollada \(Ld/)
    expect(d).toMatch(/stroke-width="2.2"/)
  })
})
