import { useState, useEffect, useRef, useCallback } from 'react'
import useBeamStore from '../store/useBeamStore'
import {
  getDB, getStats, onDBChange, mergeDB, clearUserVigas,
  exportDB, searchByMoments, getAvailableDims,
} from '../core/globalDB'

function StatCard({ label, value, sub }) {
  return (
    <div style={{
      background: 'var(--color-bg)', border: '1px solid var(--color-border)',
      borderRadius: 6, padding: '10px 14px', minWidth: 120,
    }}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em',
        color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function ResultCard({ d, MuP, MuN, onUse, isBest }) {
  const rP = MuP > 0 ? (MuP / d.MRT_P) : 0
  const rN = MuN > 0 ? (MuN / d.MRT_N) : 0
  const rMax = Math.max(rP, rN)
  const rCol = rMax >= 0.88 ? '#15803d' : rMax >= 0.70 ? '#b47814' : '#2563a8'

  return (
    <div style={{
      background: isBest ? '#f0fdf4' : 'var(--color-bg)',
      border: `1.5px solid ${isBest ? '#86efac' : 'var(--color-border)'}`,
      borderRadius: 6, padding: '10px 14px', cursor: 'pointer',
      transition: 'border-color 0.15s',
    }} onClick={() => onUse(d)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontWeight: 800, fontSize: 14 }}>{d.b}×{d.h} cm</span>
        {isBest && <span style={{
          fontSize: 9, fontWeight: 700, background: '#15803d', color: '#fff',
          padding: '2px 8px', borderRadius: 99, fontFamily: 'var(--font-mono)',
        }}>ÓPTIMA</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        <span style={{ color: 'var(--color-steel-bot)' }}>M+ {d.nP}×#{d.vP}{d.bP ? ` +${d.bP[0]}×#${d.bP[1]}` : ''}</span>
        <span>As+ {d.AsP} cm²</span>
        <span style={{ color: 'var(--color-steel-top)' }}>M− {d.nN}×#{d.vN}{d.bN ? ` +${d.bN[0]}×#${d.bN[1]}` : ''}</span>
        <span>As− {d.AsN} cm²</span>
        <span>Ratio máx</span>
        <span style={{ color: rCol, fontWeight: 700 }}>{rMax.toFixed(3)}</span>
        <span>As total</span>
        <span>{(d.AsP + d.AsN).toFixed(2)} cm²</span>
      </div>
      <div style={{
        marginTop: 6, fontSize: 10, color: 'var(--color-accent2)',
        fontWeight: 600, textAlign: 'right',
      }}>← Usar en proyecto</div>
    </div>
  )
}

export default function BDGlobalView() {
  const form = useBeamStore((s) => s.form)
  const setForm = useBeamStore((s) => s.setForm)
  const selectedIdx = useBeamStore((s) => s.selectedIdx)
  const sections = useBeamStore((s) => s.sections)

  const [stats, setStats] = useState({ total: 0, fabrica: 0, usuario: 0 })
  const [dims, setDims] = useState({ bs: [], hs: [] })
  const [searchMuP, setSearchMuP] = useState('')
  const [searchMuN, setSearchMuN] = useState('')
  const [restrictB, setRestrictB] = useState(new Set())
  const [restrictH, setRestrictH] = useState(new Set())
  const [results, setResults] = useState([])
  const [searchMsg, setSearchMsg] = useState('')
  const [toast, setToast] = useState(null)
  const iframeRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    setStats(getStats())
    setDims(getAvailableDims())
    return onDBChange(() => { setStats(getStats()); setDims(getAvailableDims()) })
  }, [])

  function toggleRestrict(type, val) {
    const setter = type === 'b' ? setRestrictB : setRestrictH
    setter(prev => {
      const next = new Set(prev)
      if (next.has(val)) next.delete(val); else next.add(val)
      return next
    })
  }

  // Send DB to iframe when it loads
  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const db = getDB()
    iframe.contentWindow.postMessage({ type: 'LOAD_DB', payload: { vigas: db.vigas, meta: db.meta } }, '*')
    // Also highlight current section
    if (form.ancho && form.peralte) {
      iframe.contentWindow.postMessage({ type: 'HIGHLIGHT_SEC', payload: { b: +form.ancho, h: +form.peralte } }, '*')
    }
  }, [form.ancho, form.peralte])

  // Listen for USE_SECTION from MallaVigas iframe
  useEffect(() => {
    function handler(e) {
      if (e.data?.type === 'USE_SECTION') {
        applyVigaToForm(e.data.payload)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [selectedIdx, sections]) // eslint-disable-line

  function applyVigaToForm(d) {
    if (selectedIdx < 0) {
      showToast('Selecciona una sección primero', 'warn')
      return
    }
    const patch = {
      ancho: d.b,
      peralte: d.h,
      cantInf: d.nP,
      calInf: String(d.vP),
      cantSup: d.nN,
      calSup: String(d.vN),
      cantBastonInf: d.bP ? d.bP[0] : 0,
      calBastonInf: d.bP ? String(d.bP[1]) : '3',
      cantBastonSup: d.bN ? d.bN[0] : 0,
      calBastonSup: d.bN ? String(d.bN[1]) : '3',
      muPos: d.MuP || '',
      muNeg: d.MuN || '',
    }
    setForm(patch)
    showToast(`Sección ${d.b}×${d.h} aplicada`, 'ok')
  }

  function showToast(msg, type = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Send full DB to iframe (refresh heatmap with new vigas)
  function handleRefreshHeatmap() {
    const iframe = iframeRef.current
    if (!iframe) return
    const db = getDB()
    iframe.contentWindow.postMessage({ type: 'LOAD_DB', payload: { vigas: db.vigas, meta: db.meta } }, '*')
    showToast(`Heatmap actualizado · ${db.vigas.length} vigas`, 'ok')
  }

  function handleSearch() {
    const MuP = +searchMuP || 0
    const MuN = +searchMuN || 0
    if (MuP <= 0 && MuN <= 0) { setSearchMsg('Ingresa al menos un Mu'); setResults([]); return }
    const res = searchByMoments(MuP, MuN, {
      limit: 12,
      restrictB: restrictB.size > 0 ? restrictB : null,
      restrictH: restrictH.size > 0 ? restrictH : null,
    })
    const restricTxt = (restrictB.size || restrictH.size)
      ? ` (b∈{${[...restrictB].join(',')}} h∈{${[...restrictH].join(',')}})`
      : ''
    if (res.length === 0) {
      setSearchMsg(`Ninguna sección cubre Mu+ = ${MuP} / Mu− = ${MuN} t·m${restricTxt}`)
      setResults([])
      // Clear iframe filter
      if (iframeRef.current) {
        iframeRef.current.contentWindow.postMessage({ type: 'RESET_FILTER' }, '*')
      }
    } else {
      setSearchMsg(`${res.length} sección${res.length !== 1 ? 'es' : ''} pasan Mu+ = ${MuP} / Mu− = ${MuN} t·m${restricTxt}`)
      setResults(res)
      // Sync search results to iframe heatmap/table
      if (iframeRef.current) {
        const secs = [...new Set(res.map(d => `${d.b}×${d.h}`))]
        iframeRef.current.contentWindow.postMessage({
          type: 'SEARCH_FILTER',
          payload: { sections: secs, MuP, MuN },
        }, '*')
      }
    }
  }

  function handleClearSearch() {
    setSearchMuP('')
    setSearchMuN('')
    setResults([])
    setSearchMsg('')
    setRestrictB(new Set())
    setRestrictH(new Set())
    // Reset iframe filters
    if (iframeRef.current) {
      iframeRef.current.contentWindow.postMessage({ type: 'RESET_FILTER' }, '*')
    }
  }

  function handleImport() { fileRef.current?.click() }

  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        const { added, skipped } = mergeDB(data)
        showToast(`${added} vigas nuevas · ${skipped} ya existían`, 'ok')
      } catch {
        showToast('Error al leer archivo', 'warn')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleExport() {
    const data = exportDB()
    const blob = new Blob([JSON.stringify(data, null, 0)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'bd_global_vigas.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function handleClearUser() {
    if (!confirm('¿Eliminar todas tus vigas añadidas? Las de fábrica se mantienen.')) return
    clearUserVigas()
    showToast('Vigas de usuario eliminadas', 'ok')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 12, right: 12, zIndex: 999,
          padding: '8px 18px', borderRadius: 6, fontSize: 12, fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          background: toast.type === 'ok' ? '#f0fdf4' : '#fffbeb',
          border: `1.5px solid ${toast.type === 'ok' ? '#86efac' : '#fcd34d'}`,
          color: toast.type === 'ok' ? '#15803d' : '#92400e',
        }}>{toast.msg}</div>
      )}

      {/* Stats + actions bar */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-panel)' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <StatCard label="Total" value={stats.total.toLocaleString()} />
          <StatCard label="Fábrica" value={stats.fabrica.toLocaleString()} sub="NTC-2023 precalc." />
          <StatCard label="Tuyas" value={stats.usuario.toLocaleString()} sub="añadidas manualmente" />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleImport} style={{ fontSize: 11 }}>
            📂 Cargar BD
          </button>
          <button className="btn btn-secondary" onClick={handleExport} style={{ fontSize: 11 }}>
            ↓ Exportar BD
          </button>
          <button className="btn btn-secondary" onClick={handleClearUser} style={{ fontSize: 11, color: '#dc2626' }}>
            🗑 Limpiar mis vigas
          </button>
          <button className="btn btn-primary" onClick={handleRefreshHeatmap} style={{ fontSize: 11 }}>
            ↻ Actualizar heatmap
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-panel)',
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em',
              color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)', marginBottom: 3 }}>Mu+ (t·m)</div>
            <input className="field-input" type="number" step="0.25" min="0" style={{ width: 100 }}
              value={searchMuP} onChange={e => setSearchMuP(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="0.00" />
          </div>
          <div>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em',
              color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)', marginBottom: 3 }}>Mu− (t·m)</div>
            <input className="field-input" type="number" step="0.25" min="0" style={{ width: 100 }}
              value={searchMuN} onChange={e => setSearchMuN(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="0.00" />
          </div>
          <button className="btn btn-primary" onClick={handleSearch} style={{ fontSize: 11, padding: '6px 16px' }}>
            Buscar
          </button>
          {(results.length > 0 || searchMsg || restrictB.size > 0 || restrictH.size > 0) && (
            <button className="btn btn-secondary" onClick={handleClearSearch} style={{ fontSize: 11, padding: '6px 12px' }}>
              Limpiar filtros
            </button>
          )}
          {searchMsg && (
            <span style={{
              fontSize: 11, fontFamily: 'var(--font-mono)',
              color: results.length > 0 ? '#15803d' : '#dc2626',
            }}>{searchMsg}</span>
          )}
        </div>
        {/* Restriction chips */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em',
              color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>Restringir base b</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {dims.bs.map(b => (
                <button key={b} onClick={() => toggleRestrict('b', b)} style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'var(--font-mono)',
                  cursor: 'pointer', transition: 'all 0.15s', border: '1px solid',
                  borderColor: restrictB.has(b) ? 'var(--color-accent)' : 'var(--color-border)',
                  background: restrictB.has(b) ? 'rgba(91,197,174,0.15)' : 'var(--color-bg)',
                  color: restrictB.has(b) ? 'var(--color-accent2)' : 'var(--color-tx3)',
                  fontWeight: restrictB.has(b) ? 700 : 400,
                }}>{b}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em',
              color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>Restringir peralte h</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {dims.hs.map(h => (
                <button key={h} onClick={() => toggleRestrict('h', h)} style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'var(--font-mono)',
                  cursor: 'pointer', transition: 'all 0.15s', border: '1px solid',
                  borderColor: restrictH.has(h) ? 'var(--color-accent)' : 'var(--color-border)',
                  background: restrictH.has(h) ? 'rgba(91,197,174,0.15)' : 'var(--color-bg)',
                  color: restrictH.has(h) ? 'var(--color-accent2)' : 'var(--color-tx3)',
                  fontWeight: restrictH.has(h) ? 700 : 400,
                }}>{h}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Search results */}
      {results.length > 0 && (
        <div style={{
          padding: '12px 20px', borderBottom: '1px solid var(--color-border)',
          maxHeight: 260, overflowY: 'auto', background: '#faf9f6',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {results.map((d, i) => (
              <ResultCard key={`${d.b}x${d.h}-${i}`} d={d}
                MuP={+searchMuP || 0} MuN={+searchMuN || 0}
                onUse={applyVigaToForm} isBest={i === 0} />
            ))}
          </div>
        </div>
      )}

      {/* MallaVigas iframe */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <iframe
          ref={iframeRef}
          src="MallaVigas.html"
          onLoad={handleIframeLoad}
          style={{
            width: '100%', height: '100%', border: 'none',
            background: '#f5f2eb',
          }}
          title="Malla de Trabes"
        />
        <div style={{
          position: 'absolute', bottom: 8, right: 12,
          fontSize: 9, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)',
          background: 'rgba(245,243,239,0.9)', padding: '2px 8px', borderRadius: 4,
        }}>MallaVigas · NTC-2023</div>
      </div>
    </div>
  )
}
