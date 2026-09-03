import { describe, it, expect, beforeEach, vi } from 'vitest'
import { packProject, saveSnapshot, loadSnapshot, clearSnapshot, pushRecent, listRecents, removeRecent, isEmptyProject, timeAgo, debounce, PROJECT_VERSION } from '../src/core/autosave.js'

// localStorage mínimo en memoria
function memStorage() {
  let m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
    clear: () => { m = new Map() },
  }
}

beforeEach(() => { globalThis.localStorage = memStorage() })

describe('autosave', () => {
  const sec = { nombre: 'T-1', ancho: 20, peralte: 30 }

  it('packProject etiqueta versión y fecha', () => {
    const p = packProject({ projectName: 'X', dxfScale: 10, sections: [sec], columns: [], model: null })
    expect(p.version).toBe(PROJECT_VERSION)
    expect(p.projectName).toBe('X')
    expect(Date.parse(p.savedAt)).toBeGreaterThan(0)
  })

  it('guarda y recupera; un proyecto vacío borra el snapshot', () => {
    expect(loadSnapshot()).toBeNull()
    saveSnapshot(packProject({ projectName: 'X', sections: [sec] }))
    expect(loadSnapshot()?.sections).toHaveLength(1)
    saveSnapshot(packProject({ sections: [], columns: [] }))
    expect(loadSnapshot()).toBeNull()
    saveSnapshot(packProject({ projectName: 'Y', sections: [sec] }))
    clearSnapshot()
    expect(loadSnapshot()).toBeNull()
  })

  it('isEmptyProject considera el modelo cargado como contenido', () => {
    expect(isEmptyProject({ sections: [], columns: [], model: { points: [{}] } })).toBe(false)
    expect(isEmptyProject({ sections: [], columns: [], model: null })).toBe(true)
  })

  it('recientes: sin duplicados por nombre, el más nuevo primero, máximo 6', () => {
    for (let i = 1; i <= 8; i++) pushRecent(packProject({ projectName: `P${i}`, sections: [sec] }))
    let l = listRecents()
    expect(l).toHaveLength(6)
    expect(l[0].name).toBe('P8')
    pushRecent(packProject({ projectName: 'P8', sections: [sec, sec] }))
    l = listRecents()
    expect(l.filter((r) => r.name === 'P8')).toHaveLength(1)
    expect(l[0].trabes).toBe(2)
    removeRecent('P8')
    expect(listRecents().some((r) => r.name === 'P8')).toBe(false)
  })

  it('sin localStorage no revienta', () => {
    globalThis.localStorage = { getItem() { throw new Error('nope') }, setItem() { throw new Error('nope') }, removeItem() { throw new Error('nope') } }
    expect(saveSnapshot(packProject({ sections: [sec] }))).toBe(false)
    expect(loadSnapshot()).toBeNull()
    expect(listRecents()).toEqual([])
  })

  it('timeAgo y debounce', () => {
    expect(timeAgo(new Date(Date.now() - 5 * 60000).toISOString())).toBe('hace 5 min')
    expect(timeAgo('')).toBe('')
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d(1); d(2); d(3)
    vi.advanceTimersByTime(150)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(3)
    d.flush(9)
    expect(fn).toHaveBeenLastCalledWith(9)
    vi.useRealTimers()
  })
})
