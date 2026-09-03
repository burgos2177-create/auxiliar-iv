import { useMemo, useRef, useState, useEffect } from 'react'
import useBeamStore from '../store/useBeamStore'
import { parseRamStations, looksLikeStations, analyzeGroup, optimizeBase, applyBase, barWeight } from '../core/longitudinal'
import { elevationSvg, diagramSvg } from '../core/longitudinalSvg'
import { parseRamEnvelope } from '../core/ramParser'

const fmt = (v, d = 2) => (v === null || v === undefined || !isFinite(v) ? '—' : Number(v).toFixed(d))
const TD = { padding: '4px 8px', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap', fontSize: 11 }
const TH = { padding: '5px 8px', background: '#1a2040', color: '#fff', fontSize: 10, textAlign: 'left', position: 'sticky', top: 0, zIndex: 1 }

function Pill({ tone, children }) {
  const st = {
    ok: { bg: '#e8f5e9', fg: '#15803d', bd: '#a5d6a7' },
    bad: { bg: '#fdecea', fg: '#c62828', bd: '#ef9a9a' },
    warn: { bg: '#fffbeb', fg: '#92400e', bd: '#fcd34d' },
    info: { bg: '#eff6ff', fg: '#1d4ed8', bd: '#bfdbfe' },
    muted: { bg: 'var(--color-panel)', fg: 'var(--color-tx3)', bd: 'var(--color-border)' },
  }[tone || 'muted']
  return <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 9px', borderRadius: 99, fontFamily: 'var(--font-mono)', background: st.bg, color: st.fg, border: `1px solid ${st.bd}`, whiteSpace: 'nowrap' }}>{children}</span>
}

const statusPill = (r) => r.status === 'insuficiente' ? <Pill tone="bad">✗ insuficiente</Pill>
  : r.shearFail ? <Pill tone="bad">✗ cortante</Pill>
    : r.status === 'baston' ? <Pill tone="info">bastón</Pill> : <Pill tone="ok">✓ corridas</Pill>

const barsTxt = (bars, cal) => bars.length ? bars.map((b) => `${b.k}#${cal} L=${fmt(b.len)} @${fmt(b.x0)}${b.ancla ? ` ⟂${b.ancla}` : ''}`).join(' · ') : '—'

/**
 * Pestaña "Longitudinal": la trabe seleccionada contra el reporte por
 * estaciones de todos sus miembros. Bastones sólo donde y en quien hacen
 * falta, patrones para dibujar pocos detalles, y acero total vs uniforme.
 */
export default function LongitudinalView() {
  const form = useBeamStore((s) => s.form)
  const sections = useBeamStore((s) => s.sections)
  const selectedIdx = useBeamStore((s) => s.selectedIdx)
  const setPerfil = useBeamStore((s) => s.setPerfil)
  const setEnvelope = useBeamStore((s) => s.setEnvelope)
  const setForm = useBeamStore((s) => s.setForm)
  const hasSel = selectedIdx >= 0 && selectedIdx < sections.length

  const fileRef = useRef(null)
  const [msg, setMsg] = useState('')
  const [sel, setSel] = useState(null)      // miembro seleccionado (id)
  const [view, setView] = useState('tabla') // tabla | patrones
  const [showOpt, setShowOpt] = useState(false)
  const [Ltxt, setLtxt] = useState('')

  const perfil = form.perfil
  useEffect(() => { setLtxt(perfil?.L ? String(perfil.L) : '') }, [perfil?.L, selectedIdx])

  const group = useMemo(() => {
    if (!hasSel || !perfil?.members?.length) return null
    try { return analyzeGroup(form, perfil) } catch (e) { console.error(e); return null }
  }, [hasSel, form, perfil])

  const opt = useMemo(() => {
    if (!showOpt || !group) return null
    try { return optimizeBase(form, perfil) } catch (e) { console.error(e); return null }
  }, [showOpt, group, form, perfil])

  const selected = useMemo(() => {
    if (!group) return null
    return group.results.find((r) => r.id === sel) || group.results.find((r) => r.status !== 'ok') || group.results[0]
  }, [group, sel])

  function onFile(e) {
    const file = e.target.files?.[0]; if (!file) return
    const rd = new FileReader()
    rd.onload = (ev) => {
      const text = ev.target.result
      if (!looksLikeStations(text)) {
        const env = parseRamEnvelope(text)
        if (env.points.length) {
          setEnvelope({ archivo: file.name, combo: env.combo, unidades: env.unidades, invertir: false, points: env.points })
          setMsg(`Este archivo es el reporte de máximos por miembro (${new Set(env.points.map((p) => p.member)).size} miembros): se cargó como envolvente de la sección. Para el análisis a lo largo exporta «Envolvente de esfuerzos» por estaciones.`)
        } else setMsg('No se reconoció el formato. Exporta en RAM «Envolvente de esfuerzos» (por estaciones).')
        return
      }
      const P = parseRamStations(text)
      if (!P.members.length) { setMsg(P.warnings[0] || 'Sin miembros.'); return }
      const Lprev = perfil?.L || +(form.calc?.L) || 0
      setPerfil({
        archivo: file.name, combo: P.combo, unidades: P.unidades,
        members: P.members, L: Lprev || 0, Lpor: {}, invertir: !!perfil?.invertir, minLen: perfil?.minLen ?? 0.6,
      })
      // La envolvente de sección (máximos por miembro) sale del mismo reporte
      setEnvelope({ archivo: file.name, combo: P.combo, unidades: P.unidades, invertir: !!perfil?.invertir, points: P.points, fromStations: true })
      const enM = P.members.filter((m) => m.Lreport).length
      setMsg(`${P.members.length} miembros · ${P.members[0].stations.length} estaciones${P.combo ? ` · ${P.combo}` : ''}${enM ? ` · ${enM} con longitud en el reporte` : ' · captura la longitud L del grupo'}${P.warnings.length ? ` · ${P.warnings[0]}` : ''}`)
      setSel(null)
    }
    rd.readAsText(file); e.target.value = ''
  }

  const patchPerfil = (p) => setPerfil({ ...perfil, ...p })
  const commitL = () => { const v = parseFloat(Ltxt); if (v > 0) patchPerfil({ L: v }) }
  const setLpor = (id, v) => {
    const Lpor = { ...(perfil.Lpor || {}) }
    const n = parseFloat(v)
    if (n > 0) Lpor[id] = n; else delete Lpor[id]
    patchPerfil({ Lpor })
  }

  const kgCal = (calNum) => barWeight((({ 2: 0.32, 2.5: 0.49, 3: 0.71, 4: 1.27, 5: 1.98, 6: 2.85, 8: 5.07 })[calNum] || 0))
  void kgCal

  if (!hasSel) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-tx3)' }}>Selecciona una trabe (o crea una con “+ Nueva”) para analizarla a lo largo</div>
  }

  const capsOk = group?.caps.okBase
  const L = perfil?.L || 0
  const needL = group && group.results.some((r) => !(r.L > 0))
  const kInfMismatch = group && group.kMaxInf !== (+form.cantBastonInf || 0)
  const kSupMismatch = group && group.kMaxSup !== (+form.cantBastonSup || 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <input ref={fileRef} data-testid="perfil-file" type="file" accept=".txt,.csv,text/plain" style={{ display: 'none' }} onChange={onFile} />

      {/* Barra superior */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-panel)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: 13 }}>{form.nombre}</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)' }}>
            {form.ancho}×{form.peralte} · corridas {form.cantInf}#{form.calInf} abajo / {form.cantSup}#{form.calSup} arriba · bastón #{form.calBastonInf}/#{form.calBastonSup} · E#{form.calEst}@{form.sepLcuarto}/{form.sepRest}
          </span>
          <button className="btn btn-primary" style={{ fontSize: 11 }} onClick={() => fileRef.current?.click()}>
            📄 Cargar «Envolvente de esfuerzos» por estaciones (RAM .txt)
          </button>
          {perfil?.members?.length > 0 && (
            <>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-tx2)' }}><b>{perfil.archivo}</b> · {perfil.members.length} miembros{perfil.combo ? ` · ${perfil.combo}` : ''}</span>
              <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                L del grupo (m)
                <input className="field-input" data-testid="perfil-L" style={{ width: 70, fontSize: 11 }} value={Ltxt} onChange={(e) => setLtxt(e.target.value)} onBlur={commitL} onKeyDown={(e) => e.key === 'Enter' && commitL()} placeholder="4.00" />
              </label>
              <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }} title="Longitud mínima práctica de un bastón (obra)">
                bastón mín (m)
                <input className="field-input" style={{ width: 60, fontSize: 11 }} type="number" step="0.05" min="0" value={perfil.minLen ?? 0.6} onChange={(e) => patchPerfil({ minLen: Math.max(0, +e.target.value || 0) })} />
              </label>
              <button className="btn btn-secondary" style={{ fontSize: 10 }} onClick={() => { patchPerfil({ invertir: !perfil.invertir }); setEnvelope({ ...(form.envelope || {}), invertir: !perfil.invertir }) }}
                title="Invierte el signo de M33 si en tu modelo el momento positivo va al revés">
                {perfil.invertir ? 'M33 invertido ⇄' : 'M33 normal ⇄'}
              </button>
              <button style={{ fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-tx3)', textDecoration: 'underline' }}
                onClick={() => { setPerfil(null); if (form.envelope?.fromStations) setEnvelope(null); setMsg('') }}>quitar</button>
            </>
          )}
          {!perfil?.members?.length && (
            <span style={{ fontSize: 10.5, color: 'var(--color-tx3)' }}>
              En RAM: Miembros → Envolvente de esfuerzos (por estaciones) de todos los miembros de este tipo de trabe.
            </span>
          )}
        </div>
        {msg && <div style={{ fontSize: 10.5, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)' }}>{msg}</div>}

        {group && (
          <>
            {needL && <div style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '6px 10px' }}>Captura la longitud L del grupo (o por miembro en la tabla) para convertir las estaciones a metros y calcular longitudes de bastón.</div>}
            {!capsOk && <div style={{ fontSize: 11, color: '#c62828', background: '#fdecea', border: '1px solid #ef9a9a', borderRadius: 6, padding: '6px 10px' }}>
              El armado corrido no cumple por sí solo (As mín, As máx o b mín): MR+ {fmt(group.caps.MRP)} · MR− {fmt(group.caps.MRN)} t·m. Sube el armado corrido antes de repartir bastones.
            </div>}
            <div style={{
              padding: '8px 12px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-mono)', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center',
              background: group.allOk && capsOk ? '#e8f5e9' : group.nInsuf || group.nShear || !capsOk ? '#fdecea' : '#fffbeb',
              border: `1px solid ${group.allOk && capsOk ? '#a5d6a7' : group.nInsuf || group.nShear || !capsOk ? '#ef9a9a' : '#fcd34d'}`,
            }}>
              <b>{group.n} miembros:</b>
              <span style={{ color: '#15803d' }}>{group.nOk} pasan con corridas</span>
              <span style={{ color: '#1d4ed8' }}>{group.nBast} con bastón</span>
              {group.nInsuf > 0 && <span style={{ color: '#c62828' }}>{group.nInsuf} insuficientes</span>}
              {group.nShear > 0 && <span style={{ color: '#c62828' }}>{group.nShear} fallan por cortante</span>}
              <span style={{ color: 'var(--color-tx3)' }}>MR+ {fmt(group.caps.MRP)} · MR− {fmt(group.caps.MRN)} t·m</span>
              <span style={{ marginLeft: 'auto' }}>
                acero: <b>{fmt(group.acero.total, 0)} kg</b> ({fmt(group.acero.base, 0)} corridas + {fmt(group.acero.bastones, 0)} bastones)
                {group.acero.uniforme != null && <> · uniforme {group.uniforme.inf.n}#{group.uniforme.inf.bar.num}/{group.uniforme.sup.n}#{group.uniforme.sup.bar.num}: {fmt(group.acero.uniforme, 0)} kg → <b style={{ color: group.acero.ahorro > 0 ? '#15803d' : '#92400e' }}>{group.acero.ahorro >= 0 ? 'ahorro' : 'exceso'} {fmt(Math.abs(group.acero.ahorro), 0)} kg ({fmt(100 * Math.abs(group.acero.ahorro) / group.acero.uniforme, 0)} %)</b></>}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {(kInfMismatch || kSupMismatch) && (
                <button className="btn btn-secondary" style={{ fontSize: 10.5, color: '#92400e', borderColor: '#fcd34d' }}
                  onClick={() => setForm({ cantBastonInf: group.kMaxInf, cantBastonSup: group.kMaxSup })}
                  title="La sección dibuja los bastones máximos del grupo para que el corte y el alzado coincidan">
                  ⚠ Sección con {form.cantBastonInf}/{form.cantBastonSup} bastones vs máx. del grupo {group.kMaxInf}/{group.kMaxSup} — actualizar sección
                </button>
              )}
              <button className="btn btn-secondary" style={{ fontSize: 10.5 }} onClick={() => setShowOpt((v) => !v)}>
                {showOpt ? 'Ocultar optimizador' : '⚙ Optimizar armado corrido (mínimo acero)'}
              </button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                {[['tabla', 'Miembros'], ['patrones', `Patrones (${group.patterns.length})`]].map(([id, lbl]) => (
                  <button key={id} onClick={() => setView(id)} className="btn" style={{ fontSize: 11, padding: '4px 12px', background: view === id ? 'var(--color-accent)' : 'var(--color-panel)', color: view === id ? '#fff' : 'var(--color-tx2)', border: '1px solid var(--color-border)' }}>{lbl}</button>
                ))}
              </div>
            </div>
            {showOpt && opt && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Armado corrido de mínimo acero (corridas + bastones, todos los miembros cubiertos, bastón del mismo calibre)</div>
                {[['inf', 'Lecho inferior (M+)'], ['sup', 'Lecho superior (M−)']].map(([k, lbl]) => (
                  <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 3 }}>
                    <span style={{ minWidth: 150, color: 'var(--color-tx3)' }}>{lbl}:</span>
                    {opt[k].feasible.slice(0, 4).map((r, i) => (
                      <span key={r.cal + r.n} style={{ padding: '2px 8px', borderRadius: 5, background: i === 0 ? '#e8f5e9' : 'var(--color-panel)', border: `1px solid ${i === 0 ? '#a5d6a7' : 'var(--color-border)'}` }}>
                        <b>{r.n}#{r.cal}</b> {fmt(r.kg, 0)} kg · MR {fmt(r.MR)} · {r.nBast} c/bastón
                      </span>
                    ))}
                    {!opt[k].feasible.length && <span style={{ color: '#c62828' }}>ningún armado de #3–#6 cubre todos los miembros con esta sección</span>}
                  </div>
                ))}
                {(opt.best.inf || opt.best.sup) && (
                  <button className="btn btn-primary" style={{ fontSize: 11, marginTop: 8 }}
                    onClick={() => { const g2 = analyzeGroup({ ...form, ...applyBase(form, opt.best) }, perfil); setForm(applyBase(form, opt.best, g2.kMaxInf, g2.kMaxSup)); setShowOpt(false) }}>
                    ← Aplicar a la sección ({opt.best.inf ? `${opt.best.inf.n}#${opt.best.inf.cal}` : '—'} abajo / {opt.best.sup ? `${opt.best.sup.n}#${opt.best.sup.cal}` : '—'} arriba)
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {group && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Izquierda: tabla de miembros o patrones */}
          <div style={{ width: view === 'tabla' ? 560 : 420, minWidth: 380, borderRight: '1px solid var(--color-border)', overflow: 'auto' }}>
            {view === 'tabla' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)' }}>
                <thead><tr>
                  <th style={TH}>Miembro</th><th style={TH}>L (m)</th><th style={TH}>Mu+</th><th style={TH}>Mu−</th><th style={TH}>Vu</th>
                  <th style={TH}>Bastón inf.</th><th style={TH}>Bastón sup.</th><th style={TH}>Estado</th>
                </tr></thead>
                <tbody>
                  {group.results.map((r) => (
                    <tr key={r.id} onClick={() => setSel(r.id)} style={{ cursor: 'pointer', background: selected?.id === r.id ? 'rgba(91,197,174,0.12)' : r.status === 'insuficiente' || r.shearFail ? 'rgba(198,40,40,0.05)' : undefined }}>
                      <td style={{ ...TD, fontWeight: 700 }}>M-{r.id}</td>
                      <td style={TD}>
                        {perfil.members.find((m) => m.id === r.id)?.Lreport
                          ? fmt(r.L)
                          : <input className="field-input" style={{ width: 56, fontSize: 10.5, padding: '1px 4px' }} placeholder={fmt(L)} value={perfil.Lpor?.[r.id] ?? ''} onChange={(e) => setLpor(r.id, e.target.value)} onClick={(e) => e.stopPropagation()} />}
                      </td>
                      <td style={{ ...TD, color: r.profile.muPmax > group.caps.MRP ? '#1d4ed8' : undefined }}>{fmt(r.profile.muPmax)}</td>
                      <td style={{ ...TD, color: r.profile.muNmax > group.caps.MRN ? '#c94f2a' : undefined }}>{fmt(r.profile.muNmax)}</td>
                      <td style={{ ...TD, color: r.shearFail ? '#c62828' : undefined }}>{fmt(r.profile.vuMax)}</td>
                      <td style={{ ...TD, color: '#2563a8', whiteSpace: 'normal' }}>{barsTxt(r.inf.bars, form.calBastonInf)}</td>
                      <td style={{ ...TD, color: '#c94f2a', whiteSpace: 'normal' }}>{barsTxt(r.sup.bars, form.calBastonSup)}</td>
                      <td style={TD}>{statusPill(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.patterns.map((p) => (
                  <div key={p.signature} onClick={() => setSel(p.sample.id)} style={{ padding: '8px 10px', borderRadius: 7, cursor: 'pointer', background: selected?.signature === p.signature ? 'rgba(91,197,174,0.12)' : 'var(--color-bg)', border: `1px solid ${selected?.signature === p.signature ? 'var(--color-accent)' : 'var(--color-border)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800 }}>Patrón {p.label}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)' }}>{p.members.length} miembro{p.members.length !== 1 ? 's' : ''}</span>
                      <span style={{ marginLeft: 'auto' }}>{statusPill(p.sample)}</span>
                    </div>
                    <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                      <div style={{ color: '#2563a8' }}>inf: {barsTxt(p.sample.inf.bars, form.calBastonInf)}</div>
                      <div style={{ color: '#c94f2a' }}>sup: {barsTxt(p.sample.sup.bars, form.calBastonSup)}</div>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-tx3)', marginTop: 4, fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>M-{p.members.join(', M-')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Derecha: diagramas + alzado del miembro/patrón seleccionado */}
          <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {selected && (
              <>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>
                  <b>M-{selected.id}</b> {statusPill(selected)}
                  <span>Mu+ {fmt(selected.profile.muPmax)} / MR+ {fmt(group.caps.MRP)}</span>
                  <span>Mu− {fmt(selected.profile.muNmax)} / MR− {fmt(group.caps.MRN)}</span>
                  <span>Vu {fmt(selected.profile.vuMax)} / Vr L4 {fmt(selected.shear.extremos.Vr)} · centro {fmt(selected.shear.centro.Vr)}</span>
                  {selected.shear.extremos.ok === false && <Pill tone="bad">extremos: E@{selected.shear.extremos.sReq ?? '—'} necesario</Pill>}
                  {selected.shear.centro.ok === false && <Pill tone="bad">centro: E@{selected.shear.centro.sReq ?? '—'} necesario</Pill>}
                  <span style={{ color: 'var(--color-tx3)' }}>Ld bastón {fmt(group.caps.inf.Ld.Ld, 0)}/{fmt(group.caps.sup.Ld.Ld, 0)} cm · prolongación ≥ máx(d, 12db) = {fmt(group.caps.inf.ext, 0)} cm</span>
                </div>
                {selected.status === 'insuficiente' && (
                  <div style={{ fontSize: 11, color: '#c62828', background: '#fdecea', border: '1px solid #ef9a9a', borderRadius: 6, padding: '6px 10px' }}>
                    Ni con {group.caps.inf.kMax}/{group.caps.sup.kMax} bastones (uno por varilla) alcanza:
                    {selected.inf.need.map((n, i) => <span key={'i' + i}> M+ {fmt(n.peak)} en x={fmt(n.peakX)} m (MR máx {fmt(n.MRmax)}).</span>)}
                    {selected.sup.need.map((n, i) => <span key={'s' + i}> M− {fmt(n.peak)} en x={fmt(n.peakX)} m (MR máx {fmt(n.MRmax)}).</span>)}
                    {' '}Sube el armado corrido o la sección.
                  </div>
                )}
                {[...selected.inf.bars, ...selected.sup.bars].some((b) => b.corteTension?.length) && (
                  <div style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '6px 10px' }}>
                    Un bastón se corta en zona de tensión con Vu &gt; ⅔·Vr en el punto de corte (NTC §5.1.4.1): prolónguelo o añada estribos en ese tramo.
                  </div>
                )}
                <div dangerouslySetInnerHTML={{ __html: diagramSvg(selected, group.caps, { width: 760 }) }} />
                <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: 6 }}
                  dangerouslySetInnerHTML={{ __html: elevationSvg(form, selected, { scale: 4.2, title: `${form.nombre} · M-${selected.id}${view === 'patrones' ? ` · patrón ${group.patterns.find((p) => p.signature === selected.signature)?.label || ''}` : ''}` }).svg.replace('<svg ', '<svg style="max-width:100%;height:auto" ') }} />
                <div style={{ fontSize: 10, color: 'var(--color-tx3)' }}>
                  Bastón: desde el punto donde Mu rebasa el MR de las corridas, prolongado ≥ máx(d, 12db) y con Ld desde el pico; longitudes a múltiplos de 5 cm, medidas desde el apoyo I. Los que llegan a un apoyo se anclan en él (gancho). Cortante por zonas: extremos L/4 con @{form.sepLcuarto}, centro con @{form.sepRest}. El alzado va al DXF a escala real junto con las secciones.
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
