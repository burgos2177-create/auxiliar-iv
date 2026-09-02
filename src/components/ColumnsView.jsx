import { useState, useMemo, useRef } from 'react'
import useColumnStore from '../store/useColumnStore'
import ColumnForm from './ColumnForm'
import ColumnCanvas from './ColumnCanvas'
import InteractionDiagram from './InteractionDiagram'
import Interaction3D from './Interaction3D'
import ColumnExcelView from './ColumnExcelView'
import { analyzeColumn, checkPoint, checkBiaxial, excentricidad } from '../core/columnCalculator'
import { parseRamEnvelope } from '../core/ramParser'
import { columnDemand } from '../core/columnDemand'

export default function ColumnsView() {
  const columns = useColumnStore((s) => s.columns)
  const selectedIdx = useColumnStore((s) => s.selectedIdx)
  const selectColumn = useColumnStore((s) => s.selectColumn)
  const createColumn = useColumnStore((s) => s.createColumn)
  const removeColumn = useColumnStore((s) => s.removeColumn)
  const form = useColumnStore((s) => s.form)
  const setEnvelope = useColumnStore((s) => s.setEnvelope)

  const [tab, setTab] = useState('diagrama')
  const [excelDir, setExcelDir] = useState('X')
  const [envMsg, setEnvMsg] = useState('')
  const envFileRef = useRef(null)

  const hasSel = selectedIdx >= 0 && selectedIdx < columns.length
  const valid = hasSel && +form.b > 0 && +form.h > 0 && +form.r > 0 && +form.fc > 0 &&
    (form.lechos || []).length >= 2 && form.lechos.every((L) => +L.n > 0)

  const analysis = useMemo(() => {
    if (!valid) return null
    try { return analyzeColumn(form) } catch { return null }
  }, [valid, form.b, form.h, form.r, form.fc, form.fy, form.epsC, JSON.stringify(form.lechos)]) // eslint-disable-line

  // Punto capturado a mano — se sigue dibujando en los diagramas, pero NO
  // decide el veredicto cuando hay envolvente cargada (ver `demanda`).
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

  // ── Envolvente (reporte RAM) ──
  // La demanda que decide el veredicto: si hay envolvente cargada manda ella
  // (todos sus ejemplares); si no, el punto capturado en el formulario.
  const env = form.envelope
  const demanda = useMemo(() => (analysis ? columnDemand(form, analysis) : null), [analysis, form])
  const envEval = demanda?.env || null

  function handleEnvFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const parsed = parseRamEnvelope(ev.target.result)
      if (!parsed.points.length) {
        setEnvMsg(parsed.warnings[0] || 'No se pudieron leer puntos del archivo.')
        return
      }
      setEnvelope({
        archivo: file.name, combo: parsed.combo, unidades: parsed.unidades,
        mapping: 'M33X', points: parsed.points,
      })
      setEnvMsg(`${parsed.points.length} puntos · ${new Set(parsed.points.map((p) => p.member)).size} miembros${parsed.combo ? ` · ${parsed.combo}` : ''}`)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const toggleMapping = () => setEnvelope({ ...env, mapping: (env.mapping || 'M33X') === 'M33X' ? 'M22X' : 'M33X' })

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
        {demanda && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}
            title={demanda.fuente === 'envolvente'
              ? `Revisión contra los ${demanda.env.total} ejemplares de la envolvente cargada`
              : demanda.fuente === 'manual'
                ? 'Revisión del punto (Pu, Mux, Muy) capturado en el formulario'
                : 'No hay demanda capturada ni envolvente cargada'}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)' }}>
              {demanda.fuenteLabel}
            </span>
            {demanda.evaluado ? (
              <>
                <Badge ok={demanda.okX} label={`Mx ${demanda.okX ? '✓' : '✗'}`} />
                <Badge ok={demanda.okY} label={`My ${demanda.okY ? '✓' : '✗'}`} />
                <Badge ok={demanda.okBi} label={`Biaxial ${demanda.okBi ? '✓' : '✗'}`} />
              </>
            ) : (
              <Badge tone="neutral" label="sin revisar" />
            )}
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

              {/* ── Envolvente de elementos mecánicos (RAM) ── */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14,
                padding: '8px 12px', borderRadius: 8,
                background: 'var(--color-panel)', border: '1px solid var(--color-border)',
              }}>
                <input ref={envFileRef} type="file" accept=".txt,.csv,text/plain" style={{ display: 'none' }} onChange={handleEnvFile} />
                <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => envFileRef.current?.click()}>
                  📄 Cargar envolvente (RAM .txt)
                </button>
                {env?.points?.length ? (
                  <>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-tx2)' }}>
                      <b>{env.archivo}</b> · {env.points.length} puntos
                      {env.combo ? ` · ${env.combo}` : ''}
                    </span>
                    <button className="btn btn-secondary" style={{ fontSize: 10 }} onClick={toggleMapping}
                      title="Intercambia qué momento del reporte actúa en cada dirección">
                      {(env.mapping || 'M33X') === 'M33X' ? 'M33→Mx · M22→My' : 'M22→Mx · M33→My'} ⇄
                    </button>
                    <button style={{
                      fontSize: 10, background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--color-tx3)', textDecoration: 'underline',
                    }} onClick={() => { setEnvelope(null); setEnvMsg('') }}>quitar</button>
                    {envEval && (
                      <span style={{
                        marginLeft: 'auto', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 99,
                        fontFamily: 'var(--font-mono)',
                        background: envEval.allOk ? '#e8f5e9' : '#fdecea',
                        color: envEval.allOk ? '#15803d' : '#c62828',
                        border: `1px solid ${envEval.allOk ? '#a5d6a7' : '#ef9a9a'}`,
                      }}>
                        {envEval.passing}/{envEval.total} dentro
                        {envEval.critical && ` · crítico M-${envEval.critical.member} (util ${isFinite(envEval.critical.util) ? envEval.critical.util.toFixed(3) : '∞'})`}
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize: 10.5, color: 'var(--color-tx3)' }}>
                    Opcional — grafica todos los miembros del reporte sobre el diagrama de esta sección
                  </span>
                )}
                {envMsg && !env?.points?.length && (
                  <span style={{ fontSize: 10.5, color: '#c62828' }}>{envMsg}</span>
                )}
                {demanda?.fuente === 'envolvente' && demanda.manual?.hayManual && (
                  <div style={{ flexBasis: '100%', fontSize: 10.5, color: 'var(--color-tx3)' }}>
                    Con la envolvente cargada el veredicto lo dan sus {envEval.total} ejemplares;
                    el punto capturado a mano (Pu = {(+form.Pu || 0)} t, Mux = {(+form.MuX || 0)}, Muy = {(+form.MuY || 0)} t·m)
                    queda sólo como referencia.
                  </div>
                )}
              </div>

              {tab === 'diagrama' && (
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 8 }}>
                    <ColumnCanvas col={form} />
                  </div>
                  <InteractionDiagram
                    analysis={analysis.dirX} Mu={form.MuX} Pu={form.Pu} check={checks.x}
                    color="#2563a8" title={`Dirección X — P–Mx (peralte h=${form.h})`}
                    cloud={envEval?.results} cloudKey="Mux" />
                  <InteractionDiagram
                    analysis={analysis.dirY} Mu={form.MuY} Pu={form.Pu} check={checks.y}
                    color="#c94f2a" title={`Dirección Y — P–My (peralte b=${form.b})`}
                    cloud={envEval?.results} cloudKey="Muy" />
                </div>
              )}

              {tab === 'diagrama' && envEval && (
                <div style={{ marginTop: 16, maxWidth: 900 }}>
                  <div className="section-title">Revisión de la envolvente — {envEval.total} puntos</div>
                  <div style={{ maxHeight: 300, overflowY: 'auto', marginTop: 8, border: '1px solid var(--color-border)', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                      <thead style={{ position: 'sticky', top: 0 }}>
                        <tr>
                          {['Miembro', 'Env.', 'Pu (t)', 'Mux (t·m)', 'Muy (t·m)', 'MRx', 'MRy', 'Util.', 'Estado'].map((t) => (
                            <th key={t} style={{ padding: '5px 8px', background: '#1a2040', color: '#fff', fontSize: 10, textAlign: 'left' }}>{t}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...envEval.results].sort((a, b) => (b.util || 0) - (a.util || 0)).map((r) => (
                          <tr key={r.id} style={{ background: r.id === envEval.critical?.id ? '#fff8e1' : undefined }}>
                            <td style={TD}><b>{r.member}</b></td>
                            <td style={TD}>{r.tipo}</td>
                            <td style={TD}>{r.Pu.toFixed(2)}</td>
                            <td style={TD}>{r.Mux.toFixed(2)}</td>
                            <td style={TD}>{r.Muy.toFixed(2)}</td>
                            <td style={TD}>{r.cx.MR.toFixed(2)}</td>
                            <td style={TD}>{r.cy.MR.toFixed(2)}</td>
                            <td style={{ ...TD, fontWeight: 700, color: r.util > 1 ? '#c62828' : r.util > 0.9 ? '#b45309' : '#15803d' }}>
                              {isFinite(r.util) ? r.util.toFixed(3) : '∞'}
                            </td>
                            <td style={TD}>
                              <span style={{ fontWeight: 800, color: r.ok ? '#15803d' : '#c62828' }}>
                                {r.ok ? '✓ pasa' : '✗ no pasa'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--color-tx3)' }}>
                    Utilización = √[(Mux/MRx)² + (Muy/MRy)²] al nivel de Pu de cada punto (contorno biaxial).
                    La fila resaltada es el caso crítico.
                  </div>
                </div>
              )}

              {tab === '3d' && (
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <Interaction3D
                    anX={analysis.dirX} anY={analysis.dirY}
                    Pu={form.Pu} MuX={form.MuX} MuY={form.MuY}
                    biaxial={checks.biaxial} cloud={envEval?.results} />
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

const TD = { padding: '4px 8px', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }

function Badge({ ok, label, tone }) {
  const neutral = tone === 'neutral'
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 99, fontFamily: 'var(--font-mono)',
      background: neutral ? 'var(--color-panel)' : ok ? '#e8f5e9' : '#fdecea',
      color: neutral ? 'var(--color-tx3)' : ok ? '#15803d' : '#c62828',
      border: `1px solid ${neutral ? 'var(--color-border)' : ok ? '#a5d6a7' : '#ef9a9a'}`,
    }}>{label}</span>
  )
}
