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
function trabesResumen(rows) {
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
  return `<table class="mem">
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
    <h2 class="mem">9. Verificación cruzada (Double Check)</h2>
    <p class="mem">Se realizó una verificación cruzada de los elementos confrontando las solicitaciones
    obtenidas del modelo estructural (actuantes) contra las resistencias del diseño (resistentes).
    El cociente demanda/capacidad se evalúa por el caso más desfavorable: VERIFICADO (≤ 0.90),
    REVISAR (≤ 1.00) o NO PASA (&gt; 1.00).${credit(dcMeta)}</p>
    <table class="mem">
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
function normalizeMeta(meta) {
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

function buildMemoriaBody({ sections, M, dcheck, renderFig, logoSrc, forWord = false }) {
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

  // ── Per-section design detail ──
  const detalle = computed.map(({ t, R }, i) => {
    const isGov = i === govIdx
    const full = M.detalleTodos || isGov
    let body = renderFig(t, R, i)

    if (!R.hasData) {
      body += `<p class="mem-p" style="color:#92400e">Sin datos de cálculo para esta sección — capture momentos y/o cortante en la pestaña Cálculo.</p>`
    } else if (full) {
      if (R.MuP > 0 && R.resP) body += renderFlexion(R.resP, '▲ MOMENTO POSITIVO (M+) — Lecho inferior', R.MuP, '#1d4ed8', R.fc, R.fy, R.b, R.h, R.r)
      if (R.MuN > 0 && R.resN) body += renderFlexion(R.resN, '▼ MOMENTO NEGATIVO (M−) — Lecho superior', R.MuN, '#b45309', R.fc, R.fy, R.b, R.h, R.r)
      if (R.hasCort && R.VuTon > 0) body += renderCortante(R.resC, R.fc, R.fy, R.b, R.h, R.r, R.VuTon, R.L, R.AsUsada, R.varEstNum, R.nramas)
    } else {
      body += resultCard(rows[i])
    }

    return `<div class="${i > 0 ? 'mem-sec mem-trabe' : ''}">
      <h2 class="mem">6.${i + 1} Trabe ${esc(t.nombre || `T-${i + 1}`)}${isGov ? ' — gobernante' : ''}</h2>
      ${isGov ? `<p class="mem-p">Esta trabe rige el diseño por flexión con un momento último de
        <b>${fmt(govMu, 2)} t·m</b>. A continuación se presenta su diseño por resistencia
        (estado límite de falla) y, en su caso, la revisión por cortante.</p>` : ''}
      <div class="det-wrap">${body}</div>
      ${brandFooter(M)}
    </div>`
  }).join('')

  // ── Assemble body ──
  const introTxt = M.descripcion?.trim()
    ? esc(M.descripcion).replace(/\n/g, '<br>')
    : `Se realizó el diseño estructural de ${M.proyecto ? `“${esc(M.proyecto)}”` : 'la edificación'}${M.ubicacion ? `, ubicada en ${esc(M.ubicacion)}` : ''}${M.area ? `, con aproximadamente ${esc(M.area)} m² de construcción` : ''}.
       El sistema estructural se compone de elementos de concreto reforzado diseñados conforme a la normatividad vigente${M.niveles ? `. La edificación consta de ${esc(M.niveles)} nivel(es)` : ''}${M.hEntrepiso ? ` con una altura de entrepiso de ${esc(M.hEntrepiso)} m` : ''}.`

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

    <!-- 1. INTRODUCCIÓN -->
    <div class="mem-sec">
      <h2 class="mem">1. Introducción</h2>
      <p class="mem-p">${introTxt}</p>
      ${brandFooter(M)}
    </div>

    <!-- 2. MATERIALES -->
    <div class="mem-sec">
      <h2 class="mem">2. Propiedades de los materiales</h2>
      <ul class="mem">
        <li><b>Concreto estructural:</b> f'c = ${esc(fcTxt)}.</li>
        <li><b>Concreto en elementos secundarios / plantilla:</b> f'c = 100 a 200 kg/cm².</li>
        <li><b>Acero de refuerzo:</b> varilla corrugada ASTM-A615, fy = ${esc(fyTxt)}.</li>
        <li><b>Peso volumétrico del concreto reforzado:</b> 2400 kg/m³.</li>
      </ul>
      ${brandFooter(M)}
    </div>

    <!-- 3. CARGAS -->
    <div class="mem-sec">
      <h2 class="mem">3. Análisis de cargas</h2>
      <h3 class="mem">3.1 Cargas muertas (CM)</h3>
      <p class="mem-p">Para el sistema de losa de entrepiso y azotea (vigueta y bovedilla) se consideró la
      siguiente integración de carga muerta:</p>
      <table class="mem" style="max-width:430px">
        <tr><th>Concepto</th><th>Carga (kg/m²)</th></tr>
        <tr><td>Vigueta y bovedilla</td><td class="num">144.0</td></tr>
        <tr><td>Sobrecarga</td><td class="num">40.0</td></tr>
        <tr><td>Piso</td><td class="num">30.0</td></tr>
        <tr><td>Yeso</td><td class="num">22.5</td></tr>
        <tr><td><b>Total CM losa</b></td><td class="num"><b>${esc(M.cmEntrepiso)}</b></td></tr>
      </table>
      <p class="mem-p">Muros de block: ${esc(M.cmMuro)} kg/m². El peso propio de trabes y columnas se
      determina con un peso específico de 2400 kg/m³.</p>
      <h3 class="mem">3.2 Cargas vivas (CV)</h3>
      <p class="mem-p">De acuerdo con las Normas Técnicas Complementarias, para vivienda se consideran
      cargas vivas de ${esc(M.cvEntrepiso)} kg/m² en losas de entrepiso y ${esc(M.cvAzotea)} kg/m²
      en azotea con pendiente menor al 5%.</p>
      ${brandFooter(M)}
    </div>

    <!-- 4. ESTADOS DE CARGA -->
    <div class="mem-sec">
      <h2 class="mem">4. Estados de carga (combinaciones)</h2>
      <p class="mem-p">Las combinaciones de carga empleadas conforme a ${esc(M.norma)} son:</p>
      <ul class="mem">
        <li><b>Estado límite de servicio:</b> CM + CV</li>
        <li><b>Estado límite de falla (diseño):</b> 1.3 CM + 1.5 CV</li>
      </ul>
      <p class="mem-p" style="color:#6b7280;font-size:10pt">CM: carga muerta (permanente) · CV: carga viva (variable).
      Los momentos y cortantes últimos empleados en el diseño provienen del análisis del modelo estructural
      bajo la combinación de falla.</p>
      ${brandFooter(M)}
    </div>

    <!-- 5. NORMATIVA -->
    <div class="mem-sec">
      <h2 class="mem">5. Normatividad de diseño</h2>
      <ul class="mem">
        <li>Normas Técnicas Complementarias para Diseño y Construcción de Estructuras de Concreto (${esc(M.norma)}).</li>
        <li>American Concrete Institute — ACI 318-19.</li>
      </ul>
      <p class="mem-p">El diseño de los elementos de concreto reforzado se realizó por el método de diseño
      por resistencia (estados límite).</p>
      ${brandFooter(M)}
    </div>

    <!-- 6. DISEÑO DE TRABES -->
    <div class="mem-sec">
      <h2 class="mem">6. Diseño de trabes</h2>
      <p class="mem-p">A partir del análisis estructural se obtuvieron los momentos y cortantes de diseño
      de cada trabe. La siguiente tabla resume las ${sections.length} sección(es) consideradas; el detalle
      del diseño por resistencia se presenta a continuación${M.detalleTodos ? ' para cada elemento' : ', con desarrollo completo de la trabe gobernante'}.</p>
      ${trabesResumen(rows)}
      ${brandFooter(M)}
    </div>
    ${detalle}

    <!-- 7. COLUMNAS (placeholder) -->
    <div class="mem-sec">
      <h2 class="mem">7. Diseño de columnas</h2>
      <div class="placeholder">
        <b>Sección en desarrollo.</b><br>
        Aquí se integrará el diseño de columnas por <b>flexocompresión</b>
        (elementos mecánicos actuantes Pu, Mu; resistencia P-M; detalle de armado).<br>
        <span style="font-size:9.5pt">Pendiente de captura — se completará con el módulo de columnas.</span>
      </div>
      ${brandFooter(M)}
    </div>

    <!-- 8. CIMENTACIÓN (placeholder) -->
    <div class="mem-sec">
      <h2 class="mem">8. Diseño de cimentación</h2>
      <div class="placeholder">
        <b>Sección en desarrollo.</b><br>
        Aquí se integrará la revisión de la cimentación (zapatas aisladas y corridas, contratrabes).<br>
        <span style="font-size:9.5pt">Pendiente de captura.</span>
      </div>
      ${brandFooter(M)}
    </div>

    ${doubleCheckSection(dcheck, M, forWord)}

    <!-- 10. ANEXOS -->
    <div class="mem-sec">
      <h2 class="mem">10. Anexos</h2>
      <p class="mem-p">Se anexan los planos de estructuración (planta alta, azotea y cimentación) y el
      reporte de elementos mecánicos del modelo estructural.</p>
      <div class="placeholder"><b>Planos de estructuración</b> — adjuntar.</div>

      <div class="firma">
        <p class="mem-p" style="text-align:center;margin-bottom:50px">ATENTAMENTE</p>
        <div class="line"></div>
        <div style="font-weight:700;font-size:11.5pt">Ing. ${esc(M.responsable || '________________________')}</div>
        ${M.cedula ? `<div style="font-size:10pt;color:#6b7280">Cédula profesional: ${esc(M.cedula)}</div>` : ''}
      </div>
      ${brandFooter(M)}
    </div>`
}

// ══════════════════════════════════════════════════════════════
// SVG → PNG (so Word can show the cover logo and section details)
// ══════════════════════════════════════════════════════════════
function svgToPng(svgString, fallbackW = 400, fallbackH = 300) {
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
export function generateMemoria({ sections = [], meta = {}, dcheck = null } = {}) {
  const M = normalizeMeta(meta)
  const logoSrc = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(LOGO_SVG)))}`
  const renderFig = (t) => `<div class="sec-svg">${sectionSvgString(t)}</div>`
  const body = buildMemoriaBody({ sections, M, dcheck, renderFig, logoSrc })

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

// ══════════════════════════════════════════════════════════════
// Output 2 — Word (.doc, editable) — rasterizes SVG figures to PNG
// ══════════════════════════════════════════════════════════════
export async function generateMemoriaWord({ sections = [], meta = {}, dcheck = null } = {}) {
  const M = normalizeMeta(meta)

  // Rasterize logo + each section detail to PNG (Word can't render SVG)
  let logoSrc
  try { logoSrc = await svgToPng(LOGO_SVG, 200, 170) }
  catch { logoSrc = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(LOGO_SVG)))}` }

  const figs = await Promise.all(sections.map(async (t) => {
    try { return await svgToPng(sectionSvgString(t)) } catch { return null }
  }))
  // Word honors the HTML width attribute (px); CSS cm/% are unreliable
  const renderFig = (t, R, i) => (figs[i]
    ? `<div class="sec-svg"><img width="440" src="${figs[i]}" alt="Detalle ${esc(t.nombre)}"/></div>`
    : '')

  const body = buildMemoriaBody({ sections, M, dcheck, renderFig, logoSrc, forWord: true })

  // Word-compatible HTML envelope (.doc) with page setup.
  // The override block neutralizes flex/grid (unsupported) and the
  // break-inside:avoid rules that left near-empty pages, and bounds images.
  const wordCss = `
    @page Section1 { size:21cm 29.7cm; margin:2cm 2cm; }
    div.Section1 { page:Section1; }
    body { font-family:'Calibri',Arial,sans-serif; }
    ${DETAIL_CSS}${MEM_CSS}
    /* ── Word overrides ── */
    .paso-h { display:block; }
    .data-grid { display:block; }
    .data-grid div { display:inline-block; margin-right:18px; }
    .shots { display:block; }
    .paso, .det-wrap, .shots { break-inside:auto; page-break-inside:auto; }
    .sec-svg img { width:440px; max-width:440px; }
    img { max-width:17cm; }
    /* Flow continuously: don't force a page per section (avoids near-empty
       pages). Only the cover stands alone, and each trabe starts fresh. */
    .mem-sec { page-break-before:auto; }
    .mem-cover { page-break-after:always; }
    .mem-trabe { page-break-before:always; }
  `
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:w="urn:schemas-microsoft-com:office:word"
    xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8">
    <title>Memoria de Cálculo${M.proyecto ? ` — ${esc(M.proyecto)}` : ''}</title>
    <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
    <style>${wordCss}</style></head>
    <body><div class="Section1">${body}</div></body></html>`

  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const name = (M.proyecto || 'memoria').trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '') || 'memoria'
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `MEMORIA-${name}.doc`
  a.click()
  URL.revokeObjectURL(a.href)
}
