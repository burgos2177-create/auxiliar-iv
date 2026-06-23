// ══════════════════════════════════════════════════════════════
// Memoria de Cálculo — generador .docx NATIVO (OOXML, librería docx)
// Documento de Word real: párrafos, tablas e imágenes nativas.
// Sin importación de HTML → paginación correcta y edición fina.
// ══════════════════════════════════════════════════════════════

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  ImageRun, VerticalAlign,
} from 'docx'
import { computeSectionResults, LOGO_SVG } from './generateDetailedHTML'
import { sectionSvgString } from './sectionSvg'
import { svgToPng, normalizeMeta } from './generateMemoria'

// ── palette ──
const TEAL = '4ECAC4', INK = '0F172A', GREY = '6B7280', SUB = '334155'
const OKC = '15803D', BADC = 'DC2626'
const MARKCOL = { ok: { t: 'VERIFICADO', c: OKC }, warn: { t: 'REVISAR', c: 'B45309' }, bad: { t: 'NO PASA', c: BADC } }

const fmt = (v, d = 2) => (v === null || v === undefined || isNaN(v) ? '—' : Number(v).toFixed(d))

// ── text / paragraph helpers ──
const run = (text, o = {}) => new TextRun({ text: String(text), ...o })
const okRun = (ok) => run(ok ? '  ✓' : '  ✗', { bold: true, color: ok ? OKC : BADC })

function para(content, o = {}) {
  const children = Array.isArray(content) ? content : [run(content, o.run || {})]
  return new Paragraph({
    children,
    alignment: o.align,
    spacing: { after: o.after ?? 120, before: o.before ?? 0, line: o.line },
    pageBreakBefore: o.pageBreak || false,
  })
}
const H1 = (text, pageBreak = false) => new Paragraph({
  heading: HeadingLevel.HEADING_1, pageBreakBefore: pageBreak, children: [run(text)],
  spacing: { before: 240, after: 120 },
  border: { bottom: { color: TEAL, size: 18, style: BorderStyle.SINGLE, space: 4 } },
})
const H2 = (text, pageBreak = false) => new Paragraph({
  heading: HeadingLevel.HEADING_2, pageBreakBefore: pageBreak, children: [run(text)],
  spacing: { before: 200, after: 80 },
})
const bullet = (content) => new Paragraph({
  bullet: { level: 0 }, children: Array.isArray(content) ? content : [run(content)], spacing: { after: 60 },
})

// ── table helpers ──
const NOBORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const noBorders = { top: NOBORDER, bottom: NOBORDER, left: NOBORDER, right: NOBORDER, insideHorizontal: NOBORDER, insideVertical: NOBORDER }

function mkCellPara(c, size) {
  return new Paragraph({ children: Array.isArray(c) ? c : [run(c, { size })], spacing: { after: 0 } })
}
function dataTable(headers, rowsData, colW, { size = 17, headFill = INK } = {}) {
  const head = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      width: { size: colW[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: headFill },
      verticalAlign: VerticalAlign.CENTER, margins: { top: 40, bottom: 40, left: 70, right: 70 },
      children: [new Paragraph({ children: [run(h, { bold: true, color: 'FFFFFF', size })], spacing: { after: 0 } })],
    })),
  })
  const body = rowsData.map((r) => new TableRow({
    children: r.map((c, i) => new TableCell({
      width: { size: colW[i], type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER, margins: { top: 36, bottom: 36, left: 70, right: 70 },
      children: [mkCellPara(c, size)],
    })),
  }))
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: colW, rows: [head, ...body] })
}

// ── calc rows (con sustitución numérica) ──
function flexRows(res, Mu, fc, fy, b, h, r) {
  const fcRed = 0.85 * fc
  const MuKg = Mu * 100000
  const d = res.d
  return [
    ["f''c", "0.85 · f'c", `0.85 × ${fc}`, `${fmt(fcRed, 1)} kg/cm²`],
    ['d', 'h − r', `${h} − ${r}`, `${fmt(d, 1)} cm`],
    ['Rn', 'Mu / (FR · b · d²)', `${fmt(MuKg, 0)} / (0.9 × ${b} × ${fmt(d, 1)}²)`, `${fmt(res.Rn, 3)} kg/cm²`],
    ['ρ', "(f''c/fy)·[1−√(1−2Rn/f''c)]", `(${fmt(fcRed, 1)}/${fy})·[1−√(1−2×${fmt(res.Rn, 3)}/${fmt(fcRed, 1)})]`, fmt(res.rhoCalc, 5)],
    ['As calc', 'ρ · b · d', `${fmt(res.rhoCalc, 5)} × ${b} × ${fmt(d, 1)}`, `${fmt(res.AsCalc, 2)} cm²`],
    ['As mín', "0.7·√f'c/fy · b · d", `0.7·√${fc}/${fy} × ${b} × ${fmt(d, 1)}`, `${fmt(res.AsMin, 2)} cm²`],
    ['As máx', '0.90 · ρ_bal · b · d', `0.90 × ${fmt(res.rhoBal, 5)} × ${b} × ${fmt(d, 1)}`, `${fmt(res.AsMax, 2)} cm²`],
    ['As requerido', 'máx(As_calc, As_mín)', `máx(${fmt(res.AsCalc, 2)}, ${fmt(res.AsMin, 2)})`, `${fmt(res.AsReq, 2)} cm²`],
    ['Armado', '—', '—', `${res.nUsed} #${res.vr.num}${res.nBastones > 0 ? ` + ${res.nBastones} #${res.vb.num}` : ''}`],
    ['As total', 'As_barras + As_bastones', `${fmt(res.AsBarras, 2)} + ${fmt(res.AsBastones, 2)}`, `${fmt(res.AsTotal, 2)} cm²`],
    ['MRT', 'FR · As · fy · (d − a/2)', `0.9 × ${fmt(res.AsTotal, 2)} × ${fy} × (${fmt(d, 1)} − ${fmt(res.a, 2)}/2)`, [run(`${fmt(res.MRT, 2)} t·m`, { size: 17 }), okRun(res.okMR), run(`  (Mu = ${fmt(Mu, 2)})`, { size: 15, color: GREY })]],
    ['b mín', '2r + (2n−1) · Ø', `2×${r} + (2×${res.nUsed}−1) × ${fmt(res.vr.diam, 3)}`, [run(`${fmt(res.bMin, 1)} cm`, { size: 17 }), okRun(res.okBmin)]],
  ]
}
function cortRows(resC, VuTon, fc, fy, b, h, r, L, AsUsada, nramas) {
  const d = resC.d
  return [
    ['d', 'h − r', `${h} − ${r}`, `${fmt(d, 1)} cm`],
    ['L/h', 'L / h', `${fmt(L * 100, 0)} / ${h}`, fmt(resC.lh, 2)],
    ['ρ', 'As / (b · d)', `${fmt(AsUsada, 2)} / (${b} × ${fmt(d, 1)})`, fmt(resC.rho, 5)],
    ['VCR', 'máx(VCR_a, VCR_b) acotado', `máx(${fmt(resC.VCR_a, 2)}, ${fmt(resC.VCR_b, 2)}) t`, `${fmt(resC.Vcr, 2)} t`],
    ['Va_max', "VCR + FR·2.2·√f'c·b·d", `${fmt(resC.Vcr, 2)} + 0.75·2.2·√${fc}·${b}·${fmt(d, 1)}`, [run(`${fmt(resC.VaMax, 2)} t`, { size: 17 }), okRun(resC.okVaMax)]],
    ['VSR nec.', 'Vu − VCR', `${fmt(VuTon, 2)} − ${fmt(resC.Vcr, 2)}`, `${fmt(resC.VsrNec, 2)} t`],
    ['Av', 'n_ramas · A_estribo', `${nramas} × ${resC.ve?.area}`, `${fmt(resC.Av, 2)} cm²`],
    ['Separación S', 'FR · Av · fy · d / VSR_nec', `0.75 × ${fmt(resC.Av, 2)} × ${fy} × ${fmt(d, 1)} / ${fmt(resC.VsrNec * 1000, 0)}`, `${resC.Suso} cm`],
    ['Estribos', '—', '—', `#${resC.ve?.num ?? ''} @ ${resC.Suso} cm`],
    ['Vr', 'VCR + VSR', `${fmt(resC.Vcr, 2)} + ${fmt(resC.VsrReal, 2)}`, [run(`${fmt(resC.Vr, 2)} t`, { size: 17 }), okRun(resC.okVr), run(`  (Vu = ${fmt(VuTon, 2)})`, { size: 15, color: GREY })]],
  ]
}
const CALC_COLS = [2000, 3400, 2400, 1839]
const CALC_HEAD = ['Parámetro', 'Fórmula', 'Sustitución', 'Resultado']

// Compact summary (used when "detallar todas" is OFF, for non-governing beams)
function compactRows(R) {
  const rows = []
  if (R.resP) rows.push(['Momento positivo (M+)', `Mu = ${fmt(R.MuP)} t·m`, [run(`MR = ${fmt(R.resP.MRT)} t·m`, { size: 17 }), okRun(R.resP.okMR)]])
  if (R.resN) rows.push(['Momento negativo (M−)', `Mu = ${fmt(R.MuN)} t·m`, [run(`MR = ${fmt(R.resN.MRT)} t·m`, { size: 17 }), okRun(R.resN.okMR)]])
  if (R.resC && R.resC.Vr) rows.push(['Cortante', `Vu = ${fmt(R.VuTon)} t`, [run(`Vr = ${fmt(R.resC.Vr)} t`, { size: 17 }), okRun(R.resC.okVr)]])
  return rows
}
const COMPACT_COLS = [3200, 3200, 3239]
const COMPACT_HEAD = ['Revisión', 'Actuante', 'Resistente']

// ── images ──
function dataUrlToBytes(d) {
  const i = d.indexOf(',')
  const bin = atob(d.slice(i + 1))
  const u = new Uint8Array(bin.length)
  for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k)
  const t = /data:image\/(\w+)/.exec(d)?.[1] || 'png'
  return { bytes: u, type: t === 'jpeg' ? 'jpg' : t }
}
function imgDims(d) {
  return new Promise((res) => {
    const im = new Image()
    im.onload = () => res({ w: im.naturalWidth || im.width || 430, h: im.naturalHeight || im.height || 300 })
    im.onerror = () => res({ w: 430, h: 300 })
    im.src = d
  })
}
async function prep(dataURL, targetW) {
  if (!dataURL) return null
  try {
    const { bytes, type } = dataUrlToBytes(dataURL)
    const { w, h } = await imgDims(dataURL)
    return { data: bytes, type, transformation: { width: Math.round(targetW), height: Math.round(h * (targetW / w)) } }
  } catch { return null }
}
const imgPara = (img) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 60, after: 160 },
  children: [new ImageRun(img)],
})

// ══════════════════════════════════════════════════════════════
// Main entry
// ══════════════════════════════════════════════════════════════
export async function generateMemoriaDocx({ sections = [], meta = {}, dcheck = null } = {}) {
  const M = normalizeMeta(meta)
  const computed = sections.map((t) => ({ t, R: computeSectionResults(t) }))

  // Governing beam
  let govIdx = -1, govMu = -1
  computed.forEach(({ R }, i) => {
    const mu = Math.max(R.MuP || 0, R.MuN || 0)
    if (mu > govMu) { govMu = mu; govIdx = i }
  })

  // Materials text
  const fcSet = [...new Set(computed.map(({ R }) => R.fc))].sort((a, b) => a - b)
  const fySet = [...new Set(computed.map(({ R }) => R.fy))].sort((a, b) => a - b)
  const fcTxt = fcSet.length ? fcSet.map((x) => `${x} kg/cm²`).join(', ') : '250 kg/cm²'
  const fyTxt = fySet.length ? fySet.map((x) => `${x} kg/cm²`).join(', ') : '4200 kg/cm²'

  // ── Rasterize all images up front ──
  let logoImg = null
  try { logoImg = await prep(await svgToPng(LOGO_SVG, 200, 170), 110) } catch { /* ignore */ }
  const figImgs = await Promise.all(computed.map(async ({ t }) => {
    try { return await prep(await svgToPng(sectionSvgString(t)), 360) } catch { return null }
  }))

  // Match .dcheck by beam name → ONLY the structural-model images
  // (slot A = momento del modelo, slot C = cortante del modelo).
  // The tool screenshots (slots B y D) are intentionally excluded.
  // Lenient: ignore case, spaces and dashes ("T 1" / "t-1" / "T1" → "t1").
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  const dcByName = new Map()
  for (const s of ((dcheck && dcheck.sections) || [])) if (s?.name) dcByName.set(norm(s.name), s)
  const modelImgs = await Promise.all(computed.map(async ({ t }) => {
    const s = dcByName.get(norm(t.nombre))
    if (!s) return null
    const mom = s.imgA ? await prep(s.imgA, 430) : null
    const cort = s.imgC ? await prep(s.imgC, 430) : null
    return (mom || cort) ? { mom, cort } : null
  }))

  // ── Descriptive sentence per trabe ──
  const trabeFrase = (t, R) => {
    const arm = (res, n, cal) => res
      ? `${res.nUsed} varilla(s) del número ${res.vr.num}${res.nBastones > 0 ? ` más ${res.nBastones} bastón(es) del número ${res.vb.num}` : ''}`
      : `${n} varilla(s) del número ${cal}`
    return `El detalle del diseño resultante se muestra a continuación, resultando una trabe de ${R.b} cm de ancho con ${R.h} cm de peralte, ${arm(R.resP, t.cantInf, t.calInf)} en el lecho inferior, ${arm(R.resN, t.cantSup, t.calSup)} en el lecho superior y estribos del número ${t.calEst} con la distribución indicada en el detalle (@ ${t.sepLcuarto} cm en L/4 y @ ${t.sepRest} cm en el resto).`
  }

  // ── Trabes summary table ──
  const sumHead = ['#', 'Trabe', 'b×h (cm)', 'Lecho inf.', 'Lecho sup.', 'Mu+/MR+ (t·m)', 'Mu−/MR− (t·m)', 'Vu/Vr (t)', 'Estado']
  const sumCols = [400, 900, 850, 1150, 1150, 1500, 1500, 1100, 1089]
  const sumRows = computed.map(({ t, R }, i) => {
    const inf = R.resP ? `${R.resP.nUsed}#${R.resP.vr.num}${R.resP.nBastones > 0 ? `+${R.resP.nBastones}#${R.resP.vb.num}` : ''}` : `${t.cantInf}#${t.calInf}`
    const sup = R.resN ? `${R.resN.nUsed}#${R.resN.vr.num}${R.resN.nBastones > 0 ? `+${R.resN.nBastones}#${R.resN.vb.num}` : ''}` : `${t.cantSup}#${t.calSup}`
    const mk = !R.hasData ? null : R.allOk ? 'ok' : 'bad'
    const estado = mk ? [run(MARKCOL[mk].t, { size: 15, bold: true, color: MARKCOL[mk].c })] : [run('—', { size: 16 })]
    return [
      `${i + 1}`, t.nombre || `T-${i + 1}`, `${R.b}×${R.h}`, inf, sup,
      `${R.MuP ? fmt(R.MuP) : '—'} / ${R.resP ? fmt(R.resP.MRT) : '—'}`,
      `${R.MuN ? fmt(R.MuN) : '—'} / ${R.resN ? fmt(R.resN.MRT) : '—'}`,
      `${R.VuTon ? fmt(R.VuTon) : '—'} / ${R.resC ? fmt(R.resC.Vr) : '—'}`,
      estado,
    ]
  })

  // ── Per-trabe detail blocks ──
  const trabeBlocks = []
  computed.forEach(({ t, R }, i) => {
    const isGov = i === govIdx
    const full = M.detalleTodos || isGov
    trabeBlocks.push(H2(`Trabe ${t.nombre || `T-${i + 1}`}${isGov ? ' — gobernante' : ''}`, true))
    if (R.hasData) trabeBlocks.push(para(trabeFrase(t, R), { align: AlignmentType.JUSTIFIED }))
    if (figImgs[i]) trabeBlocks.push(imgPara(figImgs[i]))
    if (!R.hasData) {
      trabeBlocks.push(para('Sin datos de cálculo para esta sección — capture momentos y/o cortante en la pestaña Cálculo.', { run: { color: 'B45309', italics: true } }))
    } else if (full) {
      if (R.MuP > 0 && R.resP) {
        trabeBlocks.push(para([run('Momento positivo (M+) — lecho inferior', { bold: true, color: '1D4ED8' })], { after: 60 }))
        trabeBlocks.push(dataTable(CALC_HEAD, flexRows(R.resP, R.MuP, R.fc, R.fy, R.b, R.h, R.r), CALC_COLS))
        trabeBlocks.push(para('', { after: 80 }))
      }
      if (R.MuN > 0 && R.resN) {
        trabeBlocks.push(para([run('Momento negativo (M−) — lecho superior', { bold: true, color: 'B45309' })], { after: 60 }))
        trabeBlocks.push(dataTable(CALC_HEAD, flexRows(R.resN, R.MuN, R.fc, R.fy, R.b, R.h, R.r), CALC_COLS))
        trabeBlocks.push(para('', { after: 80 }))
      }
      if (R.hasCort && R.VuTon > 0) {
        trabeBlocks.push(para([run('Revisión por cortante', { bold: true, color: '9333EA' })], { after: 60 }))
        trabeBlocks.push(dataTable(CALC_HEAD, cortRows(R.resC, R.VuTon, R.fc, R.fy, R.b, R.h, R.r, R.L, R.AsUsada, R.nramas), CALC_COLS))
      }
    } else {
      // "Detallar todas" desactivado → resumen compacto para no-gobernantes
      trabeBlocks.push(dataTable(COMPACT_HEAD, compactRows(R), COMPACT_COLS))
    }
    // Imágenes del modelo estructural para esta viga (momento y cortante)
    const mi = modelImgs[i]
    if (mi && (mi.mom || mi.cort)) {
      trabeBlocks.push(para([run('Elementos mecánicos del modelo estructural', { bold: true, size: 21, color: '1F2937' })], { before: 140, after: 60 }))
      if (mi.mom) {
        trabeBlocks.push(para([run(`Diagrama de momento — ${t.nombre || 'viga'} (modelo)`, { size: 16, italics: true, color: GREY })], { after: 20 }))
        trabeBlocks.push(imgPara(mi.mom))
      }
      if (mi.cort) {
        trabeBlocks.push(para([run(`Diagrama de cortante — ${t.nombre || 'viga'} (modelo)`, { size: 16, italics: true, color: GREY })], { after: 20 }))
        trabeBlocks.push(imgPara(mi.cort))
      }
    }
  })

  // ── Intro text ──
  const introTxt = M.descripcion?.trim()
    ? M.descripcion.trim()
    : `Se realizó el diseño estructural de ${M.proyecto ? `“${M.proyecto}”` : 'la edificación'}${M.ubicacion ? `, localizada en ${M.ubicacion}` : ''}${M.area ? `, con aproximadamente ${M.area} m² de construcción` : ''}. El sistema constructivo es mediante muros de carga de block, losas de entrepiso y azotea de vigueta y bovedilla, estructura principal de concreto reforzado y cimentación a base de zapatas corridas y aisladas${M.niveles ? `. La edificación cuenta con ${M.niveles} nivel(es)` : ''}${M.hEntrepiso ? `, con una altura de entrepiso de ${M.hEntrepiso} m` : ''}.`

  const govNombre = govIdx >= 0 ? (computed[govIdx].t.nombre || `T-${govIdx + 1}`) : '—'

  // ── Cover info (centered paragraphs) ──
  const center = (children, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, children, spacing: { after: o.after ?? 60, before: o.before ?? 0 } })
  const cover = []
  for (let k = 0; k < 5; k++) cover.push(new Paragraph({ children: [run('')] }))
  if (logoImg) cover.push(center([new ImageRun(logoImg)], { after: 120 }))
  cover.push(center([run('IV INGENIERÍAS', { size: 20, color: GREY, characterSpacing: 60 })], { after: 40 }))
  cover.push(center([run('MEMORIA DE CÁLCULO', { size: 56, bold: true, color: INK })], { after: 60 }))
  cover.push(center([run('Diseño estructural · Concreto reforzado', { size: 24, color: SUB })], { after: 200 }))
  cover.push(center([run(M.proyecto || 'Proyecto sin nombre', { size: 30, bold: true, color: INK })], { after: 240 }))
  const info = (k, v) => center([run(`${k}:  `, { size: 20, color: GREY }), run(v, { size: 20, color: INK })], { after: 40 })
  if (M.ubicacion) cover.push(info('Ubicación', M.ubicacion))
  if (M.area) cover.push(info('Área de construcción', `${M.area} m²`))
  if (M.niveles) cover.push(info('Niveles', M.niveles))
  cover.push(info('Normatividad', `${M.norma} · ACI 318-19`))
  if (M.responsable) cover.push(info('Responsable', `Ing. ${M.responsable}${M.cedula ? ` · Céd. ${M.cedula}` : ''}`))
  cover.push(info('Fecha', M.fecha))

  // ── Assemble document children ──
  const children = [
    ...cover,

    H1('Introducción', true),
    para(introTxt, { align: AlignmentType.JUSTIFIED }),

    H1('Propiedades de los materiales'),
    para([run('Concreto:', { bold: true })], { after: 60 }),
    bullet("Para elementos secundarios y plantilla de desplante: de f'c = 100 kg/cm² a f'c = 200 kg/cm²."),
    bullet(`Elementos estructurales, muros y losas: f'c = ${fcTxt}.`),
    bullet(`Acero de refuerzo: varilla corrugada ASTM-615 de fy = ${fyTxt}.`),

    H1('Análisis de cargas'),
    H2('Cargas muertas'),
    para('Se utilizará vigueta y bovedilla como sistema estructural para las losas de entrepiso y azotea; por lo tanto, la carga muerta obtenida por el peso propio de la losa se obtuvo como sigue:', { align: AlignmentType.JUSTIFIED }),
    dataTable(['Concepto', 'Carga (kg/m²)'], [
      ['Vigueta y bovedilla', '144.0'], ['Sobrecarga', '40.0'], ['Piso', '30.0'], ['Yeso', '22.5'],
      [[run('Total', { bold: true, size: 18 })], [run(String(M.cmEntrepiso), { bold: true, size: 18 })]],
    ], [3200, 1600], { size: 18 }),
    para(`En cuanto a los muros se propone block, por lo tanto, su peso unitario es de ${M.cmMuro} kg/m². El peso propio de los elementos estructurales como trabes y columnas se determina considerando un peso específico de 2400 kg/m³.`, { before: 100, align: AlignmentType.JUSTIFIED }),
    H2('Cargas vivas'),
    para(`Se consideraron las cargas vivas para casa habitación dentro de las Normas Técnicas Complementarias (NTC, 2017), donde se especifica que para losas de entrepiso son ${M.cvEntrepiso} kg/m² y para azotea con pendientes menores al 5% se consideran de ${M.cvAzotea} kg/m². La distribución de carga de las losas se realizó considerando la orientación de la vigueta y bovedilla propuesta; debido a la naturaleza del sistema las cargas se transmiten en una sola dirección.`, { align: AlignmentType.JUSTIFIED }),
    H2('Estados de carga'),
    para(`Las combinaciones de carga a utilizar según las Normas Técnicas Complementarias (${M.norma}) son las siguientes:`),
    bullet('Estado límite de servicio: CV + CM'),
    bullet('Estado límite de diseño: 1.3 CM + 1.5 CV'),
    para('CV: Carga viva (Variable). CM: Carga muerta (Permanente).'),
    H2('Normativas de diseño'),
    bullet(`Normas Técnicas Complementarias (${M.norma}).`),
    bullet('American Concrete Institute (ACI 318-19).'),

    H1('Diseño'),
    H2('Diseño de trabes y columnas'),
    para('Se construyó un modelo analítico de la estructura, del cual, mediante su análisis, se obtuvieron los momentos y cortantes de diseño como parámetros para las vigas; en cuanto a las columnas se obtuvieron las cargas axiales críticas y sus respectivos momentos de diseño. Además, para realizar la revisión por estado límite de servicio según las NTC 2023, se obtuvieron las deflexiones máximas.', { align: AlignmentType.JUSTIFIED }),
    H2('Estado límite de diseño'),
    para([
      run('De acuerdo con la revisión de momentos, ésta es la condición dominante en la revisión por estado límite de diseño, ya que los cortantes y las deflexiones se encontraron en rangos aceptables. '),
      ...(govIdx >= 0 ? [run('El momento crítico de la estructura se presenta en la trabe '), run(govNombre, { bold: true }), run(', con un valor de '), run(`${fmt(govMu)} ton·m`, { bold: true }), run('. ')] : []),
      run('Considerando los momentos obtenidos del análisis se realizó el diseño por resistencia, el cual se describe a continuación. La siguiente tabla resume las '),
      run(`${sections.length}`, { bold: true }), run(' trabe(s) consideradas:'),
    ], { align: AlignmentType.JUSTIFIED }),
    dataTable(sumHead, sumRows, sumCols, { size: 16 }),

    ...trabeBlocks,

    H2('Estado límite de servicio', false),
    para('El estado límite de servicio se revisó conforme a las NTC 2023, las cuales establecen que la deflexión vertical máxima permisible está en función de la longitud de los elementos (L/240, siendo L la longitud del elemento horizontal). Las deflexiones actuantes obtenidas del modelo resultaron menores a las permisibles, por lo que el diseño propuesto es aceptable.', { align: AlignmentType.JUSTIFIED }),
    H2('Diseño de columnas'),
    para([run('[Sección en desarrollo] ', { bold: true, color: 'B45309' }), run('La columna más crítica presenta momento, por lo que se llevará a cabo un diseño de flexocompresión a partir de la carga axial (Pu) y el momento (Mu) últimos obtenidos del análisis, con la respectiva revisión de la resistencia P-M y el detalle de armado. Pendiente de captura — se completará con el módulo de columnas.')], { align: AlignmentType.JUSTIFIED }),
    H2('Diseño de cimentación'),
    para([run('[Sección en desarrollo] ', { bold: true, color: 'B45309' }), run('Se realizará la revisión del diseño de cimentación a base de zapatas aisladas y corridas y contratrabes. Pendiente de captura.')], { align: AlignmentType.JUSTIFIED }),

    H1('Anexos'),
    para('Planos de estructuración.'),
    para([run('Planos de estructuración (planta alta, azotea y cimentación) y reporte de momentos y cortantes del modelo estructural — adjuntar.', { italics: true, color: GREY })]),

    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 800, after: 40 }, children: [run('ATENTAMENTE', { bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 500, after: 0 }, children: [run('_________________________________', {})] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [run(`Ing. ${M.responsable || ''}`, { bold: true })] }),
    ...(M.cedula ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(`Cédula: ${M.cedula}`, { size: 18, color: GREY })] })] : []),
  ]

  const doc = new Document({
    creator: 'IV Ingenierías · Auxiliar IV',
    title: `Memoria de Cálculo${M.proyecto ? ` — ${M.proyecto}` : ''}`,
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22, color: '111111' } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 30, bold: true, color: INK } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 25, bold: true, color: '1F2937' } },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const name = (M.proyecto || 'memoria').trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '') || 'memoria'
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `MEMORIA-${name}.docx`
  a.click()
  URL.revokeObjectURL(a.href)
}
