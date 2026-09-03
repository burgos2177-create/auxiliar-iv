import { describe, it, expect } from 'vitest'
import { svgToDxf } from '../src/core/svgToDxf.js'
import { columnsGridSvg, columnSectionSvgString } from '../src/core/columnsSvg.js'
import { sectionSvgString } from '../src/core/sectionSvg.js'
import { bdLookup } from '../src/core/columnCalculator.js'

// Extrae las coordenadas X/Y de todas las entidades del DXF (códigos 10/20 y 11/21)
function extents(dxf) {
  // sólo la sección ENTITIES (el HEADER trae $EXTMAX/$LIMMAX con códigos 10/20)
  const ent = dxf.slice(dxf.indexOf('ENTITIES'))
  const lines = ent.split(/\r?\n/)
  const xs = [], ys = []
  // El DXF es una lista de pares (código, valor): recorrer de dos en dos para
  // no confundir un valor "11" (color ACI) con el código 11
  for (let i = 1; i < lines.length - 1; i += 2) {
    const code = lines[i].trim()
    if (code === '10' || code === '11') xs.push(parseFloat(lines[i + 1]))
    if (code === '20' || code === '21') ys.push(parseFloat(lines[i + 1]))
  }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

describe('svgToDxf', () => {
  it('genera un DXF R12 válido con capas', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="10cm" height="10cm" data-real-width-cm="10" data-real-height-cm="10"><rect x="0" y="0" width="140" height="140" fill="none" stroke="#c4517a"/></svg>`
    const dxf = svgToDxf(svg)
    expect(dxf).toMatch(/SECTION[\s\S]*ENTITIES[\s\S]*EOF/)
    expect(dxf).toMatch(/AC1009/)
  })

  it('un rectángulo de 30×30 cm a 14 px/cm mide 30.0000 en el DXF', () => {
    const W = 30 * 14
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="30cm" height="30cm" data-real-width-cm="30" data-real-height-cm="30"><rect x="0" y="0" width="${W}" height="${W}" fill="none" stroke="#c4517a" stroke-width="2"/></svg>`
    const e = extents(svgToDxf(svg))
    expect(e.maxX - e.minX).toBeCloseTo(30, 3)
    expect(e.maxY - e.minY).toBeCloseTo(30, 3)
  })

  it('columna 25×40: la sección exportada conserva sus dimensiones físicas', () => {
    const col = { nombre: 'C-1', b: 25, h: 40, r: 3, fc: 250, fy: 4200, lechos: [{ n: 3, num: '4' }, { n: 3, num: '4' }], estriboNum: '3' }
    const grid = columnsGridSvg([col], 14)
    const wCm = (grid.W / 14).toFixed(4), hCm = (grid.H / 14).toFixed(4)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${grid.W} ${grid.H}" width="${wCm}cm" height="${hCm}cm" data-real-width-cm="${wCm}" data-real-height-cm="${hCm}">${grid.inner}</svg>`
    const dxf = svgToDxf(svg)
    // Comprobación directa sobre el SVG generado: rect de concreto de 25×40 cm
    const m = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*stroke="#c4517a"/.exec(grid.inner)
    expect(m).not.toBeNull()
    expect(+m[3] / 14).toBeCloseTo(25, 6)
    expect(+m[4] / 14).toBeCloseTo(40, 6)
    expect(dxf).toContain('POLYLINE')
  })

  it('estribo de columna tangente al paño de la varilla de esquina (como en vigas)', () => {
    const col = { nombre: 'C-1', b: 30, h: 30, r: 3, fc: 250, fy: 4200, lechos: [{ n: 3, num: '4' }, { n: 3, num: '4' }], estriboNum: '2.5' }
    const svg = columnSectionSvgString(col, 14)
    const conc = /<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"[^>]*stroke="#c4517a"/.exec(svg)
    const est = /<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"[^>]*stroke="#1a7a5e"/.exec(svg)
    expect(conc).not.toBeNull(); expect(est).not.toBeNull()
    const insetCm = (+est[1] - +conc[1]) / 14
    const rCorner = bdLookup(4).diam / 2
    expect(insetCm).toBeCloseTo(3 - rCorner, 4) // 2.365 cm → el estribo abraza la varilla, no la corta
  })

  it('la sección de una trabe con 4 bastones se exporta con sus círculos', () => {
    const t = { nombre: 'T-6', ancho: 20, peralte: 30, recub: 3, calSup: '5', cantSup: 4, calInf: '5', cantInf: 3, calBastonSup: '5', cantBastonSup: 4, calBastonInf: '5', cantBastonInf: 0, calEst: '2.5', fc: 250, sepLcuarto: 8, sepRest: 16 }
    const svg = sectionSvgString(t, { scale: 14 })
    expect((svg.match(/<circle/g) || []).length).toBe(4 + 3 + 4)
    const dxf = svgToDxf(svg.replace('<svg ', '<svg data-real-width-cm="10" data-real-height-cm="10" '))
    expect((dxf.match(/\nCIRCLE\n/g) || []).length).toBeGreaterThanOrEqual(11)
  })
})
