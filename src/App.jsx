import { useRef, useCallback, useState, useEffect, useMemo } from 'react'
import TopBar from './components/TopBar'
import BeamForm from './components/BeamForm'
import BeamCanvas from './components/BeamCanvas'
import MomentScale from './components/MomentScale'
import CalculatorView from './components/CalculatorView'
import BDGlobalView from './components/BDGlobalView'
import ColumnsView from './components/ColumnsView'
import LongitudinalView from './components/LongitudinalView'
import MemoriaDialog from './components/MemoriaDialog'
import useBeamStore from './store/useBeamStore'
import useColumnStore from './store/useColumnStore'
import { svgToDxf } from './core/svgToDxf'
import { columnsGridSvg } from './core/columnsSvg'
import { generateReport } from './core/generateReport'
import { generateDetailedReport } from './core/generateDetailedHTML'
import { initGlobalDB, getDB, getStats, onDBChange } from './core/globalDB'
import { packProject, saveSnapshot, loadSnapshot, clearSnapshot, pushRecent, listRecents, timeAgo, debounce, isEmptyProject } from './core/autosave'
import { buildDcheck } from './core/dcheckExport'
import { analyzeGroup } from './core/longitudinal'

function download(content, filename, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Guardar en localStorage con un pequeño retraso para no escribir en cada tecla
const autosave = debounce((p) => saveSnapshot(p), 600)

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
  const [recents, setRecents] = useState(() => listRecents())
  const [toast, setToast] = useState(null)
  const restored = useRef(false)

  const showToast = useCallback((msg, tone = 'ok') => {
    setToast({ msg, tone })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // Init Global DB on mount
  useEffect(() => {
    initGlobalDB()
    setDbCount(getStats().total)
    return onDBChange(() => setDbCount(getStats().total))
  }, [])

  // ── Carga completa de un proyecto (archivo, reciente o autosave) ──
  const applyProject = useCallback((data) => {
    loadProject(Array.isArray(data.sections) ? data.sections : [])
    loadColumns(Array.isArray(data.columns) ? data.columns : [])
    setProjectName(data.projectName !== undefined ? data.projectName : '')
    if (data.dxfScale !== undefined) setDxfScale(data.dxfScale)
  }, [loadProject, loadColumns])

  // Recuperar la sesión anterior al arrancar
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const snap = loadSnapshot()
    if (!snap) return
    applyProject(snap)
    showToast(`Sesión recuperada · ${snap.sections?.length || 0} trabe(s), ${snap.columns?.length || 0} columna(s) · ${timeAgo(snap.savedAt)}`)
  }, [applyProject, showToast])

  // Autoguardado en cada cambio
  useEffect(() => {
    if (!restored.current) return
    autosave(packProject({ projectName, dxfScale, sections, columns }))
  }, [projectName, dxfScale, sections, columns])

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

    // (los alzados longitudinales se exportan aparte, desde la pestaña Longitudinal)
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
    const data = packProject({ projectName, dxfScale, sections, columns })
    download(JSON.stringify(data, null, 2), `${fileName}.json`, 'application/json')
    pushRecent(data)
    setRecents(listRecents())
  }, [projectName, dxfScale, sections, columns, fileName])

  const handleVerifyResumido = useCallback(() => {
    if (sections.length === 0 && columns.length === 0) return
    const doc = generateReport(sections, projectName, columns)
    doc.save(`${fileName}-verificacion.pdf`)
  }, [sections, columns, projectName, fileName])

  const handleVerifyDetallado = useCallback(() => {
    if (sections.length === 0 && columns.length === 0) return
    generateDetailedReport(sections, projectName, columns)
  }, [sections, columns, projectName])

  // Double Check prellenado (nombres, resistencias y demandas); sólo faltan las capturas
  const handleExportDcheck = useCallback(() => {
    if (sections.length === 0 && columns.length === 0) return
    const data = buildDcheck({ projectName, sections, columns })
    const stamp = (projectName.trim() || 'proyecto').replace(/\s+/g, '_')
    download(JSON.stringify(data), `DoubleCheck_${stamp}.dcheck`, 'application/json')
    showToast(`Double Check exportado · ${data.sections.length} elemento(s) prellenados; falta añadir las capturas`)
  }, [sections, columns, projectName, showToast])

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
          applyProject(data)
          pushRecent({ ...data, savedAt: new Date().toISOString() })
          setRecents(listRecents())
          showToast(`Proyecto abierto · ${data.sections.length} trabe(s), ${(data.columns || []).length} columna(s)`)
        } else {
          alert('El archivo no tiene secciones. Verifica que sea un proyecto de Auxiliar IV.')
        }
      } catch {
        alert('No se pudo leer el archivo. Verifica que sea un JSON válido.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [applyProject, showToast])

  const handleOpenRecent = useCallback((name) => {
    const r = listRecents().find((x) => x.name === name)
    if (!r?.project) return
    applyProject(r.project)
    showToast(`Proyecto reciente "${name}" abierto`)
  }, [applyProject, showToast])

  const handleNew = useCallback(() => {
    const current = packProject({ projectName, dxfScale, sections, columns })
    if (!isEmptyProject(current) && !confirm('¿Empezar un proyecto nuevo? Lo que hay ahora queda en "Recientes" (y en tu último .json guardado).')) return
    if (!isEmptyProject(current)) { pushRecent(current); setRecents(listRecents()) }
    applyProject({ sections: [], columns: [], projectName: '', dxfScale: 1 })
    clearSnapshot()
    setMainTab('detalle')
  }, [projectName, dxfScale, sections, columns, applyProject])

  const tabBtn = (id, label, badge) => (
    <button onClick={() => setMainTab(id)}
      className="px-4 py-1.5 text-sm font-medium rounded-t-lg transition-colors"
      style={{
        background: mainTab === id ? 'var(--color-surface)' : 'transparent',
        color: mainTab === id ? 'var(--color-accent)' : 'var(--color-muted)',
        borderBottom: mainTab === id ? '2px solid var(--color-accent)' : '2px solid transparent',
        position: 'relative',
      }}>
      {label}
      {badge}
    </button>
  )
  const pill = (n, tone) => (
    <span style={{
      marginLeft: 6, fontSize: 10, fontFamily: 'var(--font-mono)',
      background: tone === 'bad' ? '#c62828' : (mainTab === 'x' ? 'var(--color-accent)' : 'var(--color-border)'),
      color: tone === 'bad' ? '#fff' : 'var(--color-tx2)',
      padding: '1px 6px', borderRadius: 99,
    }}>{n}</span>
  )

  // Trabes con perfil por estaciones cargado (pestaña Longitudinal)
  const longStats = useMemo(() => {
    let n = 0, bad = 0
    for (const t of sections) {
      if (!t.perfil?.members?.length) continue
      n++
      try { const g = analyzeGroup(t, t.perfil); if (!g.allOk || !g.caps.okBase) bad++ } catch { bad++ }
    }
    return { n, bad }
  }, [sections])

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--color-bg)' }}>
      <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
      {toast && (
        <div style={{
          position: 'fixed', top: 56, right: 14, zIndex: 2000,
          padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)',
          background: toast.tone === 'ok' ? '#f0fdf4' : '#fffbeb',
          border: `1.5px solid ${toast.tone === 'ok' ? '#86efac' : '#fcd34d'}`,
          color: toast.tone === 'ok' ? '#15803d' : '#92400e', boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
        }}>{toast.msg}</div>
      )}
      <TopBar
        onExportDxf={handleExportDxf} onExportSvg={handleExportSvg}
        onSave={handleSave} onOpen={handleOpen} onNew={handleNew}
        recents={recents} onOpenRecent={handleOpenRecent}
        onVerifyResumido={handleVerifyResumido} onVerifyDetallado={handleVerifyDetallado}
        onMemoria={() => setMemoriaOpen(true)} onExportDcheck={handleExportDcheck}
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
        {tabBtn('detalle', 'Detalle')}
        {tabBtn('calculo', 'Calculo', calcAlert && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 8, height: 8, borderRadius: '50%',
            background: '#ef4444', border: '1.5px solid var(--color-bg)',
          }} />
        ))}
        {tabBtn('columnas', 'Columnas', columns.length > 0 && pill(columns.length))}
        {tabBtn('longitudinal', 'Longitudinal', longStats.n > 0 && (
          <>
            {pill(longStats.n)}
            {longStats.bad > 0 && (
              <span title={`${longStats.bad} trabe(s) con miembros insuficientes o armado corrido que no cumple`} style={{
                position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: '50%',
                background: '#ef4444', border: '1.5px solid var(--color-bg)',
              }} />
            )}
          </>
        ))}
        {tabBtn('bdglobal', 'BD Global', dbCount > 0 && pill(dbCount.toLocaleString()))}
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
      <div className="flex-1 overflow-hidden" style={{ display: mainTab === 'longitudinal' ? 'flex' : 'none', flexDirection: 'column' }}>
        <LongitudinalView dxfScale={dxfScale} projectName={projectName} />
      </div>
      <div className="flex-1 overflow-hidden" style={{ display: mainTab === 'bdglobal' ? 'flex' : 'none', flexDirection: 'column' }}>
        <BDGlobalView />
      </div>
    </div>
  )
}
