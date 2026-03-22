import { useRef, useCallback } from 'react'
import { computeGeometry } from '../core/beamGeometry'

const SCALE = 14
const MARGIN_L = 80
const MARGIN_R = 20
const MARGIN_T = 50
const MARGIN_B = 120
const GAP = 30
const COLS = 4

/**
 * Render a single beam section as SVG group.
 * ox, oy = top-left corner of the concrete rectangle.
 */
function SectionGroup({ t, ox, oy }) {
  const g = computeGeometry(t, SCALE)
  const { bpx, hpx, rcPx, eiPx, ew, eh, er, fs, supBars, infBars, hook1, hook2,
    bastonsSup, bastonsInf, cantBSup, cantBInf, totalSup, totalInf } = g

  // Dimension annotation: cover (left, between height and section)
  const crx = -fs * 1.6
  const yEjeInf = hpx - rcPx
  const yPanoInf = hpx

  // Dimension: height (left)
  const cpx = -fs * 3.8

  // Dimension: width (bottom)
  const cpy = hpx + fs * 2.2

  return (
    <g transform={`translate(${ox},${oy})`}>
      {/* Section outline */}
      <rect width={bpx} height={hpx} fill="none" stroke="#c4517a" strokeWidth="2" />

      {/* Stirrup */}
      <rect
        x={eiPx} y={eiPx}
        width={ew} height={eh}
        rx={er} fill="none"
        stroke="#1a7a5e" strokeWidth="1.5"
      />

      {/* Hook 1 */}
      <line x1={hook1.x0} y1={hook1.y0} x2={hook1.x1} y2={hook1.y1} stroke="#1a7a5e" strokeWidth="1.5" />
      {/* Hook 2 */}
      <line x1={hook2.x0} y1={hook2.y0} x2={hook2.x1} y2={hook2.y1} stroke="#1a7a5e" strokeWidth="1.5" />

      {/* Top bars */}
      {supBars.map((b, i) => (
        <circle key={`s${i}`} cx={b.cx} cy={b.cy} r={b.r} fill="#ffd5c8" stroke="#c94f2a" strokeWidth="1.2" />
      ))}

      {/* Bottom bars */}
      {infBars.map((b, i) => (
        <circle key={`i${i}`} cx={b.cx} cy={b.cy} r={b.r} fill="#cfe0f7" stroke="#2563a8" strokeWidth="1.2" />
      ))}

      {/* Top bastones */}
      {bastonsSup.map((b, i) => (
        <g key={`bs${i}`}>
          <line x1={b.tx0} y1={b.ty0} x2={b.tx1} y2={b.ty1} stroke="#c94f2a" strokeWidth="1" />
          <circle cx={b.cx} cy={b.cy} r={b.r} fill="none" stroke="#c94f2a" strokeWidth="1.2" />
        </g>
      ))}

      {/* Bottom bastones */}
      {bastonsInf.map((b, i) => (
        <g key={`bi${i}`}>
          <line x1={b.tx0} y1={b.ty0} x2={b.tx1} y2={b.ty1} stroke="#2563a8" strokeWidth="1" />
          <circle cx={b.cx} cy={b.cy} r={b.r} fill="none" stroke="#2563a8" strokeWidth="1.2" />
        </g>
      ))}

      {/* ── Cover dimension (left, near bottom) ── */}
      <line x1={0} y1={yEjeInf} x2={crx - 2} y2={yEjeInf} stroke="#bbb" strokeWidth="0.6" strokeDasharray="2,2" />
      <line x1={0} y1={yPanoInf} x2={crx - 2} y2={yPanoInf} stroke="#bbb" strokeWidth="0.6" strokeDasharray="2,2" />
      <line x1={crx} y1={yEjeInf} x2={crx} y2={yPanoInf} stroke="#aaa" strokeWidth="0.9" />
      <polygon points={`${crx},${yEjeInf} ${crx - 2},${yEjeInf + 4} ${crx + 2},${yEjeInf + 4}`} fill="#aaa" />
      <polygon points={`${crx},${yPanoInf} ${crx - 2},${yPanoInf - 4} ${crx + 2},${yPanoInf - 4}`} fill="#aaa" />
      <text
        x={crx - fs * 0.9} y={yEjeInf + rcPx / 2 + fs * 0.35}
        fontSize={Math.round(fs * 0.8)} fill="#aaa" textAnchor="middle"
        transform={`rotate(-90,${crx - fs * 0.9},${yEjeInf + rcPx / 2 + fs * 0.35})`}
      >r={t.recub}</text>

      {/* ── Height dimension (left) ── */}
      <line x1={0} y1={0} x2={cpx - 3} y2={0} stroke="#bbb" strokeWidth="0.6" strokeDasharray="2,2" />
      <line x1={0} y1={hpx} x2={cpx - 3} y2={hpx} stroke="#bbb" strokeWidth="0.6" strokeDasharray="2,2" />
      <line x1={cpx} y1={0} x2={cpx} y2={hpx} stroke="#aaa" strokeWidth="0.9" />
      <polygon points={`${cpx},0 ${cpx - 2},4 ${cpx + 2},4`} fill="#aaa" />
      <polygon points={`${cpx},${hpx} ${cpx - 2},${hpx - 4} ${cpx + 2},${hpx - 4}`} fill="#aaa" />
      <text
        x={cpx - fs * 0.9} y={hpx / 2 + fs * 0.35}
        fontSize={Math.round(fs * 0.9)} fill="#888" textAnchor="middle"
        transform={`rotate(-90,${cpx - fs * 0.9},${hpx / 2 + fs * 0.35})`}
      >{t.peralte}</text>

      {/* ── Width dimension (bottom) ── */}
      <line x1={0} y1={hpx} x2={0} y2={cpy + 3} stroke="#bbb" strokeWidth="0.6" strokeDasharray="2,2" />
      <line x1={bpx} y1={hpx} x2={bpx} y2={cpy + 3} stroke="#bbb" strokeWidth="0.6" strokeDasharray="2,2" />
      <line x1={0} y1={cpy} x2={bpx} y2={cpy} stroke="#aaa" strokeWidth="0.9" />
      <polygon points={`0,${cpy} 4,${cpy - 2} 4,${cpy + 2}`} fill="#aaa" />
      <polygon points={`${bpx},${cpy} ${bpx - 4},${cpy - 2} ${bpx - 4},${cpy + 2}`} fill="#aaa" />
      <text x={bpx / 2} y={cpy + fs * 1.3} fontSize={Math.round(fs * 0.9)} fill="#888" textAnchor="middle">
        {t.ancho}
      </text>

      {/* ── Labels ── */}
      {/* Stirrups label */}
      <text x={bpx / 2} y={-fs * 1.5} fontSize={Math.round(fs * 0.88)} fill="#1a7a5e" textAnchor="middle">
        {`Est. #${t.calEst}  @${t.sepLcuarto}/@${t.sepRest} cm`}
      </text>
      {/* Top steel label */}
      <text x={bpx / 2} y={-fs * 0.3} fontSize={Math.round(fs * 0.88)} fill="#c94f2a" textAnchor="middle">
        {cantBSup > 0 && t.calBastonSup !== t.calSup
          ? `${t.cantSup}\u00D8#${t.calSup} + ${cantBSup}\u00D8#${t.calBastonSup}`
          : `${totalSup}\u00D8#${t.calSup}`}
      </text>
      {/* Bottom steel label */}
      <text x={bpx / 2} y={hpx + fs * 1.2} fontSize={Math.round(fs * 0.88)} fill="#2563a8" textAnchor="middle">
        {cantBInf > 0 && t.calBastonInf !== t.calInf
          ? `${t.cantInf}\u00D8#${t.calInf} + ${cantBInf}\u00D8#${t.calBastonInf}`
          : `${totalInf}\u00D8#${t.calInf}`}
      </text>

      {/* Name + dims */}
      <text x={bpx / 2} y={hpx + fs * 5.8} textAnchor="middle" fontSize={Math.round(fs * 1.5)} fontWeight="600" fill="#1a1814">
        {t.nombre}
      </text>
      <text x={bpx / 2} y={hpx + fs * 7.2} textAnchor="middle" fontSize={Math.round(fs * 0.95)} fill="#6b6760">
        {`${t.ancho} \u00D7 ${t.peralte} cm`}
      </text>
      <text x={bpx / 2} y={hpx + fs * 8.5} textAnchor="middle" fontSize={Math.round(fs * 0.85)} fill="#8a8580">
        {`f'c = ${t.fc} kg/cm2`}
      </text>
    </g>
  )
}

/**
 * BeamCanvas: renders all sections as SVG.
 * Exposes SVG element via ref for DXF export.
 */
export default function BeamCanvas({ sections, svgRef }) {
  const internalRef = useRef(null)
  const ref = svgRef || internalRef

  const list = sections
  if (list.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-tx3)' }}>
        Pulsa &ldquo;+ Nueva&rdquo; para crear una secci&oacute;n
      </div>
    )
  }

  const colCount = Math.min(list.length, COLS)
  const cellWidths = list.map((t) => t.ancho * SCALE + MARGIN_L + MARGIN_R)
  const cellHeights = list.map((t) => t.peralte * SCALE + MARGIN_T + MARGIN_B)

  const colW = []
  for (let c = 0; c < colCount; c++) {
    let maxW = 0
    for (let r = 0; r * colCount + c < list.length; r++) {
      maxW = Math.max(maxW, cellWidths[r * colCount + c] || 0)
    }
    colW.push(maxW + GAP)
  }

  const rowCount = Math.ceil(list.length / colCount)
  const rowH = []
  for (let r = 0; r < rowCount; r++) {
    let maxH = 0
    for (let c = 0; c < colCount; c++) {
      const idx = r * colCount + c
      if (idx < list.length) maxH = Math.max(maxH, cellHeights[idx])
    }
    rowH.push(maxH + GAP)
  }

  const colX = [GAP]
  for (let c = 1; c < colCount; c++) colX.push(colX[c - 1] + colW[c - 1])
  const rowY = [GAP]
  for (let r = 1; r < rowCount; r++) rowY.push(rowY[r - 1] + rowH[r - 1])

  const W = colX[colCount - 1] + colW[colCount - 1]
  const H = rowY[rowCount - 1] + rowH[rowCount - 1]

  return (
    <div className="flex-1 overflow-auto" style={{
      background: 'radial-gradient(circle, #c9c5be 1px, transparent 1px)',
      backgroundSize: '24px 24px',
      backgroundColor: 'var(--color-bg)',
    }}>
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        data-real-width-cm={(W / SCALE).toFixed(4)}
        data-real-height-cm={(H / SCALE).toFixed(4)}
        style={{ display: 'block', fontFamily: "'DM Mono', monospace" }}
      >
        {list.map((t, i) => {
          const col = i % colCount
          const row = Math.floor(i / colCount)
          const bpx = t.ancho * SCALE
          const hpx = t.peralte * SCALE
          const cellStartX = colX[col]
          const cellStartY = rowY[row]
          const cellTotalW = colW[col] - GAP
          const cellTotalH = rowH[row] - GAP
          const ox = cellStartX + MARGIN_L + (cellTotalW - MARGIN_L - MARGIN_R - bpx) / 2
          const oy = cellStartY + MARGIN_T + (cellTotalH - MARGIN_T - MARGIN_B - hpx) / 2
          return <SectionGroup key={t.nombre + i} t={t} ox={ox} oy={oy} />
        })}
      </svg>
    </div>
  )
}
