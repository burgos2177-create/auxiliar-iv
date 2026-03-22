import { useState, useMemo, useEffect, useRef } from 'react'
import useBeamStore from '../store/useBeamStore'
import { VARILLAS, calcFlexion, calcCortante } from '../core/sectionCalculator'
import MemoriaView from './MemoriaView'

// ── Helpers ─────────────────────────────────────────────────
function fmt(v, dec = 4) {
  if (v === null || v === undefined || isNaN(v)) return '—'
  return Number(v).toFixed(dec)
}

const VAR_OPTS = VARILLAS.map((v) => ({
  value: v.num,
  label: `#${v.num} — Ø${(v.diam * 10).toFixed(1)}mm | A=${v.area}cm²`,
}))

// ── Mapping from detailer rebar string to VARILLAS num ──────
const CAL_TO_NUM = { '2': 2, '2.5': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10 }

// ── Small UI components ─────────────────────────────────────
function Tag({ ok, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 8px', borderRadius: 3, fontSize: 11, fontWeight: 700,
      background: ok ? '#e8f5e9' : '#fdecea',
      color: ok ? '#2e7d32' : '#c62828',
      border: `1px solid ${ok ? '#a5d6a7' : '#ef9a9a'}`,
    }}>
      {ok ? '✓' : '✗'} {children}
    </span>
  )
}

function CalcRow({ label, value, unit, tag, dim = false, tooltip }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  return (
    <>
      <div
        onMouseEnter={() => { if (tooltip) setShow(true) }}
        onMouseMove={(e) => { if (tooltip) setPos({ x: e.clientX, y: e.clientY }) }}
        onMouseLeave={() => setShow(false)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '5px 6px', borderBottom: '1px solid var(--color-border)',
          background: show ? '#fff8e1' : 'transparent',
          transition: 'background 0.1s',
        }}
      >
        <span style={{
          color: show ? '#b45309' : dim ? 'var(--color-tx3)' : 'var(--color-tx2)',
          fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {label}
          {tooltip && <span style={{ fontSize: 9, opacity: 0.4, color: '#b45309' }}>ⓘ</span>}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {value !== undefined && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: dim ? 'var(--color-tx3)' : 'var(--color-tx)', fontWeight: 600,
            }}>
              {typeof value === 'number' ? value.toFixed(4) : value}
              {unit && <span style={{ color: 'var(--color-tx3)', fontSize: 10, marginLeft: 3 }}>{unit}</span>}
            </span>
          )}
          {tag}
        </div>
      </div>

      {show && tooltip && (
        <div style={{
          position: 'fixed',
          left: Math.min(pos.x + 12, window.innerWidth - 290),
          top: pos.y + 16,
          zIndex: 9999,
          background: '#1a2040',
          border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: 8, padding: '10px 14px', maxWidth: 275,
          pointerEvents: 'none',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        }}>
          <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Fórmula
          </div>
          <div style={{ fontSize: 12.5, color: '#e2e8f0', fontFamily: 'Georgia, serif', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {tooltip.formula}
          </div>
          {tooltip.vars && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {tooltip.vars.map((v) => (
                <span key={v} style={{
                  background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: 4, padding: '1px 7px', fontSize: 11,
                  color: '#fbbf24', fontFamily: 'var(--font-mono)',
                }}>{v}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

function CInput({ label, value, onChange, unit, min, step = 'any', style: extraStyle }) {
  return (
    <div style={{ marginBottom: 6, ...extraStyle }}>
      <label className="field-label">{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="number" value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min} step={step}
          className="field-input"
          style={{ flex: 1 }}
        />
        {unit && <span style={{ color: 'var(--color-tx3)', fontSize: 11, minWidth: 36, flexShrink: 0 }}>{unit}</span>}
      </div>
    </div>
  )
}

function CSelect({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <label className="field-label">{label}</label>
      <select
        className="field-select"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function SectionHeader({ children, style }) {
  return (
    <div className="section-title" style={{ marginTop: 8, ...style }}>
      {children}
    </div>
  )
}

// ── Tooltips ────────────────────────────────────────────────
const TT = {
  d: { formula: 'd = h − r', vars: ['h', 'r'] },
  Rn: { formula: 'Rn = Mu / (FR × b × d²)', vars: ['Mu', 'FR', 'b', 'd'] },
  rhoCalc: { formula: 'ρ = (f\'\'c / fy) × [1 − √(1 − 2·Rn / f\'\'c)]', vars: ['f\'\'c', 'fy', 'Rn'] },
  AsCalc: { formula: 'As_calc = ρ × b × d', vars: ['ρ', 'b', 'd'] },
  AsMin: { formula: 'As_min = (0.7 × √f\'c / fy) × b × d', vars: ['f\'c', 'fy', 'b', 'd'] },
  AsMax: { formula: 'As_max = 0.90 × As_bal\nAs_bal = ρ_bal × b × d', vars: ['ρ_bal', 'b', 'd'] },
  AsReq: { formula: 'As_req = máx(As_calc, As_min)', vars: ['As_calc', 'As_min'] },
  rhoReal: { formula: 'ρ_real = As_total / (b × d)', vars: ['As_total', 'b', 'd'] },
  q: { formula: 'q = ρ_real × fy / f\'\'c', vars: ['ρ_real', 'fy', 'f\'\'c'] },
  MRT: { formula: 'MRT = FR × As_total × fy × (d − a/2)\na = As_total × fy / (f\'\'c × b)', vars: ['FR', 'As_total', 'fy', 'd', 'a'] },
  bMin: { formula: 'b_min = 2r + (2n − 1) × Ø_varilla', vars: ['r', 'n', 'Ø_varilla'] },
}

const TC = {
  VCR_a: { formula: 'VCR_a = FR · 0.5 · √f\'c · b · d\n[NTC-2023 ec. 5.5.3.1.1.a]', vars: ['FR', 'f\'c', 'b', 'd'] },
  VCR_b: { formula: 'VCR_b = FR · 2 · ρ^(1/3) · √f\'c · b · d\n[NTC-2023 ec. 5.5.3.1.1.b]', vars: ['FR', 'ρ', 'f\'c', 'b', 'd'] },
  VCR: { formula: 'VCR = max(VCR_a, VCR_b)\nacotado a [VCR_min, VCR_max]', vars: ['VCR_a', 'VCR_b'] },
  VaMax: { formula: 'Va_max = VCR + FR · 2.2 · √f\'c · b · d\n[NTC-2023 ec. 5.5.2.2]', vars: ['VCR', 'FR', 'f\'c', 'b', 'd'] },
  VsrNec: { formula: 'VSR_nec = Vu − VCR\n[NTC-2023 ec. 5.5.1.1]', vars: ['Vu', 'VCR'] },
  SCalc: { formula: 'S = FR · Av · fy · d / VSR_nec\n[NTC-2023 ec. 5.5.3.6.1.b]', vars: ['FR', 'Av', 'fy', 'd', 'VSR_nec'] },
  Vr: { formula: 'Vr = VCR + VSR\n[NTC-2023 ec. 5.5.1.1]', vars: ['VCR', 'VSR'] },
}

// ── Flexion results panel ───────────────────────────────────
function FlexionPanel({ res, label, accentColor, lecho }) {
  if (!res || res.error) {
    return (
      <div style={{ color: '#c62828', padding: 10, background: '#fdecea', borderRadius: 6, fontSize: 13 }}>
        {res?.error || 'Sin datos'}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        color: accentColor, textTransform: 'uppercase', marginBottom: 8,
        paddingBottom: 4, borderBottom: `1px solid ${accentColor}33`,
      }}>
        {label}
      </div>

      <CalcRow label="d" value={res.d} unit="cm" tooltip={TT.d} />
      <CalcRow label="Rn" value={res.Rn} unit="kg/cm²" tooltip={TT.Rn} />
      <CalcRow label="ρ calculada" value={res.rhoCalc} tooltip={TT.rhoCalc} />
      <CalcRow label="As calculado" value={res.AsCalc} unit="cm²" tooltip={TT.AsCalc} />
      <CalcRow label="As mínimo" value={res.AsMin} unit="cm²" tooltip={TT.AsMin} />
      <CalcRow label="As máximo" value={res.AsMax} unit="cm²" tooltip={TT.AsMax} />
      <CalcRow label="As requerido" value={res.AsReq} unit="cm²" tooltip={TT.AsReq} />
      <CalcRow label="ρ real" value={res.rhoReal} tooltip={TT.rhoReal} />
      <CalcRow label="q = ρ·fy / f''c" value={res.q} tooltip={TT.q} />
      <CalcRow label="Varillas calculadas" value={res.nCalc} />
      <CalcRow label="Varillas usadas" value={res.nUsed} />

      {/* As breakdown */}
      <div style={{
        margin: '8px 0', padding: '8px 10px', borderRadius: 6,
        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
      }}>
        <div style={{ fontSize: 10, color: 'var(--color-tx3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          Desglose As — {lecho}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0', borderBottom: '1px dashed var(--color-border)' }}>
          <span style={{ color: 'var(--color-tx3)' }}>{res.nUsed} var. #{res.vr.num}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: accentColor }}>{res.AsBarras.toFixed(2)} cm²</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0', borderBottom: '1px dashed var(--color-border)', opacity: res.nBastones > 0 ? 1 : 0.4 }}>
          <span style={{ color: 'var(--color-tx3)' }}>{res.nBastones > 0 ? `${res.nBastones} bastón(es) #${res.vb.num}` : 'Sin bastones'}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#2a9da8' }}>{res.AsBastones > 0 ? `+${res.AsBastones.toFixed(2)} cm²` : '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingTop: 4, fontWeight: 700 }}>
          <span>As total</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{res.AsTotal.toFixed(2)} cm²</span>
        </div>
      </div>

      <CalcRow label="b mínimo" value={res.bMin} unit="cm" tooltip={TT.bMin}
        tag={<Tag ok={res.okBmin}>b {res.okBmin ? 'OK' : '< bmin'}</Tag>} />
      <CalcRow label="MRT (acero)" value={res.MRT} unit="ton·m" tooltip={TT.MRT}
        tag={<Tag ok={res.okMR}>MR {res.okMR ? '≥ Mu' : '< Mu'}</Tag>} />
      <CalcRow label="MRC (concreto)" value={res.MRC} unit="ton·m" />

      {/* Tags */}
      <div style={{
        marginTop: 8, padding: '6px 10px', borderRadius: 6,
        background: (res.okMin && res.okMax && res.okMR && res.okBmin) ? '#e8f5e9' : '#fdecea',
        border: `1px solid ${(res.okMin && res.okMax && res.okMR && res.okBmin) ? '#a5d6a7' : '#ef9a9a'}`,
        display: 'flex', flexWrap: 'wrap', gap: 4,
      }}>
        <Tag ok={res.okMin}>As ≥ As min</Tag>
        <Tag ok={res.okMax}>As ≤ As max</Tag>
        <Tag ok={res.okMR}>MR ≥ Mu</Tag>
        <Tag ok={res.okBmin}>b ≥ b min</Tag>
      </div>

      {(res.okMin && res.okMax && res.okMR && res.okBmin) && (
        <div style={{
          marginTop: 6, padding: '6px 10px', borderRadius: 6,
          background: '#e8f5e9', color: '#2e7d32',
          fontWeight: 700, fontSize: 12, textAlign: 'center',
        }}>
          ✓ {res.nUsed} var. #{res.vr.num}
          {res.nBastones > 0 && <span style={{ color: '#2a9da8' }}> + {res.nBastones} bastón(es) #{res.vb.num}</span>}
          {' '}— As = {res.AsTotal.toFixed(2)} cm²
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Main CalculatorView component
// ═══════════════════════════════════════════════════════════════
export default function CalculatorView() {
  const form = useBeamStore((s) => s.form)
  const calc = form.calc || {}
  const setCalc = useBeamStore((s) => s.setCalc)
  const syncCalcResults = useBeamStore((s) => s.syncCalcResults)
  const setCalcAlert = useBeamStore((s) => s.setCalcAlert)
  const selectedIdx = useBeamStore((s) => s.selectedIdx)
  const sections = useBeamStore((s) => s.sections)

  const [calcTab, setCalcTab] = useState('flexion')
  const prevIdxRef = useRef(selectedIdx)

  const hasSelection = selectedIdx >= 0 && selectedIdx < sections.length
  const { ancho: b, peralte: h, recub: r, fc } = form
  const { fy } = calc

  // ── Auto-prefill from detailer when switching sections ────
  useEffect(() => {
    if (!hasSelection) return
    if (prevIdxRef.current !== selectedIdx) {
      prevIdxRef.current = selectedIdx
      const sec = sections[selectedIdx]
      if (!sec) return

      const patch = {}
      // Map detailer calibre string → VARILLAS num
      const supNum = CAL_TO_NUM[sec.calSup] || 3
      const infNum = CAL_TO_NUM[sec.calInf] || 3
      const estNum = CAL_TO_NUM[sec.calEst] || 2

      patch.varNNum = supNum
      patch.varNCount = Number(sec.cantSup) || 0
      patch.varPNum = infNum
      patch.varPCount = Number(sec.cantInf) || 0
      patch.varEstNum = estNum

      // Prefill bastones from detailer
      if (sec.cantBastonSup > 0) {
        patch.bastonNNum = CAL_TO_NUM[sec.calBastonSup] || supNum
        patch.bastonNCount = Math.min(Number(sec.cantBastonSup) || 0, 2)
      }
      if (sec.cantBastonInf > 0) {
        patch.bastonPNum = CAL_TO_NUM[sec.calBastonInf] || infNum
        patch.bastonPCount = Math.min(Number(sec.cantBastonInf) || 0, 2)
      }

      // Prefill moments and shear from detailer (for old projects without calc block)
      if (sec.muPos) patch.MuP = Number(sec.muPos) || 0
      if (sec.muNeg) patch.MuN = Number(sec.muNeg) || 0
      if (sec.vu) patch.VuTon = Number(sec.vu) || 0
      if (sec.sepLcuarto) patch.SL4 = Number(sec.sepLcuarto)
      if (sec.sepRest) patch.SLresto = Number(sec.sepRest)

      setCalc(patch)
    }
  }, [selectedIdx, hasSelection, sections, setCalc])

  // ── Flexion calcs ─────────────────────────────────────────
  const resP = useMemo(() => {
    if (!b || !h || !r || !fc || !fy) return { error: 'Datos incompletos' }
    return calcFlexion({
      fc: +fc, fy: +fy, b: +b, h: +h, r: +r, MuTm: +(calc.MuP || 0),
      varNum: +(calc.varPNum || 4), varCount: +(calc.varPCount) || null,
      bastonNum: +(calc.bastonPNum || 4), bastonCount: +(calc.bastonPCount || 0),
    })
  }, [fc, fy, b, h, r, calc.MuP, calc.varPNum, calc.varPCount, calc.bastonPNum, calc.bastonPCount])

  const resN = useMemo(() => {
    if (!b || !h || !r || !fc || !fy) return { error: 'Datos incompletos' }
    return calcFlexion({
      fc: +fc, fy: +fy, b: +b, h: +h, r: +r, MuTm: +(calc.MuN || 0),
      varNum: +(calc.varNNum || 4), varCount: +(calc.varNCount) || null,
      bastonNum: +(calc.bastonNNum || 4), bastonCount: +(calc.bastonNCount || 0),
    })
  }, [fc, fy, b, h, r, calc.MuN, calc.varNNum, calc.varNCount, calc.bastonNNum, calc.bastonNCount])

  // ── Auto-sync results to detailer ─────────────────────────
  useEffect(() => {
    if (!hasSelection) return
    const patch = {}
    if (!resP.error && resP.MRT > 0) {
      patch.mrPos = Number(resP.MRT.toFixed(4))
      patch.muPos = Number(calc.MuP) || ''
    }
    if (!resN.error && resN.MRT > 0) {
      patch.mrNeg = Number(resN.MRT.toFixed(4))
      patch.muNeg = Number(calc.MuN) || ''
    }
    if (Object.keys(patch).length > 0) syncCalcResults(patch)
  }, [resP, resN, hasSelection])

  // ── Cortante calc ─────────────────────────────────────────
  const asFlexion = useMemo(() => {
    const a = (!resP.error ? resP.AsTotal : 0) || 0
    const b2 = (!resN.error ? resN.AsTotal : 0) || 0
    return Math.max(a, b2)
  }, [resP, resN])

  const AsUsada = calc.asManual !== null && calc.asManual !== undefined
    ? +calc.asManual
    : (asFlexion || 4.52)

  const resC = useMemo(() => {
    if (!b || !h || !r || !fc || !fy) return null
    return calcCortante({
      fc: +fc, fy: +fy, b: +b, h: +h, r: +r,
      L: +(calc.L || 0), VuTon: +(calc.VuTon || 0),
      AsUsada: +AsUsada,
      varEstNum: +(calc.varEstNum || 2), nramas: +(calc.nramas || 2),
      conCompresion: calc.conCompresion, MuCorte: +(calc.MuCorte || 0),
    })
  }, [fc, fy, b, h, r, calc.L, calc.VuTon, AsUsada, calc.varEstNum, calc.nramas, calc.conCompresion, calc.MuCorte])

  // ── Auto-sync Vr + spacing ──────────────────────────────
  useEffect(() => {
    if (!hasSelection || !resC) return
    const patch = {}
    if (resC.Vr > 0) {
      patch.vr = Number(resC.Vr.toFixed(4))
      patch.vu = Number(calc.VuTon) || ''
    }
    // Sync stirrup spacing to detailer when there's actual shear demand
    if (+(calc.VuTon || 0) > 0) {
      const sL4 = calc.SL4 ?? resC.Suso
      const sResto = calc.SLresto ?? resC.Suso
      if (sL4) patch.sepLcuarto = sL4
      if (sResto) patch.sepRest = sResto
    }
    if (Object.keys(patch).length > 0) syncCalcResults(patch)
  }, [resC, hasSelection, calc.SL4, calc.SLresto, calc.VuTon])

  // ── Calc alert: flag when any check fails ────────────────
  useEffect(() => {
    if (!hasSelection) { setCalcAlert(false); return }
    const hasMuP = +(calc.MuP || 0) > 0
    const hasMuN = +(calc.MuN || 0) > 0
    const hasVu = +(calc.VuTon || 0) > 0
    let alert = false
    if (hasMuP && resP && !resP.error) {
      if (!resP.okMin || !resP.okMax || !resP.okMR || !resP.okBmin) alert = true
    }
    if (hasMuN && resN && !resN.error) {
      if (!resN.okMin || !resN.okMax || !resN.okMR || !resN.okBmin) alert = true
    }
    if (hasVu && resC) {
      if (!resC.okVr || !resC.okVaMax) alert = true
    }
    if ((hasMuP && resP?.error) || (hasMuN && resN?.error)) alert = true
    setCalcAlert(alert)
  }, [resP, resN, resC, hasSelection, calc.MuP, calc.MuN, calc.VuTon, setCalcAlert])

  // ── Vr for custom spacing ─────────────────────────────────
  const VrL4 = calc.SL4 && resC?.VcrKg
    ? (resC.VcrKg + (resC.FR * resC.Av * +fy * resC.d) / +calc.SL4) / 1000
    : null
  const VrResto = calc.SLresto && resC?.VcrKg
    ? (resC.VcrKg + (resC.FR * resC.Av * +fy * resC.d) / +calc.SLresto) / 1000
    : null

  if (!hasSelection) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-tx3)' }}>
        Selecciona una sección del toolbar para calcular
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto" style={{ padding: 16 }}>
      {/* Tab strip: Flexión / Cortante */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[
          { id: 'flexion', label: 'Flexión' },
          { id: 'cortante', label: 'Cortante' },
          { id: 'memoria', label: 'Memoria' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setCalcTab(t.id)}
            className="btn"
            style={{
              padding: '6px 18px', fontSize: 13, fontWeight: 600,
              background: calcTab === t.id ? 'var(--color-accent)' : 'var(--color-panel)',
              color: calcTab === t.id ? '#fff' : 'var(--color-tx2)',
              border: calcTab === t.id ? 'none' : '1px solid var(--color-border)',
            }}
          >
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{
          fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {form.nombre} — {b}×{h} cm — f'c={fc} — fy={fy}
        </div>
      </div>

      {/* ═══ FLEXIÓN ═══ */}
      {calcTab === 'flexion' && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Inputs */}
          <div style={{
            minWidth: 220, flex: '0 0 220px',
            background: 'var(--color-panel)', border: '1px solid var(--color-border)',
            borderRadius: 8, padding: '12px 14px',
          }}>
            <SectionHeader>Sección y materiales</SectionHeader>
            <div style={{
              padding: '6px 8px', borderRadius: 4, marginBottom: 8,
              background: 'var(--color-bg)', border: '1px solid var(--color-border)',
              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)',
            }}>
              b={b} h={h} r={r} cm — f'c={fc} kg/cm²
              <div style={{ fontSize: 10, marginTop: 2, color: 'var(--color-accent2)' }}>
                ↑ Editables desde la pestaña Detalle
              </div>
            </div>
            <CInput label="fy" value={fy} onChange={(v) => setCalc({ fy: +v || 0 })} unit="kg/cm²" min={0} />

            <SectionHeader style={{ marginTop: 10 }}>Momentos</SectionHeader>
            <CInput label="Mu+ (positivo)" value={calc.MuP} onChange={(v) => setCalc({ MuP: v })} unit="ton·m" min={0} />
            <CInput label="Mu− (negativo)" value={calc.MuN} onChange={(v) => setCalc({ MuN: v })} unit="ton·m" min={0} />

            <SectionHeader style={{ marginTop: 10, color: '#c94f2a' }}>Acero superior (M−)</SectionHeader>
            <CSelect label="Varilla principal" value={calc.varNNum} onChange={(v) => setCalc({ varNNum: v })} options={VAR_OPTS} />
            <CInput label="Cant. varillas (0 = auto)" value={calc.varNCount} onChange={(v) => setCalc({ varNCount: v })} min={0} step={1} />
            <div style={{ paddingLeft: 8, borderLeft: '2px solid #c94f2a', marginTop: 4 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)', marginBottom: 4, textTransform: 'uppercase' }}>Bastón M−</div>
              <CSelect label="Varilla bastón" value={calc.bastonNNum} onChange={(v) => setCalc({ bastonNNum: v })} options={VAR_OPTS} />
              <CInput label="Cantidad (0–2)" value={calc.bastonNCount} onChange={(v) => setCalc({ bastonNCount: v })} min={0} step={1} />
            </div>

            <SectionHeader style={{ marginTop: 10, color: '#2563a8' }}>Acero inferior (M+)</SectionHeader>
            <CSelect label="Varilla principal" value={calc.varPNum} onChange={(v) => setCalc({ varPNum: v })} options={VAR_OPTS} />
            <CInput label="Cant. varillas (0 = auto)" value={calc.varPCount} onChange={(v) => setCalc({ varPCount: v })} min={0} step={1} />
            <div style={{ paddingLeft: 8, borderLeft: '2px solid #2563a8', marginTop: 4 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)', marginBottom: 4, textTransform: 'uppercase' }}>Bastón M+</div>
              <CSelect label="Varilla bastón" value={calc.bastonPNum} onChange={(v) => setCalc({ bastonPNum: v })} options={VAR_OPTS} />
              <CInput label="Cantidad (0–2)" value={calc.bastonPCount} onChange={(v) => setCalc({ bastonPCount: v })} min={0} step={1} />
            </div>
          </div>

          {/* Results — two columns */}
          <div style={{ flex: 1, minWidth: 300, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{
              flex: 1, minWidth: 220, background: 'var(--color-panel)',
              border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 14px',
            }}>
              <FlexionPanel res={resP} label="▲ Momento positivo M+" accentColor="#2563a8" lecho="lecho inferior" />
            </div>
            <div style={{
              flex: 1, minWidth: 220, background: 'var(--color-panel)',
              border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 14px',
            }}>
              <FlexionPanel res={resN} label="▼ Momento negativo M−" accentColor="#c94f2a" lecho="lecho superior" />
            </div>
          </div>
        </div>
      )}

      {/* ═══ CORTANTE ═══ */}
      {calcTab === 'cortante' && resC && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Inputs */}
          <div style={{
            minWidth: 240, flex: '0 0 240px',
            background: 'var(--color-panel)', border: '1px solid var(--color-border)',
            borderRadius: 8, padding: '12px 14px',
          }}>
            <SectionHeader>Sección y materiales</SectionHeader>
            <div style={{
              padding: '6px 8px', borderRadius: 4, marginBottom: 8,
              background: 'var(--color-bg)', border: '1px solid var(--color-border)',
              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)',
            }}>
              b={b} h={h} r={r} cm — f'c={fc}
            </div>
            <CInput label="fy" value={fy} onChange={(v) => setCalc({ fy: +v || 0 })} unit="kg/cm²" min={0} />

            <SectionHeader style={{ marginTop: 10 }}>Cortante</SectionHeader>
            <CInput label="L (longitud libre)" value={calc.L} onChange={(v) => setCalc({ L: v })} unit="m" min={0} />
            <CInput label="Vu (cortante último)" value={calc.VuTon} onChange={(v) => setCalc({ VuTon: v })} unit="ton" min={0} />

            {/* As usada */}
            <div style={{ marginBottom: 6 }}>
              <label className="field-label">As usada (long.)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="number"
                  className="field-input"
                  value={calc.asManual !== null && calc.asManual !== undefined ? calc.asManual : AsUsada.toFixed(2)}
                  onChange={(e) => setCalc({ asManual: e.target.value === '' ? null : +e.target.value })}
                  min={0} step="any"
                  style={{
                    flex: 1,
                    background: calc.asManual === null || calc.asManual === undefined ? '#f0fdf4' : 'var(--color-bg)',
                    borderColor: calc.asManual === null || calc.asManual === undefined ? '#a5d6a7' : 'var(--color-border)',
                  }}
                />
                <span style={{ color: 'var(--color-tx3)', fontSize: 11 }}>cm²</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                <span style={{ fontSize: 10, color: calc.asManual !== null && calc.asManual !== undefined ? '#b45309' : '#2e7d32' }}>
                  {calc.asManual !== null && calc.asManual !== undefined ? '✎ Manual' : '✓ De Flexión'}
                </span>
                {calc.asManual !== null && calc.asManual !== undefined && (
                  <button onClick={() => setCalc({ asManual: null })} style={{
                    fontSize: 10, color: 'var(--color-tx3)', background: 'none', border: 'none',
                    cursor: 'pointer', textDecoration: 'underline', padding: 0,
                  }}>restablecer</button>
                )}
              </div>
            </div>

            {/* L/h badge */}
            <div style={{
              margin: '4px 0 8px', padding: '4px 8px', borderRadius: 4,
              background: 'var(--color-bg)', border: '1px solid var(--color-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 10, color: 'var(--color-tx3)', fontWeight: 600 }}>L/h</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: 'var(--color-accent2)' }}>
                {resC.lh?.toFixed(2)}
                <span style={{ fontSize: 10, marginLeft: 5, fontWeight: 400, color: 'var(--color-tx3)' }}>
                  {resC.lhZone === 'mayor5' && `→ ec. ${resC.ecVcr.split(' ')[0]}`}
                  {resC.lhZone === 'entre4y5' && '⚠ 4–5'}
                  {resC.lhZone === 'menor4' && '⚠ <4'}
                </span>
              </span>
            </div>

            {/* Compression selector for L/h < 4 */}
            {resC.lhZone === 'menor4' && (
              <div style={{
                marginBottom: 8, padding: '8px 10px', borderRadius: 6,
                background: 'var(--color-bg)', border: '1px solid var(--color-border)',
              }}>
                <div style={{ fontSize: 10, color: 'var(--color-accent2)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
                  ¿Hay momento negativo? (L/h &lt; 4)
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[
                    { v: false, label: 'SIN M−' },
                    { v: true, label: 'CON M−' },
                  ].map((opt) => (
                    <button
                      key={String(opt.v)}
                      onClick={() => setCalc({ conCompresion: opt.v })}
                      className="btn"
                      style={{
                        flex: 1, padding: '4px 6px', fontSize: 11,
                        background: calc.conCompresion === opt.v ? 'var(--color-accent)' : 'var(--color-panel)',
                        color: calc.conCompresion === opt.v ? '#fff' : 'var(--color-tx3)',
                        border: calc.conCompresion === opt.v ? 'none' : '1px solid var(--color-border)',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {calc.conCompresion && (
                  <CInput
                    label="Mu en sección crítica"
                    value={calc.MuCorte}
                    onChange={(v) => setCalc({ MuCorte: v })}
                    unit="ton·m" min={0}
                    style={{ marginTop: 6, marginBottom: 0 }}
                  />
                )}
              </div>
            )}

            <SectionHeader style={{ marginTop: 8 }}>Estribos</SectionHeader>
            <CSelect label="Varilla del estribo" value={calc.varEstNum} onChange={(v) => setCalc({ varEstNum: v })} options={VAR_OPTS} />
            <CInput label="Nº de ramas" value={calc.nramas} onChange={(v) => setCalc({ nramas: v })} min={1} step={1} />
          </div>

          {/* Results */}
          <div style={{
            flex: 1, minWidth: 280,
            background: 'var(--color-panel)', border: '1px solid var(--color-border)',
            borderRadius: 8, padding: '12px 14px',
          }}>
            <SectionHeader>Resultados — Cortante (NTC-2023 Sec. 5.5)</SectionHeader>

            <CalcRow label="d" value={resC.d} unit="cm" />
            <CalcRow label="L/h" value={resC.lh} />
            <CalcRow label="ρ (cuantía long.)" value={resC.rho} />
            <CalcRow label="VCR fórmula a" value={resC.VCR_a} unit="ton" dim tooltip={TC.VCR_a} />
            <CalcRow label="VCR fórmula b" value={resC.VCR_b} unit="ton" dim tooltip={TC.VCR_b} />
            <CalcRow label={`VCR adoptado (${resC.ecVcr})`} value={resC.Vcr} unit="ton" tooltip={TC.VCR} />
            <CalcRow label="VCR_min" value={resC.VCR_min} unit="ton" dim />
            <CalcRow label="VCR_max" value={resC.VCR_max} unit="ton" dim />
            <CalcRow label="Va_max (límite)" value={resC.VaMax} unit="ton" tooltip={TC.VaMax}
              tag={<Tag ok={resC.okVaMax}>Vu {resC.okVaMax ? '≤' : '>'} Va_max</Tag>} />

            {resC.seccionInsuficiente && (
              <div style={{ margin: '6px 0', padding: '6px 10px', borderRadius: 6, background: '#fdecea', border: '1px solid #ef9a9a', fontSize: 12, color: '#c62828', fontWeight: 600 }}>
                ⚠ Vu supera límite ec. 5.5.2.2 — Redimensionar
              </div>
            )}

            <CalcRow label="VSR necesario" value={resC.VsrNec} unit="ton" tooltip={TC.VsrNec}
              tag={<Tag ok={resC.necesitaEstribos}>{resC.necesitaEstribos ? 'Requiere estribos' : 'Solo mínimos'}</Tag>} />
            <CalcRow label="Av estribo" value={resC.Av} unit="cm²" />
            <CalcRow label="S calculado" value={resC.SCalc} unit="cm" tooltip={TC.SCalc} />
            <CalcRow label="S máximo" value={resC.SmaxGeom} unit="cm" />
            <CalcRow label="S mínimo (constr.)" value={resC.Smin} unit="cm" />

            {resC.SminAlert && (
              <div style={{ margin: '6px 0', padding: '6px 10px', borderRadius: 6, background: '#fff8e1', border: '1px solid #ffe082', fontSize: 12, color: '#b45309', fontWeight: 600 }}>
                ⚠ S calculado &lt; 6 cm — Se adopta S = 6 cm
              </div>
            )}

            {/* Design spacing */}
            <div style={{
              margin: '10px 0', padding: '12px', borderRadius: 8,
              background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--color-tx3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Separación de diseño
              </div>
              <div style={{ fontSize: 28, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                S = {resC.Suso} cm
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-tx3)', marginTop: 2 }}>
                E #{calc.varEstNum} @ {resC.Suso} cm ({calc.nramas} ramas)
              </div>
            </div>

            <CalcRow label="VSR real" value={resC.VsrReal} unit="ton" />
            <CalcRow label="Vr = VCR + VSR" value={resC.Vr} unit="ton" tooltip={TC.Vr}
              tag={<Tag ok={resC.okVr}>Vr {resC.okVr ? '≥' : '<'} Vu</Tag>} />

            {/* Real spacing zones */}
            <div style={{
              margin: '12px 0', padding: '10px 12px', borderRadius: 8,
              background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--color-tx3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 700 }}>
                Separación real en obra
              </div>
              <div style={{ marginBottom: 8 }}>
                <label className="field-label">S en zona L/4</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number" className="field-input"
                    value={calc.SL4 ?? ''} placeholder={String(resC.Suso)}
                    onChange={(e) => setCalc({ SL4: e.target.value === '' ? null : +e.target.value })}
                    min={6} step={1} style={{ width: 80 }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--color-tx3)' }}>cm</span>
                  {VrL4 !== null && (
                    <span style={{ flex: 1, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: VrL4 >= +(calc.VuTon || 0) ? '#2e7d32' : '#c62828' }}>
                      Vr = {VrL4.toFixed(3)} ton
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className="field-label">S en zona L/restante</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number" className="field-input"
                    value={calc.SLresto ?? ''} placeholder="—"
                    onChange={(e) => setCalc({ SLresto: e.target.value === '' ? null : +e.target.value })}
                    min={6} step={1} style={{ width: 80 }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--color-tx3)' }}>cm</span>
                  {VrResto !== null && (
                    <span style={{ flex: 1, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-accent2)' }}>
                      Vr = {VrResto.toFixed(3)} ton
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Final tags */}
            <div style={{
              marginTop: 6, padding: '6px 10px', borderRadius: 6,
              background: resC.okVr ? '#e8f5e9' : '#fdecea',
              border: `1px solid ${resC.okVr ? '#a5d6a7' : '#ef9a9a'}`,
              display: 'flex', gap: 6, flexWrap: 'wrap',
            }}>
              <Tag ok={resC.okVaMax}>Vu ≤ Va_max</Tag>
              <Tag ok={resC.okSmin}>S ≥ 6 cm</Tag>
              <Tag ok={resC.Suso <= resC.SmaxGeom}>S ≤ S max</Tag>
              <Tag ok={resC.okVr}>Vr ≥ Vu</Tag>
            </div>

            {resC.okVr && (
              <div style={{
                marginTop: 6, padding: '8px 12px', borderRadius: 6,
                background: '#e8f5e9', color: '#2e7d32',
                fontWeight: 700, fontSize: 13, textAlign: 'center',
              }}>
                ✓ E #{calc.varEstNum} @ {resC.Suso} cm — Vr = {resC.Vr?.toFixed(3)} ton
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ MEMORIA ═══ */}
      {calcTab === 'memoria' && (
        <MemoriaView
          nombre={form.nombre}
          fc={+fc} fy={+fy} b={+b} h={+h} r={+r}
          MuP={+(calc.MuP || 0)} MuN={+(calc.MuN || 0)}
          resP={resP} resN={resN}
          VuTon={+(calc.VuTon || 0)} L={+(calc.L || 0)}
          AsUsada={+AsUsada}
          varEstNum={+(calc.varEstNum || 2)} nramas={+(calc.nramas || 2)}
          resC={resC}
        />
      )}
    </div>
  )
}
