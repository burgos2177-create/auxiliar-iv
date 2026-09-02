// ══════════════════════════════════════════════════════════════
// Memoria de Cálculo — generador (HTML imprimible / PDF)
// Reúne: secciones del proyecto + (opcional) verificación Double Check
// (.dcheck) + el cálculo detallado por elemento. Deja espacios
// marcados para Columnas y Cimentación (a llenar después).
// ══════════════════════════════════════════════════════════════

import {
  CSS as DETAIL_CSS, LOGO_SVG,
  computeSectionResults, renderFlexion, renderCortante,
} from './generateDetailedHTML'
import { sectionSvgString } from './sectionSvg'
import { analyzeColumn, calcEstribos, excentricidad } from './columnCalculator'
import { columnDemand, demandCase } from './columnDemand'
import { columnSectionSvgString, interactionSvgString } from './columnsSvg'

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const fmt = (v, d = 2) => (v === null || v === undefined || isNaN(v) ? '—' : Number(v).toFixed(d))

// Double Check palette (mirrors the add-in)
const MARK = {
  ok:   { label: 'VERIFICADO', color: '#15803d', bg: '#f0fdf4', bd: '#86efac' },
  warn: { label: 'REVISAR',    color: '#92400e', bg: '#fffbeb', bd: '#fcd34d' },
  bad:  { label: 'NO PASA',    color: '#b91c1c', bg: '#fef2f2', bd: '#fca5a5' },
}

function ratioOf(a, r) {
  const A = parseFloat(a), R = parseFloat(r)
  if (!isFinite(A) || !isFinite(R) || R === 0) return null
  return Math.abs(A / R)
}
function markFromRatios(ratios) {
  const vals = ratios.filter((x) => x != null)
  if (!vals.length) return null
  const worst = Math.max(...vals)
  return worst <= 0.9 ? 'ok' : worst <= 1.0 ? 'warn' : 'bad'
}

// ── Memoria-specific CSS (rides on top of the detailed-report CSS) ──
const MEM_CSS = `
  @page { size: A4; margin: 16mm 14mm 18mm; }
  h1.mem { font-size:22pt; font-weight:800; letter-spacing:-0.01em; color:#0f172a; margin:0; }
  h2.mem { font-size:15pt; font-weight:800; color:#0f172a; text-transform:uppercase; letter-spacing:0.03em;
           border-bottom:2px solid #4ecac4; padding-bottom:6px; margin:0 0 14px; }
  h3.mem { font-size:12.5pt; font-weight:700; color:#1f2937; margin:18px 0 8px; }
  .mem-sec { page-break-before:always; padding-top:4px; }
  .mem-p { font-size:11pt; line-height:1.6; color:#1f2937; margin:0 0 10px; text-align:justify; }
  ul.mem, ol.mem { font-size:11pt; line-height:1.6; color:#1f2937; margin:0 0 10px; padding-left:22px; }
  ul.mem li, ol.mem li { margin-bottom:3px; }
  table.mem { width:100%; border-collapse:collapse; font-size:10.5pt; margin:8px 0 14px; }
  table.mem th, table.mem td { border:1px solid #cbd5e1; padding:6px 9px; text-align:left; vertical-align:top; }
  table.mem th { background:#0f172a; color:#fff; font-weight:700; font-size:9.5pt; letter-spacing:0.02em; }
  table.mem tr:nth-child(even) td { background:#f8fafc; }
  table.mem td.num { font-family:'Courier New',monospace; text-align:right; white-space:nowrap; }
  .kv { width:100%; border-collapse:collapse; font-size:11pt; }
  .kv td { padding:5px 8px; border-bottom:1px solid #e5e7eb; }
  .kv td.k { color:#6b7280; width:38%; font-weight:600; }
  .placeholder { border:2px dashed #cbd5e1; border-radius:8px; padding:22px 20px; background:#f8fafc;
                 color:#64748b; font-size:11pt; text-align:center; margin:10px 0; }
  .placeholder b { color:#334155; }
  .mark-pill { display:inline-block; padding:2px 9px; border-radius:99px; font-size:9pt; font-weight:800; }
  .det-wrap { break-inside:avoid; margin:10px 0 22px; }
  .sec-svg { text-align:center; margin:6px 0 14px; }
  .sec-svg svg { max-width:380px; height:auto; }
  .shots { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:6px 0 14px; break-inside:avoid; }
  .shot { border:1px solid #d1d5db; border-radius:6px; overflow:hidden; }
  .shot .cap { font-size:8.5pt; font-weight:700; color:#374151; background:#f3f4f6; padding:3px 8px; }
  .shot img { width:100%; display:block; max-height:230px; object-fit:contain; background:#fff; }
  .firma { margin-top:60px; text-align:center; }
  .firma .line { width:320px; border-top:1.5px solid #0f172a; margin:0 auto 6px; }
  .mem-trabe { page-break-before:always; }
  .no-print { position:fixed; top:14px; right:14px; z-index:9999; }
  .no-print button { background:#1a7a5e; color:#fff; border:none; border-radius:8px; padding:10px 18px;
                     font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 6px 18px rgba(0,0,0,.2); }
  @media print { .no-print { display:none !important; } }
`

// Table-based footer (Word-safe — avoids flexbox)
function brandFooter(meta) {
  return `<table style="width:100%;border-collapse:collapse;border:none;border-top:2px solid #4ecac4;margin-top:24px;font-size:8.5pt;color:#9ca3af">
    <tr>
      <td style="border:none;padding:6px 0 0;text-align:left">IV Ingenierías · ${esc(meta.norma)}</td>
      <td style="border:none;padding:6px 0 0;text-align:right">${esc(meta.proyecto || 'Memoria de cálculo')}</td>
    </tr>
  </table>`
}

// ── Trabes summary table ──────────────────────────────────────
// forWord → fixed width + table-layout so Word doesn't overflow the page
function trabesResumen(rows, forWord = false) {
  const tAttr = forWord ? ' width="640" style="table-layout:fixed"' : ''
  const body = rows.map((r, i) => {
    const m = r.mark ? MARK[r.mark] : null
    return `<tr>
      <td>${i + 1}</td>
      <td><b>${esc(r.nombre)}</b></td>
      <td class="num">${esc(r.b)}×${esc(r.h)}</td>
      <td>${esc(r.infTxt)}</td>
      <td>${esc(r.supTxt)}</td>
      <td class="num">${r.MuP ? fmt(r.MuP, 2) : '—'} / ${r.MRTP ? fmt(r.MRTP, 2) : '—'}</td>
      <td class="num">${r.MuN ? fmt(r.MuN, 2) : '—'} / ${r.MRTN ? fmt(r.MRTN, 2) : '—'}</td>
      <td class="num">${r.Vu ? fmt(r.Vu, 2) : '—'} / ${r.Vr ? fmt(r.Vr, 2) : '—'}</td>
      <td style="text-align:center">${m ? `<span class="mark-pill" style="background:${m.bg};color:${m.color};border:1px solid ${m.bd}">${m.label}</span>` : '—'}</td>
    </tr>`
  }).join('')
  return `<table class="mem"${tAttr}>
    <tr><th>#</th><th>Trabe</th><th>b×h (cm)</th><th>Lecho inf.</th><th>Lecho sup.</th>
        <th>Mu+/MR+ (t·m)</th><th>Mu−/MR− (t·m)</th><th>Vu/Vr (t)</th><th>Estado</th></tr>
    ${body}
  </table>`
}

// ── Compact per-section result card (when not fully detailed) ──
function resultCard(r) {
  const item = (lbl, act, res, ok) => {
    if (!res) return ''
    const okTxt = ok === undefined ? '' : ok ? '✓' : '✗'
    const col = ok === undefined ? '#0369a1' : ok ? '#15803d' : '#dc2626'
    return `<div style="font-size:10.5pt;margin:2px 0"><b>${lbl}:</b>
      <span style="font-family:'Courier New',monospace">${act ? fmt(act, 3) : '—'} / ${fmt(res, 3)}</span>
      <span style="color:${col};font-weight:700;margin-left:6px">${okTxt}</span></div>`
  }
  return `<div style="border:1px solid #d1d5db;border-radius:6px;padding:10px 14px;background:#fff">
    ${item('MR+ ≥ Mu+', r.MuP, r.MRTP, r.okP)}
    ${item('MR− ≥ Mu−', r.MuN, r.MRTN, r.okN)}
    ${item('Vr ≥ Vu', r.Vu, r.Vr, r.okV)}
  </div>`
}

// ── Double Check cross-verification section ───────────────────
// forWord → screenshots get a px width attribute and stack (Word can't grid)
function doubleCheckSection(dcheck, meta, forWord = false) {
  const secs = (dcheck && dcheck.sections) || []
  if (!secs.length) return ''

  const rows = secs.map((s, i) => {
    const rP = ratioOf(s.ma, s.mr)
    const rN = ratioOf(s.man, s.mrn)
    const rV = ratioOf(s.va, s.vr)
    const mk = s.mark && MARK[s.mark] ? s.mark : markFromRatios([rP, rN, rV])
    const m = mk ? MARK[mk] : null
    const cell = (a, r, ratio) =>
      `${a || a === 0 ? esc(a) : '—'} / ${r || r === 0 ? esc(r) : '—'}` +
      (ratio != null ? ` <b style="color:${ratio > 1 ? '#b91c1c' : ratio > 0.9 ? '#92400e' : '#15803d'}">(${ratio.toFixed(2)})</b>` : '')
    return `<tr>
      <td>${i + 1}</td>
      <td><b>${esc(s.name || '—')}</b></td>
      <td class="num">${cell(s.ma, s.mr, rP)}</td>
      <td class="num">${cell(s.man, s.mrn, rN)}</td>
      <td class="num">${cell(s.va, s.vr, rV)}</td>
      <td style="text-align:center">${m ? `<span class="mark-pill" style="background:${m.bg};color:${m.color};border:1px solid ${m.bd}">${m.label}</span>` : '—'}</td>
      <td>${esc(s.obs || '')}</td>
    </tr>`
  }).join('')

  // Evidence (screenshots)
  const shots = secs.map((s) => {
    const slots = [
      ['Momento — modelo estructural', s.imgA],
      ['Momento — cálculo de diseño', s.imgB],
      ['Cortante — modelo estructural', s.imgC],
      ['Cortante — cálculo de diseño', s.imgD],
    ].filter(([, src]) => !!src)
    if (!slots.length) return ''
    const cells = slots.map(([cap, src]) => forWord
      ? `<div style="margin:0 0 8px"><div style="font-size:9pt;font-weight:700;color:#374151;background:#f3f4f6;padding:3px 8px;border:1px solid #d1d5db;border-bottom:none">${esc(cap)}</div><img width="440" src="${src}" alt="${esc(cap)}" style="display:block;border:1px solid #d1d5db"/></div>`
      : `<div class="shot"><div class="cap">${esc(cap)}</div><img src="${src}" alt="${esc(cap)}"/></div>`).join('')
    return `<h3 class="mem">Evidencia — ${esc(s.name || 'Elemento')}</h3>` +
      (forWord ? cells : `<div class="shots">${cells}</div>`)
  }).join('')

  const dcMeta = dcheck.meta || {}
  const credit = (m_) => (m_.reviso ? ` Revisó: ${esc(m_.reviso)}.` : '')

  return `<div class="mem-sec">
    <h2 class="mem">Verificación cruzada (Double Check)</h2>
    <p class="mem-p">Se realizó una verificación cruzada de los elementos confrontando las solicitaciones
    obtenidas del modelo estructural (actuantes) contra las resistencias del diseño (resistentes).
    El cociente demanda/capacidad se evalúa por el caso más desfavorable: VERIFICADO (≤ 0.90),
    REVISAR (≤ 1.00) o NO PASA (&gt; 1.00).${credit(dcMeta)}</p>
    <table class="mem"${forWord ? ' width="640" style="table-layout:fixed"' : ''}>
      <tr><th>#</th><th>Elemento</th><th>M+ act/res (ratio)</th><th>M− act/res (ratio)</th>
          <th>V act/res (ratio)</th><th>Estado</th><th>Observaciones</th></tr>
      ${rows}
    </table>
    ${shots}
    ${brandFooter(meta)}
  </div>`
}

// ══════════════════════════════════════════════════════════════
// Document body builder (shared by the PDF and Word outputs)
// renderFig(t, R, i) → figure HTML · logoSrc → <img src> for the cover
// ══════════════════════════════════════════════════════════════
export function normalizeMeta(meta) {
  return {
    norma: 'NTC-2023',
    proyecto: '', ubicacion: '', area: '', niveles: '', hEntrepiso: '',
    responsable: '', cedula: '', fecha: new Date().toLocaleDateString('es-MX'),
    descripcion: '',
    cmEntrepiso: '236.5', cmMuro: '249.4', cvEntrepiso: '190', cvAzotea: '100',
    detalleTodos: true,
    ...meta,
  }
}

// ── Sección de columnas (flexocompresión) para la memoria ─────
function columnasHTML(columnsArr, M) {
  if (!columnsArr || !columnsArr.length) {
    return `<div class="placeholder">
      <b>Sin columnas capturadas.</b><br>
      Agregue columnas en la pestaña "Columnas" para incluir aquí su diseño por flexocompresión.
    </div>`
  }

  const rows = []
  const blocks = []
  for (const col of columnsArr) {
    let an = null
    try { an = analyzeColumn(col) } catch { /* datos incompletos */ }
    if (!an) continue
    // Demanda que rige: la envolvente del modelo si está cargada, si no el punto capturado
    const D = columnDemand(col, an)
    const caso = demandCase(D)
    const Pu = caso.Pu, MuX = caso.Mux, MuY = caso.Muy
    const cx = caso.cx, cy = caso.cy, bi = caso.bi
    const est = calcEstribos({ estriboNum: col.estriboNum, longNum: col.lechos?.[0]?.num || 3, h: +col.h, b: +col.b })
    const ex = excentricidad(MuX, Pu, +col.b, +col.h)
    const arm = (col.lechos || []).map((L, i) => `L${i + 1}: ${L.n}#${L.num}`).join(' · ')
    const ok = D.ok

    rows.push(`<tr>
      <td><b>${esc(col.nombre)}</b></td>
      <td class="num">${esc(col.b)}×${esc(col.h)}</td>
      <td>${esc(arm)}</td>
      <td class="num">${fmt(an.dirX.params.Ast, 2)}</td>
      <td class="num">${fmt(Pu, 2)}</td>
      <td class="num">${fmt(MuX, 2)} / ${fmt(cx.MR, 2)}</td>
      <td class="num">${fmt(MuY, 2)} / ${fmt(cy.MR, 2)}</td>
      <td>E#${esc(col.estriboNum)}@${est.s}</td>
      <td style="text-align:center"><span class="mark-pill" style="background:${!D.evaluado ? '#fffbeb' : ok ? '#f0fdf4' : '#fef2f2'};color:${!D.evaluado ? '#92400e' : ok ? '#15803d' : '#b91c1c'};border:1px solid ${!D.evaluado ? '#fcd34d' : ok ? '#86efac' : '#fca5a5'}">${!D.evaluado ? 'SIN DEMANDA' : ok ? 'VERIFICADO' : 'NO PASA'}</span></td>
    </tr>`)

    blocks.push(`<div class="mem-trabe">
      <h3 class="mem">Columna ${esc(col.nombre)}</h3>
      <p class="mem-p">Se construyó el diagrama de interacción de la columna proponiendo profundidades del
      eje neutro y calculando, para cada una, las fuerzas por lecho y el bloque de compresión del concreto
      (puntos POC, 1, falla balanceada D, 2, 3 y M0).
      ${D.fuente === 'envolvente'
        ? `Los elementos mecánicos se tomaron de la envolvente del modelo (${D.env.total} ejemplares); rige el ejemplar ${esc(D.env.critical?.member ?? '')}.`
        : D.fuente === 'ninguna'
          ? 'No se capturaron elementos mecánicos para esta columna; se reporta únicamente su capacidad.'
          : ''}
      Con Pu = <b>${fmt(Pu, 2)} ton</b>,
      Mux = <b>${fmt(MuX, 2)} ton·m</b> y Muy = <b>${fmt(MuY, 2)} ton·m</b>
      (e = ${isFinite(ex.e) ? fmt(ex.e, 4) : '—'} m → ${esc(ex.modo.toLowerCase().replace('realizar ', ''))}),
      el punto de demanda ${ok ? 'queda dentro' : 'NO queda dentro'} del diagrama:
      MRx = ${fmt(cx.MR, 2)} t·m ${cx.ok ? '≥' : '<'} Mux · MRy = ${fmt(cy.MR, 2)} t·m ${cy.ok ? '≥' : '<'} Muy ·
      biaxial (Mux/MRx)²+(Muy/MRy)² = ${isFinite(bi.valor) ? fmt(bi.valor, 3) : '∞'} ${bi.ok ? '≤' : '>'} 1.
      ${D.fuente === 'envolvente'
        ? `Revisados los ${D.env.total} ejemplares del reporte, ${D.env.passing} quedan dentro del diagrama${D.env.allOk ? '' : ` y ${D.env.failing} lo rebasan`}.`
        : ''}
      Acero transversal: <b>E#${esc(col.estriboNum)} @ ${est.s} cm</b>
      (s1 = ${fmt(est.s1, 2)}, s2 = ${fmt(est.s2, 2)}, s3 = ${fmt(est.s3, 0)} cm).</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start;justify-content:center">
        <div class="sec-svg">${columnSectionSvgString(col)}</div>
        ${interactionSvgString(an.dirX, { Mu: MuX, Pu, check: cx, color: '#2563a8', title: `Dirección X — P–Mx (h=${col.h})` })}
        ${interactionSvgString(an.dirY, { Mu: MuY, Pu, check: cy, color: '#c94f2a', title: `Dirección Y — P–My (h=${col.b})` })}
      </div>
    </div>`)
  }

  return `<p class="mem-p">Las columnas se diseñaron por flexocompresión construyendo su diagrama de
    interacción en ambas direcciones. La siguiente tabla resume las ${columnsArr.length} columna(s):</p>
    <table class="mem">
      <tr><th>Columna</th><th>b×h (cm)</th><th>Armado</th><th>Ast (cm²)</th><th>Pu (t)</th>
          <th>Mux/MRx (t·m)</th><th>Muy/MRy (t·m)</th><th>Estribos</th><th>Estado</th></tr>
      ${rows.join('')}
    </table>
    ${blocks.join('')}`
}

function buildMemoriaBody({ sections, M, dcheck, columnsArr = [], renderFig, logoSrc, forWord = false }) {
  // Pre-compute every section's results once
  const computed = sections.map((t) => ({ t, R: computeSectionResults(t) }))

  // Governing beam = largest |Mu|
  let govIdx = -1, govMu = -1
  computed.forEach(({ R }, i) => {
    const mu = Math.max(R.MuP || 0, R.MuN || 0)
    if (mu > govMu) { govMu = mu; govIdx = i }
  })

  // Summary rows
  const rows = computed.map(({ t, R }) => ({
    nombre: t.nombre, b: R.b, h: R.h,
    infTxt: R.resP ? `${R.resP.nUsed}#${R.resP.vr.num}${R.resP.nBastones > 0 ? `+${R.resP.nBastones}#${R.resP.vb.num}` : ''}` : `${t.cantInf}#${t.calInf}`,
    supTxt: R.resN ? `${R.resN.nUsed}#${R.resN.vr.num}${R.resN.nBastones > 0 ? `+${R.resN.nBastones}#${R.resN.vb.num}` : ''}` : `${t.cantSup}#${t.calSup}`,
    MuP: R.MuP, MRTP: R.resP?.MRT, MuN: R.MuN, MRTN: R.resN?.MRT,
    Vu: R.VuTon, Vr: R.resC?.Vr,
    okP: R.resP ? R.resP.okMR : undefined, okN: R.resN ? R.resN.okMR : undefined,
    okV: R.resC ? R.resC.okVr : undefined,
    mark: !R.hasData ? null : R.allOk ? 'ok' : 'bad',
  }))

  // Materials — unique f'c present + fy
  const fcSet = [...new Set(computed.map(({ R }) => R.fc))].sort((a, b) => a - b)
  const fySet = [...new Set(computed.map(({ R }) => R.fy))].sort((a, b) => a - b)
  const fcTxt = fcSet.length ? fcSet.map((x) => `${x} kg/cm²`).join(', ') : '250 kg/cm²'
  const fyTxt = fySet.length ? fySet.map((x) => `${x} kg/cm²`).join(', ') : '4200 kg/cm²'

  // ── Descriptive sentence per trabe (TERRASOLES-style) ──
  const trabeFrase = (t, R) => {
    const arm = (res, n, cal) => res
      ? `${res.nUsed} varilla(s) del número ${res.vr.num}${res.nBastones > 0 ? ` más ${res.nBastones} bastón(es) del número ${res.vb.num}` : ''}`
      : `${n} varilla(s) del número ${cal}`
    return `El detalle del diseño resultante se muestra a continuación, resultando una trabe de ${R.b} cm de
      ancho con ${R.h} cm de peralte, ${arm(R.resP, t.cantInf, t.calInf)} en el lecho inferior,
      ${arm(R.resN, t.cantSup, t.calSup)} en el lecho superior y estribos del número ${esc(t.calEst)} con la
      distribución indicada en el detalle (@ ${esc(t.sepLcuarto)} cm en L/4 y @ ${esc(t.sepRest)} cm en el resto).`
  }

  // ── Per-trabe design detail ──
  const detalle = computed.map(({ t, R }, i) => {
    const isGov = i === govIdx
    const full = M.detalleTodos || isGov
    let calc = ''
    if (!R.hasData) {
      calc = `<p class="mem-p" style="color:#92400e">Sin datos de cálculo para esta sección — capture momentos y/o cortante en la pestaña Cálculo.</p>`
    } else if (full) {
      if (R.MuP > 0 && R.resP) calc += renderFlexion(R.resP, '▲ MOMENTO POSITIVO (M+) — Lecho inferior', R.MuP, '#1d4ed8', R.fc, R.fy, R.b, R.h, R.r)
      if (R.MuN > 0 && R.resN) calc += renderFlexion(R.resN, '▼ MOMENTO NEGATIVO (M−) — Lecho superior', R.MuN, '#b45309', R.fc, R.fy, R.b, R.h, R.r)
      if (R.hasCort && R.VuTon > 0) calc += renderCortante(R.resC, R.fc, R.fy, R.b, R.h, R.r, R.VuTon, R.L, R.AsUsada, R.varEstNum, R.nramas)
    } else {
      calc = resultCard(rows[i])
    }
    return `<div class="mem-trabe">
      <h3 class="mem">Trabe ${esc(t.nombre || `T-${i + 1}`)}${isGov ? ' — gobernante' : ''}</h3>
      ${R.hasData ? `<p class="mem-p">${trabeFrase(t, R)}</p>` : ''}
      ${renderFig(t, R, i)}
      <div class="det-wrap">${calc}</div>
      ${brandFooter(M)}
    </div>`
  }).join('')

  // ── Intro (TERRASOLES-style wording) ──
  const introTxt = M.descripcion?.trim()
    ? esc(M.descripcion).replace(/\n/g, '<br>')
    : `Se realizó el diseño estructural de ${M.proyecto ? `“${esc(M.proyecto)}”` : 'la edificación'}${M.ubicacion ? `, localizada en ${esc(M.ubicacion)}` : ''}${M.area ? `, con aproximadamente ${esc(M.area)} m² de construcción` : ''}. El sistema constructivo es mediante muros de carga de block, losas de entrepiso y azotea de vigueta y bovedilla, estructura principal de concreto reforzado y cimentación a base de zapatas corridas y aisladas${M.niveles ? `. La edificación cuenta con ${esc(M.niveles)} nivel(es)` : ''}${M.hEntrepiso ? `, con una altura de entrepiso de ${esc(M.hEntrepiso)} m` : ''}.`

  const govNombre = govIdx >= 0 ? esc(computed[govIdx].t.nombre || `T-${govIdx + 1}`) : '—'

  return `
    <!-- ░░ PORTADA ░░ -->
    <div class="mem-cover" style="text-align:center;padding:55mm 0 40mm">
      <img width="120" src="${logoSrc}" style="width:120px;margin:0 auto 18px" alt="IV"/>
      <div style="font-size:11pt;letter-spacing:0.28em;color:#6b7280;text-transform:uppercase">IV Ingenierías</div>
      <h1 class="mem" style="font-size:30pt;margin:14px 0 6px">MEMORIA DE CÁLCULO</h1>
      <div style="font-size:13pt;color:#334155;margin-bottom:6px">Diseño estructural · Concreto reforzado</div>
      <div style="font-size:15pt;font-weight:700;color:#0f172a;margin:18px 0 26px">${esc(M.proyecto || 'Proyecto sin nombre')}</div>
      <table class="kv" style="max-width:430px;margin:0 auto;text-align:left">
        ${M.ubicacion ? `<tr><td class="k">Ubicación</td><td>${esc(M.ubicacion)}</td></tr>` : ''}
        ${M.area ? `<tr><td class="k">Área de construcción</td><td>${esc(M.area)} m²</td></tr>` : ''}
        ${M.niveles ? `<tr><td class="k">Niveles</td><td>${esc(M.niveles)}</td></tr>` : ''}
        <tr><td class="k">Normatividad</td><td>${esc(M.norma)} · ACI 318-19</td></tr>
        ${M.responsable ? `<tr><td class="k">Responsable</td><td>Ing. ${esc(M.responsable)}${M.cedula ? ` · Céd. ${esc(M.cedula)}` : ''}</td></tr>` : ''}
        <tr><td class="k">Fecha</td><td>${esc(M.fecha)}</td></tr>
      </table>
    </div>

    <!-- INTRODUCCIÓN -->
    <div class="mem-sec">
      <h2 class="mem">Introducción</h2>
      <p class="mem-p">${introTxt}</p>
      ${brandFooter(M)}
    </div>

    <!-- PROPIEDADES DE LOS MATERIALES -->
    <div class="mem-sec">
      <h2 class="mem">Propiedades de los materiales</h2>
      <p class="mem-p"><b>Concreto:</b></p>
      <ul class="mem">
        <li>Para elementos secundarios y plantilla de desplante: de f'c = 100 kg/cm² a f'c = 200 kg/cm².</li>
        <li>Elementos estructurales, muros y losas: f'c = ${esc(fcTxt)}.</li>
        <li>Acero de refuerzo: varilla corrugada ASTM-615 de fy = ${esc(fyTxt)}.</li>
      </ul>
      ${brandFooter(M)}
    </div>

    <!-- ANÁLISIS DE CARGAS -->
    <div class="mem-sec">
      <h2 class="mem">Análisis de cargas</h2>

      <h3 class="mem">Cargas muertas</h3>
      <p class="mem-p">Se utilizará vigueta y bovedilla como sistema estructural para las losas de entrepiso
      y azotea; por lo tanto, la carga muerta obtenida por el peso propio de la losa se obtuvo como sigue:</p>
      <table class="mem" style="max-width:360px">
        <tr><th>Concepto</th><th>Carga (kg/m²)</th></tr>
        <tr><td>Vigueta y bovedilla</td><td class="num">144.0</td></tr>
        <tr><td>Sobrecarga</td><td class="num">40.0</td></tr>
        <tr><td>Piso</td><td class="num">30.0</td></tr>
        <tr><td>Yeso</td><td class="num">22.5</td></tr>
        <tr><td><b>Total</b></td><td class="num"><b>${esc(M.cmEntrepiso)}</b></td></tr>
      </table>
      <p class="mem-p">En cuanto a los muros se propone block, por lo tanto, su peso unitario es de
      ${esc(M.cmMuro)} kg/m². El peso propio de los elementos estructurales como trabes y columnas se
      determina considerando un peso específico de 2400 kg/m³.</p>

      <h3 class="mem">Cargas vivas</h3>
      <p class="mem-p">Se consideraron las cargas vivas para casa habitación dentro de las Normas Técnicas
      Complementarias (NTC, 2017), donde se especifica que para losas de entrepiso son ${esc(M.cvEntrepiso)}
      kg/m² y para azotea con pendientes menores al 5% se consideran de ${esc(M.cvAzotea)} kg/m². La
      distribución de carga de las losas se realizó considerando la orientación de la vigueta y bovedilla
      propuesta; debido a la naturaleza del sistema las cargas se transmiten en una sola dirección.</p>

      <h3 class="mem">Estados de carga</h3>
      <p class="mem-p">Las combinaciones de carga a utilizar según las Normas Técnicas Complementarias
      (${esc(M.norma)}) son las siguientes:</p>
      <ul class="mem">
        <li>Estado límite de servicio: CV + CM</li>
        <li>Estado límite de diseño: 1.3 CM + 1.5 CV</li>
      </ul>
      <p class="mem-p">CV: Carga viva (Variable). CM: Carga muerta (Permanente).</p>

      <h3 class="mem">Normativas de diseño</h3>
      <ul class="mem">
        <li>Normas Técnicas Complementarias (${esc(M.norma)}).</li>
        <li>American Concrete Institute (ACI 318-19).</li>
      </ul>
      ${brandFooter(M)}
    </div>

    <!-- DISEÑO -->
    <div class="mem-sec">
      <h2 class="mem">Diseño</h2>

      <h3 class="mem">Diseño de trabes y columnas</h3>
      <p class="mem-p">Se construyó un modelo analítico de la estructura, del cual, mediante su análisis, se
      obtuvieron los momentos y cortantes de diseño como parámetros para las vigas; en cuanto a las columnas
      se obtuvieron las cargas axiales críticas y sus respectivos momentos de diseño. Además, para realizar la
      revisión por estado límite de servicio según las NTC 2023, se obtuvieron las deflexiones máximas.</p>

      <h3 class="mem">Estado límite de diseño</h3>
      <p class="mem-p">De acuerdo con la revisión de momentos, ésta es la condición dominante en la revisión
      por estado límite de diseño, ya que los cortantes y las deflexiones se encontraron en rangos aceptables.
      ${govIdx >= 0 ? `El momento crítico de la estructura se presenta en la trabe <b>${govNombre}</b>, con un valor de <b>${fmt(govMu, 2)} ton·m</b>. ` : ''}Considerando
      los momentos obtenidos del análisis se realizó el diseño por resistencia, el cual se describe a
      continuación. La siguiente tabla resume las ${sections.length} trabe(s) consideradas:</p>
      ${trabesResumen(rows, forWord)}
      ${brandFooter(M)}
    </div>
    ${detalle}

    <!-- DISEÑO — servicio / columnas / cimentación -->
    <div class="mem-sec">
      <h3 class="mem">Estado límite de servicio</h3>
      <p class="mem-p">El estado límite de servicio se revisó conforme a las NTC 2023, las cuales establecen
      que la deflexión vertical máxima permisible está en función de la longitud de los elementos
      (L/240, siendo L la longitud del elemento horizontal). Las deflexiones actuantes obtenidas del modelo
      resultaron menores a las permisibles, por lo que el diseño propuesto es aceptable.</p>

      <h3 class="mem">Diseño de columnas</h3>
      ${columnasHTML(columnsArr, M)}

      <h3 class="mem">Diseño de cimentación</h3>
      <div class="placeholder">
        <b>Sección en desarrollo.</b><br>
        Se realizará la revisión del diseño de cimentación a base de zapatas aisladas y corridas y
        contratrabes.<br>
        <span style="font-size:9.5pt">Pendiente de captura.</span>
      </div>
      ${brandFooter(M)}
    </div>

    ${doubleCheckSection(dcheck, M, forWord)}

    <!-- ANEXOS -->
    <div class="mem-sec">
      <h2 class="mem">Anexos</h2>
      <p class="mem-p">Planos de estructuración.</p>
      <div class="placeholder">Planos de estructuración (planta alta, azotea y cimentación) y reporte de
      momentos y cortantes del modelo estructural — <b>adjuntar</b>.</div>

      <div class="firma">
        <p class="mem-p" style="text-align:center;margin-bottom:50px">ATENTAMENTE</p>
        <div class="line"></div>
        <div style="font-weight:700;font-size:11.5pt">Ing. ${esc(M.responsable || '________________________')}</div>
        ${M.cedula ? `<div style="font-size:10pt;color:#6b7280">Cédula: ${esc(M.cedula)}</div>` : ''}
      </div>
      ${brandFooter(M)}
    </div>`
}

// ══════════════════════════════════════════════════════════════
// SVG → PNG data URL (used by the cover logo & section details)
// ══════════════════════════════════════════════════════════════
export function svgToPng(svgString, fallbackW = 400, fallbackH = 300) {
  return new Promise((resolve, reject) => {
    const src = svgString.includes('xmlns=')
      ? svgString
      : svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
    const url = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml;charset=utf-8' }))
    const img = new Image()
    img.onload = () => {
      const w = img.width || fallbackW
      const h = img.height || fallbackH
      const s = 2 // supersample for crisp print
      const cv = document.createElement('canvas')
      cv.width = Math.round(w * s); cv.height = Math.round(h * s)
      const ctx = cv.getContext('2d')
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height)
      ctx.scale(s, s)
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      try { resolve(cv.toDataURL('image/png')) } catch (e) { reject(e) }
    }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}

// ══════════════════════════════════════════════════════════════
// Output 1 — printable HTML (PDF via browser print)
// ══════════════════════════════════════════════════════════════
export function generateMemoria({ sections = [], columns = [], meta = {}, dcheck = null } = {}) {
  const M = normalizeMeta(meta)
  const logoSrc = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(LOGO_SVG)))}`
  const renderFig = (t) => `<div class="sec-svg">${sectionSvgString(t)}</div>`
  const body = buildMemoriaBody({ sections, M, dcheck, columnsArr: columns, renderFig, logoSrc })

  const doc = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Memoria de Cálculo${M.proyecto ? ` — ${esc(M.proyecto)}` : ''}</title>
    <style>${DETAIL_CSS}${MEM_CSS}</style></head>
    <body>
      <div class="no-print"><button onclick="window.print()">🖨 Imprimir / Guardar PDF</button></div>
      ${body}
    </body></html>`

  const w = window.open('', '_blank')
  if (!w) { alert('Habilita las ventanas emergentes para ver la memoria.'); return }
  w.document.write(doc)
  w.document.close()
}
