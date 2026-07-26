import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { checkPoint } from '../core/columnCalculator'

/**
 * Superficie de interacción 3D (geoide P–Mx–My).
 * Por cada nivel de P se traza la elipse (Mx/MRx)² + (My/MRy)² = 1, cuyos
 * semiejes son las fronteras de cada dirección; los meridianos θ=0 y θ=90°
 * son exactamente las curvas 2D. Cuadrada → geoide de revolución;
 * rectangular → alargado hacia la dirección fuerte.
 *
 * Interacción: arrastrar rota · rueda hace zoom · presets de vista ·
 * el nivel de carga del punto activo se resalta con su elipse, de modo que
 * se aprecia si el punto queda dentro del contorno a SU nivel de P.
 */

const VIEWS = {
  iso:   { yaw: 0.7,  pitch: 0.42, label: 'Iso' },
  mx:    { yaw: 0,    pitch: 0,    label: 'Mx–P' },
  my:    { yaw: Math.PI / 2, pitch: 0, label: 'My–P' },
  planta:{ yaw: 0,    pitch: 1.45, label: 'Planta' },
}

export default function Interaction3D({
  anX, anY, Pu, MuX, MuY, biaxial,
  cloud = null, width = 580, height = 500,
}) {
  const [rot, setRot] = useState(VIEWS.iso)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [showRings, setShowRings] = useState(true)
  const [sel, setSel] = useState(null) // punto de la nube resaltado
  const drag = useRef(null)
  const svgRef = useRef(null)

  // Zoom con rueda (listener no pasivo para poder prevenir el scroll)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      setZoom((z) => Math.max(0.5, Math.min(14, z * (e.deltaY > 0 ? 0.92 : 1.08))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const geo = useMemo(() => {
    const POC = Math.min(anX.POC, anY.POC)
    const Pmin = Math.max(
      Math.min(...anX.curve.map((p) => p.P)),
      Math.min(...anY.curve.map((p) => p.P)),
    )
    const NL = 24, NM = 48
    const levels = []
    for (let i = 0; i <= NL; i++) {
      const P = Pmin + ((POC - Pmin) * i) / NL
      levels.push({ P, MRx: checkPoint(anX.curve, P, 0).MR, MRy: checkPoint(anY.curve, P, 0).MR })
    }
    const Mscale = Math.max(...levels.map((l) => Math.max(l.MRx, l.MRy)), 0.01)
    return { levels, Pmin, POC, Mscale, NM }
  }, [anX, anY])

  const projectWith = useCallback((mx, my, P, zoomV, panV) => {
    const { Pmin, POC, Mscale } = geo
    const x = mx / Mscale, z = my / Mscale
    const y = ((P - Pmin) / (POC - Pmin)) * 2 - 1
    const cy = Math.cos(rot.yaw), sy = Math.sin(rot.yaw)
    const cp = Math.cos(rot.pitch), sp = Math.sin(rot.pitch)
    const x1 = x * cy - z * sy
    const z1 = x * sy + z * cy
    const y1 = y * cp - z1 * sp
    const S = Math.min(width, height) * 0.30 * zoomV
    return {
      X: width / 2 + panV.x + x1 * S * 1.3,
      Y: height / 2 + panV.y - y1 * S * 1.25,
      depth: z1 * cp + y * sp,
    }
  }, [geo, rot, width, height])

  const project = useCallback(
    (mx, my, P) => projectWith(mx, my, P, zoom, pan),
    [projectWith, zoom, pan],
  )

  // Encuadra la nube (o el punto de demanda) en el centro de la vista
  const fitDemand = useCallback(() => {
    const pts = (cloud && cloud.length)
      ? cloud.map((r) => [r.Mux, r.Muy, r.Pu])
      : [[+MuX || 0, +MuY || 0, +Pu || 0]]
    const Z0 = { x: 0, y: 0 }
    const proj = pts.map(([a, b, c]) => projectWith(a, b, c, 1, Z0))
    const xsA = proj.map((p) => p.X), ysA = proj.map((p) => p.Y)
    const spanX = Math.max(...xsA) - Math.min(...xsA)
    const spanY = Math.max(...ysA) - Math.min(...ysA)
    const span = Math.max(spanX, spanY, 1e-6)
    const target = Math.min(width, height) * 0.42
    const z = Math.max(0.5, Math.min(14, target / span))
    // Centroide con el nuevo zoom → paneo para centrarlo
    const proj2 = pts.map(([a, b, c]) => projectWith(a, b, c, z, Z0))
    const cxm = proj2.reduce((s, p) => s + p.X, 0) / proj2.length
    const cym = proj2.reduce((s, p) => s + p.Y, 0) / proj2.length
    setZoom(z)
    setPan({ x: width / 2 - cxm, y: height / 2 - cym })
  }, [cloud, MuX, MuY, Pu, projectWith, width, height])

  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [])

  const ringPts = useCallback((MRx, MRy, P) => {
    const pts = []
    for (let j = 0; j <= geo.NM; j++) {
      const th = (2 * Math.PI * j) / geo.NM
      pts.push(project(MRx * Math.cos(th), MRy * Math.sin(th), P))
    }
    return pts
  }, [geo, project])

  const rings = useMemo(
    () => geo.levels.map((l) => ({ P: l.P, pts: ringPts(l.MRx, l.MRy, l.P) })),
    [geo, ringPts],
  )

  const meridians = useMemo(() => {
    const mk = (fx, fy) => geo.levels.map((l) => project(fx(l), fy(l), l.P))
    return [
      { color: '#2563a8', pts: mk((l) => l.MRx, () => 0) },
      { color: '#2563a8', pts: mk((l) => -l.MRx, () => 0) },
      { color: '#c94f2a', pts: mk(() => 0, (l) => l.MRy) },
      { color: '#c94f2a', pts: mk(() => 0, (l) => -l.MRy) },
    ]
  }, [geo, project])

  // Punto activo: el seleccionado de la nube, o la demanda manual
  const active = sel || (cloud && cloud.length
    ? null
    : { Pu: +Pu || 0, Mux: +MuX || 0, Muy: +MuY || 0, ok: biaxial?.ok, member: null })

  // Elipse del nivel de carga del punto activo → deja ver si cae dentro
  const levelRing = useMemo(() => {
    if (!active) return null
    const P = active.Pu
    if (P < geo.Pmin || P > geo.POC) return null
    const MRx = checkPoint(anX.curve, P, 0).MR
    const MRy = checkPoint(anY.curve, P, 0).MR
    return { pts: ringPts(MRx, MRy, P), MRx, MRy, P }
  }, [active, geo, anX, anY, ringPts])

  const toPath = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.X.toFixed(1)},${p.Y.toFixed(1)}`).join(' ')

  const onDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY, yaw: rot.yaw, pitch: rot.pitch }
  }
  const onMove = (e) => {
    if (!drag.current) return
    const d = drag.current
    setRot({
      yaw: d.yaw + (e.clientX - d.x) * 0.006,
      pitch: Math.max(-1.5, Math.min(1.5, d.pitch + (e.clientY - d.y) * 0.006)),
    })
  }
  const stop = () => { drag.current = null }

  const btn = (activeFlag) => ({
    padding: '3px 9px', fontSize: 10, fontWeight: 700, borderRadius: 5, cursor: 'pointer',
    fontFamily: 'var(--font-mono)', border: '1px solid var(--color-border)',
    background: activeFlag ? 'var(--color-accent)' : 'var(--color-bg)',
    color: activeFlag ? '#fff' : 'var(--color-tx3)',
  })

  return (
    <div style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 12 }}>
      {/* Controles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-tx1)', marginRight: 4 }}>
          Superficie de interacción 3D
        </span>
        {Object.entries(VIEWS).map(([k, v]) => (
          <button key={k} style={btn(Math.abs(rot.yaw - v.yaw) < 0.02 && Math.abs(rot.pitch - v.pitch) < 0.02)}
            onClick={() => setRot({ yaw: v.yaw, pitch: v.pitch })}>{v.label}</button>
        ))}
        <button style={btn(false)} onClick={() => setZoom((z) => Math.min(14, z * 1.2))}>+</button>
        <button style={btn(false)} onClick={() => setZoom((z) => Math.max(0.5, z / 1.2))}>−</button>
        <button style={btn(zoom > 1.05 || pan.x !== 0)} onClick={fitDemand}
          title="Acerca y centra la vista en la demanda">⤢ demanda</button>
        <button style={btn(false)} onClick={resetView}>⌂</button>
        <button style={btn(showRings)} onClick={() => setShowRings((v) => !v)}>Malla</button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9.5, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)' }}>
          arrastra = rotar · rueda = zoom
        </span>
      </div>

      <svg ref={svgRef} width={width} height={height}
        style={{ display: 'block', cursor: drag.current ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' }}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={stop} onMouseLeave={stop}>

        {/* Eje P */}
        {(() => {
          const top = project(0, 0, geo.POC)
          const bot = project(0, 0, geo.Pmin)
          return <line x1={bot.X} y1={bot.Y} x2={top.X} y2={top.Y} stroke="#b8b2a6" strokeWidth="1" strokeDasharray="4,3" />
        })()}

        {/* Malla de anillos (por nivel de P) */}
        {showRings && rings.map((r, i) => (
          <path key={i} d={toPath(r.pts)} fill="none"
            stroke={r.P >= 0 ? '#9aa5c4' : '#c9a68a'} strokeWidth="0.7" opacity="0.4" />
        ))}

        {/* Meridianos = curvas 2D */}
        {meridians.map((m, i) => (
          <path key={i} d={toPath(m.pts)} fill="none" stroke={m.color} strokeWidth="2" opacity="0.95" />
        ))}

        {/* Elipse del nivel de carga del punto activo */}
        {levelRing && (
          <>
            <path d={toPath(levelRing.pts)} fill="#f59e0b" fillOpacity="0.12"
              stroke="#b45309" strokeWidth="2" strokeDasharray="5,3" />
            <text x={project(levelRing.MRx, 0, levelRing.P).X + 6}
              y={project(levelRing.MRx, 0, levelRing.P).Y - 6}
              fontSize="10" fill="#b45309" fontWeight="700" fontFamily="var(--font-mono)">
              P = {levelRing.P.toFixed(1)} t
            </text>
          </>
        )}

        {/* Nube de la envolvente */}
        {(cloud || []).map((r, i) => {
          const p = project(r.Mux, r.Muy, r.Pu)
          const isSel = sel && sel.id === r.id
          return (
            <g key={i} onMouseEnter={() => setSel(r)} style={{ cursor: 'pointer' }}>
              <circle cx={p.X} cy={p.Y} r={isSel ? 6 : 3.6}
                fill={r.ok ? '#15803d' : '#dc2626'} fillOpacity={isSel ? 1 : 0.75}
                stroke="#fff" strokeWidth={isSel ? 2 : 1} />
              <circle cx={p.X} cy={p.Y} r="10" fill="transparent" />
            </g>
          )
        })}

        {/* Punto activo con líneas guía al eje P y al plano */}
        {active && (() => {
          const p = project(active.Mux, active.Muy, active.Pu)
          const axis = project(0, 0, active.Pu)
          const col = active.ok ? '#15803d' : '#dc2626'
          return (
            <g>
              <line x1={axis.X} y1={axis.Y} x2={p.X} y2={p.Y} stroke={col} strokeWidth="1" strokeDasharray="3,2" opacity="0.8" />
              <circle cx={axis.X} cy={axis.Y} r="2.5" fill="#b45309" />
              <circle cx={p.X} cy={p.Y} r="8" fill="#fff" opacity="0.9" />
              <circle cx={p.X} cy={p.Y} r="5.5" fill={col} stroke="#fff" strokeWidth="2" />
              <text x={p.X + 11} y={p.Y + 4} fontSize="10.5" fontWeight="700" fill="#1a1814" fontFamily="var(--font-mono)">
                {active.member ? `M-${active.member}` : '(Mux, Muy, Pu)'}
              </text>
            </g>
          )
        })()}

        {/* Etiquetas de ejes */}
        {(() => {
          const ex = project(geo.Mscale * 1.15, 0, geo.Pmin)
          const ey = project(0, geo.Mscale * 1.15, geo.Pmin)
          const ep = project(0, 0, geo.POC)
          return (
            <g fontFamily="var(--font-mono)" fontSize="11" fontWeight="700">
              <text x={ex.X} y={ex.Y} fill="#2563a8">Mx</text>
              <text x={ey.X} y={ey.Y} fill="#c94f2a">My</text>
              <text x={ep.X + 7} y={ep.Y} fill="#6b6760">P</text>
            </g>
          )
        })()}
      </svg>

      {/* Estado */}
      {active && (
        <div style={{
          marginTop: 8, padding: '8px 12px', borderRadius: 6, fontSize: 12,
          background: active.ok ? '#e8f5e9' : '#fdecea',
          border: `1px solid ${active.ok ? '#a5d6a7' : '#ef9a9a'}`,
          color: active.ok ? '#15803d' : '#c62828', fontWeight: 700,
          display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6,
        }}>
          <span>
            {active.member ? `Miembro ${active.member} (${active.tipo}): ` : ''}
            {active.ok ? '✓ DENTRO de la superficie' : '✗ FUERA de la superficie'}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 400 }}>
            Pu={active.Pu.toFixed(2)} t · Mux={active.Mux.toFixed(2)} · Muy={active.Muy.toFixed(2)} t·m
            {active.util !== undefined && ` · util=${isFinite(active.util) ? active.util.toFixed(3) : '∞'}`}
            {active.util === undefined && biaxial && ` · (Mux/MRx)²+(Muy/MRy)²=${isFinite(biaxial.valor) ? biaxial.valor.toFixed(3) : '∞'}`}
          </span>
        </div>
      )}
      {cloud && cloud.length > 0 && !sel && (
        <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)' }}>
          Pasa el cursor por un punto de la nube para resaltarlo y ver la elipse de su nivel de carga.
        </div>
      )}
    </div>
  )
}
