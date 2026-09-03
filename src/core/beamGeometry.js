import { DIAM } from './constants'

// ══════════════════════════════════════════════════════════════
// Bastones (varillas de amarre)
// Se amarra un bastón por varilla del lecho, así que el límite es la
// cantidad de varillas principales. Los bastones NO cuentan para b_min:
// van amarrados a una varilla existente, no ocupan un espacio libre
// nuevo a lo ancho de la sección.
// ══════════════════════════════════════════════════════════════

/**
 * Orden de amarre: primero las varillas de esquina y después hacia el
 * centro, de izquierda a derecha.
 * @returns {number[]} índices de varilla, uno por bastón
 */
export function tieOrder(nBars, nBastones) {
  const n = Math.max(0, Math.min(Number(nBastones) || 0, nBars))
  if (n === 0) return []
  const order = []
  if (nBars >= 1) order.push(0)
  if (nBars >= 2) order.push(nBars - 1)
  for (let i = 1; i <= nBars - 2; i++) order.push(i)
  return order.slice(0, n)
}

/**
 * Posiciona los bastones amarrados a las varillas de un lecho.
 * @param {Array} bars  varillas principales [{cx, cy, r}] de izq. a der.
 * @param {number} nBastones
 * @param {number} rB   radio del bastón (mismas unidades que bars)
 * @param {object} opts { dir: +1 hacia abajo (lecho sup) | −1 hacia arriba
 *                        (lecho inf), gap, gapDiag, diagFirst }
 *   diagFirst coloca el primer bastón a ~53° para no encimarse con los
 *   ganchos del estribo, que se dibujan en la varilla superior izquierda.
 */
export function placeBastones(bars, nBastones, rB, opts = {}) {
  const { dir = 1, gap = 1.5, gapDiag = 1, diagFirst = false } = opts
  const ang = (53 * Math.PI) / 180
  return tieOrder(bars.length, nBastones).map((idx) => {
    const mb = bars[idx]
    if (diagFirst && idx === 0) {
      const off = mb.r + rB + gapDiag
      const cx = mb.cx + off * Math.cos(ang)
      const cy = mb.cy + off * Math.sin(ang)
      return {
        cx, cy, r: rB, bar: idx,
        tx0: mb.cx + mb.r * Math.cos(ang), ty0: mb.cy + mb.r * Math.sin(ang),
        tx1: cx - rB * Math.cos(ang), ty1: cy - rB * Math.sin(ang),
      }
    }
    const off = mb.r + rB + gap
    const cx = mb.cx
    const cy = mb.cy + dir * off
    return {
      cx, cy, r: rB, bar: idx,
      tx0: mb.cx, ty0: mb.cy + dir * mb.r,
      tx1: cx, ty1: cy - dir * rB,
    }
  })
}

/**
 * Compute all geometry for drawing a beam section.
 * All values returned in SCALE units (px for rendering).
 * @param {object} section - beam section data
 * @param {number} scale - px per cm
 * @returns {object} geometry data for SVG rendering
 */
export function computeGeometry(section, scale = 14) {
  const t = section
  const bpx = t.ancho * scale
  const hpx = t.peralte * scale
  const rcPx = t.recub * scale // face → bar center

  const rSupPx = (DIAM[t.calSup] / 20) * scale
  const rInfPx = (DIAM[t.calInf] / 20) * scale
  const rEstPx = (DIAM[t.calEst] / 20) * scale

  // Stirrup inset: its center is at (recub - r_main_bar) from face
  const eiPx = (t.recub - DIAM[t.calSup] / 20) * scale

  // Stirrup rounded corners
  const ew = bpx - 2 * eiPx
  const eh = hpx - 2 * eiPx
  const er = Math.min(4, ew * 0.08)

  // Bar positions
  const innerW = bpx - 2 * rcPx

  const supBars = []
  for (let i = 0; i < t.cantSup; i++) {
    const cx = t.cantSup === 1 ? rcPx : rcPx + (i * innerW) / (t.cantSup - 1)
    supBars.push({ cx, cy: rcPx, r: Math.max(rSupPx, 3.5) })
  }

  const infBars = []
  for (let i = 0; i < t.cantInf; i++) {
    const cx = t.cantInf === 1 ? rcPx : rcPx + (i * innerW) / (t.cantInf - 1)
    infBars.push({ cx, cy: hpx - rcPx, r: Math.max(rInfPx, 3.5) })
  }

  // Hooks (on top-left bar)
  const barCx = rcPx
  const barCy = rcPx
  const gLen = (DIAM[t.calEst] / 10) * scale * 1.8
  const hx = 0.60, hy = 0.80

  const hook1 = {
    x0: barCx + rSupPx * Math.cos((Math.PI * 160) / 180),
    y0: barCy + rSupPx * Math.sin((Math.PI * 160) / 180),
  }
  hook1.x1 = hook1.x0 + hx * gLen
  hook1.y1 = hook1.y0 + hy * gLen

  const hook2 = {
    x0: barCx + rSupPx * Math.cos((Math.PI * 310) / 180),
    y0: barCy + rSupPx * Math.sin((Math.PI * 310) / 180),
  }
  hook2.x1 = hook2.x0 + hx * gLen
  hook2.y1 = hook2.y0 + hy * gLen

  // ── Bastones (varillas de amarre) — hasta uno por varilla del lecho ──
  const cantBSup = Math.max(0, Math.min(Number(t.cantBastonSup) || 0, supBars.length))
  const cantBInf = Math.max(0, Math.min(Number(t.cantBastonInf) || 0, infBars.length))
  const rBSupPx = (DIAM[t.calBastonSup] / 20) * scale
  const rBInfPx = (DIAM[t.calBastonInf] / 20) * scale

  // Lecho superior: bastones hacia abajo (el primero a 53° para librar los ganchos)
  const bastonsSup = placeBastones(supBars, cantBSup, Math.max(rBSupPx, 3.5), {
    dir: 1, gap: 1.5, gapDiag: 1, diagFirst: true,
  })
  // Lecho inferior: bastones hacia arriba
  const bastonsInf = placeBastones(infBars, cantBInf, Math.max(rBInfPx, 3.5), {
    dir: -1, gap: 1.5,
  })

  // Label counts (main + bastones)
  const totalSup = (Number(t.cantSup) || 0) + cantBSup
  const totalInf = (Number(t.cantInf) || 0) + cantBInf

  // Font size
  const fs = Math.max(10, scale * 1.1)

  return {
    bpx, hpx, rcPx, eiPx, ew, eh, er, fs,
    supBars, infBars, hook1, hook2,
    rSupPx, rInfPx, rEstPx,
    bastonsSup, bastonsInf,
    cantBSup, cantBInf,
    totalSup, totalInf,
  }
}
