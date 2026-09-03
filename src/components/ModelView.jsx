import { useMemo, useRef, useState } from 'react'
import useBeamStore from '../store/useBeamStore'
import useColumnStore from '../store/useColumnStore'
import useModelStore from '../store/useModelStore'
import { evaluateModel, groupByMember, suggestKind, parseMemberRanges } from '../core/modelEnvelope'
import { normName } from '../core/constants'

const fmt = (v, d = 2) => (v === null || v === undefined || !isFinite(v) ? '—' : Number(v).toFixed(d))
const TD = { padding: '4px 8px', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap', fontSize: 11 }
const TH = { padding: '5px 8px', background: '#1a2040', color: '#fff', fontSize: 10, textAlign: 'left', position: 'sticky', top: 0 }

function Pill({ ok, children, tone }) {
  const t = tone || (ok === null || ok === undefined ? 'muted' : ok ? 'ok' : 'bad')
  const st = {
    ok: { bg: '#e8f5e9', fg: '#15803d', bd: '#a5d6a7' },
    bad: { bg: '#fdecea', fg: '#c62828', bd: '#ef9a9a' },
    warn: { bg: '#fffbeb', fg: '#92400e', bd: '#fcd34d' },
    muted: { bg: 'var(--color-panel)', fg: 'var(--color-tx3)', bd: 'var(--color-border)' },
  }[t]
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: '2px 9px', borderRadius: 99, fontFamily: 'var(--font-mono)',
      background: st.bg, color: st.fg, border: `1px solid ${st.bd}`, whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

/**
 * Pestaña "Modelo": un solo .txt de RAM para todo el modelo, asignación de
 * miembros a las trabes/columnas del proyecto y semáforo global.
 */
export default function ModelView({ onExportDcheck }) {
  const sections = useBeamStore((s) => s.sections)
  const columns = useColumnStore((s) => s.columns)
  const selectSection = useBeamStore((s) => s.selectSection)
  const selectColumn = useColumnStore((s) => s.selectColumn)
  const setBeamEnvAt = useBeamStore((s) => s.setEnvelopeAt)
  const setColEnvAt = useColumnStore((s) => s.setEnvelopeAt)

  const model = useModelStore((s) => s.model)
  const warnings = useModelStore((s) => s.warnings)
  const lastAuto = useModelStore((s) => s.lastAuto)
  const loadModelText = useModelStore((s) => s.loadModelText)
  const loadMemberDataText = useModelStore((s) => s.loadMemberDataText)
  const autoAssignAct = useModelStore((s) => s.autoAssign)
  const assign = useModelStore((s) => s.assign)
  const unassign = useModelStore((s) => s.unassign)
  const clear = useModelStore((s) => s.clear)

  const modelRef = useRef(null)
  const dataRef = useRef(null)
  const [msg, setMsg] = useState('')
  const [filter, setFilter] = useState('todos') // todos | sin | <nombre>
  const [selected, setSelected] = useState(() => new Set())
  const [rangeTxt, setRangeTxt] = useState('')
  const [target, setTarget] = useState('')

  const targets = useMemo(() => [
    ...sections.map((t) => ({ name: t.nombre, kind: 'trabe', label: `${t.nombre} · trabe ${t.ancho}×${t.peralte}` })),
    ...columns.map((c) => ({ name: c.nombre, kind: 'columna', label: `${c.nombre} · columna ${c.b}×${c.h}` })),
  ], [sections, columns])

  // Opciones por sección (invertir / mapping) viven en la envolvente de cada una
  const opts = useMemo(() => {
    const o = {}
    for (const t of sections) o[normName(t.nombre)] = { invertir: !!t.envelope?.invertir }
    for (const c of columns) o[normName(c.nombre)] = { mapping: c.envelope?.mapping || 'M33X' }
    return o
  }, [sections, columns])

  const evalM = useMemo(() => evaluateModel({ ...model, opts }, sections, columns), [model, opts, sections, columns])
  const byMember = useMemo(() => groupByMember(model.points), [model.points])

  // Utilización por miembro (la de su sección, si está evaluada)
  const utilByMember = useMemo(() => {
    const m = new Map()
    for (const s of evalM.porSeccion) {
      if (!s.ev) continue
      for (const r of s.ev.results) {
        const id = r.member
        const u = isFinite(r.util) ? r.util : Infinity
        const prev = m.get(id)
        if (!prev || u > prev.util) m.set(id, { util: u, ok: r.ok, hasData: s.hasData })
      }
    }
    return m
  }, [evalM])

  const rows = useMemo(() => {
    const out = []
    for (const [id, pts] of byMember) {
      const a = model.assignment[id]
      const u = utilByMember.get(id)
      const P = Math.max(...pts.map((p) => p.P))
      const v2 = Math.max(...pts.map((p) => Math.abs(p.v2)))
      const m33max = Math.max(...pts.map((p) => p.m33)), m33min = Math.min(...pts.map((p) => p.m33))
      const m22 = Math.max(...pts.map((p) => Math.abs(p.m22)))
      out.push({ id, pts, a, P, v2, m33max, m33min, m22, kindHint: suggestKind(pts), util: u?.util ?? null, ok: u ? (u.hasData ? u.ok : null) : null })
    }
    out.sort((x, y) => (+x.id || 0) - (+y.id || 0) || String(x.id).localeCompare(String(y.id)))
    return out
  }, [byMember, model.assignment, utilByMember])

  const visible = useMemo(() => {
    if (filter === 'todos') return rows
    if (filter === 'sin') return rows.filter((r) => !r.a || !targets.some((t) => normName(t.name) === normName(r.a.name)))
    return rows.filter((r) => r.a && normName(r.a.name) === normName(filter))
  }, [rows, filter, targets])

  // ── carga de archivos ──
  function onModelFile(e) {
    const file = e.target.files?.[0]; if (!file) return
    const rd = new FileReader()
    rd.onload = (ev) => {
      const res = loadModelText(ev.target.result, file.name)
      setMsg(res.ok
        ? `${res.points} puntos · ${res.members} miembros${res.warnings?.length ? ` · ${res.warnings[0]}` : ''}`
        : (res.warnings?.[0] || 'No se pudo leer el archivo.'))
      setSelected(new Set())
    }
    rd.readAsText(file); e.target.value = ''
  }
  function onDataFile(e) {
    const file = e.target.files?.[0]; if (!file) return
    const rd = new FileReader()
    rd.onload = (ev) => {
      const parsed = loadMemberDataText(ev.target.result)
      const auto = useModelStore.getState().lastAuto
      setMsg(parsed.rows.length
        ? `Datos de ${parsed.rows.length} miembros (columnas: ${parsed.columnas.join(', ')})${auto ? ` · ${auto.matched} asignados por nombre, ${auto.unmatched.length} sin empate` : ''}`
        : (parsed.warnings[0] || 'Sin filas.'))
    }
    rd.readAsText(file); e.target.value = ''
  }

  // ── asignación ──
  const toggleSel = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allVisibleSel = visible.length > 0 && visible.every((r) => selected.has(r.id))
  const toggleAll = () => setSelected(allVisibleSel ? new Set() : new Set(visible.map((r) => r.id)))
  const targetObj = targets.find((t) => t.name === target)
  function doAssign(ids) {
    if (!targetObj) { setMsg('Elige a qué trabe/columna asignar.'); return }
    const valid = ids.filter((id) => byMember.has(String(id)))
    if (!valid.length) { setMsg('Ningún miembro válido para asignar.'); return }
    assign(valid, targetObj.name, targetObj.kind)
    setMsg(`${valid.length} miembro(s) → ${targetObj.name}`)
    setSelected(new Set()); setRangeTxt('')
  }
  const assignRow = (id, name) => {
    if (!name) { unassign([id]); return }
    const t = targets.find((x) => x.name === name)
    if (t) assign([id], t.name, t.kind)
  }

  // toggles por sección
  const toggleInvertir = (name) => {
    const idx = sections.findIndex((t) => t.nombre === name); if (idx < 0) return
    const env = sections[idx].envelope; if (!env) return
    setBeamEnvAt(idx, { ...env, invertir: !env.invertir })
  }
  const toggleMapping = (name) => {
    const idx = columns.findIndex((c) => c.nombre === name); if (idx < 0) return
    const env = columns[idx].envelope; if (!env) return
    setColEnvAt(idx, { ...env, mapping: (env.mapping || 'M33X') === 'M33X' ? 'M22X' : 'M33X' })
  }

  const hasModel = model.points.length > 0
  const semaforo = !hasModel ? null
    : evalM.allOk ? { tone: 'ok', txt: `✓ Todo el modelo cubierto: ${evalM.ejemplaresOk}/${evalM.ejemplares} ejemplares dentro · util. máx ${fmt(evalM.utilMax, 3)}` }
      : { tone: evalM.fallan ? 'bad' : 'warn', txt: [
        evalM.fallan ? `${evalM.fallan} sección(es) no cumplen` : null,
        evalM.sinAsignar.length ? `${evalM.sinAsignar.length} miembro(s) sin asignar` : null,
        evalM.seccionesSinDatos ? `${evalM.seccionesSinDatos} sección(es) sin datos de cálculo` : null,
        evalM.huerfanos.length ? `${evalM.huerfanos.length} asignados a secciones que ya no existen` : null,
        `${evalM.ejemplaresOk}/${evalM.ejemplares} ejemplares dentro`,
      ].filter(Boolean).join(' · ') }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <input ref={modelRef} data-testid="model-file" type="file" accept=".txt,.csv,text/plain" style={{ display: 'none' }} onChange={onModelFile} />
      <input ref={dataRef} data-testid="model-data-file" type="file" accept=".txt,.csv,text/plain" style={{ display: 'none' }} onChange={onDataFile} />

      {/* Barra superior */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-panel)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" style={{ fontSize: 11 }} onClick={() => modelRef.current?.click()}>
            📄 Cargar modelo completo (RAM .txt)
          </button>
          <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => dataRef.current?.click()}
            title="Reporte de datos de miembros de RAM con la columna Sección o Descripción: asigna cada miembro a su trabe/columna por nombre">
            📋 Datos de miembros (opcional)
          </button>
          {hasModel && (
            <>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-tx2)' }}>
                <b>{model.archivo}</b> · {evalM.totalMiembros} miembros{model.combo ? ` · ${model.combo}` : ''}
              </span>
              {model.memberData?.length > 0 && (
                <button className="btn btn-secondary" style={{ fontSize: 10 }} onClick={() => { const r = autoAssignAct(); if (r) setMsg(`${r.matched} asignados por nombre · ${r.unmatched.length} sin empate`) }}>
                  ↻ Re-asignar por nombre
                </button>
              )}
              <button className="btn btn-secondary" style={{ fontSize: 10 }} onClick={() => onExportDcheck?.(evalM)}
                title="Genera el .dcheck con nombres, resistencias y demandas ya llenos; sólo faltan las capturas">
                ✓✓ Exportar Double Check (.dcheck)
              </button>
              <button style={{ fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-tx3)', textDecoration: 'underline' }}
                onClick={() => { if (confirm('¿Quitar el modelo y las envolventes que derivan de él?')) { clear(); setMsg('') } }}>quitar</button>
            </>
          )}
          {!hasModel && (
            <span style={{ fontSize: 10.5, color: 'var(--color-tx3)' }}>
              Exporta en RAM el reporte «Máximos esfuerzos en miembros» de <b>todo</b> el modelo y cárgalo aquí. Luego reparte los miembros a cada trabe/columna (por rangos, o por nombre con el reporte de datos de miembros).
            </span>
          )}
        </div>
        {(msg || warnings.length > 0) && (
          <div style={{ fontSize: 10.5, color: warnings.length && !hasModel ? '#c62828' : 'var(--color-tx3)', fontFamily: 'var(--font-mono)' }}>
            {msg}{warnings.length && msg ? ' · ' : ''}{warnings.length && !msg ? warnings[0] : ''}
          </div>
        )}
        {semaforo && (
          <div style={{
            padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
            background: semaforo.tone === 'ok' ? '#e8f5e9' : semaforo.tone === 'bad' ? '#fdecea' : '#fffbeb',
            color: semaforo.tone === 'ok' ? '#15803d' : semaforo.tone === 'bad' ? '#c62828' : '#92400e',
            border: `1px solid ${semaforo.tone === 'ok' ? '#a5d6a7' : semaforo.tone === 'bad' ? '#ef9a9a' : '#fcd34d'}`,
          }}>
            {semaforo.txt}
            <span style={{ fontWeight: 400, marginLeft: 10, opacity: 0.8 }}>
              {evalM.asignados}/{evalM.totalMiembros} miembros asignados · {evalM.seccionesConEnv}/{evalM.secciones} secciones con envolvente
            </span>
          </div>
        )}
      </div>

      {hasModel && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Secciones */}
          <div style={{ width: 300, minWidth: 300, borderRight: '1px solid var(--color-border)', overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="section-title" style={{ marginBottom: 2 }}>Secciones del proyecto</div>
            <button onClick={() => setFilter('todos')} className="btn" style={{
              fontSize: 11, textAlign: 'left', padding: '5px 10px',
              background: filter === 'todos' ? 'var(--color-accent)' : 'var(--color-panel)',
              color: filter === 'todos' ? '#fff' : 'var(--color-tx2)', border: '1px solid var(--color-border)',
            }}>Todos los miembros ({rows.length})</button>
            <button onClick={() => setFilter('sin')} className="btn" style={{
              fontSize: 11, textAlign: 'left', padding: '5px 10px',
              background: filter === 'sin' ? '#c62828' : 'var(--color-panel)',
              color: filter === 'sin' ? '#fff' : evalM.sinAsignar.length ? '#c62828' : 'var(--color-tx2)', border: '1px solid var(--color-border)',
            }}>Sin asignar ({evalM.sinAsignar.length})</button>

            {evalM.porSeccion.map((s) => {
              const active = filter === s.nombre
              const n = s.members.length
              return (
                <div key={s.kind + s.nombre} onClick={() => setFilter(s.nombre)} style={{
                  padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                  background: active ? 'rgba(91,197,174,0.15)' : 'var(--color-bg)',
                  border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 12, color: s.kind === 'trabe' ? 'var(--color-steel-bot)' : '#7c3aed' }}>{s.nombre}</span>
                    <span style={{ fontSize: 9.5, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)' }}>{s.kind}</span>
                    <span style={{ marginLeft: 'auto' }}>
                      {n === 0 ? <Pill tone="muted">sin miembros</Pill>
                        : s.ok === null ? <Pill tone="warn">sin datos</Pill>
                          : <Pill ok={s.ok}>{s.ev.passing}/{s.ev.total} {s.ok ? '✓' : '✗'}</Pill>}
                    </span>
                  </div>
                  {n > 0 && (
                    <div style={{ marginTop: 4, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span>{n} miembro{n !== 1 ? 's' : ''}</span>
                      {s.ev?.critical && <span>crítico M-{s.ev.critical.member} · util {fmt(s.ev.critical.util, 3)}</span>}
                      {s.kind === 'trabe' && s.cap && (
                        <span title={s.cap.vrDesdeDetalle ? 'Vr calculado con los estribos del detalle (no hay Vu capturado)' : ''}>
                          MR+ {fmt(s.cap.MRP)} · MR− {fmt(s.cap.MRN)} · Vr {fmt(s.cap.VR)}{s.cap.vrDesdeDetalle ? '*' : ''}
                        </span>
                      )}
                      {s.kind === 'trabe' && (
                        <button onClick={(e) => { e.stopPropagation(); toggleInvertir(s.nombre) }} className="btn btn-secondary" style={{ fontSize: 9, padding: '1px 6px' }}
                          title="Invierte el signo de M33 si en tu modelo el momento positivo va al revés">
                          {opts[normName(s.nombre)]?.invertir ? 'M33 invertido ⇄' : 'M33 normal ⇄'}
                        </button>
                      )}
                      {s.kind === 'columna' && (
                        <button onClick={(e) => { e.stopPropagation(); toggleMapping(s.nombre) }} className="btn btn-secondary" style={{ fontSize: 9, padding: '1px 6px' }}
                          title="Intercambia qué momento del reporte actúa en cada dirección">
                          {(opts[normName(s.nombre)]?.mapping || 'M33X') === 'M33X' ? 'M33→Mx' : 'M22→Mx'} ⇄
                        </button>
                      )}
                      <button onClick={(e) => {
                        e.stopPropagation()
                        if (s.kind === 'trabe') selectSection(sections.findIndex((t) => t.nombre === s.nombre))
                        else selectColumn(columns.findIndex((c) => c.nombre === s.nombre))
                      }} className="btn btn-secondary" style={{ fontSize: 9, padding: '1px 6px' }} title="Abrir esta sección en su pestaña">abrir</button>
                    </div>
                  )}
                </div>
              )
            })}
            {evalM.porSeccion.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--color-tx3)' }}>Crea trabes y columnas en sus pestañas para poder asignarles miembros.</div>
            )}
          </div>

          {/* Miembros */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Asignación */}
            <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'var(--color-panel)' }}>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Asignar</span>
              <input className="field-input" style={{ width: 220, fontSize: 11 }} placeholder="miembros: 47, 52, 57-97" data-testid="model-ranges"
                value={rangeTxt} onChange={(e) => setRangeTxt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') doAssign(parseMemberRanges(rangeTxt)) }} />
              <span style={{ fontSize: 11, color: 'var(--color-tx3)' }}>a</span>
              <select className="field-select" data-testid="model-target" style={{ width: 220, fontSize: 11 }} value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">— trabe / columna —</option>
                {targets.map((t) => <option key={t.kind + t.name} value={t.name}>{t.label}</option>)}
              </select>
              <button className="btn btn-primary" style={{ fontSize: 11 }} disabled={!rangeTxt.trim() || !target}
                onClick={() => doAssign(parseMemberRanges(rangeTxt))}>Asignar rango</button>
              <button className="btn btn-secondary" style={{ fontSize: 11 }} disabled={selected.size === 0 || !target}
                onClick={() => doAssign([...selected])}>Asignar {selected.size ? `${selected.size} seleccionados` : 'seleccionados'}</button>
              {selected.size > 0 && (
                <button className="btn btn-secondary" style={{ fontSize: 11, color: '#c62828' }} onClick={() => { unassign([...selected]); setSelected(new Set()) }}>
                  Quitar asignación
                </button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)' }}>
                {filter === 'todos' ? 'todos' : filter === 'sin' ? 'sin asignar' : filter} · {visible.length} miembro{visible.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)' }}>
                <thead>
                  <tr>
                    <th style={TH}><input type="checkbox" checked={allVisibleSel} onChange={toggleAll} /></th>
                    <th style={TH}>Miembro</th>
                    <th style={TH} title="Pista por la relación axial/momento; no asigna nada">Tipo prob.</th>
                    <th style={TH}>P máx (t)</th>
                    <th style={TH}>|V2| máx (t)</th>
                    <th style={TH}>M33 máx / mín (t·m)</th>
                    <th style={TH}>|M22| máx</th>
                    <th style={TH}>Sección asignada</th>
                    <th style={TH}>Util.</th>
                    <th style={TH}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const unassigned = !r.a || !targets.some((t) => normName(t.name) === normName(r.a.name))
                    return (
                      <tr key={r.id} style={{ background: selected.has(r.id) ? 'rgba(91,197,174,0.10)' : unassigned ? 'rgba(198,40,40,0.04)' : undefined }}>
                        <td style={TD}><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
                        <td style={{ ...TD, fontWeight: 700 }}>{r.id}</td>
                        <td style={{ ...TD, color: 'var(--color-tx3)' }}>{r.kindHint}</td>
                        <td style={TD}>{fmt(r.P)}</td>
                        <td style={TD}>{fmt(r.v2)}</td>
                        <td style={TD}>{fmt(r.m33max)} / {fmt(r.m33min)}</td>
                        <td style={TD}>{fmt(r.m22)}</td>
                        <td style={TD}>
                          <select className="field-select" style={{ fontSize: 10.5, padding: '2px 6px', minWidth: 150, color: unassigned ? '#c62828' : undefined }}
                            value={unassigned ? '' : r.a.name} onChange={(e) => assignRow(r.id, e.target.value)}>
                            <option value="">— sin asignar —</option>
                            {targets.map((t) => <option key={t.kind + t.name} value={t.name}>{t.label}</option>)}
                          </select>
                          {r.a && unassigned && <span style={{ fontSize: 9.5, color: '#c62828', marginLeft: 4 }}>({r.a.name} ya no existe)</span>}
                        </td>
                        <td style={{ ...TD, fontWeight: 700, color: r.util === null ? 'var(--color-tx3)' : r.util > 1 ? '#c62828' : r.util > 0.9 ? '#b45309' : '#15803d' }}>
                          {r.util === null ? '—' : fmt(r.util, 3)}
                        </td>
                        <td style={TD}>
                          {unassigned ? <Pill tone="muted">sin asignar</Pill>
                            : r.ok === null ? <Pill tone="warn">sin datos</Pill>
                              : <Pill ok={r.ok}>{r.ok ? '✓ pasa' : '✗ no pasa'}</Pill>}
                        </td>
                      </tr>
                    )
                  })}
                  {visible.length === 0 && (
                    <tr><td colSpan={10} style={{ ...TD, textAlign: 'center', color: 'var(--color-tx3)', padding: 20 }}>Sin miembros en este filtro.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '6px 14px', fontSize: 10, color: 'var(--color-tx3)', borderTop: '1px solid var(--color-border)' }}>
              Trabes: Mu+ = mayor M33 positivo · Mu− = |menor M33 negativo| · Vu = máx |V2| · util = máx(Mu+/MR+, Mu−/MR−, Vu/Vr).
              Columnas: Pu = −axial, Mux = |M33|, Muy = |M22| · util = √[(Mux/MRx)² + (Muy/MRy)²] al nivel de Pu.
              {lastAuto?.unmatched?.length > 0 && ` · ${lastAuto.unmatched.length} miembro(s) del reporte de datos sin empate por nombre (p. ej. "${lastAuto.unmatched[0].seccion}").`}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
