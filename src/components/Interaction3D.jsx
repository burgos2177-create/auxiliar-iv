import { useState, useMemo, useCallback } from 'react'
import { checkPoint } from '../core/columnCalculator'

/**
 * Geoide de interacción 3D: por cada nivel de P se traza la elipse
 *   (Mx/MRx(P))² + (My/MRy(P))² = 1
 * cuyos semiejes son las fronteras de cada dirección. Los meridianos
 * θ=0 y θ=90° son exactamente las dos curvas 2D. Columna cuadrada →
 * geoide de revolución; rectangular → alargado hacia la dirección fuerte.
 * Arrastra para rotar.
 */
export default function Interaction3D({ anX, anY, Pu, MuX, MuY, biaxial, width = 560, height = 470 }) {
  const [rot, setRot] = useState({ yaw: 0.7, pitch: 0.42 })
  const [drag, setDrag] = useState(null)

  const geo = useMemo(() => {
    const POC = Math.min(anX.POC, anY.POC)
    const PminX = Math.min(...anX.curve.map((p) => p.P))
    const PminY = Math.min(...anY.curve.map((p) => p.P))
    const Pmin = Math.max(PminX, PminY)
    const NL = 26, NM = 24
    const levels = []
    for (let i = 0; i <= NL; i++) {
      const P = Pmin + ((POC - Pmin) * i) / NL
      const MRx = checkPoint(anX.curve, P, 0).MR
      const MRy = checkPoint(anY.curve, P, 0).MR
      levels.push({ P, MRx, MRy })
    }
    const Mscale = Math.max(...levels.map((l) => Math.max(l.MRx, l.MRy)), 0.01)
    return { levels, Pmin, POC, Mscale, NM }
  }, [anX, anY])

  const project = useCallback((mx, my, P) => {
    const { Pmin, POC, Mscale } = geo
    // normalizar a caja [-1,1]
    const x = mx / Mscale
    const z = my / Mscale
    const y = ((P - Pmin) / (POC - Pmin)) * 2 - 1
    // rotación yaw (alrededor de eje P) + pitch
    const cy = Math.cos(rot.yaw), sy = Math.sin(rot.yaw)
    const cp = Math.cos(rot.pitch), sp = Math.sin(rot.pitch)
    const x1 = x * cy - z * sy
    const z1 = x * sy + z * cy
    const y1 = y * cp - z1 * sp
    const S = Math.min(width, height) * 0.31
    return { X: width / 2 + x1 * S * 1.35, Y: height / 2 - y1 * S * 1.28, depth: z1 }
  }, [geo, rot, width, height])

  const rings = useMemo(() => geo.levels.map((l) => {
    const pts = []
    for (let j = 0; j <= geo.NM; j++) {
      const th = (2 * Math.PI * j) / geo.NM
      pts.push(project(l.MRx * Math.cos(th), l.MRy * Math.sin(th), l.P))
    }
    return { P: l.P, pts }
  }), [geo, project])

  const meridians = useMemo(() => {
    const mk = (fx, fy) => geo.levels.map((l) => project(fx(l), fy(l), l.P))
    return [
      { color: '#2563a8', pts: mk((l) => l.MRx, () => 0), label: '+Mx' },
      { color: '#2563a8', pts: mk((l) => -l.MRx, () => 0) },
      { color: '#c94f2a', pts: mk(() => 0, (l) => l.MRy), label: '+My' },
      { color: '#c94f2a', pts: mk(() => 0, (l) => -l.MRy) },
    ]
  }, [geo, project])

  const demand = project(+MuX || 0, +MuY || 0, +Pu || 0)
  const okCol = biaxial?.ok ? '#15803d' : '#dc2626'

  const onDown = (e) => setDrag({ x: e.clientX, y: e.clientY, yaw: rot.yaw, pitch: rot.pitch })
  const onMove = (e) => {
    if (!drag) return
    setRot({
      yaw: drag.yaw + (e.clientX - drag.x) * 0.011,
      pitch: Math.max(-1.4, Math.min(1.4, drag.pitch + (e.clientY - drag.y) * 0.011)),
    })
  }

  const toPath = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.X.toFixed(1)},${p.Y.toFixed(1)}`).join(' ')

  return (
    <div style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-tx1)' }}>
          Superficie de interacción 3D (P, Mx, My)
        </span>
        <span style={{ fontSize: 10, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)' }}>
          arrastra para rotar
        </span>
      </div>
      <svg width={width} height={height}
        style={{ display: 'block', cursor: drag ? 'grabbing' : 'grab', touchAction: 'none' }}
        onMouseDown={onDown} onMouseMove={onMove}
        onMouseUp={() => setDrag(null)} onMouseLeave={() => setDrag(null)}>
        {/* Eje P */}
        {(() => {
          const top = project(0, 0, geo.POC * 1.05)
          const bot = project(0, 0, geo.Pmin * 1.05)
          return <line x1={bot.X} y1={bot.Y} x2={top.X} y2={top.Y} stroke="#b8b2a6" strokeWidth="1" strokeDasharray="3,3" />
        })()}
        {/* Anillos (niveles de P) */}
        {rings.map((r, i) => (
          <path key={i} d={toPath(r.pts)} fill="none"
            stroke={r.P >= 0 ? '#8a95b8' : '#c9a68a'} strokeWidth="0.8" opacity="0.55" />
        ))}
        {/* Meridianos = curvas 2D X / Y */}
        {meridians.map((m, i) => (
          <path key={i} d={toPath(m.pts)} fill="none" stroke={m.color} strokeWidth="2" opacity="0.95" />
        ))}
        {/* Etiquetas de ejes */}
        {(() => {
          const ex = project(geo.Mscale * 1.12, 0, geo.Pmin + (geo.POC - geo.Pmin) * 0.02)
          const ey = project(0, geo.Mscale * 1.12, geo.Pmin + (geo.POC - geo.Pmin) * 0.02)
          const ep = project(0, 0, geo.POC * 1.08)
          return (
            <g fontFamily="var(--font-mono)" fontSize="11">
              <text x={ex.X} y={ex.Y} fill="#2563a8" fontWeight="700">Mx</text>
              <text x={ey.X} y={ey.Y} fill="#c94f2a" fontWeight="700">My</text>
              <text x={ep.X + 6} y={ep.Y} fill="#6b6760" fontWeight="700">P</text>
            </g>
          )
        })()}
        {/* Punto de demanda */}
        <g>
          <circle cx={demand.X} cy={demand.Y} r="6" fill={okCol} stroke="#fff" strokeWidth="2" />
          <text x={demand.X + 10} y={demand.Y + 4} fontSize="11" fontWeight="700" fill="#1a1814" fontFamily="var(--font-mono)">
            (Mux, Muy, Pu)
          </text>
        </g>
      </svg>
      {biaxial && (
        <div style={{
          marginTop: 8, padding: '8px 12px', borderRadius: 6, fontSize: 12,
          background: biaxial.ok ? '#e8f5e9' : '#fdecea',
          border: `1px solid ${biaxial.ok ? '#a5d6a7' : '#ef9a9a'}`,
          color: biaxial.ok ? '#15803d' : '#c62828', fontWeight: 700,
          display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6,
        }}>
          <span>{biaxial.ok ? '✓ DENTRO de la superficie' : '✗ FUERA de la superficie'}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 400 }}>
            (Mux/MRx)² + (Muy/MRy)² = {isFinite(biaxial.valor) ? biaxial.valor.toFixed(3) : '∞'} {biaxial.ok ? '≤' : '>'} 1
          </span>
        </div>
      )}
    </div>
  )
}
