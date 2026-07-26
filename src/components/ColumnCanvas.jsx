import { barGrid, bdLookup } from '../core/columnCalculator'

const SCALE = 7

/**
 * Sección transversal de la columna: concreto, estribo y retícula
 * real de barras (la misma retícula que alimenta la dirección Y).
 */
export default function ColumnCanvas({ col }) {
  const b = +col.b || 30
  const h = +col.h || 30
  const r = +col.r || 3
  const lechos = col.lechos || []

  const bpx = b * SCALE
  const hpx = h * SCALE
  const ML = 56, MT = 34, MR = 56, MB = 62
  const W = ML + bpx + MR
  const H = MT + hpx + MB

  const bars = barGrid({ h, b, r, lechos })
  const est = bdLookup(col.estriboNum || 2.5)
  // Igual que en vigas: el eje del estribo va a (recub − radio_varilla) de la
  // cara, tangente al paño exterior de las varillas → las envuelve.
  const rCornerCm = bdLookup(lechos[0]?.num ?? 3).diam / 2
  const eiPx = (r - rCornerCm) * SCALE

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: 'var(--font-mono)', display: 'block' }}>
      <g transform={`translate(${ML},${MT})`}>
        {/* Concreto */}
        <rect width={bpx} height={hpx} fill="#fff" stroke="#c4517a" strokeWidth="2" />
        {/* Estribo */}
        <rect x={eiPx} y={eiPx} width={bpx - 2 * eiPx} height={hpx - 2 * eiPx} rx={4}
          fill="none" stroke="#1a7a5e" strokeWidth="1.5" />
        {/* Ganchos sobre la varilla de esquina sup.-izq. (como en vigas) */}
        {[160, 310].map((deg) => {
          const a = (Math.PI * deg) / 180
          const rc = rCornerCm * SCALE
          const gLen = est.diam * SCALE * 1.8
          const x0 = r * SCALE + rc * Math.cos(a)
          const y0 = r * SCALE + rc * Math.sin(a)
          return <line key={deg} x1={x0} y1={y0} x2={x0 + 0.6 * gLen} y2={y0 + 0.8 * gLen}
            stroke="#1a7a5e" strokeWidth="1.5" />
        })}
        {/* Barras (x a lo ancho, y = dp desde cara superior) */}
        {bars.map((bar, i) => (
          <circle key={i} cx={bar.x * SCALE} cy={bar.y * SCALE}
            r={Math.max(3.2, (bar.diam / 2) * SCALE)}
            fill="#ffd5c8" stroke="#c94f2a" strokeWidth="1.2" />
        ))}
        {/* Cotas */}
        <line x1={-16} y1={0} x2={-16} y2={hpx} stroke="#9a958c" strokeWidth="0.9" />
        <line x1={-19} y1={0} x2={-13} y2={0} stroke="#9a958c" strokeWidth="0.9" />
        <line x1={-19} y1={hpx} x2={-13} y2={hpx} stroke="#9a958c" strokeWidth="0.9" />
        <text x={-24} y={hpx / 2} fontSize="11" fill="#6b6760" textAnchor="middle"
          transform={`rotate(-90,-24,${hpx / 2})`}>h = {h}</text>
        <line x1={0} y1={hpx + 14} x2={bpx} y2={hpx + 14} stroke="#9a958c" strokeWidth="0.9" />
        <line x1={0} y1={hpx + 11} x2={0} y2={hpx + 17} stroke="#9a958c" strokeWidth="0.9" />
        <line x1={bpx} y1={hpx + 11} x2={bpx} y2={hpx + 17} stroke="#9a958c" strokeWidth="0.9" />
        <text x={bpx / 2} y={hpx + 27} fontSize="11" fill="#6b6760" textAnchor="middle">b = {b}</text>
        {/* Etiquetas de ejes de flexión */}
        <text x={bpx + 10} y={hpx / 2 - 6} fontSize="10" fill="#2563a8">Mx →</text>
        <text x={bpx + 10} y={hpx / 2 + 8} fontSize="10" fill="#c94f2a">My ↑</text>
        {/* Nombre */}
        <text x={bpx / 2} y={hpx + 46} fontSize="14" fontWeight="600" fill="#1a1814" textAnchor="middle">
          {col.nombre || 'COL'}
        </text>
      </g>
      {/* Lechos numerados */}
      {barGridLabels({ h, r, lechos }).map((L, i) => (
        <text key={i} x={ML - 34} y={MT + L.y * SCALE + 3.5} fontSize="9" fill="#c94f2a">
          L{i + 1}
        </text>
      ))}
    </svg>
  )
}

function barGridLabels({ h, r, lechos }) {
  if (!lechos.length) return []
  if (lechos.length === 1) return [{ y: h / 2 }]
  const step = (h - 2 * r) / (lechos.length - 1)
  return lechos.map((_, i) => ({ y: r + step * i }))
}
