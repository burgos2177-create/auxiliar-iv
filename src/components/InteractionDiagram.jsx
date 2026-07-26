import { useState, useMemo, useId } from 'react'

/**
 * Diagrama de interacción P–M (2D) de una dirección.
 * Curva de frontera (barrido fino) + puntos canónicos del Excel +
 * punto de demanda (Mu, Pu) con estado.
 */
export default function InteractionDiagram({ analysis, Mu, Pu, check, color = '#2563a8', title, width = 380, height = 330, cloud = null, cloudKey = 'Mux' }) {
  const [hover, setHover] = useState(null)
  const [fit, setFit] = useState('full') // 'full' | 'demand'
  const clipId = useId().replace(/:/g, '')

  const PAD = { l: 52, r: 16, t: 26, b: 40 }
  const iw = width - PAD.l - PAD.r
  const ih = height - PAD.t - PAD.b

  const hasDemand = (cloud && cloud.length) || +Mu || +Pu

  const { xs, ys, xTicks, yTicks, path, areaPath } = useMemo(() => {
    const curve = analysis.curve
    const cM = (cloud || []).map((r) => r[cloudKey] || 0)
    const cP = (cloud || []).map((r) => r.Pu || 0)
    let Mmax, Pmin, Pmax
    if (fit === 'demand' && hasDemand) {
      // Encuadre en la nube de demanda, pero SIEMPRE incluyendo la frontera
      // dentro del rango de carga de los puntos (si no, se pierde la referencia).
      const dM = cM.concat([+Mu || 0])
      const dP = cP.concat([+Pu || 0])
      const p0 = Math.min(...dP), p1 = Math.max(...dP)
      const padP = Math.max((p1 - p0) * 0.35, Math.abs(p1) * 0.25, 1)
      Pmin = p0 - padP
      Pmax = p1 + padP
      // Capacidad de la frontera en la franja de P que realmente ocupan los
      // puntos → así la frontera queda a la vista como referencia.
      const inRange = curve.filter((p) => p.P >= p0 && p.P <= p1).map((p) => p.M)
      const MRref = inRange.length ? Math.max(...inRange) : 0
      Mmax = Math.max(Math.max(...dM, 0.05) * 2.4, MRref * 1.18)
    } else {
      const Ms = curve.map((p) => p.M).concat([+Mu || 0], cM)
      const Ps = curve.map((p) => p.P).concat([+Pu || 0], cP)
      Mmax = Math.max(...Ms, 0.1) * 1.12
      Pmin = Math.min(...Ps, 0) * 1.12
      Pmax = Math.max(...Ps) * 1.08
    }
    const xs = (M) => PAD.l + (M / Mmax) * iw
    const ys = (P) => PAD.t + ((Pmax - P) / (Pmax - Pmin)) * ih
    const sorted = [...curve].sort((a, b) => b.P - a.P) // POC arriba → tensión abajo
    const path = sorted.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(p.M).toFixed(1)},${ys(p.P).toFixed(1)}`).join(' ')
    // Región segura: frontera + eje M=0
    const areaPath = `${path} L${xs(0).toFixed(1)},${ys(sorted[sorted.length - 1].P).toFixed(1)} L${xs(0).toFixed(1)},${ys(sorted[0].P).toFixed(1)} Z`
    const nice = (v) => Number(v.toPrecision(2))
    const xTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => nice(Mmax * t))
    const yTicks = [Pmin, Pmin / 2, 0, Pmax * 0.33, Pmax * 0.66, Pmax].map(nice)
    return { xs, ys, xTicks, yTicks, path, areaPath }
  }, [analysis, Mu, Pu, iw, ih, cloud, cloudKey, fit, hasDemand])

  const demand = { x: xs(+Mu || 0), y: ys(+Pu || 0) }
  const okCol = check?.ok ? '#15803d' : '#dc2626'

  return (
    <div style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{title}</span>
        {hasDemand && (
          <button onClick={() => setFit(fit === 'full' ? 'demand' : 'full')}
            title="Alterna entre ver todo el diagrama y acercarse a la zona de la demanda"
            style={{
              fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 5, cursor: 'pointer',
              fontFamily: 'var(--font-mono)', border: '1px solid var(--color-border)',
              background: fit === 'demand' ? 'var(--color-accent)' : 'var(--color-bg)',
              color: fit === 'demand' ? '#fff' : 'var(--color-tx3)', marginLeft: 'auto',
            }}>
            {fit === 'demand' ? '⤡ todo' : '⤢ demanda'}
          </button>
        )}
        {cloud && cloud.length ? (() => {
          const inside = cloud.filter((r) => r.ok).length
          const all = inside === cloud.length
          return (
            <span style={{
              fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99,
              background: all ? '#e8f5e9' : '#fdecea', color: all ? '#15803d' : '#dc2626',
              border: `1px solid ${all ? '#a5d6a7' : '#ef9a9a'}`,
            }}>
              {inside}/{cloud.length} dentro
            </span>
          )
        })() : check && (
          <span style={{
            fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99,
            background: check.ok ? '#e8f5e9' : '#fdecea', color: okCol,
            border: `1px solid ${check.ok ? '#a5d6a7' : '#ef9a9a'}`,
          }}>
            {check.ok ? '✓ DENTRO' : '✗ FUERA'} · MR={check.MR.toFixed(2)}
          </span>
        )}
      </div>
      <svg width={width} height={height} style={{ fontFamily: 'var(--font-mono)', display: 'block' }}
        onMouseLeave={() => setHover(null)}>
        {/* Grid + ejes (recesivos) */}
        {yTicks.map((p, i) => (
          <g key={`y${i}`}>
            <line x1={PAD.l} y1={ys(p)} x2={width - PAD.r} y2={ys(p)} stroke={p === 0 ? '#b8b2a6' : '#eceae4'} strokeWidth={p === 0 ? 1.2 : 1} />
            <text x={PAD.l - 6} y={ys(p) + 3} fontSize="9" fill="#8a8580" textAnchor="end">{p}</text>
          </g>
        ))}
        {xTicks.map((m, i) => (
          <g key={`x${i}`}>
            <line x1={xs(m)} y1={PAD.t} x2={xs(m)} y2={height - PAD.b} stroke="#f2f0ea" strokeWidth="1" />
            <text x={xs(m)} y={height - PAD.b + 14} fontSize="9" fill="#8a8580" textAnchor="middle">{m}</text>
          </g>
        ))}
        <text x={PAD.l + iw / 2} y={height - 6} fontSize="10" fill="#6b6760" textAnchor="middle">M (ton·m)</text>
        <text x={12} y={PAD.t + ih / 2} fontSize="10" fill="#6b6760" textAnchor="middle"
          transform={`rotate(-90,12,${PAD.t + ih / 2})`}>P (ton)</text>

        {/* Región segura */}
        <defs>
          <clipPath id={`plot-${clipId}`}>
            <rect x={PAD.l} y={PAD.t} width={iw} height={ih} />
          </clipPath>
        </defs>
        <g clipPath={`url(#plot-${clipId})`}>
          <path d={areaPath} fill={color} opacity="0.07" />
          {/* Frontera */}
          <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />

          {/* Puntos canónicos del Excel */}
          {analysis.canonical.map((pt) => (
            <g key={pt.key}
              onMouseEnter={() => setHover(pt)}
              style={{ cursor: 'default' }}>
              <circle cx={xs(pt.M)} cy={ys(pt.P)} r="4" fill="#fff" stroke={color} strokeWidth="1.6" />
              <circle cx={xs(pt.M)} cy={ys(pt.P)} r="10" fill="transparent" />
            </g>
          ))}
        </g>

        {/* Nube de la envolvente (RAM) */}
        {(cloud || []).map((r, i) => (
          <g key={`c${i}`} onMouseEnter={() => setHover({
            label: `Miembro ${r.member} (${r.tipo})`, c: null, P: r.Pu, M: r[cloudKey] || 0,
            extra: `util ${isFinite(r.util) ? r.util.toFixed(3) : '∞'}`,
          })}>
            <circle cx={xs(r[cloudKey] || 0)} cy={ys(r.Pu)} r="3.2"
              fill={r.ok ? '#15803d' : '#dc2626'} fillOpacity="0.55"
              stroke="#fff" strokeWidth="0.8" />
            <circle cx={xs(r[cloudKey] || 0)} cy={ys(r.Pu)} r="9" fill="transparent" />
          </g>
        ))}

        {/* Punto de demanda */}
        <g style={{ display: cloud && cloud.length ? 'none' : undefined }}>
          <line x1={demand.x - 7} y1={demand.y} x2={demand.x + 7} y2={demand.y} stroke={okCol} strokeWidth="2" />
          <line x1={demand.x} y1={demand.y - 7} x2={demand.x} y2={demand.y + 7} stroke={okCol} strokeWidth="2" />
          <circle cx={demand.x} cy={demand.y} r="4.5" fill={okCol} stroke="#fff" strokeWidth="1.5" />
          <text x={demand.x + 9} y={demand.y - 8} fontSize="10" fontWeight="700" fill="#1a1814">
            (Mu, Pu)
          </text>
        </g>

        {/* Tooltip de punto canónico */}
        {hover && (
          <g>
            <rect x={Math.min(xs(hover.M) + 10, width - 150)} y={Math.max(ys(hover.P) - 40, 4)} width="142" height="36" rx="5"
              fill="#1a2040" opacity="0.95" />
            <text x={Math.min(xs(hover.M) + 18, width - 142)} y={Math.max(ys(hover.P) - 25, 19)} fontSize="10" fill="#fbbf24" fontWeight="700">
              {hover.label}{hover.c != null ? ` · c=${hover.c.toFixed(2)}` : ''}
            </text>
            <text x={Math.min(xs(hover.M) + 18, width - 142)} y={Math.max(ys(hover.P) - 12, 32)} fontSize="10" fill="#e2e8f0">
              P={hover.P.toFixed(2)} t · M={hover.M.toFixed(3)}{hover.extra ? ` · ${hover.extra}` : ''}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
