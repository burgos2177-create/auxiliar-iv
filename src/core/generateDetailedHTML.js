// ══════════════════════════════════════════════════════════════
// Detailed Calculation Report — all sections in printable HTML
// ══════════════════════════════════════════════════════════════

import { calcFlexion, calcCortante, VARILLAS } from './sectionCalculator'

const CAL_TO_NUM = { '2': 2, '2.5': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10 }

function fmt(v, dec = 4) {
  if (v === null || v === undefined || isNaN(v)) return '—'
  return Number(v).toFixed(dec)
}

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 170">
  <rect x="18" y="10" width="22" height="90" fill="#1a1a2e"/>
  <rect x="8"  y="10" width="42" height="14" fill="#1a1a2e"/>
  <rect x="8"  y="86" width="42" height="14" fill="#1a1a2e"/>
  <polygon points="52,10 74,10 110,100 88,100" fill="#1a1a2e"/>
  <polygon points="148,10 170,10 128,100 106,100" fill="#1a1a2e"/>
  <rect x="111" y="28" width="10" height="52" rx="4" transform="rotate(-18,116,54)" fill="#4ecac4"/>
  <rect x="127" y="24" width="10" height="52" rx="4" transform="rotate(-18,132,50)" fill="#8a9ab0"/>
  <text x="100" y="148" text-anchor="middle" font-family="Arial,sans-serif"
    font-size="15" font-weight="800" letter-spacing="5" fill="#1a1a2e">INGENIERÍAS</text>
</svg>`

const CSS = `
  body { font-family:'IBM Plex Sans',Arial,sans-serif; margin:18mm 15mm; color:#111; font-size:11pt; }
  @media print { body { margin:10mm 12mm; } .section-page { page-break-before:always; } }
  .paso { margin-bottom:14px; border:1px solid #d1d5db; border-radius:6px; overflow:hidden; break-inside:avoid; }
  .paso-h { padding:5px 14px; color:#fff; font-weight:700; font-size:12px; display:flex; align-items:center; gap:10px; }
  .paso-b { padding:10px 14px; background:#fff; }
  .linea { margin-bottom:8px; }
  .formula { font-size:11px; color:#6b7280; font-family:Georgia,serif; margin-bottom:2px; }
  .sust { font-size:11px; color:#374151; font-family:'Courier New',monospace; margin-bottom:2px; }
  .res { display:inline-block; border-radius:4px; padding:3px 12px; font-family:'Courier New',monospace; font-weight:700; font-size:12px; margin-bottom:4px; }
  .res-ok { background:#f0fdf4; border:1.5px solid #86efac; color:#15803d; }
  .res-fail { background:#fef2f2; border:1.5px solid #fca5a5; color:#dc2626; }
  .res-n { background:#f0f9ff; border:1.5px solid #bae6fd; color:#0369a1; }
  .chk { font-weight:700; font-size:11px; margin-left:10px; }
  .chk-ok { color:#15803d; }
  .chk-fail { color:#dc2626; }
  .nota { margin:6px 0 8px; padding:10px 14px; border-radius:6px; background:#fffbeb; border:1px solid #f59e0b; font-size:10px; color:#78350f; line-height:1.7; }
  .vfinal { border-radius:6px; padding:12px 16px; margin:8px 0; font-weight:700; font-size:13px; }
  .vfinal-ok { background:#f0fdf4; border:2px solid #86efac; color:#15803d; }
  .vfinal-fail { background:#fef2f2; border:2px solid #fca5a5; color:#dc2626; }
  .data-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:6px 20px; margin-bottom:16px; }
  .data-grid div { font-size:12px; color:#374151; }
  .data-grid span.l { font-weight:600; }
  .data-grid span.v { font-family:'Courier New',monospace; }
  .data-grid span.u { color:#6b7280; }
  table.summary { width:100%; border-collapse:collapse; font-size:12px; }
  table.summary th,table.summary td { padding:6px 10px; border:1px solid #d1d5db; text-align:left; }
  table.summary th { background:#f3f4f6; font-weight:700; }
`

function linea(sym, formula, sust, resultado, unidad, ok, nota) {
  let h = '<div class="linea">'
  if (formula) h += `<div class="formula">${formula}</div>`
  if (sust) h += `<div class="sust">${sym ? `<b>${sym}</b> = ` : ''}${sust}</div>`
  if (resultado !== undefined) {
    const cls = ok === undefined ? 'res-n' : ok ? 'res-ok' : 'res-fail'
    h += `<div class="res ${cls}">${sym && !sust ? `${sym} = ` : ''}${resultado}${unidad ? ` <span style="font-weight:400;font-size:11px;margin-left:4px">${unidad}</span>` : ''}</div>`
    if (ok !== undefined) h += `<span class="chk ${ok ? 'chk-ok' : 'chk-fail'}">${ok ? '✓ CUMPLE' : '✗ NO CUMPLE'}</span>`
  }
  if (nota) h += `<span style="font-size:11px;color:#6b7280;margin-left:8px">${nota}</span>`
  h += '</div>'
  return h
}

function paso(num, titulo, color, body) {
  return `<div class="paso"><div class="paso-h" style="background:${color}">
    <span style="font-weight:800;font-size:13px;opacity:0.7">${num}</span>
    <span style="letter-spacing:0.04em">${titulo}</span>
  </div><div class="paso-b">${body}</div></div>`
}

function renderFlexion(res, lecho, Mu, acento, fc, fy, b, h, r) {
  if (!res || res.error) return `<div style="color:#dc2626;padding:12px">Error: ${res?.error || 'Sin datos'}</div>`
  const fcRed = 0.85 * fc
  const MuKgcm = Mu * 100000

  let html = `<div style="background:${acento};color:#fff;padding:8px 16px;border-radius:6px;font-weight:800;font-size:15px;margin-bottom:16px">${lecho} — Mu = ${fmt(Mu, 4)} ton·m</div>`

  // Paso 1
  html += paso('1', 'Propiedades del concreto y geometría · NTC-2023 art. 5.2.1.3.1', '#dde1ec',
    linea("f''c", "f''c = 0.85 × f'c", `0.85 × ${fc}`, fmt(fcRed), 'kg/cm²') +
    linea('d', 'd = h − r', `${h} − ${r}`, fmt(res.d, 2), 'cm') +
    linea('Mu', 'Mu [kg·cm] = Mu [ton·m] × 100,000', `${fmt(Mu, 4)} × 100,000`, fmt(MuKgcm, 0), 'kg·cm')
  )

  // Paso 2
  html += paso('2', 'Coeficiente Rn · NTC-2023 ec. 5.2.2.1.1.1.b (despejada)', '#dde1ec',
    linea('Rn', 'Rn = Mu / (FR × b × d²)', `${fmt(MuKgcm, 0)} / (${res.FR} × ${b} × ${fmt(res.d, 2)}²)`, fmt(res.Rn), 'kg/cm²')
  )

  // Paso 3
  html += paso('3', 'Cuantía ρ · NTC-2023 ec. 5.2.2.1.1.1.b (invertida)', '#dde1ec',
    linea('ρ', "ρ = (f''c / fy) × [1 − √(1 − 2·Rn / f''c)]", `(${fmt(fcRed, 2)} / ${fy}) × [1 − √(1 − 2×${fmt(res.Rn)} / ${fmt(fcRed, 2)})]`, fmt(res.rhoCalc, 6)) +
    linea('As calc', 'As_calc = ρ × b × d', `${fmt(res.rhoCalc, 6)} × ${b} × ${fmt(res.d, 2)}`, fmt(res.AsCalc), 'cm²')
  )

  // Paso 4
  html += paso('4', 'Verificación: Acero mínimo · NTC-2023 art. 5.2.3', '#dde1ec',
    linea('As_min', "As_min = (0.7 × √f'c / fy) × b × d", `(0.7 × √${fc} / ${fy}) × ${b} × ${fmt(res.d, 2)}`, fmt(res.AsMin), 'cm²') +
    linea('As req', 'As_req = máx(As_calc, As_min)', `máx(${fmt(res.AsCalc)}, ${fmt(res.AsMin)})`, fmt(res.AsReq), 'cm²')
  )

  // Paso 5
  html += paso('5', 'Verificación: Acero máximo · NTC-2023 arts. 5.2.1.3.1 y 6.3.5.2.1', '#dde1ec',
    linea('β1', fc <= 280 ? "β1 = 0.85 (f'c ≤ 280 kg/cm²)" : "β1 = 0.85 − 0.05×(f'c−280)/70", null, fmt(res.b1, 2)) +
    linea('ρ_bal', "ρ_bal = (β1 × f''c / fy) × (6000 / (6000 + fy))", `(${fmt(res.b1, 2)} × ${fmt(fcRed, 2)} / ${fy}) × (6000 / (6000 + ${fy}))`, fmt(res.rhoBal, 6)) +
    linea('As_bal', 'As_bal = ρ_bal × b × d', `${fmt(res.rhoBal, 6)} × ${b} × ${fmt(res.d, 2)}`, fmt(res.AsBal), 'cm²') +
    linea('As_max', 'As_max = 0.90 × As_bal [NTC-2023 art. 6.3.5.2.1]', `0.90 × ${fmt(res.AsBal)}`, fmt(res.AsMax), 'cm²')
  )

  // Paso 6
  let p6 = linea('Varilla', null, null, `#${res.vr.num} (Ø = ${(res.vr.diam * 10).toFixed(1)} mm, A = ${res.vr.area} cm²)`) +
    linea('n calc', 'n_calc = ⌈As_req / A_varilla⌉', `⌈${fmt(res.AsReq)} / ${res.vr.area}⌉`, `${res.nCalc} varillas`) +
    linea('n usado', null, null, `${res.nUsed} varillas`) +
    linea('As_barras', 'As_barras = n × A_varilla', `${res.nUsed} × ${res.vr.area}`, fmt(res.AsBarras), 'cm²')
  if (res.nBastones > 0) {
    p6 += linea('Bastón', null, null, `#${res.vb.num} (A = ${res.vb.area} cm²)`) +
      linea('As_bastones', 'As_bastones = n_bastones × A_bastón', `${res.nBastones} × ${res.vb.area}`, fmt(res.AsBastones), 'cm²')
  }
  p6 += linea('As_total', 'As_total = As_barras + As_bastones', `${fmt(res.AsBarras)} + ${fmt(res.AsBastones)}`, fmt(res.AsTotal), 'cm²')
  html += paso('6', 'Selección de varillas · NTC-2023 art. 5.2.2.1.1.1', '#374151', p6)

  // Paso 7
  html += paso('7', 'Cuantía real y parámetro q · NTC-2023 ec. 5.2.2.1.1.1', '#dde1ec',
    linea('ρ_real', 'ρ_real = As_total / (b × d)', `${fmt(res.AsTotal)} / (${b} × ${fmt(res.d, 2)})`, fmt(res.rhoReal, 6)) +
    `<div class="nota"><b>⚠ Nota — q adoptado de NTC-2017:</b> La NTC-2023 define q = ρ·f''c/fy, invirtiendo el numerador y denominador respecto a la NTC-2017. La definición congruente con las ecs. 5.2.2.1.1.1.a y .b es <b>q = ρ·fy/f''c</b>, de la NTC-2017, que se adopta en este cálculo.</div>` +
    linea('q', "q = ρ_real × fy / f''c [adoptado de NTC-2017]", `${fmt(res.rhoReal, 6)} × ${fy} / ${fmt(fcRed, 2)}`, fmt(res.q, 6))
  )

  // Paso 8
  html += paso('8', 'Momento resistente MRT y MRC · NTC-2023 ecs. 5.2.2.1.1.1.a y .b', '#dde1ec',
    linea('a', "a = As_total × fy / (f''c × b)", `${fmt(res.AsTotal)} × ${fy} / (${fmt(fcRed, 2)} × ${b})`, fmt(res.a), 'cm') +
    linea('MRT', "MRT = FR × As_total × fy × (d − a/2) / 100,000 [ec. 5.2.2.1.1.1.b]",
      `${res.FR} × ${fmt(res.AsTotal)} × ${fy} × (${fmt(res.d, 2)} − ${fmt(res.a / 2, 4)}) / 100,000`,
      fmt(res.MRT, 6), 'ton·m', res.okMR, `Mu = ${fmt(Mu, 4)} ton·m`) +
    linea('MRC', "MRC = FR × b × d² × f''c × q × (1 − 0.5q) / 100,000 [ec. 5.2.2.1.1.1.a]",
      `${res.FR} × ${b} × ${fmt(res.d, 2)}² × ${fmt(fcRed, 2)} × ${fmt(res.q, 6)} × (1 − 0.5×${fmt(res.q, 6)}) / 100,000`,
      fmt(res.MRC, 6), 'ton·m', undefined, 'Verificación por concreto — debe aproximarse a MRT')
  )

  // Paso 9
  html += paso('9', 'Verificaciones finales · NTC-2023 arts. 5.2.1.3.1, 5.2.3 y 6.3.5.2.1', '#dde1ec',
    linea('b_min', 'b_min = 2r + (2n − 1) × Ø_varilla', `2(${r}) + (2×${res.nUsed}−1) × ${res.vr.diam}`, fmt(res.bMin), 'cm', res.okBmin, `b = ${b} cm`) +
    linea(null, 'As_total ≥ As_min', `${fmt(res.AsTotal)} ≥ ${fmt(res.AsMin)}`, undefined, undefined, res.okMin) +
    linea(null, 'As_total ≤ As_max', `${fmt(res.AsTotal)} ≤ ${fmt(res.AsMax)}`, undefined, undefined, res.okMax)
  )

  const allOk = res.okMR && res.okMin && res.okMax && res.okBmin
  html += `<div class="vfinal ${allOk ? 'vfinal-ok' : 'vfinal-fail'}">${allOk
    ? `✓ DISEÑO VÁLIDO — Usar ${res.nUsed} var. #${res.vr.num}${res.nBastones > 0 ? ` + ${res.nBastones} bastón(es) #${res.vb.num}` : ''} — As = ${fmt(res.AsTotal)} cm² | MRT = ${fmt(res.MRT, 4)} ton·m ≥ Mu = ${fmt(Mu, 4)} ton·m`
    : '✗ DISEÑO NO VÁLIDO — Revisar sección o varillas'}</div>`

  return html
}

function renderCortante(resC, fc, fy, b, h, r, VuTon, L, AsUsada, varEstNum, nramas) {
  if (!resC || !resC.Vr) return ''

  let html = `<div style="font-size:16px;font-weight:800;color:#0f172a;border-bottom:2px solid #9333ea;padding-bottom:8px;margin:32px 0 20px;text-transform:uppercase;letter-spacing:0.04em">Revisión por cortante</div>`

  html += `<div class="data-grid">${[
    ['L', L, 'm'], ['Vu', VuTon, 'ton'], ['As usada', AsUsada, 'cm²'],
    [`E #${varEstNum}`, resC.ve?.area, 'cm²'], ['Ramas', nramas, '']
  ].map(([l, v, u]) => `<div><span class="l">${l}:</span> <span class="v">${v}</span>${u ? ` <span class="u">${u}</span>` : ''}</div>`).join('')}</div>`

  // Paso 1
  let lhNote = resC.lhZone === 'mayor5' ? '✓ L/h > 5 — se aplican ecs. 5.3.1 / 5.3.2 directamente'
    : resC.lhZone === 'entre4y5' ? '⚠ 4 ≤ L/h ≤ 5 — NTC-2023 indica cambiar dimensiones'
    : '⚠ L/h < 4 — viga de gran peralte'
  let lhColor = resC.lhZone === 'mayor5' ? '#15803d' : '#92400e'
  html += paso('1', 'Geometría y cuantía · NTC-2023 art. 5.3', '#dde1ec',
    linea('d', 'd = h − r', `${h} − ${r}`, fmt(resC.d, 2), 'cm') +
    linea('L/h', 'L/h = L[cm] / h', `${L * 100} / ${h}`, fmt(resC.lh, 2)) +
    `<div style="margin:6px 0;padding:6px 10px;border-radius:4px;font-size:11px;color:${lhColor};background:${resC.lhZone === 'mayor5' ? '#f0fdf4' : '#fffbeb'};border:1px solid ${resC.lhZone === 'mayor5' ? '#86efac' : '#fcd34d'}">${lhNote}</div>` +
    linea('ρ', 'ρ = As / (b × d)', `${AsUsada} / (${b} × ${fmt(resC.d, 2)})`, fmt(resC.rho, 6), null, undefined,
      resC.rho < 0.015 ? '→ ρ < 0.015: usar ec. 5.3.1' : '→ ρ ≥ 0.015: usar ec. 5.3.2')
  )

  // Paso 2
  html += paso('2', 'VCR · NTC-2023 ec. 5.5.3.1.1', '#dde1ec',
    linea('VCR_a', "VCR_a = FR · 0.5 · √f'c · b · d [ec. 5.5.3.1.1.a]",
      `${resC.FR} × 0.5 × 1 × √${fc} × ${b} × ${fmt(resC.d, 2)}`, fmt(resC.VCR_a * 1000, 2), 'kg') +
    linea('VCR_b', "VCR_b = FR · 2 · ρ^(1/3) · √f'c · b · d [ec. 5.5.3.1.1.b]",
      `${resC.FR} × 2 × 1 × ${fmt(resC.rho, 6)}^(1/3) × √${fc} × ${b} × ${fmt(resC.d, 2)}`, fmt(resC.VCR_b * 1000, 2), 'kg') +
    linea('VCR_min', "VCR_min = FR · 0.25 · √f'c · b · d", null, fmt(resC.VCR_min * 1000, 2), 'kg') +
    linea('VCR_max', "VCR_max = FR · 1.25 · √f'c · b · d", null, fmt(resC.VCR_max * 1000, 2), 'kg') +
    linea('VCR adoptado', null, null, fmt(resC.Vcr, 4), 'ton')
  )

  // Paso 2b
  html += paso('2b', 'Verificación límite · NTC-2023 ec. 5.5.2.2', '#374151',
    linea('Va_max', "Va_max = VCR + FR · 2.2 · √f'c · b · d",
      `${fmt(resC.Vcr * 1000, 2)} + ${resC.FR} × 2.2 × √${fc} × ${b} × ${fmt(resC.d, 2)}`,
      fmt(resC.VaMax * 1000, 2), 'kg', resC.okVaMax, `Vu = ${fmt(VuTon * 1000, 2)} kg`) +
    (resC.seccionInsuficiente ? '<div style="padding:6px 10px;background:#fef2f2;border:1px solid #fca5a5;border-radius:4px;font-size:11px;color:#dc2626;font-weight:700">⚠ Vu > Va_max — La sección debe redimensionarse</div>' : '')
  )

  // Paso 3
  html += paso('3', 'VSR · NTC-2023 ec. 5.5.1.1', '#dde1ec',
    linea('VSR_nec', 'VSR_nec = Vu − VCR [ton]', `${fmt(VuTon, 4)} − ${fmt(resC.Vcr, 4)}`, fmt(resC.VsrNec, 4), 'ton',
      undefined, resC.necesitaEstribos ? '→ Requiere estribos de diseño' : '→ Solo estribos mínimos')
  )

  // Paso 4
  html += paso('4', 'Separación de estribos · NTC-2023 ecs. 5.5.3.6.1.b y 14.4', '#dde1ec',
    linea('Av', `Av = ${nramas} ramas × A_varilla #${varEstNum}`, `${nramas} × ${resC.ve?.area}`, fmt(resC.Av, 2), 'cm²') +
    linea('S_calc', 'S = FR · Av · fy · d / VSR_nec',
      `${resC.FR} × ${fmt(resC.Av, 2)} × ${fy} × ${fmt(resC.d, 2)} / ${fmt(resC.VsrNec * 1000, 2)}`,
      resC.SCalc ? fmt(resC.SCalc, 2) : '—', 'cm') +
    linea('S_max', null, null, fmt(resC.SmaxGeom, 2), 'cm') +
    linea('S_min', 'S_min = 6 cm [requisito constructivo]', null, '6', 'cm') +
    `<div style="margin:8px 0;padding:10px 14px;border-radius:6px;background:#f8fafc;border:1px solid #cbd5e1;font-size:13px"><b>S adoptado = </b><span style="font-family:'Courier New',monospace;font-weight:800;font-size:18px;color:#1e40af">${resC.Suso} cm</span><span style="color:#6b7280;margin-left:8px">E #${varEstNum} @ ${resC.Suso} cm (${nramas} ramas)</span></div>`
  )

  // Paso 5
  html += paso('5', 'Resistencia total Vr · NTC-2023 ec. 5.5.1.1', '#dde1ec',
    linea('VSR', 'VSR = FR · Av · fy · d / S [ton]',
      `${resC.FR} × ${fmt(resC.Av, 2)} × ${fy} × ${fmt(resC.d, 2)} / ${resC.Suso}`,
      fmt(resC.VsrReal, 4), 'ton') +
    linea('Vr', 'Vr = VCR + VSR [ton]', `${fmt(resC.Vcr, 4)} + ${fmt(resC.VsrReal, 4)}`,
      fmt(resC.Vr, 4), 'ton', resC.okVr, `Vu = ${fmt(VuTon, 4)} ton`)
  )

  html += `<div class="vfinal ${resC.okVr ? 'vfinal-ok' : 'vfinal-fail'}">${resC.okVr
    ? `✓ DISEÑO VÁLIDO — E #${varEstNum} @ ${resC.Suso} cm (${nramas} ramas) — Vr = ${fmt(resC.Vr, 4)} ton ≥ Vu = ${fmt(VuTon, 4)} ton`
    : resC.seccionInsuficiente
      ? '✗ SECCIÓN INSUFICIENTE — Vu supera Va_max — Redimensionar sección'
      : `✗ DISEÑO NO VÁLIDO — Vr = ${fmt(resC.Vr, 4)} ton < Vu = ${fmt(VuTon, 4)} ton`}</div>`

  return html
}

// ═══════════════════════════════════════════════════════════════
// Main export
// ═══════════════════════════════════════════════════════════════
export function generateDetailedReport(sections, projectName = '') {
  const logob64 = btoa(unescape(encodeURIComponent(LOGO_SVG)))
  const now = new Date()
  const dateStr = now.toLocaleDateString('es-MX') + ' — ' + now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

  const summaryRows = []

  let sectionsHTML = ''
  sections.forEach((t, idx) => {
    const calc = t.calc || {}
    const fc = +t.fc || 250
    const fy = +calc.fy || 4200
    const b = +t.ancho, h = +t.peralte, r = +t.recub || 3
    const MuP = +(calc.MuP || t.muPos || 0)
    const MuN = +(calc.MuN || t.muNeg || 0)
    const VuTon = +(calc.VuTon || t.vu || 0)
    const L = +(calc.L || 0)
    const varEstNum = +(calc.varEstNum || CAL_TO_NUM[t.calEst] || 2)
    const nramas = +(calc.nramas || 2)

    // Run flexion calcs
    let resP = null, resN = null
    if (MuP > 0 || +t.cantInf > 0) {
      resP = calcFlexion({
        fc, fy, b, h, r, MuTm: MuP,
        varNum: +(calc.varPNum || CAL_TO_NUM[t.calInf] || 3),
        varCount: +(calc.varPCount || t.cantInf || 0) || null,
        bastonNum: +(calc.bastonPNum || CAL_TO_NUM[t.calBastonInf] || 3),
        bastonCount: +(calc.bastonPCount || t.cantBastonInf || 0),
      })
      if (resP.error) resP = null
    }
    if (MuN > 0 || +t.cantSup > 0) {
      resN = calcFlexion({
        fc, fy, b, h, r, MuTm: MuN,
        varNum: +(calc.varNNum || CAL_TO_NUM[t.calSup] || 3),
        varCount: +(calc.varNCount || t.cantSup || 0) || null,
        bastonNum: +(calc.bastonNNum || CAL_TO_NUM[t.calBastonSup] || 3),
        bastonCount: +(calc.bastonNCount || t.cantBastonSup || 0),
      })
      if (resN.error) resN = null
    }

    // AsUsada for shear
    const AsUsada = +(calc.asManual != null ? calc.asManual :
      Math.max(resP?.AsTotal || 0, resN?.AsTotal || 0) || 4.52)

    // Run shear calc
    let resC = null
    if (VuTon > 0) {
      resC = calcCortante({
        fc, fy, b, h, r, L, VuTon, AsUsada,
        varEstNum, nramas,
        conCompresion: calc.conCompresion, MuCorte: +(calc.MuCorte || 0),
      })
    }

    const hasFlex = resP || resN
    const hasCort = resC && resC.Vr > 0
    const flexOk = (!resP || (resP.okMR && resP.okMin && resP.okMax && resP.okBmin)) &&
      (!resN || (resN.okMR && resN.okMin && resN.okMax && resN.okBmin))
    const cortOk = !hasCort || resC.okVr
    const allOk = flexOk && cortOk
    const hasData = hasFlex || hasCort

    summaryRows.push({ nombre: t.nombre, bxh: `${b}×${h}`, ok: allOk, hasData })

    // Build section HTML
    sectionsHTML += `<div class="${idx > 0 ? 'section-page' : ''}">`
    sectionsHTML += `<div style="border-bottom:2px solid #4ecac4;padding-bottom:14px;margin-bottom:24px">
      <div style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.02em">MEMORIA DE CÁLCULO — ${t.nombre || 'SECCIÓN'}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:4px">Norma: NTC-2023 · Concreto Reforzado · Método de Diseño por Resistencia</div>
    </div>`

    // Input data
    sectionsHTML += `<div style="margin-bottom:16px"><div style="font-weight:700;font-size:13px;color:#374151;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #d1d5db;padding-bottom:4px;margin-bottom:10px">Datos de entrada</div>`
    sectionsHTML += `<div class="data-grid">${[
      ["f'c", fc, 'kg/cm²'], ['fy', fy, 'kg/cm²'], ['b', b, 'cm'], ['h', h, 'cm'],
      ['r', r, 'cm'], ['d', h - r, 'cm'], ['FR (flex)', 0.9, ''], ['FR (cort)', 0.75, '']
    ].map(([l, v, u]) => `<div><span class="l">${l}:</span> <span class="v">${v}</span>${u ? ` <span class="u">${u}</span>` : ''}</div>`).join('')}</div></div>`

    // Flexion
    if (hasFlex) {
      sectionsHTML += `<div style="font-size:16px;font-weight:800;color:#0f172a;border-bottom:2px solid #1d4ed8;padding-bottom:8px;margin-bottom:20px;text-transform:uppercase;letter-spacing:0.04em">Revisión por flexión</div>`
      if (MuP > 0 && resP) {
        sectionsHTML += renderFlexion(resP, '▲ MOMENTO POSITIVO (M+) — Lecho inferior', MuP, '#1d4ed8', fc, fy, b, h, r)
      }
      if (MuN > 0 && resN) {
        sectionsHTML += renderFlexion(resN, '▼ MOMENTO NEGATIVO (M−) — Lecho superior', MuN, '#b45309', fc, fy, b, h, r)
      }
    }

    // Shear
    if (hasCort && VuTon > 0) {
      sectionsHTML += renderCortante(resC, fc, fy, b, h, r, VuTon, L, AsUsada, varEstNum, nramas)
    }

    if (!hasData) {
      sectionsHTML += `<div style="padding:20px;text-align:center;color:#6b7280;font-size:14px">Sin datos de cálculo para esta sección. Ingrese momentos y/o cortante en la pestaña Cálculo.</div>`
    }

    // Footer per section
    sectionsHTML += `<div style="border-top:2px solid #4ecac4;padding-top:10px;margin-top:24px;font-size:10px;color:#9ca3af;text-align:right">IV Ingenierías · Auxiliar IV v0.2 NTC-2023 · (q conforme NTC-2017, ver nota)</div>`
    sectionsHTML += '</div>'
  })

  // Summary page
  let summaryHTML = `<div class="section-page">
    <div style="font-size:20px;font-weight:800;color:#0f172a;margin-bottom:20px">RESUMEN DE VERIFICACIÓN</div>
    <table class="summary">
      <tr><th>#</th><th>Sección</th><th>Dimensiones</th><th>Estado</th></tr>
      ${summaryRows.map((r, i) => `<tr>
        <td>${i + 1}</td><td>${r.nombre}</td><td>${r.bxh} cm</td>
        <td style="color:${!r.hasData ? '#92400e' : r.ok ? '#15803d' : '#dc2626'};font-weight:700">
          ${!r.hasData ? 'Sin datos' : r.ok ? '✓ CUMPLE' : '✗ NO CUMPLE'}
        </td>
      </tr>`).join('')}
    </table>
    <div style="margin-top:20px;font-size:10px;color:#9ca3af">
      Generado con Auxiliar IV v0.2 — ${dateStr}<br>
      Secciones: ${sections.length}
    </div>
  </div>`

  // Brand header
  const brandHeader = `<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #4ecac4;padding-bottom:10px;margin-bottom:6px">
    <div>
      <div style="font-size:8pt;color:#6b7280;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:2px">Método de Diseño por Resistencia · NTC-2023</div>
      <div style="font-size:11pt;font-weight:800;color:#1b2349;letter-spacing:-0.01em">IV Ingenierías</div>
      <div style="font-size:8pt;color:#9ca3af;margin-top:2px">${projectName ? `Proyecto: ${projectName} — ` : ''}${dateStr}</div>
    </div>
    <img src="data:image/svg+xml;base64,${logob64}" style="width:48px;opacity:0.85" alt="IV"/>
  </div>`

  // Open print window
  const w = window.open('', '_blank')
  w.document.write(`<html><head><title>Memoria de Cálculo${projectName ? ` — ${projectName}` : ''}</title>
    <style>${CSS}</style>
  </head><body>
    ${brandHeader}
    ${sectionsHTML}
    ${summaryHTML}
  </body></html>`)
  w.document.close()
  setTimeout(() => w.print(), 800)
}
