import { useState, useMemo } from 'react'

/**
 * Diagrama de interacción P–M (2D) de una dirección.
 * Curva de frontera (barrido fino) + puntos canónicos del Excel +
 * punto de demanda (Mu, Pu) con estado.
 */
export default function InteractionDiagram({ analysis, Mu, Pu, check, color = '#2563a8', title, width = 380, height = 330 }) {
  const [hover, setHover] = useState(null)

  const PAD = { l: 52, r: 16, t: 26, b: 40 }
  const iw = width - PAD.l - PAD.r
  const ih = height - PAD.t - PAD.b

  const { xs, ys, xTicks, yTicks, path, areaPath } = useMemo(() => {
    const curve = analysis.curve
    const Ms = curve.map((p) => p.M).concat([+Mu || 0])
    const Ps = curve.map((p) => p.P).concat([+Pu || 0])
    const Mmax = Math.max(...Ms, 0.1) * 1.12
    const Pmin = Math.min(...Ps, 0) * 1.12
    const Pmax = Math.max(...Ps) * 1.08
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
  }, [analysis, Mu, Pu, iw, ih])

  const demand = { x: xs(+Mu || 0), y: ys(+Pu || 0) }
  const okCol = check?.ok ? '#15803d' : '#dc2626'

  return (
    <div style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{title}</span>
        {check && (
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

        {/* Punto de demanda */}
        <g>
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
              P={hover.P.toFixed(2)} t · M={hover.M.toFixed(3)} t·m
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
