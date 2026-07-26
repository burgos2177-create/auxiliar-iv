import { useState, useMemo } from 'react'
import useColumnStore from '../store/useColumnStore'
import ColumnForm from './ColumnForm'
import ColumnCanvas from './ColumnCanvas'
import InteractionDiagram from './InteractionDiagram'
import Interaction3D from './Interaction3D'
import ColumnExcelView from './ColumnExcelView'
import { analyzeColumn, checkPoint, checkBiaxial, excentricidad } from '../core/columnCalculator'

export default function ColumnsView() {
  const columns = useColumnStore((s) => s.columns)
  const selectedIdx = useColumnStore((s) => s.selectedIdx)
  const selectColumn = useColumnStore((s) => s.selectColumn)
  const createColumn = useColumnStore((s) => s.createColumn)
  const removeColumn = useColumnStore((s) => s.removeColumn)
  const form = useColumnStore((s) => s.form)

  const [tab, setTab] = useState('diagrama')
  const [excelDir, setExcelDir] = useState('X')

  const hasSel = selectedIdx >= 0 && selectedIdx < columns.length
  const valid = hasSel && +form.b > 0 && +form.h > 0 && +form.r > 0 && +form.fc > 0 &&
    (form.lechos || []).length >= 2 && form.lechos.every((L) => +L.n > 0)

  const analysis = useMemo(() => {
    if (!valid) return null
    try { return analyzeColumn(form) } catch { return null }
  }, [valid, form.b, form.h, form.r, form.fc, form.fy, form.epsC, JSON.stringify(form.lechos)]) // eslint-disable-line

  const checks = useMemo(() => {
    if (!analysis) return null
    const Pu = +form.Pu || 0, MuX = +form.MuX || 0, MuY = +form.MuY || 0
    return {
      x: checkPoint(analysis.dirX.curve, Pu, MuX),
      y: checkPoint(analysis.dirY.curve, Pu, MuY),
      biaxial: checkBiaxial(analysis.dirX, analysis.dirY, Pu, MuX, MuY),
      ex: excentricidad(MuX, Pu, +form.b, +form.h),
    }
  }, [analysis, form.Pu, form.MuX, form.MuY, form.b, form.h])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Chips de columnas */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
        borderBottom: '1px solid var(--color-border)', background: 'var(--color-panel)',
        overflowX: 'auto', flexShrink: 0,
      }}>
        {columns.map((c, i) => (
          <span key={c.nombre + i} className={`chip ${i === selectedIdx ? 'active' : ''}`}
            onClick={() => selectColumn(i)}>
            {c.nombre || `C-${i + 1}`}
            <span className="chip-x" onClick={(e) => { e.stopPropagation(); removeColumn(i) }}>&times;</span>
          </span>
        ))}
        <button className="btn btn-primary" onClick={createColumn} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 99 }}>
          + Nueva
        </button>
        <div style={{ flex: 1 }} />
        {checks && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <Badge ok={checks.x.ok} label={`Mx ${checks.x.ok ? '✓' : '✗'}`} />
            <Badge ok={checks.y.ok} label={`My ${checks.y.ok ? '✓' : '✗'}`} />
            <Badge ok={checks.biaxial.ok} label={`Biaxial ${checks.biaxial.ok ? '✓' : '✗'}`} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <ColumnForm />

        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {!hasSel && (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-tx3)' }}>
              Pulsa &ldquo;+ Nueva&rdquo; para crear una columna
            </div>
          )}
          {hasSel && !analysis && (
            <div style={{ padding: 20, color: '#c62828', fontSize: 13 }}>
              Datos incompletos — revisa geometría y lechos.
            </div>
          )}
          {hasSel && analysis && (
            <>
              {/* Sub-tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 14, alignItems: 'center' }}>
                {[
                  { id: 'diagrama', label: 'Diagramas P–M' },
                  { id: '3d', label: 'Superficie 3D' },
                  { id: 'excel', label: 'Cálculo (Excel)' },
                ].map((t) => (
                  <button key={t.id} onClick={() => setTab(t.id)} className="btn"
                    style={{
                      padding: '6px 18px', fontSize: 13, fontWeight: 600,
                      background: tab === t.id ? 'var(--color-accent)' : 'var(--color-panel)',
                      color: tab === t.id ? '#fff' : 'var(--color-tx2)',
                      border: tab === t.id ? 'none' : '1px solid var(--color-border)',
                    }}>
                    {t.label}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)' }}>
                  {form.nombre} — {form.b}×{form.h} cm — Ast = {analysis.dirX.params.Ast.toFixed(2)} cm² — {checks?.ex.modo}
                </span>
              </div>

              {tab === 'diagrama' && (
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 8 }}>
                    <ColumnCanvas col={form} />
                  </div>
                  <InteractionDiagram
                    analysis={analysis.dirX} Mu={form.MuX} Pu={form.Pu} check={checks.x}
                    color="#2563a8" title={`Dirección X — P–Mx (peralte h=${form.h})`} />
                  <InteractionDiagram
                    analysis={analysis.dirY} Mu={form.MuY} Pu={form.Pu} check={checks.y}
                    color="#c94f2a" title={`Dirección Y — P–My (peralte b=${form.b})`} />
                </div>
              )}

              {tab === '3d' && (
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <Interaction3D
                    anX={analysis.dirX} anY={analysis.dirY}
                    Pu={form.Pu} MuX={form.MuX} MuY={form.MuY}
                    biaxial={checks.biaxial} />
                  <div style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 8 }}>
                    <ColumnCanvas col={form} />
                  </div>
                </div>
              )}

              {tab === 'excel' && (
                <div style={{ maxWidth: 860 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                    {['X', 'Y'].map((d) => (
                      <button key={d} onClick={() => setExcelDir(d)} className="btn"
                        style={{
                          padding: '4px 14px', fontSize: 12, fontWeight: 700,
                          background: excelDir === d ? (d === 'X' ? '#2563a8' : '#c94f2a') : 'var(--color-panel)',
                          color: excelDir === d ? '#fff' : 'var(--color-tx3)',
                          border: excelDir === d ? 'none' : '1px solid var(--color-border)',
                        }}>
                        Dirección {d}
                      </button>
                    ))}
                  </div>
                  <ColumnExcelView
                    col={form}
                    analysis={excelDir === 'X' ? analysis.dirX : analysis.dirY}
                    dirLabel={excelDir === 'X' ? `Dirección X (h=${form.h} cm)` : `Dirección Y (h=${form.b} cm, sección girada)`}
                    accent={excelDir === 'X' ? '#2563a8' : '#c94f2a'}
                    Mu={excelDir === 'X' ? form.MuX : form.MuY} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Badge({ ok, label }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 99, fontFamily: 'var(--font-mono)',
      background: ok ? '#e8f5e9' : '#fdecea', color: ok ? '#15803d' : '#c62828',
      border: `1px solid ${ok ? '#a5d6a7' : '#ef9a9a'}`,
    }}>{label}</span>
  )
}
