import { calcEstribos, excentricidad } from '../core/columnCalculator'

const fmt = (v, d = 4) => (v === null || v === undefined || isNaN(v) ? '—' : Number(v).toFixed(d))

const TH = { padding: '4px 8px', border: '1px solid var(--color-border)', background: '#1a2040', color: '#fff', fontSize: 10, fontWeight: 700, textAlign: 'left' }
const TD = { padding: '3px 8px', border: '1px solid var(--color-border)', fontSize: 11, fontFamily: 'var(--font-mono)' }

function LechosTable({ detail }) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 6 }}>
      <thead>
        <tr>
          {['Lecho', 'ε', 'f (kg/cm²)', 'F (ton)', 'Z (cm)', 'M (ton·m)'].map((t) => <th key={t} style={TH}>{t}</th>)}
        </tr>
      </thead>
      <tbody>
        {detail.capas.map((L, i) => (
          <tr key={i}>
            <td style={TD}>{i + 1}</td>
            <td style={TD}>{fmt(L.eps, 6)}</td>
            <td style={TD}>{fmt(L.f, 2)}</td>
            <td style={TD}>{fmt(L.F, 4)}</td>
            <td style={TD}>{fmt(L.Z, 2)}</td>
            <td style={TD}>{fmt(L.M, 5)}</td>
          </tr>
        ))}
        <tr>
          <td style={{ ...TD, fontWeight: 700 }} colSpan={3}>CC (concreto) = {fmt(detail.CC, 4)} ton</td>
          <td style={TD}>{fmt(detail.CC, 4)}</td>
          <td style={TD}>{fmt(detail.Zcc, 3)}</td>
          <td style={TD}>{fmt(detail.Mcc, 5)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function PointBlock({ pt, accent }) {
  return (
    <div style={{ marginBottom: 14, border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '6px 12px', background: accent, color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
        <span>{pt.label}{pt.c != null ? ` — c = ${fmt(pt.c, 4)} cm` : ' — compresión pura'}</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>P = {fmt(pt.P, 4)} t · M = {fmt(pt.M, 5)} t·m</span>
      </div>
      {pt.detail && <div style={{ padding: '6px 10px', background: 'var(--color-panel)' }}><LechosTable detail={pt.detail} /></div>}
    </div>
  )
}

/**
 * El "Excel" de la columna: tablas de fuerzas por lecho de cada punto
 * canónico (POC, Punto 1, D, Punto 2, Punto 3, M0), excentricidad y
 * diseño de acero transversal — réplica de la hoja de cálculo.
 */
export default function ColumnExcelView({ col, analysis, dirLabel, accent, Mu }) {
  const P = analysis.params
  const ex = excentricidad(+Mu || 0, +col.Pu || 0, P.b, P.h)
  const est = calcEstribos({
    estriboNum: col.estriboNum, longNum: (col.lechos?.[0]?.num) || 3,
    h: +col.h, b: +col.b,
  })

  return (
    <div style={{ fontSize: 12 }}>
      {/* Encabezado datos */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 6,
        padding: '10px 12px', background: 'var(--color-panel)', borderRadius: 8,
        border: '1px solid var(--color-border)', marginBottom: 12, fontFamily: 'var(--font-mono)', fontSize: 11,
      }}>
        <span>h = {P.h} cm · b = {P.b} cm</span>
        <span>r = {P.r} cm · d = {P.d} cm</span>
        <span>f'c = {P.fc} · β1 = {fmt(P.b1, 3)}</span>
        <span>fy = {P.fy} · E = {P.E.toExponential(0)}</span>
        <span>εc = {P.epsC} · εy = {fmt(P.epsY, 4)}</span>
        <span>Ast = {fmt(P.Ast, 2)} cm²</span>
        <span>e = {isFinite(ex.e) ? fmt(ex.e, 5) : '—'} m</span>
        <span style={{ color: 'var(--color-accent2)', fontWeight: 700 }}>{ex.modo}</span>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: accent, marginBottom: 8 }}>
        {dirLabel} — puntos del diagrama
      </div>
      {analysis.canonical.map((pt) => <PointBlock key={pt.key} pt={pt} accent={pt.key === 'D' ? '#374151' : accent} />)}

      {/* Estribos — fórmulas exactas de la hoja */}
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', marginTop: 4 }}>
        <div style={{ padding: '6px 12px', background: '#1a7a5e', color: '#fff', fontSize: 12, fontWeight: 700 }}>
          Diseño de acero transversal
        </div>
        <div style={{ padding: '8px 12px', background: 'var(--color-panel)', fontFamily: 'var(--font-mono)', fontSize: 11, display: 'grid', gap: 3 }}>
          <span>s1 (por estribos, #{col.estriboNum}) = {fmt(est.s1, 2)} cm</span>
          <span>s2 (por acero longitudinal, #{col.lechos?.[0]?.num}) = {fmt(est.s2, 2)} cm</span>
          <span>s3 (por dimensiones) = {fmt(est.s3, 0)} cm</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-accent2)' }}>
            s propuesta = E#{col.estriboNum} @ {est.s} cm
          </span>
        </div>
      </div>
    </div>
  )
}
