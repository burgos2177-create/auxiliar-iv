import { useRef, useCallback, useState, useEffect } from 'react'
import TopBar from './components/TopBar'
import BeamForm from './components/BeamForm'
import BeamCanvas from './components/BeamCanvas'
import MomentScale from './components/MomentScale'
import CalculatorView from './components/CalculatorView'
import BDGlobalView from './components/BDGlobalView'
import ColumnsView from './components/ColumnsView'
import MemoriaDialog from './components/MemoriaDialog'
import useBeamStore from './store/useBeamStore'
import useColumnStore from './store/useColumnStore'
import { svgToDxf } from './core/svgToDxf'
import { columnsGridSvg } from './core/columnsSvg'
import { generateReport } from './core/generateReport'
import { generateDetailedReport } from './core/generateDetailedHTML'
import { initGlobalDB, getDB, getStats, onDBChange } from './core/globalDB'

function download(content, filename, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function App() {
  const svgRef = useRef(null)
  const fileInputRef = useRef(null)
  const sections = useBeamStore((s) => s.sections)
  const loadProject = useBeamStore((s) => s.loadProject)
  const calcAlert = useBeamStore((s) => s.calcAlert)
  const columns = useColumnStore((s) => s.columns)
  const loadColumns = useColumnStore((s) => s.loadColumns)
  const [dxfScale, setDxfScale] = useState(1)
  const [projectName, setProjectName] = useState('')
  const [mainTab, setMainTab] = useState('detalle')
  const [dbCount, setDbCount] = useState(0)
  const [memoriaOpen, setMemoriaOpen] = useState(false)

  // Init Global DB on mount
  useEffect(() => {
    initGlobalDB()
    setDbCount(getStats().total)
    return onDBChange(() => setDbCount(getStats().total))
  }, [])

  // SVG de export: vigas (canvas en vivo) + columnas (grid generado),
  // apiladas en un solo documento a 14 px/cm. Con forDxf=true el ancho/alto
  // van en cm para que svgToDxf deduzca la escala física real.
  const getSvgString = useCallback((forDxf = false) => {
    const el = svgRef.current
    const hasBeams = sections.length > 0 && el
    const grid = columns.length > 0 ? columnsGridSvg(columns, 14) : { inner: '', W: 0, H: 0 }
    if (!hasBeams && !grid.inner) return null

    let beamsInner = ''
    let wB = 0, hB = 0
    if (hasBeams) {
      wB = parseFloat(el.getAttribute('width')) || 0
      hB = parseFloat(el.getAttribute('height')) || 0
      const str = new XMLSerializer().serializeToString(el)
      beamsInner = str.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
    }

    const W = Math.max(wB, grid.W)
    const H = hB + grid.H
    const wCm = (W / 14).toFixed(4)
    const hCm = (H / 14).toFixed(4)
    const size = forDxf ? `width="${wCm}cm" height="${hCm}cm"` : `width="${W}" height="${H}"`
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${size} ` +
      `data-real-width-cm="${wCm}" data-real-height-cm="${hCm}" style="font-family:'DM Mono',monospace">` +
      beamsInner +
      (grid.inner ? `<g transform="translate(0,${hB})">${grid.inner}</g>` : '') +
      `</svg>`
  }, [sections.length, columns])

  const fileName = projectName.trim()
    ? `secciones-${projectName.trim().replace(/\s+/g, '-')}`
    : 'secciones'

  const handleExportSvg = useCallback(() => {
    const str = getSvgString(false)
    if (!str) return
    download(str, `${fileName}.svg`, 'image/svg+xml')
  }, [getSvgString, fileName])

  const handleExportDxf = useCallback(() => {
    const str = getSvgString(true)
    if (!str) return
    const dxf = svgToDxf(str, { scaleFactor: dxfScale })
    download(dxf, `${fileName}.dxf`, 'application/dxf')
  }, [getSvgString, dxfScale, fileName])

  const handleSave = useCallback(() => {
    const data = { version: 2, projectName, dxfScale, sections, columns }
    download(JSON.stringify(data, null, 2), `${fileName}.json`, 'application/json')
  }, [projectName, dxfScale, sections, columns, fileName])

  const handleVerifyResumido = useCallback(() => {
    if (sections.length === 0) return
    const doc = generateReport(sections, projectName)
    doc.save(`${fileName}-verificacion.pdf`)
  }, [sections, projectName, fileName])

  const handleVerifyDetallado = useCallback(() => {
    if (sections.length === 0) return
    generateDetailedReport(sections, projectName)
  }, [sections, projectName])

  const handleOpen = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (data.sections && Array.isArray(data.sections)) {
          loadProject(data.sections)
          loadColumns(Array.isArray(data.columns) ? data.columns : [])
          if (data.projectName !== undefined) setProjectName(data.projectName)
          if (data.dxfScale !== undefined) setDxfScale(data.dxfScale)
        }
      } catch {
        alert('No se pudo leer el archivo. Verifica que sea un JSON válido.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [loadProject, loadColumns])

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--color-bg)' }}>
      <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
      <TopBar
        onExportDxf={handleExportDxf} onExportSvg={handleExportSvg}
        onSave={handleSave} onOpen={handleOpen} onVerifyResumido={handleVerifyResumido} onVerifyDetallado={handleVerifyDetallado}
        onMemoria={() => setMemoriaOpen(true)}
        dxfScale={dxfScale} setDxfScale={setDxfScale}
        projectName={projectName} setProjectName={setProjectName}
      />
      <MemoriaDialog
        open={memoriaOpen}
        onClose={() => setMemoriaOpen(false)}
        sections={sections}
        projectName={projectName}
      />
      <div className="flex items-center gap-1 px-4 pt-2" style={{ background: 'var(--color-bg)' }}>
        <button onClick={() => setMainTab('detalle')}
          className="px-4 py-1.5 text-sm font-medium rounded-t-lg transition-colors"
          style={{
            background: mainTab === 'detalle' ? 'var(--color-surface)' : 'transparent',
            color: mainTab === 'detalle' ? 'var(--color-accent)' : 'var(--color-muted)',
            borderBottom: mainTab === 'detalle' ? '2px solid var(--color-accent)' : '2px solid transparent',
          }}>
          Detalle
        </button>
        <button onClick={() => setMainTab('calculo')}
          className="px-4 py-1.5 text-sm font-medium rounded-t-lg transition-colors"
          style={{
            background: mainTab === 'calculo' ? 'var(--color-surface)' : 'transparent',
            color: mainTab === 'calculo' ? 'var(--color-accent)' : 'var(--color-muted)',
            borderBottom: mainTab === 'calculo' ? '2px solid var(--color-accent)' : '2px solid transparent',
            position: 'relative',
          }}>
          Calculo
          {calcAlert && (
            <span style={{
              position: 'absolute', top: 2, right: 2,
              width: 8, height: 8, borderRadius: '50%',
              background: '#ef4444', border: '1.5px solid var(--color-bg)',
            }} />
          )}
        </button>
        <button onClick={() => setMainTab('columnas')}
          className="px-4 py-1.5 text-sm font-medium rounded-t-lg transition-colors"
          style={{
            background: mainTab === 'columnas' ? 'var(--color-surface)' : 'transparent',
            color: mainTab === 'columnas' ? 'var(--color-accent)' : 'var(--color-muted)',
            borderBottom: mainTab === 'columnas' ? '2px solid var(--color-accent)' : '2px solid transparent',
          }}>
          Columnas
          {columns.length > 0 && (
            <span style={{
              marginLeft: 6, fontSize: 10, fontFamily: 'var(--font-mono)',
              background: mainTab === 'columnas' ? 'var(--color-accent)' : 'var(--color-border)',
              color: mainTab === 'columnas' ? '#fff' : 'var(--color-tx2)',
              padding: '1px 6px', borderRadius: 99,
            }}>{columns.length}</span>
          )}
        </button>
        <button onClick={() => setMainTab('bdglobal')}
          className="px-4 py-1.5 text-sm font-medium rounded-t-lg transition-colors"
          style={{
            background: mainTab === 'bdglobal' ? 'var(--color-surface)' : 'transparent',
            color: mainTab === 'bdglobal' ? 'var(--color-accent)' : 'var(--color-muted)',
            borderBottom: mainTab === 'bdglobal' ? '2px solid var(--color-accent)' : '2px solid transparent',
            position: 'relative',
          }}>
          BD Global
          {dbCount > 0 && (
            <span style={{
              marginLeft: 6, fontSize: 10, fontFamily: 'var(--font-mono)',
              background: mainTab === 'bdglobal' ? 'var(--color-accent)' : 'var(--color-border)',
              color: mainTab === 'bdglobal' ? '#fff' : 'var(--color-tx2)',
              padding: '1px 6px', borderRadius: 99,
            }}>{dbCount.toLocaleString()}</span>
          )}
        </button>
      </div>
      <div className="flex flex-1 overflow-hidden" style={{ display: mainTab === 'detalle' ? 'flex' : 'none' }}>
        <BeamForm />
        <BeamCanvas sections={sections} svgRef={svgRef} />
        <MomentScale />
      </div>
      <div className="flex-1 overflow-auto" style={{ display: mainTab === 'calculo' ? 'block' : 'none' }}>
        <CalculatorView />
      </div>
      <div className="flex-1 overflow-hidden" style={{ display: mainTab === 'columnas' ? 'flex' : 'none', flexDirection: 'column' }}>
        <ColumnsView />
      </div>
      <div className="flex-1 overflow-hidden" style={{ display: mainTab === 'bdglobal' ? 'flex' : 'none', flexDirection: 'column' }}>
        <BDGlobalView />
      </div>
    </div>
  )
}
