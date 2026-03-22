import { useState, useMemo, useEffect, useCallback } from 'react'
import useBeamStore from '../store/useBeamStore'
import { smartSuggestions, getDB, onDBChange } from '../core/globalDB'

const COLORS = [
  '#6366f1', '#06b6d4', '#f59e0b', '#ef4444',
  '#8b5cf6', '#10b981', '#f97316', '#ec4899',
  '#14b8a6', '#a855f7', '#eab308', '#3b82f6',
]

function toNum(v) {
  if (v === '' || v === undefined || v === null) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function buildBands(sections, mrKey) {
  const valid = []
  sections.forEach((s, i) => {
    const mr = toNum(s[mrKey])
    if (mr !== null && mr > 0) {
      valid.push({ nombre: s.nombre, mr, idx: i })
    }
  })
  valid.sort((a, b) => a.mr - b.mr)

  const bands = []
  let prev = 0
  valid.forEach((v) => {
    bands.push({
      nombre: v.nombre,
      lower: prev,
      upper: v.mr,
      color: COLORS[v.idx % COLORS.length],
      sectionIdx: v.idx,
    })
    prev = v.mr
  })
  return bands
}

function ScaleRuler({ bands, maxVal, demand, label, onSelectSection, selectedIdx }) {
  if (bands.length === 0) return null

  const RULER_W = 60
  const LABEL_W = 28
  const RULER_H = 280
  const TOTAL_W = RULER_W + LABEL_W

  const yForVal = (v) => RULER_H - (v / maxVal) * RULER_H

  let hitIdx = -1
  if (demand !== null && demand >= 0) {
    for (let i = 0; i < bands.length; i++) {
      if (demand <= bands[i].upper) { hitIdx = i; break }
    }
  }

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
        color: 'var(--color-tx3)', textTransform: 'uppercase',
        letterSpacing: '0.04em', marginBottom: 6, textAlign: 'center',
      }}>
        {label}
      </div>

      <svg width={TOTAL_W} height={RULER_H + 16} style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
        {/* Axis line */}
        <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={RULER_H} stroke="var(--color-border2)" strokeWidth={1} />
        <line x1={LABEL_W} y1={RULER_H} x2={LABEL_W + RULER_W} y2={RULER_H} stroke="var(--color-border2)" strokeWidth={1} />

        {/* Zero label */}
        <text x={LABEL_W - 4} y={RULER_H + 4} textAnchor="end"
          style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--color-tx3)' }}>0</text>

        {/* Bands */}
        {bands.map((b, i) => {
          const y1 = yForVal(b.upper)
          const y2 = yForVal(b.lower)
          const h = y2 - y1
          const isHit = i === hitIdx
          const isSelected = b.sectionIdx === selectedIdx

          return (
            <g key={b.nombre + i}
              onClick={() => onSelectSection(b.sectionIdx)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={LABEL_W + 1} y={y1} width={RULER_W - 2} height={Math.max(h, 2)}
                rx={3}
                fill={b.color}
                opacity={isHit ? 0.4 : 0.18}
                stroke={isSelected ? 'var(--color-accent)' : isHit ? b.color : 'none'}
                strokeWidth={isSelected ? 2 : isHit ? 1.5 : 0}
              />

              {h > 16 && (
                <text
                  x={LABEL_W + RULER_W / 2} y={y1 + h / 2 + 4}
                  textAnchor="middle"
                  style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)',
                    fontWeight: isHit ? 700 : 500,
                    fill: isHit ? b.color : 'var(--color-tx2)',
                  }}
                >
                  {b.nombre}
                </text>
              )}

              <line x1={LABEL_W - 3} y1={y1} x2={LABEL_W + RULER_W} y2={y1}
                stroke={b.color} strokeWidth={0.7} strokeDasharray="3,3" opacity={0.5} />
              <text x={LABEL_W - 4} y={y1 + 4} textAnchor="end"
                style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: b.color, fontWeight: 600 }}>
                {b.upper}
              </text>
            </g>
          )
        })}

        {/* Demand line */}
        {demand !== null && demand >= 0 && (() => {
          const dy = yForVal(Math.min(demand, maxVal))
          return (
            <g>
              <line
                x1={LABEL_W - 6} y1={dy} x2={LABEL_W + RULER_W + 2} y2={dy}
                stroke="var(--color-accent)" strokeWidth={2}
              />
              <polygon
                points={`${LABEL_W + RULER_W + 2},${dy} ${LABEL_W + RULER_W - 2},${dy - 3} ${LABEL_W + RULER_W - 2},${dy + 3}`}
                fill="var(--color-accent)"
              />

              {hitIdx >= 0 && (
                <text x={LABEL_W + RULER_W / 2} y={dy - 6} textAnchor="middle"
                  style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, fill: 'var(--color-accent2)' }}>
                  {bands[hitIdx].nombre}
                </text>
              )}
              {demand > maxVal && (
                <text x={LABEL_W + RULER_W / 2} y={dy - 6} textAnchor="middle"
                  style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, fill: '#c94f2a' }}>
                  Excede
                </text>
              )}
            </g>
          )
        })()}

        {/* t·m unit */}
        <text x={LABEL_W - 4} y={RULER_H + 14} textAnchor="end"
          style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fill: 'var(--color-tx3)' }}>t·m</text>
      </svg>
    </div>
  )
}

export default function MomentScale() {
  const sections = useBeamStore((s) => s.sections)
  const selectedIdx = useBeamStore((s) => s.selectedIdx)
  const selectSection = useBeamStore((s) => s.selectSection)
  const [muDemandPos, setMuDemandPos] = useState('')
  const [muDemandNeg, setMuDemandNeg] = useState('')

  const bandsPos = useMemo(() => buildBands(sections, 'mrPos'), [sections])
  const bandsNeg = useMemo(() => buildBands(sections, 'mrNeg'), [sections])

  const maxPos = bandsPos.length > 0 ? bandsPos[bandsPos.length - 1].upper * 1.15 : 1
  const maxNeg = bandsNeg.length > 0 ? bandsNeg[bandsNeg.length - 1].upper * 1.15 : 1

  const hasBands = bandsPos.length > 0 || bandsNeg.length > 0

  // ── Optimal section suggestion ──
  // Find the smallest section whose Mr(+) >= Mu(+) AND Mr(-) >= Mu(-)
  const suggestion = useMemo(() => {
    const dPos = toNum(muDemandPos)
    const dNeg = toNum(muDemandNeg)
    // Need at least both demands entered
    if (dPos === null || dNeg === null || dPos <= 0 || dNeg <= 0) return null

    // Build candidates: each section with both Mr+ and Mr-
    const candidates = []
    sections.forEach((s, i) => {
      const mrP = toNum(s.mrPos)
      const mrN = toNum(s.mrNeg)
      if (mrP !== null && mrP > 0 && mrN !== null && mrN > 0) {
        candidates.push({ idx: i, nombre: s.nombre, ancho: s.ancho, peralte: s.peralte, mrP, mrN })
      }
    })

    // Filter those that satisfy BOTH demands
    const valid = candidates.filter((c) => c.mrP >= dPos && c.mrN >= dNeg)

    if (valid.length === 0) {
      // No section covers both — "Diseñar sección"
      return { type: 'design' }
    }

    // Pick the smallest one: minimize max(Mr+, Mr-) to get the least oversized
    valid.sort((a, b) => {
      const scoreA = Math.max(a.mrP, a.mrN)
      const scoreB = Math.max(b.mrP, b.mrN)
      return scoreA - scoreB
    })

    const best = valid[0]
    return { type: 'ok', nombre: best.nombre, idx: best.idx, ancho: best.ancho, peralte: best.peralte }
  }, [sections, muDemandPos, muDemandNeg])

  // ── BD Global suggestions ──
  const [dbReady, setDbReady] = useState(() => getDB().ready)
  useEffect(() => {
    if (!dbReady) return onDBChange((d) => { if (d.ready) setDbReady(true) })
  }, [dbReady])

  const bdSuggestions = useMemo(() => {
    if (!dbReady) return []
    const dPos = toNum(muDemandPos)
    const dNeg = toNum(muDemandNeg)
    if ((dPos === null || dPos <= 0) && (dNeg === null || dNeg <= 0)) return []
    return smartSuggestions(dPos || 0, dNeg || 0)
  }, [muDemandPos, muDemandNeg, dbReady])

  const setForm = useBeamStore((s) => s.setForm)
  const applyBDViga = useCallback((d) => {
    setForm({
      ancho: d.b, peralte: d.h,
      cantInf: d.nP, calInf: String(d.vP),
      cantSup: d.nN, calSup: String(d.vN),
      cantBastonInf: d.bP ? d.bP[0] : 0,
      calBastonInf: d.bP ? String(d.bP[1]) : '3',
      cantBastonSup: d.bN ? d.bN[0] : 0,
      calBastonSup: d.bN ? String(d.bN[1]) : '3',
    })
  }, [setForm])

  if (sections.length === 0) return null

  return (
    <div style={{
      width: 280,
      minWidth: 280,
      background: 'var(--color-panel)',
      borderLeft: '1px solid var(--color-border)',
      overflowY: 'auto',
      padding: '16px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div className="section-title" style={{ border: 'none', paddingBottom: 0 }}>
        Escala de momentos
      </div>

      {!hasBands && (
        <div style={{ fontSize: 11, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
          Ingresa valores de Mr en las propiedades de cada secci&oacute;n para activar la escala.
        </div>
      )}

      {/* Demand inputs */}
      {hasBands && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: '8px 10px', borderRadius: 6,
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg)',
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)', textTransform: 'uppercase', fontWeight: 600 }}>Mu(+)</label>
              <input
                type="number" step="0.1" min="0"
                className="field-input"
                style={{ marginTop: 2 }}
                value={muDemandPos}
                onChange={(e) => setMuDemandPos(e.target.value)}
                placeholder="—"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)', textTransform: 'uppercase', fontWeight: 600 }}>Mu(−)</label>
              <input
                type="number" step="0.1" min="0"
                className="field-input"
                style={{ marginTop: 2 }}
                value={muDemandNeg}
                onChange={(e) => setMuDemandNeg(e.target.value)}
                placeholder="—"
              />
            </div>
          </div>
          {/* Local project suggestion */}
          {suggestion !== null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 8px', borderRadius: 5,
              background: suggestion.type === 'ok'
                ? 'rgba(26, 122, 94, 0.10)'
                : 'rgba(201, 79, 42, 0.10)',
            }}>
              <span style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
                color: suggestion.type === 'ok' ? 'var(--color-accent2)' : '#c94f2a',
              }}>
                {suggestion.type === 'ok' ? '→' : '⚠'}
              </span>
              {suggestion.type === 'ok' ? (
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-tx2)' }}>
                  Usar <strong
                    style={{ color: 'var(--color-accent2)', cursor: 'pointer' }}
                    onClick={() => selectSection(suggestion.idx)}
                  >{suggestion.nombre}</strong>
                  <span style={{ color: 'var(--color-tx3)', fontSize: 10 }}>
                    {' '}({suggestion.ancho}×{suggestion.peralte})
                  </span>
                </span>
              ) : (
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#c94f2a', fontWeight: 500 }}>
                  Diseñar secci&oacute;n
                </span>
              )}
            </div>
          )}

          {/* BD Global suggestions */}
          {bdSuggestions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{
                fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>BD Global</div>
              {bdSuggestions.map((d, i) => (
                <button
                  key={`${d.b}x${d.h}-${i}`}
                  onClick={() => applyBDViga(d)}
                  title={`As total ≈ ${(d._as || 0).toFixed(1)} cm²`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 8px', borderRadius: 5, cursor: 'pointer',
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-tx2)',
                    textAlign: 'left', width: '100%',
                  }}
                >
                  <span style={{ fontWeight: 700, color: '#6366f1' }}>{d.b}×{d.h}</span>
                  <span>{d.nP}#{d.vP}/{d.nN}#{d.vN}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--color-tx3)', fontSize: 8, fontStyle: 'italic' }}>
                    {d.tag}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rulers side by side */}
      {hasBands && (
        <div style={{ display: 'flex', gap: 4 }}>
          {bandsPos.length > 0 && (
            <ScaleRuler
              bands={bandsPos}
              maxVal={maxPos}
              demand={toNum(muDemandPos)}
              label="Mr(+)"
              onSelectSection={selectSection}
              selectedIdx={selectedIdx}
            />
          )}
          {bandsNeg.length > 0 && (
            <ScaleRuler
              bands={bandsNeg}
              maxVal={maxNeg}
              demand={toNum(muDemandNeg)}
              label="Mr(−)"
              onSelectSection={selectSection}
              selectedIdx={selectedIdx}
            />
          )}
        </div>
      )}
    </div>
  )
}
