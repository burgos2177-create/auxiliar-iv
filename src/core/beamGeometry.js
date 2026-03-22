import { DIAM } from './constants'

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

  // ── Bastones (dowel bars) ──
  const cantBSup = Math.min(Number(t.cantBastonSup) || 0, 2)
  const cantBInf = Math.min(Number(t.cantBastonInf) || 0, 2)
  const rBSupPx = (DIAM[t.calBastonSup] / 20) * scale
  const rBInfPx = (DIAM[t.calBastonInf] / 20) * scale
  const bastonLen = scale * 1.6 // tie line length in px

  // Top bastones: at 45° going down from corner bars
  const bastonsSup = []
  if (cantBSup >= 1 && supBars.length >= 2) {
    // Left corner bar → baston at ~53° down-right, offset = 1 diameter (almost touching)
    const lb = supBars[0]
    const rB = Math.max(rBSupPx, 3.5)
    const angle = (53 * Math.PI) / 180 // ~53° from horizontal
    const offDist = lb.r + rB + 1 // just 1px gap — almost touching
    const bx = lb.cx + offDist * Math.cos(angle)
    const by = lb.cy + offDist * Math.sin(angle)
    bastonsSup.push({
      cx: bx, cy: by, r: rB,
      tx0: lb.cx + lb.r * Math.cos(angle),
      ty0: lb.cy + lb.r * Math.sin(angle),
      tx1: bx - rB * Math.cos(angle),
      ty1: by - rB * Math.sin(angle),
    })
  }
  if (cantBSup >= 2 && supBars.length >= 2) {
    // Right corner bar → baston straight down (90°)
    const rb = supBars[supBars.length - 1]
    const offDist = rb.r + Math.max(rBSupPx, 3.5) + 1.5
    const bx = rb.cx
    const by = rb.cy + offDist
    const rB = Math.max(rBSupPx, 3.5)
    bastonsSup.push({
      cx: bx, cy: by, r: rB,
      tx0: rb.cx, ty0: rb.cy + rb.r,
      tx1: bx, ty1: by - rB,
    })
  }

  // Bottom bastones: at 90° going up from corner bars
  const bastonsInf = []
  if (cantBInf >= 1 && infBars.length >= 2) {
    // Left corner bar → baston straight up
    const lb = infBars[0]
    const offDist = lb.r + Math.max(rBInfPx, 3.5) + 1.5
    const bx = lb.cx
    const by = lb.cy - offDist
    const rB = Math.max(rBInfPx, 3.5)
    bastonsInf.push({
      cx: bx, cy: by, r: rB,
      tx0: lb.cx, ty0: lb.cy - lb.r,
      tx1: bx, ty1: by + rB,
    })
  }
  if (cantBInf >= 2 && infBars.length >= 2) {
    // Right corner bar → baston straight up
    const rb = infBars[infBars.length - 1]
    const offDist = rb.r + Math.max(rBInfPx, 3.5) + 1.5
    const bx = rb.cx
    const by = rb.cy - offDist
    const rB = Math.max(rBInfPx, 3.5)
    bastonsInf.push({
      cx: bx, cy: by, r: rB,
      tx0: rb.cx, ty0: rb.cy - rb.r,
      tx1: bx, ty1: by + rB,
    })
  }

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
