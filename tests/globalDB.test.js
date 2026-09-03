import { describe, it, expect, beforeAll } from 'vitest'
import { initGlobalDB, matchSection, getDB, calcGID, smartSuggestions } from '../src/core/globalDB.js'

beforeAll(() => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  initGlobalDB()
})

describe('BD Global', () => {
  it('carga la BD de fábrica', () => {
    expect(getDB().ready).toBe(true)
    expect(getDB().vigas.length).toBeGreaterThan(7000)
  })

  it('calcGID es estable y distingue bastones', () => {
    const a = { b: 15, h: 20, MuP: 0.5, MuN: 0.5, nP: 2, vP: 3, nN: 2, vN: 3 }
    expect(calcGID(a)).toBe(calcGID({ ...a }))
    expect(calcGID(a)).not.toBe(calcGID({ ...a, bP: [1, 3] }))
  })

  it('matchSection: empate exacto de una viga de fábrica', () => {
    const v = getDB().vigas.find((x) => !x.bP && !x.bN)
    const sec = { ancho: v.b, peralte: v.h, cantInf: v.nP, calInf: String(v.vP), cantSup: v.nN, calSup: String(v.vN), cantBastonInf: 0, cantBastonSup: 0 }
    const m = matchSection(sec)
    expect(m.status).toBe('db_match')
    expect(m.entry.b).toBe(v.b)
  })

  it('matchSection parcial: elige la viga de misma b×h con el As total más cercano', () => {
    // Armado que no existe en la BD: 15×20 con 7#3 / 7#3
    const sec = { ancho: 15, peralte: 20, cantInf: 7, calInf: '3', cantSup: 7, calSup: '3', cantBastonInf: 0, cantBastonSup: 0 }
    const m = matchSection(sec)
    expect(m.status).toBe('db_partial')
    const asSec = 14 * 0.71
    const asOf = (v) => (v.nP * 0.71 * (v.vP === 3) || v.AsP) + (v.AsN || 0)
    const cand = getDB().vigas.filter((v) => v.b === 15 && v.h === 20)
    const best = Math.min(...cand.map((v) => Math.abs((v.AsP + v.AsN) - asSec)))
    expect(Math.abs((m.entry.AsP + m.entry.AsN) - asSec)).toBeCloseTo(best, 6)
    void asOf
  })

  it('smartSuggestions devuelve hasta 3 opciones que cubren los momentos', () => {
    const s = smartSuggestions(1.5, 2.0)
    expect(s.length).toBeGreaterThan(0)
    expect(s.length).toBeLessThanOrEqual(3)
    for (const v of s) { expect(v.MRT_P).toBeGreaterThanOrEqual(1.5); expect(v.MRT_N).toBeGreaterThanOrEqual(2.0) }
    expect(s.map((v) => v.tag)).toContain('h mín')
  })
})
