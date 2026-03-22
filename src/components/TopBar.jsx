import { useState, useRef, useEffect } from 'react'
import useBeamStore from '../store/useBeamStore'

const SCALE_PRESETS = [
  { label: '50:1', value: 0.02 },
  { label: '20:1', value: 0.05 },
  { label: '10:1', value: 0.1 },
  { label: '1:1', value: 1 },
  { label: '1:10', value: 10 },
  { label: '1:20', value: 20 },
  { label: '1:50', value: 50 },
]

export default function TopBar({ onExportDxf, onExportSvg, onSave, onOpen, onVerifyResumido, onVerifyDetallado, dxfScale, setDxfScale, projectName, setProjectName }) {
  const sections = useBeamStore((s) => s.sections)
  const selectedIdx = useBeamStore((s) => s.selectedIdx)
  const selectSection = useBeamStore((s) => s.selectSection)
  const removeSection = useBeamStore((s) => s.removeSection)
  const createSection = useBeamStore((s) => s.createSection)

  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const [verifyOpen, setVerifyOpen] = useState(false)
  const menuRef = useRef(null)
  const verifyRef = useRef(null)

  // Close dropdowns on outside click
  useEffect(() => {
    if (!open && !verifyOpen) return
    const handler = (e) => {
      if (open && menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
      if (verifyOpen && verifyRef.current && !verifyRef.current.contains(e.target)) setVerifyOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, verifyOpen])

  const currentLabel = SCALE_PRESETS.find((p) => p.value === dxfScale)?.label
    || (dxfScale >= 1 ? `1:${dxfScale}` : `${Math.round(1 / dxfScale)}:1`)

  return (
    <header className="flex items-center gap-3 px-4 py-2 border-b"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-panel)', minHeight: 48 }}>
      {/* Logo / title */}
      <div className="flex items-center gap-2 mr-4" style={{ flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
          &#9645;
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-tx1)' }}>
          Auxiliar IV
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)' }}>
          v0.2
        </span>
      </div>

      {/* Project name */}
      <input
        type="text"
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        placeholder="Proyecto"
        style={{
          width: 140, padding: '4px 8px', fontSize: 12,
          fontFamily: 'var(--font-mono)', background: 'var(--color-bg)',
          border: '1px solid var(--color-border)', borderRadius: 5,
          color: 'var(--color-tx1)', outline: 'none', flexShrink: 0,
        }}
        onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
        onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
      />

      {/* Verify button with dropdown */}
      <div style={{ position: 'relative', flexShrink: 0 }} ref={verifyRef}>
        <button
          className="btn"
          onClick={() => setVerifyOpen(!verifyOpen)}
          disabled={sections.length === 0}
          style={{
            fontSize: 12, padding: '5px 12px',
            background: '#e8830a', color: '#fff',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#cf7509'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#e8830a'}
          title="Generar informe de verificación"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          Verificar
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2 }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {verifyOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4,
            background: 'var(--color-panel)', border: '1px solid var(--color-border)',
            borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            padding: 6, minWidth: 180, zIndex: 100,
          }}>
            <div
              onClick={() => { setVerifyOpen(false); onVerifyResumido?.() }}
              style={{
                padding: '8px 12px', borderRadius: 5, cursor: 'pointer',
                fontSize: 12, color: 'var(--color-tx2)', transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-border)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontWeight: 600 }}>Resumido</div>
              <div style={{ fontSize: 10, color: 'var(--color-tx3)', marginTop: 2 }}>
                Resumen con verificaciones
              </div>
            </div>
            <div
              onClick={() => { setVerifyOpen(false); onVerifyDetallado?.() }}
              style={{
                padding: '8px 12px', borderRadius: 5, cursor: 'pointer',
                fontSize: 12, color: 'var(--color-tx2)', transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-border)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontWeight: 600 }}>Detallado</div>
              <div style={{ fontSize: 10, color: 'var(--color-tx3)', marginTop: 2 }}>
                Memoria de c&aacute;lculo completa
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ width: 1, height: 24, background: 'var(--color-border)', flexShrink: 0 }} />

      {/* Section chips */}
      <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
        {sections.map((s, i) => (
          <span
            key={s.nombre + i}
            className={`chip ${i === selectedIdx ? 'active' : ''}`}
            onClick={() => selectSection(i)}
          >
            {s.nombre || `S-${i + 1}`}
            <span
              className="chip-x"
              onClick={(e) => { e.stopPropagation(); removeSection(i) }}
            >&times;</span>
          </span>
        ))}
        <button
          className="btn btn-primary"
          onClick={createSection}
          style={{ fontSize: 12, padding: '4px 12px', borderRadius: 99 }}
        >
          + Nueva
        </button>
      </div>

      {/* File + Export buttons */}
      <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
        <button
          className="btn btn-secondary"
          onClick={onOpen}
          style={{ fontSize: 12, padding: '6px 10px' }}
          title="Abrir proyecto (.json)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1" />
            <path d="M14 14l-4 4m0 0l-4-4m4 4V10" style={{ transform: 'rotate(180deg)', transformOrigin: '12px 14px' }} />
          </svg>
        </button>
        <button
          className="btn btn-secondary"
          onClick={onSave}
          disabled={sections.length === 0}
          style={{ fontSize: 12, padding: '6px 10px' }}
          title="Guardar proyecto (.json)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--color-border)' }} />

        <button
          className="btn btn-secondary"
          onClick={onExportSvg}
          disabled={sections.length === 0}
          style={{ fontSize: 12 }}
        >
          SVG
        </button>

        {/* Scale selector */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            className="btn btn-secondary"
            onClick={() => setOpen(!open)}
            style={{ fontSize: 11, padding: '6px 10px', fontFamily: 'var(--font-mono)', gap: 4 }}
            title="Escala de exportación DXF"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 2l20 20" />
              <path d="M5.5 5.5L2 2" />
              <path d="M7 2h-5v5" />
              <path d="M18.5 18.5L22 22" />
              <path d="M17 22h5v-5" />
            </svg>
            {currentLabel}
          </button>

          {open && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              background: 'var(--color-panel)', border: '1px solid var(--color-border)',
              borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              padding: 6, minWidth: 130, zIndex: 100,
            }}>
              {SCALE_PRESETS.map((p) => (
                <div
                  key={p.value}
                  onClick={() => { setDxfScale(p.value); setOpen(false) }}
                  style={{
                    padding: '6px 10px', borderRadius: 5, cursor: 'pointer',
                    fontSize: 12, fontFamily: 'var(--font-mono)',
                    background: dxfScale === p.value ? 'var(--color-accent)' : 'transparent',
                    color: dxfScale === p.value ? '#fff' : 'var(--color-tx2)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { if (dxfScale !== p.value) e.currentTarget.style.background = 'var(--color-border)' }}
                  onMouseLeave={(e) => { if (dxfScale !== p.value) e.currentTarget.style.background = 'transparent' }}
                >
                  {p.label}
                </div>
              ))}

              {/* Custom */}
              <div style={{
                borderTop: '1px solid var(--color-border)', marginTop: 4, paddingTop: 6,
              }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)', marginBottom: 3, paddingLeft: 4 }}>
                  Personalizado
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', paddingLeft: 4 }}>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)' }}>1:</span>
                  <input
                    type="number" min="1" step="1"
                    className="field-input"
                    style={{ width: 60, padding: '3px 6px', fontSize: 12 }}
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="—"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const v = parseInt(custom, 10)
                        if (v > 0) { setDxfScale(v); setOpen(false) }
                      }
                    }}
                  />
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 10, padding: '3px 8px' }}
                    onClick={() => {
                      const v = parseInt(custom, 10)
                      if (v > 0) { setDxfScale(v); setOpen(false) }
                    }}
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          className="btn btn-export"
          onClick={onExportDxf}
          disabled={sections.length === 0}
          style={{ fontSize: 12 }}
        >
          Exportar DXF
        </button>
      </div>
    </header>
  )
}
