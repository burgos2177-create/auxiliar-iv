import { useState, useEffect, useCallback } from 'react'
import useBeamStore from '../store/useBeamStore'
import { REBAR_OPTIONS, STIRRUP_OPTIONS } from '../core/constants'
import { matchSection, addViga, getDB, onDBChange } from '../core/globalDB'

function Field({ label, children }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  )
}

function Row({ children }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>
}

// ── Badge colors ──────────────────────────────────────────
const BADGE_STYLES = {
  db_match:   { bg: 'rgba(91,197,174,0.15)', border: 'var(--color-accent)', color: 'var(--color-accent2)', icon: '🟢', label: 'De BD Global' },
  db_partial: { bg: '#fffbeb', border: '#f59e0b', color: '#92400e', icon: '🟡', label: 'Basada en BD · modificada' },
  new_design: { bg: 'var(--color-bg)', border: 'var(--color-border)', color: 'var(--color-tx3)', icon: '⚪', label: 'Trabe nueva · no guardada' },
}

function DBBadge({ status, gid }) {
  if (!status) return null
  const s = BADGE_STYLES[status] || BADGE_STYLES.new_design
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 10px', borderRadius: 5,
      background: s.bg, border: `1px solid ${s.border}`,
      fontSize: 10, fontFamily: 'var(--font-mono)', color: s.color,
      marginBottom: 4,
    }}>
      <span>{s.icon}</span>
      <span style={{ fontWeight: 600 }}>{s.label}</span>
      {gid && <span style={{ opacity: 0.6 }}>· {gid}</span>}
    </div>
  )
}


export default function BeamForm() {
  const form = useBeamStore((s) => s.form)
  const set = useBeamStore((s) => s.setForm)
  const selectedIdx = useBeamStore((s) => s.selectedIdx)
  const sections = useBeamStore((s) => s.sections)
  const dbStatus = useBeamStore((s) => s.dbStatus)
  const setDbStatus = useBeamStore((s) => s.setDbStatus)

  const [bdToast, setBdToast] = useState(null)
  const [dbReady, setDbReady] = useState(false)

  const num = (key) => (e) => {
    const v = e.target.value
    set({ [key]: v === '' ? '' : Number(v) })
  }
  const str = (key) => (e) => set({ [key]: e.target.value })

  const hasSelection = selectedIdx >= 0 && selectedIdx < sections.length
  const disabled = !hasSelection

  // Track DB readiness
  useEffect(() => {
    const db = getDB()
    if (db.ready) setDbReady(true)
    return onDBChange((d) => { if (d.ready) setDbReady(true) })
  }, [])

  // Match section against DB whenever form changes
  useEffect(() => {
    if (!hasSelection || !dbReady) return
    const match = matchSection(form)
    setDbStatus(match)
  }, [form.ancho, form.peralte, form.cantInf, form.calInf, form.cantSup, form.calSup,
    form.cantBastonInf, form.calBastonInf, form.cantBastonSup, form.calBastonSup,
    hasSelection, dbReady]) // eslint-disable-line


  // Add current section to BD
  const handleAddToBD = useCallback(() => {
    const mrP = +form.mrPos || 0
    const mrN = +form.mrNeg || 0
    const muP = +form.muPos || 0
    const muN = +form.muNeg || 0
    const vr = +form.vr || 0
    const vu = +form.vu || 0

    // Validate all checks pass
    if (muP > 0 && mrP < muP) { setBdToast('✗ Mr+ < Mu+ — no pasa'); setTimeout(() => setBdToast(null), 3000); return }
    if (muN > 0 && mrN < muN) { setBdToast('✗ Mr− < Mu− — no pasa'); setTimeout(() => setBdToast(null), 3000); return }
    if (vu > 0 && vr < vu) { setBdToast('✗ Vr < Vu — no pasa'); setTimeout(() => setBdToast(null), 3000); return }
    if (mrP <= 0 && mrN <= 0) { setBdToast('✗ Sin resultados de cálculo'); setTimeout(() => setBdToast(null), 3000); return }

    const entry = {
      MuP: muP, MuN: muN,
      b: +form.ancho, h: +form.peralte,
      nP: +form.cantInf, vP: +form.calInf,
      AsP: 0, MRT_P: mrP,
      nN: +form.cantSup, vN: +form.calSup,
      AsN: 0, MRT_N: mrN,
    }
    if (+form.cantBastonInf > 0) entry.bP = [+form.cantBastonInf, +form.calBastonInf]
    if (+form.cantBastonSup > 0) entry.bN = [+form.cantBastonSup, +form.calBastonSup]

    const res = addViga(entry)
    if (res.added) {
      setBdToast(`✓ ${res.gid} añadida a BD Global`)
    } else {
      setBdToast(`Ya existe: ${res.gid}`)
    }
    setTimeout(() => setBdToast(null), 3000)
  }, [form])

  const canAddToBD = hasSelection && dbStatus?.status !== 'db_match' &&
    ((+form.mrPos > 0 && (+form.muPos <= 0 || +form.mrPos >= +form.muPos)) ||
     (+form.mrNeg > 0 && (+form.muNeg <= 0 || +form.mrNeg >= +form.muNeg)))

  return (
    <div className="sidebar">
      {!hasSelection && (
        <div style={{
          padding: '20px 12px',
          textAlign: 'center',
          color: 'var(--color-tx3)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
        }}>
          Selecciona una secci&oacute;n del toolbar o crea una nueva con el bot&oacute;n &ldquo;+&rdquo;
        </div>
      )}

      {hasSelection && (
        <>
          {/* ── BD Status Badge ── */}
          <DBBadge status={dbStatus?.status} gid={dbStatus?.gid} />

          {/* ── Nombre ── */}
          <div>
            <div className="section-title">Identificaci&oacute;n</div>
            <div className="mt-2">
              <Field label="Nombre de secci&oacute;n">
                <input className="field-input" value={form.nombre} onChange={str('nombre')} placeholder="ej: V-1 izq" />
              </Field>
            </div>
          </div>

          {/* ── Geometría ── */}
          <div>
            <div className="section-title">Geometr&iacute;a (cm)</div>
            <div className="mt-2 flex flex-col gap-2">
              <Row>
                <Field label="Ancho (b)">
                  <input className="field-input" type="number" min="10" max="200" value={form.ancho} onChange={num('ancho')} />
                </Field>
                <Field label="Peralte (h)">
                  <input className="field-input" type="number" min="15" max="300" value={form.peralte} onChange={num('peralte')} />
                </Field>
              </Row>
              <Row>
                <Field label="Recubrimiento (r)">
                  <input className="field-input" type="number" min="1" max="10" step="0.5" value={form.recub} onChange={num('recub')} />
                </Field>
                <Field label="f'c (kg/cm²)">
                  <input className="field-input" type="number" min="100" max="700" step="10" value={form.fc} onChange={num('fc')} />
                </Field>
              </Row>
            </div>
          </div>

          {/* ── Acero superior ── */}
          <div>
            <div className="section-title" style={{ color: 'var(--color-steel-top)' }}>Acero superior</div>
            <div className="mt-2 flex flex-col gap-2">
              <Row>
                <Field label="Calibre (#)">
                  <select className="field-select" value={form.calSup} onChange={str('calSup')}>
                    {REBAR_OPTIONS.map((v) => <option key={v} value={v}>#{v}</option>)}
                  </select>
                </Field>
                <Field label="Cantidad">
                  <input className="field-input" type="number" min="1" max="20" value={form.cantSup} onChange={num('cantSup')} />
                </Field>
              </Row>
              {/* Bastón superior */}
              <div style={{ paddingLeft: 8, borderLeft: '2px solid var(--color-steel-top)', opacity: 0.85 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Bast&oacute;n sup. (0–2)
                </div>
                <Row>
                  <Field label="Calibre">
                    <select className="field-select" value={form.calBastonSup} onChange={str('calBastonSup')}>
                      {REBAR_OPTIONS.map((v) => <option key={v} value={v}>#{v}</option>)}
                    </select>
                  </Field>
                  <Field label="Cantidad">
                    <input className="field-input" type="number" min="0" max="2" value={form.cantBastonSup} onChange={num('cantBastonSup')} />
                  </Field>
                </Row>
              </div>
            </div>
          </div>

          {/* ── Acero inferior ── */}
          <div>
            <div className="section-title" style={{ color: 'var(--color-steel-bot)' }}>Acero inferior</div>
            <div className="mt-2 flex flex-col gap-2">
              <Row>
                <Field label="Calibre (#)">
                  <select className="field-select" value={form.calInf} onChange={str('calInf')}>
                    {REBAR_OPTIONS.map((v) => <option key={v} value={v}>#{v}</option>)}
                  </select>
                </Field>
                <Field label="Cantidad">
                  <input className="field-input" type="number" min="1" max="20" value={form.cantInf} onChange={num('cantInf')} />
                </Field>
              </Row>
              {/* Bastón inferior */}
              <div style={{ paddingLeft: 8, borderLeft: '2px solid var(--color-steel-bot)', opacity: 0.85 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Bast&oacute;n inf. (0–2)
                </div>
                <Row>
                  <Field label="Calibre">
                    <select className="field-select" value={form.calBastonInf} onChange={str('calBastonInf')}>
                      {REBAR_OPTIONS.map((v) => <option key={v} value={v}>#{v}</option>)}
                    </select>
                  </Field>
                  <Field label="Cantidad">
                    <input className="field-input" type="number" min="0" max="2" value={form.cantBastonInf} onChange={num('cantBastonInf')} />
                  </Field>
                </Row>
              </div>
            </div>
          </div>

          {/* ── Momentos ── */}
          <div>
            <div className="section-title">Momentos (t&middot;m)</div>
            <div className="mt-2 flex flex-col gap-2">
              <Row>
                <Field label="Mr (+)">
                  <input className="field-input" type="number" step="0.01" value={form.mrPos ?? ''} readOnly disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} placeholder="—" title="Calculado automáticamente" />
                </Field>
                <Field label="Mu (+)">
                  <input className="field-input" type="number" step="0.01" value={form.muPos ?? ''} onChange={num('muPos')} placeholder="—" />
                </Field>
              </Row>
              <Row>
                <Field label="Mr (−)">
                  <input className="field-input" type="number" step="0.01" value={form.mrNeg ?? ''} readOnly disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} placeholder="—" title="Calculado automáticamente" />
                </Field>
                <Field label="Mu (−)">
                  <input className="field-input" type="number" step="0.01" value={form.muNeg ?? ''} onChange={num('muNeg')} placeholder="—" />
                </Field>
              </Row>
            </div>
          </div>

          {/* ── Estribos ── */}
          <div>
            <div className="section-title" style={{ color: 'var(--color-accent2)' }}>Estribos</div>
            <div className="mt-2 flex flex-col gap-2">
              <Field label="Calibre estribo (#)">
                <select className="field-select" value={form.calEst} onChange={str('calEst')}>
                  {STIRRUP_OPTIONS.map((v) => <option key={v} value={v}>#{v}</option>)}
                </select>
              </Field>
              <Row>
                <Field label="Sep. L/4 (cm)">
                  <input className="field-input" type="number" min="3" max="40" value={form.sepLcuarto} onChange={num('sepLcuarto')} />
                </Field>
                <Field label="Sep. resto (cm)">
                  <input className="field-input" type="number" min="3" max="40" value={form.sepRest} onChange={num('sepRest')} />
                </Field>
              </Row>
            </div>
          </div>

          {/* ── Cortantes ── */}
          <div>
            <div className="section-title" style={{ color: '#9333ea' }}>Cortantes (t)</div>
            <div className="mt-2 flex flex-col gap-2">
              <Row>
                <Field label="Vu">
                  <input className="field-input" type="number" step="0.01" value={form.vu ?? ''} onChange={num('vu')} placeholder="—" />
                </Field>
                <Field label="Vr">
                  <input className="field-input" type="number" step="0.01" value={form.vr ?? ''} readOnly disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} placeholder="—" title="Calculado automáticamente" />
                </Field>
              </Row>
            </div>
          </div>
          {/* ── Añadir a BD Global ── */}
          <div style={{ paddingTop: 4 }}>
            <button
              className="btn"
              disabled={!canAddToBD}
              onClick={handleAddToBD}
              style={{
                width: '100%', justifyContent: 'center',
                background: canAddToBD ? 'var(--color-accent2)' : 'var(--color-border)',
                color: canAddToBD ? '#fff' : 'var(--color-tx3)',
                fontSize: 11, fontFamily: 'var(--font-mono)',
              }}>
              + Añadir a BD Global
            </button>
            {bdToast && (
              <div style={{
                marginTop: 6, fontSize: 10, fontFamily: 'var(--font-mono)',
                padding: '4px 8px', borderRadius: 4, textAlign: 'center',
                background: bdToast.startsWith('✓') ? '#f0fdf4' : '#fef2f2',
                color: bdToast.startsWith('✓') ? '#15803d' : '#dc2626',
                border: `1px solid ${bdToast.startsWith('✓') ? '#86efac' : '#fca5a5'}`,
              }}>{bdToast}</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
