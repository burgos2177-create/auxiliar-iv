import { useState, useMemo, useRef } from 'react'
import useBeamStore from '../store/useBeamStore'
import { parseRamEnvelope, evaluateBeamEnvelope } from '../core/ramParser'

const TD = { padding: '4px 8px', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }
const TH = { padding: '5px 8px', background: '#1a2040', color: '#fff', fontSize: 10, textAlign: 'left' }
const fmt = (v, d = 2) => (v === null || v === undefined || !isFinite(v) ? '—' : Number(v).toFixed(d))

/**
 * Carga y revisión de la envolvente de elementos mecánicos (reporte RAM)
 * para la trabe activa. Agrupa por miembro: Mu+ = mayor M33 positivo,
 * Mu− = |menor M33 negativo|, Vu = máx |V2|, y los contrasta con
 * MR+, MR− y Vr de la sección.
 */
export default function BeamEnvelopePanel({ R }) {
  const form = useBeamStore((s) => s.form)
  const setEnvelope = useBeamStore((s) => s.setEnvelope)
  const setCalc = useBeamStore((s) => s.setCalc)
  const [msg, setMsg] = useState('')
  const fileRef = useRef(null)

  const env = form.envelope
  const ev = useMemo(() => {
    if (!R || !env?.points?.length) return null
    return evaluateBeamEnvelope(env.points, R, !!env.invertir)
  }, [R, env])

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev2) => {
      const parsed = parseRamEnvelope(ev2.target.result)
      if (!parsed.points.length) {
        setMsg(parsed.warnings[0] || 'No se pudieron leer puntos del archivo.')
        return
      }
      setEnvelope({
        archivo: file.name, combo: parsed.combo, unidades: parsed.unidades,
        invertir: false, points: parsed.points,
      })
      setMsg('')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Aplica a la trabe los valores de un miembro (o la envolvente global)
  const aplicar = (MuP, MuN, Vu) => setCalc({
    MuP: Number(MuP.toFixed(4)), MuN: Number(MuN.toFixed(4)), VuTon: Number(Vu.toFixed(4)),
  })

  return (
    <div style={{
      marginTop: 14, padding: '10px 14px', borderRadius: 8,
      background: 'var(--color-panel)', border: '1px solid var(--color-border)',
    }}>
      <input ref={fileRef} type="file" accept=".txt,.csv,text/plain" style={{ display: 'none' }} onChange={handleFile} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-tx2)' }}>
          Envolvente del modelo
        </span>
        <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => fileRef.current?.click()}>
          📄 Cargar envolvente (RAM .txt)
        </button>
        {env?.points?.length ? (
          <>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-tx2)' }}>
              <b>{env.archivo}</b> · {ev?.total ?? 0} miembros{env.combo ? ` · ${env.combo}` : ''}
            </span>
            <button className="btn btn-secondary" style={{ fontSize: 10 }}
              title="Invierte el signo de M33 si en tu modelo el momento positivo va al revés"
              onClick={() => setEnvelope({ ...env, invertir: !env.invertir })}>
              {env.invertir ? 'M33 invertido ⇄' : 'M33 normal ⇄'}
            </button>
            <button style={{
              fontSize: 10, background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-tx3)', textDecoration: 'underline',
            }} onClick={() => setEnvelope(null)}>quitar</button>
            {ev && (
              <span style={{
                marginLeft: 'auto', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 99,
                fontFamily: 'var(--font-mono)',
                background: ev.allOk ? '#e8f5e9' : '#fdecea',
                color: ev.allOk ? '#15803d' : '#c62828',
                border: `1px solid ${ev.allOk ? '#a5d6a7' : '#ef9a9a'}`,
              }}>
                {ev.passing}/{ev.total} pasan
                {ev.critical && ` · crítico M-${ev.critical.member} (util ${fmt(ev.critical.util, 3)})`}
              </span>
            )}
          </>
        ) : (
          <span style={{ fontSize: 10.5, color: 'var(--color-tx3)' }}>
            Opcional — revisa esta sección contra todos los miembros del modelo
          </span>
        )}
        {msg && <span style={{ fontSize: 10.5, color: '#c62828' }}>{msg}</span>}
      </div>

      {ev && (
        <>
          {/* Envolvente global + aplicar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            marginTop: 10, padding: '8px 12px', borderRadius: 6,
            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            fontSize: 11.5, fontFamily: 'var(--font-mono)',
          }}>
            <span style={{ color: 'var(--color-tx3)' }}>Envolvente global:</span>
            <span style={{ color: 'var(--color-steel-bot)' }}>Mu+ = {fmt(ev.globalMuP)}</span>
            <span style={{ color: 'var(--color-steel-top)' }}>Mu− = {fmt(ev.globalMuN)}</span>
            <span style={{ color: '#9333ea' }}>Vu = {fmt(ev.globalVu)}</span>
            <span style={{ color: 'var(--color-tx3)' }}>
              vs MR+ {fmt(ev.results[0]?.MRP)} · MR− {fmt(ev.results[0]?.MRN)} · Vr {fmt(ev.results[0]?.VR)}
            </span>
            <button className="btn btn-primary" style={{ fontSize: 10, marginLeft: 'auto' }}
              onClick={() => aplicar(ev.globalMuP, ev.globalMuN, ev.globalVu)}
              title="Copia la envolvente más desfavorable a los campos de cálculo de esta trabe">
              ← Usar envolvente global
            </button>
          </div>

          {/* Tabla por miembro */}
          <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 10, border: '1px solid var(--color-border)', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <thead style={{ position: 'sticky', top: 0 }}>
                <tr>
                  {['Miembro', 'Mu+ (t·m)', 'Mu− (t·m)', 'Vu (t)', 'Mu+/MR+', 'Mu−/MR−', 'Vu/Vr', 'Util.', 'Estado', ''].map((t, i) => (
                    <th key={i} style={TH}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...ev.results].sort((a, b) => b.util - a.util).map((r) => (
                  <tr key={r.member} style={{ background: r.member === ev.critical?.member ? '#fff8e1' : undefined }}>
                    <td style={TD}><b>{r.member}</b></td>
                    <td style={TD}>{fmt(r.MuP)}</td>
                    <td style={TD}>{fmt(r.MuN)}</td>
                    <td style={TD}>{fmt(r.Vu)}</td>
                    <td style={{ ...TD, color: r.okP ? 'inherit' : '#c62828' }}>{fmt(r.ratioP, 3)}</td>
                    <td style={{ ...TD, color: r.okN ? 'inherit' : '#c62828' }}>{fmt(r.ratioN, 3)}</td>
                    <td style={{ ...TD, color: r.okV ? 'inherit' : '#c62828' }}>{fmt(r.ratioV, 3)}</td>
                    <td style={{ ...TD, fontWeight: 700, color: r.util > 1 ? '#c62828' : r.util > 0.9 ? '#b45309' : '#15803d' }}>
                      {fmt(r.util, 3)}
                    </td>
                    <td style={TD}>
                      <span style={{ fontWeight: 800, color: r.ok ? '#15803d' : '#c62828' }}>
                        {r.ok ? '✓ pasa' : '✗ no pasa'}
                      </span>
                    </td>
                    <td style={TD}>
                      <button style={{
                        fontSize: 9.5, padding: '1px 6px', borderRadius: 4, cursor: 'pointer',
                        border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                        color: 'var(--color-accent2)', fontFamily: 'var(--font-mono)',
                      }} onClick={() => aplicar(r.MuP, r.MuN, r.Vu)} title="Usar los valores de este miembro">
                        usar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--color-tx3)' }}>
            Por miembro: Mu+ = mayor M33 positivo · Mu− = |menor M33 negativo| · Vu = máx |V2|.
            Utilización = máx(Mu+/MR+, Mu−/MR−, Vu/Vr). La fila resaltada es el caso crítico.
          </div>
        </>
      )}
    </div>
  )
}
