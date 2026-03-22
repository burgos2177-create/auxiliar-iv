import { jsPDF } from 'jspdf'
import { computeGeometry } from './beamGeometry'
import { DIAM } from './constants'
import { calcFlexion, calcCortante } from './sectionCalculator'

const CAL_TO_NUM = { '2': 2, '2.5': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10 }

// ── Colors ──────────────────────────────────────────────────
const COL = {
  bg: [245, 243, 239],
  panel: [234, 230, 223],
  border: [214, 208, 198],
  tx: [26, 24, 20],
  tx2: [74, 70, 64],
  tx3: [138, 133, 128],
  accent: [91, 197, 174],
  accent2: [26, 122, 94],
  steelTop: [201, 79, 42],
  steelBot: [37, 99, 168],
  stirrup: [26, 122, 94],
  ok: [26, 122, 94],
  warn: [201, 79, 42],
  white: [255, 255, 255],
}

function setColor(doc, col) { doc.setTextColor(...col) }
function setDraw(doc, col) { doc.setDrawColor(...col) }
function setFill(doc, col) { doc.setFillColor(...col) }

// ── Draw beam section on PDF ────────────────────────────────
function drawSection(doc, section, ox, oy, drawScale = 2.2) {
  const s = drawScale
  const t = section
  const bMm = t.ancho * s
  const hMm = t.peralte * s

  // Concrete outline
  setDraw(doc, COL.steelTop)
  doc.setLineWidth(0.4)
  doc.rect(ox, oy, bMm, hMm)

  // Stirrup
  const recubMm = t.recub * s
  const rEstMm = (DIAM[t.calEst] / 20) * s
  const eiMm = (t.recub - DIAM[t.calSup] / 20) * s
  const ew = bMm - 2 * eiMm
  const eh = hMm - 2 * eiMm
  setDraw(doc, COL.stirrup)
  doc.setLineWidth(0.25)
  doc.roundedRect(ox + eiMm, oy + eiMm, ew, eh, 1, 1)

  // Top bars
  const rSupMm = Math.max((DIAM[t.calSup] / 20) * s, 0.8)
  const innerW = bMm - 2 * recubMm
  setDraw(doc, COL.steelTop)
  setFill(doc, [255, 213, 200])
  doc.setLineWidth(0.2)
  for (let i = 0; i < t.cantSup; i++) {
    const cx = t.cantSup === 1 ? ox + recubMm : ox + recubMm + (i * innerW) / (t.cantSup - 1)
    const cy = oy + recubMm
    doc.circle(cx, cy, rSupMm, 'FD')
  }

  // Top bastones
  const cantBSup = Math.min(Number(t.cantBastonSup) || 0, 2)
  if (cantBSup >= 1 && t.cantSup >= 2) {
    const rBMm = Math.max((DIAM[t.calBastonSup] / 20) * s, 0.8)
    setDraw(doc, COL.steelTop)
    doc.setFillColor(255, 255, 255)
    // Left baston at ~53°
    const lbCx = ox + recubMm, lbCy = oy + recubMm
    const angle = (53 * Math.PI) / 180
    const off = rSupMm + rBMm + 0.3
    doc.circle(lbCx + off * Math.cos(angle), lbCy + off * Math.sin(angle), rBMm, 'FD')
    if (cantBSup >= 2) {
      // Right baston at 90°
      const rbCx = ox + recubMm + innerW, rbCy = oy + recubMm
      doc.circle(rbCx, rbCy + rSupMm + rBMm + 0.3, rBMm, 'FD')
    }
  }

  // Bottom bars
  const rInfMm = Math.max((DIAM[t.calInf] / 20) * s, 0.8)
  setDraw(doc, COL.steelBot)
  setFill(doc, [207, 224, 247])
  for (let i = 0; i < t.cantInf; i++) {
    const cx = t.cantInf === 1 ? ox + recubMm : ox + recubMm + (i * innerW) / (t.cantInf - 1)
    const cy = oy + hMm - recubMm
    doc.circle(cx, cy, rInfMm, 'FD')
  }

  // Bottom bastones
  const cantBInf = Math.min(Number(t.cantBastonInf) || 0, 2)
  if (cantBInf >= 1 && t.cantInf >= 2) {
    const rBMm = Math.max((DIAM[t.calBastonInf] / 20) * s, 0.8)
    setDraw(doc, COL.steelBot)
    doc.setFillColor(255, 255, 255)
    const lbCx = ox + recubMm, lbCy = oy + hMm - recubMm
    doc.circle(lbCx, lbCy - rInfMm - rBMm - 0.3, rBMm, 'FD')
    if (cantBInf >= 2) {
      const rbCx = ox + recubMm + innerW, rbCy = oy + hMm - recubMm
      doc.circle(rbCx, rbCy - rInfMm - rBMm - 0.3, rBMm, 'FD')
    }
  }

  // Dimension labels around section
  const fs = 6
  doc.setFontSize(fs)
  setColor(doc, COL.tx3)

  // Width label (bottom)
  doc.text(`${t.ancho}`, ox + bMm / 2, oy + hMm + 4, { align: 'center' })
  // Height label (left)
  doc.text(`${t.peralte}`, ox - 3, oy + hMm / 2, { align: 'center', angle: 90 })

  return { w: bMm, h: hMm }
}

// ── Watermark: IV INGENIERIAS logo (vector) ─────────────────
function drawWatermark(doc, pageW, pageH) {
  doc.saveGraphicsState()
  // Very subtle — low opacity
  doc.setGState(new doc.GState({ opacity: 0.04 }))

  const cx = pageW / 2
  const cy = pageH / 2 - 10
  const s = 1.8 // scale

  // "I" vertical bar
  setFill(doc, [30, 30, 30])
  doc.rect(cx - 28 * s, cy - 25 * s, 8 * s, 50 * s, 'F')

  // "V" left diagonal
  const vLeft = [
    [cx - 20 * s, cy - 25 * s],
    [cx - 10 * s, cy - 25 * s],
    [cx + 5 * s, cy + 25 * s],
    [cx - 5 * s, cy + 25 * s],
  ]
  doc.triangle(vLeft[0][0], vLeft[0][1], vLeft[2][0], vLeft[2][1], vLeft[3][0], vLeft[3][1], 'F')
  doc.triangle(vLeft[0][0], vLeft[0][1], vLeft[1][0], vLeft[1][1], vLeft[2][0], vLeft[2][1], 'F')

  // "V" right diagonal
  const vRight = [
    [cx + 20 * s, cy - 25 * s],
    [cx + 10 * s, cy - 25 * s],
    [cx + 5 * s, cy + 25 * s],
    [cx - 5 * s, cy + 25 * s],
  ]
  doc.triangle(vRight[0][0], vRight[0][1], vRight[1][0], vRight[1][1], vRight[2][0], vRight[2][1], 'F')
  doc.triangle(vRight[0][0], vRight[0][1], vRight[2][0], vRight[2][1], vRight[3][0], vRight[3][1], 'F')

  // Accent stripes inside the V
  // Cyan stripe
  setFill(doc, [91, 197, 174])
  const cs = [
    [cx + 6 * s, cy - 16 * s],
    [cx + 9 * s, cy - 16 * s],
    [cx + 3 * s, cy + 2 * s],
    [cx + 0 * s, cy + 2 * s],
  ]
  doc.triangle(cs[0][0], cs[0][1], cs[2][0], cs[2][1], cs[3][0], cs[3][1], 'F')
  doc.triangle(cs[0][0], cs[0][1], cs[1][0], cs[1][1], cs[2][0], cs[2][1], 'F')

  // Gray stripe
  setFill(doc, [170, 170, 170])
  const gs = [
    [cx + 11 * s, cy - 16 * s],
    [cx + 14 * s, cy - 16 * s],
    [cx + 8 * s, cy + 2 * s],
    [cx + 5 * s, cy + 2 * s],
  ]
  doc.triangle(gs[0][0], gs[0][1], gs[2][0], gs[2][1], gs[3][0], gs[3][1], 'F')
  doc.triangle(gs[0][0], gs[0][1], gs[1][0], gs[1][1], gs[2][0], gs[2][1], 'F')

  // "INGENIERIAS" text below
  doc.setFontSize(18)
  setColor(doc, [30, 30, 30])
  doc.text('INGENIERIAS', cx, cy + 32 * s, { align: 'center' })

  doc.restoreGraphicsState()
}

// ── Verification row helper ─────────────────────────────────
function drawVerifRow(doc, label, mr, mu, y, x, w) {
  const mrVal = mr !== '' && mr !== undefined && !isNaN(mr) ? Number(mr) : null
  const muVal = mu !== '' && mu !== undefined && !isNaN(mu) ? Number(mu) : null

  doc.setFontSize(7.5)
  setColor(doc, COL.tx2)
  doc.text(label, x, y)

  // Mr column (Resistencia)
  doc.text(mrVal !== null ? mrVal.toFixed(2) : '—', x + 28, y, { align: 'right' })
  // Mu column (Demanda)
  doc.text(muVal !== null ? muVal.toFixed(2) : '—', x + 44, y, { align: 'right' })

  if (mrVal !== null && muVal !== null && mrVal > 0) {
    // Ratio inverted: Mu/Mr (demand/capacity) — should be <= 1.00
    const ratio = muVal / mrVal
    const ok = ratio <= 1.00

    // Ratio
    doc.text(ratio.toFixed(2), x + 58, y, { align: 'right' })

    // Status
    setColor(doc, ok ? COL.ok : COL.warn)
    doc.setFontSize(7)
    doc.text(ok ? 'OK' : 'N.C.', x + 68, y, { align: 'right' })

    return ok
  }

  return true // no data = no warning
}

// ── Small check tag helper ───────────────────────────────────
function drawCheckTag(doc, label, ok, x, y) {
  const bg = ok ? [230, 245, 240] : [252, 235, 230]
  const fg = ok ? COL.ok : COL.warn
  const text = ok ? `✓ ${label}` : `✗ ${label}`
  const tw = doc.getTextWidth(text) + 4
  setFill(doc, bg)
  setDraw(doc, fg)
  doc.setLineWidth(0.15)
  doc.roundedRect(x, y - 3.2, tw, 4.5, 1, 1, 'FD')
  doc.setFontSize(5.5)
  setColor(doc, fg)
  doc.text(text, x + 2, y)
  return tw + 2
}

// ── Compute structural checks for a section ─────────────────
function computeChecks(t) {
  const calc = t.calc || {}
  const fc = +t.fc || 250
  const fy = +calc.fy || 4200
  const b = +t.ancho, h = +t.peralte, r = +t.recub || 3
  const MuP = +(calc.MuP || t.muPos || 0)
  const MuN = +(calc.MuN || t.muNeg || 0)

  const checks = { flexP: null, flexN: null }

  if (MuP > 0 || +t.cantInf > 0) {
    const resP = calcFlexion({
      fc, fy, b, h, r, MuTm: MuP,
      varNum: +(calc.varPNum || CAL_TO_NUM[t.calInf] || 3),
      varCount: +(calc.varPCount || t.cantInf || 0) || null,
      bastonNum: +(calc.bastonPNum || CAL_TO_NUM[t.calBastonInf] || 3),
      bastonCount: +(calc.bastonPCount || t.cantBastonInf || 0),
    })
    if (!resP.error) checks.flexP = resP
  }

  if (MuN > 0 || +t.cantSup > 0) {
    const resN = calcFlexion({
      fc, fy, b, h, r, MuTm: MuN,
      varNum: +(calc.varNNum || CAL_TO_NUM[t.calSup] || 3),
      varCount: +(calc.varNCount || t.cantSup || 0) || null,
      bastonNum: +(calc.bastonNNum || CAL_TO_NUM[t.calBastonSup] || 3),
      bastonCount: +(calc.bastonNCount || t.cantBastonSup || 0),
    })
    if (!resN.error) checks.flexN = resN
  }

  return checks
}

// ── Main report generator ───────────────────────────────────
export function generateReport(sections, projectName = '') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  })

  const pageW = 215.9
  const pageH = 279.4
  const marginL = 15
  const marginR = 15
  const marginT = 15
  const contentW = pageW - marginL - marginR

  let y = marginT
  let pageNum = 1
  let hasWarnings = false
  const incompleteSections = []

  // ── Header ──
  doc.setFontSize(16)
  setColor(doc, COL.tx)
  doc.text('Informe de Verificación', marginL, y)
  y += 5
  doc.setFontSize(9)
  setColor(doc, COL.tx3)
  doc.text('Auxiliar IV — Detallador de Vigas', marginL, y)

  if (projectName.trim()) {
    y += 4.5
    doc.setFontSize(10)
    setColor(doc, COL.tx2)
    doc.text(`Proyecto: ${projectName}`, marginL, y)
  }

  y += 4.5
  doc.setFontSize(8)
  setColor(doc, COL.tx3)
  const now = new Date()
  doc.text(`Fecha: ${now.toLocaleDateString('es-MX')} — ${now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`, marginL, y)

  y += 3
  setDraw(doc, COL.border)
  doc.setLineWidth(0.3)
  doc.line(marginL, y, pageW - marginR, y)
  y += 6

  // ── Section cards ──
  sections.forEach((t, idx) => {
    // Check if we need a new page
    if (y > pageH - 60) {
      doc.addPage()
      pageNum++
      y = marginT
    }

    const totalSup = (Number(t.cantSup) || 0) + Math.min(Number(t.cantBastonSup) || 0, 2)
    const totalInf = (Number(t.cantInf) || 0) + Math.min(Number(t.cantBastonInf) || 0, 2)

    // Card background
    setFill(doc, COL.white)
    setDraw(doc, COL.border)
    doc.setLineWidth(0.2)
    const cardH = 88
    doc.roundedRect(marginL, y - 2, contentW, cardH, 2, 2, 'FD')

    const cardY = y

    // ── Left column: section drawing ──
    const drawOx = marginL + 14
    const drawOy = y + 6
    const drawScale = Math.min(2.2, 40 / t.peralte, 35 / t.ancho)
    const { w: dw, h: dh } = drawSection(doc, t, drawOx, drawOy, drawScale)

    // Section name above drawing
    doc.setFontSize(11)
    setColor(doc, COL.tx)
    doc.text(t.nombre, drawOx + dw / 2, y + 2, { align: 'center' })

    // Dims below drawing
    doc.setFontSize(7)
    setColor(doc, COL.tx3)
    doc.text(`${t.ancho} × ${t.peralte} cm`, drawOx + dw / 2, drawOy + dh + 8, { align: 'center' })
    doc.text(`f'c = ${t.fc} kg/cm2`, drawOx + dw / 2, drawOy + dh + 12, { align: 'center' })

    // Steel summary
    doc.setFontSize(6.5)
    setColor(doc, COL.steelTop)
    doc.text(`Sup: ${totalSup}\u00D8#${t.calSup}`, drawOx + dw / 2, drawOy + dh + 16, { align: 'center' })
    setColor(doc, COL.steelBot)
    doc.text(`Inf: ${totalInf}\u00D8#${t.calInf}`, drawOx + dw / 2, drawOy + dh + 20, { align: 'center' })
    setColor(doc, COL.stirrup)
    doc.text(`Est: #${t.calEst} @${t.sepLcuarto}/@${t.sepRest}`, drawOx + dw / 2, drawOy + dh + 24, { align: 'center' })

    // ── Right column: verification table ──
    const tblX = marginL + 62
    const tblW = contentW - 62 - 6

    // Table header
    doc.setFontSize(9)
    setColor(doc, COL.tx)
    doc.text('Verificación Estructural', tblX, y + 3)

    let ty = y + 9

    ty += 2
    setDraw(doc, COL.border)
    doc.setLineWidth(0.15)
    doc.line(tblX, ty, tblX + 72, ty)
    ty += 4

    // Column headers — ratio is Dem/Res (Mu/Mr)
    doc.setFontSize(6.5)
    setColor(doc, COL.tx3)
    doc.text('Concepto', tblX, ty - 6)
    doc.text('Res.', tblX + 28, ty - 6, { align: 'right' })
    doc.text('Dem.', tblX + 44, ty - 6, { align: 'right' })
    doc.text('Mu/Mr', tblX + 58, ty - 6, { align: 'right' })
    doc.text('Estado', tblX + 68, ty - 6, { align: 'right' })

    // Flexion (+)
    const okFlexPos = drawVerifRow(doc, 'Mu(+) / Mr(+)', t.mrPos, t.muPos, ty, tblX, tblW)
    if (!okFlexPos) hasWarnings = true
    ty += 5.5

    // Flexion (-)
    const okFlexNeg = drawVerifRow(doc, 'Mu(-) / Mr(-)', t.mrNeg, t.muNeg, ty, tblX, tblW)
    if (!okFlexNeg) hasWarnings = true
    ty += 5.5

    // Separator
    setDraw(doc, [230, 226, 220])
    doc.setLineWidth(0.1)
    doc.line(tblX, ty - 2, tblX + 72, ty - 2)

    // Cortante
    const okCort = drawVerifRow(doc, 'Vu / Vr', t.vr, t.vu, ty, tblX, tblW)
    if (!okCort) hasWarnings = true
    ty += 6

    // Structural checks (bmin, asmin, asmax)
    const checks = computeChecks(t)
    let cx = tblX
    doc.setFontSize(5.5)
    if (checks.flexP) {
      cx += drawCheckTag(doc, 'As≥min(+)', checks.flexP.okMin, cx, ty)
      cx += drawCheckTag(doc, 'As≤max(+)', checks.flexP.okMax, cx, ty)
      cx += drawCheckTag(doc, 'b≥bmin(+)', checks.flexP.okBmin, cx, ty)
      if (!checks.flexP.okMin || !checks.flexP.okMax || !checks.flexP.okBmin) hasWarnings = true
    }
    if (checks.flexN) {
      if (cx > tblX + 55) { ty += 5.5; cx = tblX }
      cx += drawCheckTag(doc, 'As≥min(−)', checks.flexN.okMin, cx, ty)
      cx += drawCheckTag(doc, 'As≤max(−)', checks.flexN.okMax, cx, ty)
      cx += drawCheckTag(doc, 'b≥bmin(−)', checks.flexN.okBmin, cx, ty)
      if (!checks.flexN.okMin || !checks.flexN.okMax || !checks.flexN.okBmin) hasWarnings = true
    }
    ty += 6

    // Overall status for this section
    const allFields = [t.mrPos, t.muPos, t.mrNeg, t.muNeg, t.vr, t.vu]
    const filledFields = allFields.filter(v => v !== '' && v !== undefined && v !== null && !isNaN(v))
    const isComplete = filledFields.length === 6
    const hasAnyData = filledFields.length > 0

    if (isComplete) {
      const checksOk = (!checks.flexP || (checks.flexP.okMin && checks.flexP.okMax && checks.flexP.okBmin)) &&
        (!checks.flexN || (checks.flexN.okMin && checks.flexN.okMax && checks.flexN.okBmin))
      const sectionOk = okFlexPos && okFlexNeg && okCort && checksOk
      setFill(doc, sectionOk ? [230, 245, 240] : [252, 235, 230])
      setDraw(doc, sectionOk ? COL.ok : COL.warn)
      doc.setLineWidth(0.15)
      doc.roundedRect(tblX, ty, 72, 7, 1.5, 1.5, 'FD')

      doc.setFontSize(8)
      setColor(doc, sectionOk ? COL.ok : COL.warn)
      doc.text(
        sectionOk ? 'CUMPLE' : 'NO CUMPLE — Revisar dise\u00F1o',
        tblX + 36, ty + 5,
        { align: 'center' }
      )

      if (!sectionOk) hasWarnings = true
    } else {
      // Incomplete data — show warning badge
      incompleteSections.push(t.nombre)
      setFill(doc, [255, 245, 230])
      setDraw(doc, [200, 160, 80])
      doc.setLineWidth(0.15)
      doc.roundedRect(tblX, ty, 72, 7, 1.5, 1.5, 'FD')

      doc.setFontSize(7)
      doc.setTextColor(180, 120, 20)
      doc.text(`Informaci\u00F3n incompleta (${filledFields.length}/6)`, tblX + 36, ty + 5, { align: 'center' })
    }

    y = cardY + cardH + 5
  })

  // ── Summary at bottom ──
  if (y > pageH - 30) {
    doc.addPage()
    y = marginT
  }

  y += 3
  setDraw(doc, COL.border)
  doc.setLineWidth(0.3)
  doc.line(marginL, y, pageW - marginR, y)
  y += 6

  doc.setFontSize(10)
  if (hasWarnings) {
    setColor(doc, COL.warn)
    doc.text('⚠  Se encontraron elementos que no cumplen. Revisar diseño.', marginL, y)
  } else {
    setColor(doc, COL.ok)
    doc.text('Todas las secciones verificadas cumplen.', marginL, y)
  }

  // Incomplete sections warning
  if (incompleteSections.length > 0) {
    y += 5
    doc.setFontSize(8)
    doc.setTextColor(180, 120, 20)
    doc.text(
      `Secciones con informaci\u00F3n incompleta: ${incompleteSections.join(', ')}`,
      marginL, y
    )
  }

  y += 6
  doc.setFontSize(7)
  setColor(doc, COL.tx3)
  doc.text('Generado con Auxiliar IV — Detallador de Vigas', marginL, y)
  doc.text(`Secciones: ${sections.length}  |  P\u00E1ginas: ${pageNum}`, marginL, y + 3.5)

  // ── Watermark + Footer on each page ──
  const totalPages = doc.internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    // Watermark
    drawWatermark(doc, pageW, pageH)
    // Footer
    doc.setFontSize(7)
    setColor(doc, COL.tx3)
    doc.text(`${p} / ${totalPages}`, pageW - marginR, pageH - 8, { align: 'right' })
    if (projectName.trim()) {
      doc.text(projectName, marginL, pageH - 8)
    }
  }

  return doc
}
