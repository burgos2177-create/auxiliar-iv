import { useRef, useCallback, useState, useEffect } from 'react'
import TopBar from './components/TopBar'
import BeamForm from './components/BeamForm'
import BeamCanvas from './components/BeamCanvas'
import MomentScale from './components/MomentScale'
import CalculatorView from './components/CalculatorView'
import BDGlobalView from './components/BDGlobalView'
import useBeamStore from './store/useBeamStore'
import { svgToDxf } from './core/svgToDxf'
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
  const [dxfScale, setDxfScale] = useState(1)
  const [projectName, setProjectName] = useState('')
  const [mainTab, setMainTab] = useState('detalle')
  const [dbCount, setDbCount] = useState(0)

  // Init Global DB on mount
  useEffect(() => {
    initGlobalDB()
    setDbCount(getStats().total)
    return onDBChange(() => setDbCount(getStats().total))
  }, [])

  // Serialize SVG; when forDxf=true, swap width/height to cm units
  const getSvgString = useCallback((forDxf = false) => {
    const el = svgRef.current
    if (!el) return null
    const serializer = new XMLSerializer()
    let str = serializer.serializeToString(el)
    if (!str.includes('xmlns')) {
      str = str.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
    }
    if (forDxf) {
      const wCm = el.getAttribute('data-real-width-cm')
      const hCm = el.getAttribute('data-real-height-cm')
      if (wCm && hCm) {
        // Replace numeric width/height with cm values for correct DXF scaling
        str = str
          .replace(/\bwidth="[\d.]+"/, `width="${wCm}cm"`)
          .replace(/\bheight="[\d.]+"/, `height="${hCm}cm"`)
      }
    }
    return str
  }, [])

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
    const data = { version: 1, projectName, dxfScale, sections }
    download(JSON.stringify(data, null, 2), `${fileName}.json`, 'application/json')
  }, [projectName, dxfScale, sections, fileName])

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
          if (data.projectName !== undefined) setProjectName(data.projectName)
          if (data.dxfScale !== undefined) setDxfScale(data.dxfScale)
        }
      } catch {
        alert('No se pudo leer el archivo. Verifica que sea un JSON válido.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [loadProject])

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--color-bg)' }}>
      <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
      <TopBar
        onExportDxf={handleExportDxf} onExportSvg={handleExportSvg}
        onSave={handleSave} onOpen={handleOpen} onVerifyResumido={handleVerifyResumido} onVerifyDetallado={handleVerifyDetallado}
        dxfScale={dxfScale} setDxfScale={setDxfScale}
        projectName={projectName} setProjectName={setProjectName}
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
      <div className="flex-1 overflow-hidden" style={{ display: mainTab === 'bdglobal' ? 'flex' : 'none', flexDirection: 'column' }}>
        <BDGlobalView />
      </div>
    </div>
  )
}
