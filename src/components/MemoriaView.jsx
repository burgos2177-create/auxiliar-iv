// ══════════════════════════════════════════════════════════════
// Memoria de Cálculo — step-by-step calculation report
// Extracted from DisenoVigas_2.html (MemoriaFlexion + MemoriaCortante)
// ══════════════════════════════════════════════════════════════

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

const PRINT_STYLE = `
  body { font-family:'IBM Plex Sans',Arial,sans-serif; margin:18mm 15mm; color:#111; }
  @media print { body { margin:10mm 12mm; } }
`

function printDoc(elId, title) {
  const el = document.getElementById(elId)
  if (!el) return
  const logob64 = btoa(unescape(encodeURIComponent(LOGO_SVG)))
  const clone = el.innerHTML

  const brandHeader = `
    <div style="display:flex;align-items:center;justify-content:space-between;
      border-bottom:2px solid #4ecac4;padding-bottom:10px;margin-bottom:6px;">
      <div>
        <div style="font-size:8pt;color:#6b7280;letter-spacing:0.08em;
          text-transform:uppercase;margin-bottom:2px;">
          Método de Diseño por Resistencia · NTC-2023
        </div>
        <div style="font-size:11pt;font-weight:800;color:#1b2349;letter-spacing:-0.01em;">
          IV Ingenierías
        </div>
      </div>
      <img src="data:image/svg+xml;base64,${logob64}"
        style="width:48px;opacity:0.85;" alt="IV Ingenierías"/>
    </div>`

  const w = window.open('', '_blank')
  w.document.write(`<html><head><title>${title}</title>
    <style>${PRINT_STYLE}</style>
    </head><body>
    ${brandHeader}
    ${clone}
    </body></html>`)
  w.document.close()
  setTimeout(() => w.print(), 700)
}

// ── Step block container ─────────────────────────────────────
function PasoBloque({ id, num, titulo, color = '#dde1ec', children }) {
  return (
    <div id={id} style={{
      marginBottom: 18, breakInside: 'avoid',
      border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden',
    }}>
      <div style={{ background: color, color: '#fff',
        padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 13, opacity: 0.7 }}>{num}</span>
        <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.04em' }}>{titulo}</span>
      </div>
      <div style={{ padding: '10px 14px', background: '#fff' }}>{children}</div>
    </div>
  )
}

// ── Calculation line ─────────────────────────────────────────
function Linea({ simbolo, formula, sust, resultado, unidad, ok, nota }) {
  return (
    <div style={{ marginBottom: 8 }}>
      {formula && <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'Georgia,serif', marginBottom: 2 }}>{formula}</div>}
      {sust && (
        <div style={{ fontSize: 12, color: '#374151', fontFamily: "'DM Mono',monospace", marginBottom: 2 }}>
          {simbolo && <span style={{ fontWeight: 700 }}>{simbolo} = </span>}{sust}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {resultado !== undefined && (
          <div style={{
            display: 'inline-block',
            background: ok === undefined ? '#f0f9ff' : ok ? '#f0fdf4' : '#fef2f2',
            border: `1.5px solid ${ok === undefined ? '#bae6fd' : ok ? '#86efac' : '#fca5a5'}`,
            borderRadius: 4, padding: '3px 12px',
            fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 13,
            color: ok === undefined ? '#0369a1' : ok ? '#15803d' : '#dc2626',
          }}>
            {simbolo && !sust && <span>{simbolo} = </span>}{resultado}
            {unidad && <span style={{ fontWeight: 400, fontSize: 11, marginLeft: 4 }}>{unidad}</span>}
          </div>
        )}
        {ok !== undefined && (
          <span style={{ fontWeight: 700, fontSize: 12, color: ok ? '#15803d' : '#dc2626' }}>
            {ok ? '✓ CUMPLE' : '✗ NO CUMPLE'}
          </span>
        )}
        {nota && <span style={{ fontSize: 11, color: '#6b7280' }}>{nota}</span>}
      </div>
    </div>
  )
}

// ── Flexion section ──────────────────────────────────────────
function SeccionFlexion({ res, lecho, Mu, acento, pfx, fc, fy, b, h, r, fcRed }) {
  if (!res || res.error) return <div style={{ color: '#dc2626', padding: 12 }}>Error: {res?.error}</div>
  const MuKgcm = Mu * 100000

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ background: acento, color: '#fff', padding: '8px 16px',
        borderRadius: 6, fontWeight: 800, fontSize: 15, marginBottom: 16 }}>
        {lecho}  —  Mu = {fmt(Mu, 4)} ton·m
      </div>

      <PasoBloque id={`${pfx}-paso1`} num="1" titulo="Propiedades del concreto y geometría  ·  NTC-2023 art. 5.2.1.3.1">
        <Linea simbolo="f''c" formula="f''c = 0.85 × f'c" sust={`0.85 × ${fc}`} resultado={fmt(fcRed)} unidad="kg/cm²"/>
        <Linea simbolo="d" formula="d = h − r" sust={`${h} − ${r}`} resultado={fmt(res.d, 2)} unidad="cm"/>
        <Linea simbolo="Mu" formula="Mu [kg·cm] = Mu [ton·m] × 100,000"
          sust={`${fmt(Mu,4)} × 100,000`} resultado={fmt(MuKgcm, 0)} unidad="kg·cm"/>
      </PasoBloque>

      <PasoBloque id={`${pfx}-paso2`} num="2" titulo="Coeficiente de resistencia nominal Rn  ·  NTC-2023 ec. 5.2.2.1.1.1.b (despejada)">
        <Linea simbolo="Rn" formula="Rn = Mu / (FR × b × d²)"
          sust={`${fmt(MuKgcm,0)} / (${res.FR} × ${b} × ${fmt(res.d,2)}²)`}
          resultado={fmt(res.Rn)} unidad="kg/cm²"/>
      </PasoBloque>

      <PasoBloque id={`${pfx}-paso3`} num="3" titulo="Cuantía de acero requerida ρ  ·  NTC-2023 ec. 5.2.2.1.1.1.b (invertida)">
        <Linea formula="ρ = (f''c / fy) × [1 − √(1 − 2·Rn / f''c)]"
          sust={`(${fmt(fcRed,2)} / ${fy}) × [1 − √(1 − 2×${fmt(res.Rn)} / ${fmt(fcRed,2)})]`}
          simbolo="ρ" resultado={fmt(res.rhoCalc, 6)}/>
        <Linea simbolo="As calc" formula="As_calc = ρ × b × d"
          sust={`${fmt(res.rhoCalc,6)} × ${b} × ${fmt(res.d,2)}`}
          resultado={fmt(res.AsCalc)} unidad="cm²"/>
      </PasoBloque>

      <PasoBloque id={`${pfx}-paso4`} num="4" titulo="Verificación: Acero mínimo  ·  NTC-2023 art. 5.2.3">
        <Linea simbolo="As_min" formula="As_min = (0.7 × √f'c / fy) × b × d"
          sust={`(0.7 × √${fc} / ${fy}) × ${b} × ${fmt(res.d,2)}`}
          resultado={fmt(res.AsMin)} unidad="cm²"/>
        <Linea simbolo="As req" formula="As_req = máx(As_calc, As_min)"
          sust={`máx(${fmt(res.AsCalc)}, ${fmt(res.AsMin)})`}
          resultado={fmt(res.AsReq)} unidad="cm²"/>
      </PasoBloque>

      <PasoBloque id={`${pfx}-paso5`} num="5" titulo="Verificación: Acero máximo — falla balanceada  ·  NTC-2023 arts. 5.2.1.3.1 y 6.3.5.2.1">
        <Linea simbolo="β1"
          formula={fc <= 280 ? 'β1 = 0.85  (f\'c ≤ 280 kg/cm²)' : 'β1 = 0.85 − 0.05×(f\'c−280)/70'}
          resultado={fmt(res.b1, 2)}/>
        <Linea simbolo="ρ_bal"
          formula="ρ_bal = (β1 × f''c / fy) × (6000 / (6000 + fy))  [NTC-2023 ec. 5.2.1.3.1]"
          sust={`(${fmt(res.b1,2)} × ${fmt(fcRed,2)} / ${fy}) × (6000 / (6000 + ${fy}))`}
          resultado={fmt(res.rhoBal, 6)}/>
        <Linea simbolo="As_bal" formula="As_bal = ρ_bal × b × d"
          sust={`${fmt(res.rhoBal,6)} × ${b} × ${fmt(res.d,2)}`}
          resultado={fmt(res.AsBal)} unidad="cm²"/>
        <Linea simbolo="As_max"
          formula="As_max = 0.90 × As_bal  [NTC-2023 art. 6.3.5.2.1: no excederá 90% del área balanceada]"
          sust={`0.90 × ${fmt(res.AsBal)}`}
          resultado={fmt(res.AsMax)} unidad="cm²"/>
      </PasoBloque>

      <PasoBloque id={`${pfx}-paso6`} num="6" titulo="Selección de varillas  ·  NTC-2023 art. 5.2.2.1.1.1" color="#374151">
        <Linea simbolo="Varilla"
          resultado={`#${res.vr.num}  (Ø = ${(res.vr.diam*10).toFixed(1)} mm,  A = ${res.vr.area} cm²)`}/>
        <Linea simbolo="n calc" formula="n_calc = ⌈As_req / A_varilla⌉"
          sust={`⌈${fmt(res.AsReq)} / ${res.vr.area}⌉`} resultado={`${res.nCalc} varillas`}/>
        <Linea simbolo="n usado" resultado={`${res.nUsed} varillas`}/>
        <Linea simbolo="As_barras" formula="As_barras = n × A_varilla"
          sust={`${res.nUsed} × ${res.vr.area}`} resultado={fmt(res.AsBarras)} unidad="cm²"/>
        {res.nBastones > 0 && <>
          <Linea simbolo="Bastón" resultado={`#${res.vb.num}  (A = ${res.vb.area} cm²)`}/>
          <Linea simbolo="As_bastones" formula="As_bastones = n_bastones × A_bastón"
            sust={`${res.nBastones} × ${res.vb.area}`} resultado={fmt(res.AsBastones)} unidad="cm²"/>
        </>}
        <Linea simbolo="As_total" formula="As_total = As_barras + As_bastones"
          sust={`${fmt(res.AsBarras)} + ${fmt(res.AsBastones)}`}
          resultado={fmt(res.AsTotal)} unidad="cm²"/>
      </PasoBloque>

      <PasoBloque id={`${pfx}-paso7`} num="7" titulo="Cuantía real y parámetro q  ·  NTC-2023 ec. 5.2.2.1.1.1 (ver nota)">
        <Linea simbolo="ρ_real" formula="ρ_real = As_total / (b × d)"
          sust={`${fmt(res.AsTotal)} / (${b} × ${fmt(res.d,2)})`}
          resultado={fmt(res.rhoReal, 6)}/>
        <div style={{
          margin: '6px 0 8px', padding: '10px 14px', borderRadius: 6,
          background: '#fffbeb', border: '1px solid #f59e0b',
          fontSize: 11, color: '#78350f', lineHeight: 1.7,
        }}>
          <strong>⚠ Nota — q adoptado de NTC-2017:</strong>{' '}
          La NTC-2023 define <span style={{ fontFamily: "'DM Mono',monospace" }}>q = ρ·f&apos;&apos;c/fy</span>,
          invirtiendo el numerador y denominador respecto a la NTC-2017. Esto contradice
          el significado físico de q y produce una sobreestimación del MR. La definición congruente
          con las ecs. 5.2.2.1.1.1.a y .b es{' '}
          <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>q = ρ·fy/f&apos;&apos;c</span>,
          de la <strong>NTC-2017</strong>, que se adopta en este cálculo.
        </div>
        <Linea simbolo="q"
          formula="q = ρ_real × fy / f''c  [adoptado de NTC-2017]"
          sust={`${fmt(res.rhoReal,6)} × ${fy} / ${fmt(fcRed,2)}`}
          resultado={fmt(res.q, 6)}/>
      </PasoBloque>

      <PasoBloque id={`${pfx}-paso8`} num="8" titulo="Momento resistente MRT y MRC  ·  NTC-2023 ecs. 5.2.2.1.1.1.a y .b">
        <Linea simbolo="a" formula="a = As_total × fy / (f''c × b)"
          sust={`${fmt(res.AsTotal)} × ${fy} / (${fmt(fcRed,2)} × ${b})`}
          resultado={fmt(res.a)} unidad="cm"/>
        <Linea simbolo="MRT"
          formula="MRT = FR × As_total × fy × (d − a/2)  [NTC-2023 ec. 5.2.2.1.1.1.b]  [ton·m]"
          sust={`${res.FR} × ${fmt(res.AsTotal)} × ${fy} × (${fmt(res.d,2)} − ${fmt(res.a/2,4)}) / 100,000`}
          resultado={fmt(res.MRT, 6)} unidad="ton·m"
          ok={res.okMR} nota={`Mu = ${fmt(Mu,4)} ton·m`}/>
        <Linea simbolo="MRC"
          formula="MRC = FR × b × d² × f''c × q × (1 − 0.5q)  [NTC-2023 ec. 5.2.2.1.1.1.a]  [ton·m]"
          sust={`${res.FR} × ${b} × ${fmt(res.d,2)}² × ${fmt(fcRed,2)} × ${fmt(res.q,6)} × (1 − 0.5×${fmt(res.q,6)}) / 100,000`}
          resultado={fmt(res.MRC, 6)} unidad="ton·m"
          nota="Verificación por concreto — debe aproximarse a MRT"/>
      </PasoBloque>

      <PasoBloque id={`${pfx}-paso9`} num="9" titulo="Verificaciones finales  ·  NTC-2023 arts. 5.2.1.3.1, 5.2.3 y 6.3.5.2.1">
        <Linea simbolo="b_min" formula="b_min = 2r + (2n − 1) × Ø_varilla"
          sust={`2(${r}) + (2×${res.nUsed}−1) × ${res.vr.diam}`}
          resultado={fmt(res.bMin)} unidad="cm"
          ok={res.okBmin} nota={`b = ${b} cm`}/>
        <Linea formula="As_total ≥ As_min"
          sust={`${fmt(res.AsTotal)} ≥ ${fmt(res.AsMin)}`} ok={res.okMin}/>
        <Linea formula="As_total ≤ As_max"
          sust={`${fmt(res.AsTotal)} ≤ ${fmt(res.AsMax)}`} ok={res.okMax}/>
      </PasoBloque>

      <div style={{
        background: (res.okMR&&res.okMin&&res.okMax&&res.okBmin) ? '#f0fdf4' : '#fef2f2',
        border: `2px solid ${(res.okMR&&res.okMin&&res.okMax&&res.okBmin) ? '#86efac' : '#fca5a5'}`,
        borderRadius: 6, padding: '12px 16px', marginBottom: 8,
        fontWeight: 700, fontSize: 14,
        color: (res.okMR&&res.okMin&&res.okMax&&res.okBmin) ? '#15803d' : '#dc2626',
      }}>
        {(res.okMR&&res.okMin&&res.okMax&&res.okBmin)
          ? `✓ DISEÑO VÁLIDO — Usar ${res.nUsed} var. #${res.vr.num}${res.nBastones > 0 ? ` + ${res.nBastones} bastón(es) #${res.vb.num}` : ''} — As = ${fmt(res.AsTotal)} cm²  |  MRT = ${fmt(res.MRT,4)} ton·m ≥ Mu = ${fmt(Mu,4)} ton·m`
          : '✗ DISEÑO NO VÁLIDO — Revisar sección o varillas'}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// Main MemoriaView component
// ══════════════════════════════════════════════════════════════
export default function MemoriaView({ nombre, fc, fy, b, h, r, MuP, MuN, resP, resN, VuTon, L, AsUsada, varEstNum, nramas, resC }) {
  const fcRed = 0.85 * fc
  const hasFlex = (resP && !resP.error) || (resN && !resN.error)
  const hasCort = resC && resC.Vr > 0

  const handlePrint = () => {
    printDoc('memoria-completa-print', `Memoria de Cálculo — ${nombre || 'Sección'}`)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={handlePrint} style={{
          padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer',
          background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13,
        }}>Imprimir / Exportar PDF</button>
      </div>

      <div id="memoria-completa-print" style={{
        background: '#fff', color: '#111',
        fontFamily: "'Instrument Sans','Segoe UI',sans-serif",
        padding: '28px 32px', borderRadius: 8,
        border: '1px solid #e5e7eb', maxWidth: 860, margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{ borderBottom: '2px solid #4ecac4', paddingBottom: 14, marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            MEMORIA DE CÁLCULO — {nombre || 'SECCIÓN'}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            Norma: NTC-2023 · Concreto Reforzado · Método de Diseño por Resistencia
          </div>
        </div>

        {/* Input data summary */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#374151',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            borderBottom: '1px solid #d1d5db', paddingBottom: 4, marginBottom: 10 }}>
            Datos de entrada
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px 20px' }}>
            {[["f'c",fc,'kg/cm²'],['fy',fy,'kg/cm²'],['b',b,'cm'],['h',h,'cm'],
              ['r',r,'cm'],['d',h-r,'cm'],['FR (flexión)',0.9,''],['FR (cortante)',0.75,'']
            ].map(([lbl,val,u]) => (
              <div key={lbl} style={{ fontSize: 12, color: '#374151' }}>
                <span style={{ fontWeight: 600 }}>{lbl}:</span>{' '}
                <span style={{ fontFamily: "'DM Mono',monospace" }}>{val}</span>
                {u && <span style={{ color: '#6b7280' }}> {u}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* ═══ FLEXIÓN ═══ */}
        {hasFlex && (
          <>
            <div style={{
              fontSize: 16, fontWeight: 800, color: '#0f172a',
              borderBottom: '2px solid #1d4ed8', paddingBottom: 8, marginBottom: 20,
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              Revisión por flexión
            </div>
            {+(MuP || 0) > 0 && resP && !resP.error && (
              <SeccionFlexion res={resP} lecho="▲  MOMENTO POSITIVO (M+)  —  Lecho inferior"
                Mu={MuP} acento="#1d4ed8" pfx="mp" fc={fc} fy={fy} b={b} h={h} r={r} fcRed={fcRed} />
            )}
            {+(MuN || 0) > 0 && resN && !resN.error && (
              <SeccionFlexion res={resN} lecho="▼  MOMENTO NEGATIVO (M−)  —  Lecho superior"
                Mu={MuN} acento="#b45309" pfx="mn" fc={fc} fy={fy} b={b} h={h} r={r} fcRed={fcRed} />
            )}
          </>
        )}

        {/* ═══ CORTANTE ═══ */}
        {hasCort && +(VuTon || 0) > 0 && (
          <>
            <div style={{
              fontSize: 16, fontWeight: 800, color: '#0f172a',
              borderBottom: '2px solid #9333ea', paddingBottom: 8, marginBottom: 20,
              marginTop: 32, textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              Revisión por cortante
            </div>

            {/* Cortante input data */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px 20px' }}>
                {[['L',L,'m'],['Vu',VuTon,'ton'],['As usada',AsUsada,'cm²'],
                  [`E #${varEstNum}`,resC.ve?.area,'cm²'],['Ramas',nramas,'']
                ].map(([lbl,val,u]) => (
                  <div key={lbl} style={{ fontSize: 12, color: '#374151' }}>
                    <span style={{ fontWeight: 600 }}>{lbl}:</span>{' '}
                    <span style={{ fontFamily: "'DM Mono',monospace" }}>{val}</span>
                    {u && <span style={{ color: '#6b7280' }}> {u}</span>}
                  </div>
                ))}
              </div>
            </div>

            <PasoBloque id="c-paso1" num="1" titulo="Geometría y cuantía longitudinal  ·  NTC-2023 art. 5.3">
              <Linea simbolo="d" formula="d = h − r" sust={`${h} − ${r}`} resultado={fmt(resC.d,2)} unidad="cm"/>
              <Linea simbolo="L/h" formula="L/h = L[cm] / h" sust={`${L*100} / ${h}`} resultado={fmt(resC.lh,2)}/>
              <div style={{ marginTop:6, padding:'6px 10px', background:
                resC.lhZone==='mayor5' ? '#f0fdf4' : resC.lhZone==='entre4y5' ? '#fffbeb' : '#fef2f2',
                border:`1px solid ${resC.lhZone==='mayor5'?'#86efac':resC.lhZone==='entre4y5'?'#fcd34d':'#fca5a5'}`,
                borderRadius:4, fontSize:11,
                color: resC.lhZone==='mayor5'?'#15803d':resC.lhZone==='entre4y5'?'#92400e':'#dc2626' }}>
                {resC.lhZone==='mayor5' && '✓ L/h > 5 — se aplican ecs. 5.3.1 / 5.3.2 directamente'}
                {resC.lhZone==='entre4y5' && '⚠ 4 ≤ L/h ≤ 5 — NTC-2023 indica cambiar dimensiones; se calcula con ecs. 5.3.1/5.3.2 como aproximación'}
                {resC.lhZone==='menor4' && '⚠ L/h < 4 — viga de gran peralte; se usa ec. 5.3.2 como aproximación conservadora'}
              </div>
              <Linea simbolo="ρ" formula="ρ = As / (b × d)"
                sust={`${AsUsada} / (${b} × ${fmt(resC.d,2)})`}
                resultado={fmt(resC.rho,6)}
                nota={resC.rho < 0.015 ? '→ ρ < 0.015: usar ec. 5.3.1' : '→ ρ ≥ 0.015: usar ec. 5.3.2'}/>
            </PasoBloque>

            <PasoBloque id="c-paso2" num="2" titulo={`Resistencia a cortante del concreto VCR  ·  NTC-2023 ec. 5.5.3.1.1 (λ=1, Pu=0)`}>
              <Linea simbolo="VCR_a"
                formula="VCR_a = FR · 0.5 · λ · √f'c · b · d  [ec. 5.5.3.1.1.a]"
                sust={`${resC.FR} × 0.5 × 1 × √${fc} × ${b} × ${fmt(resC.d,2)}`}
                resultado={fmt(resC.VCR_a*1000,2)} unidad="kg"/>
              <Linea simbolo="VCR_b"
                formula="VCR_b = FR · 2 · λ · ρ^(1/3) · √f'c · b · d  [ec. 5.5.3.1.1.b]"
                sust={`${resC.FR} × 2 × 1 × ${fmt(resC.rho,6)}^(1/3) × √${fc} × ${b} × ${fmt(resC.d,2)}`}
                resultado={fmt(resC.VCR_b*1000,2)} unidad="kg"/>
              <Linea
                formula="Se usa la mayor de VCR_a y VCR_b, acotada a [VCR_min, VCR_max]"
                nota={`Mayor = ${resC.VCR_b >= resC.VCR_a ? 'VCR_b → ec. 5.5.3.1.1.b' : 'VCR_a → ec. 5.5.3.1.1.a'}`}/>
              <Linea simbolo="VCR_min"
                formula="VCR_min = FR · 0.25 · √f'c · b · d  [NTC-2023 ec. 5.5.3.1.2.a]"
                sust={`${resC.FR} × 0.25 × √${fc} × ${b} × ${fmt(resC.d,2)}`}
                resultado={fmt(resC.VCR_min*1000,2)} unidad="kg"/>
              <Linea simbolo="VCR_max"
                formula="VCR_max = FR · 1.25 · √f'c · b · d  [NTC-2023 ec. 5.5.3.1.2.a]"
                sust={`${resC.FR} × 1.25 × √${fc} × ${b} × ${fmt(resC.d,2)}`}
                resultado={fmt(resC.VCR_max*1000,2)} unidad="kg"/>
              <Linea simbolo="VCR adoptado" resultado={fmt(resC.Vcr,4)} unidad="ton"/>
            </PasoBloque>

            <PasoBloque id="c-paso2b" num="2b" titulo="Verificación límite de sección  ·  NTC-2023 ec. 5.5.2.2" color="#374151">
              <Linea simbolo="Va_max"
                formula="Va_max = VCR + FR · 2.2 · √f'c · b · d  [ec. 5.5.2.2]"
                sust={`${fmt(resC.Vcr*1000,2)} + ${resC.FR} × 2.2 × √${fc} × ${b} × ${fmt(resC.d,2)}`}
                resultado={fmt(resC.VaMax*1000,2)} unidad="kg"
                ok={resC.okVaMax} nota={`Vu = ${fmt(VuTon*1000,2)} kg`}/>
              {resC.seccionInsuficiente && (
                <div style={{ padding:'6px 10px', background:'#fef2f2', border:'1px solid #fca5a5',
                  borderRadius:4, fontSize:11, color:'#dc2626', fontWeight:700 }}>
                  ⚠ Vu &gt; Va_max — La sección debe redimensionarse (NTC-2023 ec. 5.5.2.2)
                </div>
              )}
            </PasoBloque>

            <PasoBloque id="c-paso3" num="3" titulo="Cortante que debe tomar el acero VSR  ·  NTC-2023 ec. 5.5.1.1">
              <Linea simbolo="VSR_nec"
                formula="VSR_nec = Vu − VCR  [ton]"
                sust={`${fmt(VuTon,4)} − ${fmt(resC.Vcr,4)}`}
                resultado={fmt(resC.VsrNec,4)} unidad="ton"
                nota={resC.necesitaEstribos ? '→ Requiere estribos de diseño' : '→ Solo estribos mínimos'}/>
            </PasoBloque>

            <PasoBloque id="c-paso4" num="4" titulo="Separación de estribos  ·  NTC-2023 ecs. 5.5.3.6.1.b y 14.4">
              <Linea simbolo="Av"
                formula={`Av = ${nramas} ramas × A_varilla #${varEstNum}  [ec. 5.5.3.6.2]`}
                sust={`${nramas} × ${resC.ve?.area}`}
                resultado={fmt(resC.Av,2)} unidad="cm²"/>
              <Linea simbolo="S_calc"
                formula="S = FR · Av · fy · d / VSR_nec  [ec. 5.5.3.6.1.b]"
                sust={`${resC.FR} × ${fmt(resC.Av,2)} × ${fy} × ${fmt(resC.d,2)} / ${fmt(resC.VsrNec*1000,2)}`}
                resultado={resC.SCalc ? fmt(resC.SCalc,2) : '—'} unidad="cm"/>
              <Linea simbolo="S_max"
                formula={resC.VsrNec*1000 > resC.FR*1.1*Math.sqrt(fc)*b*resC.d
                  ? 'S_max = min(d/4, 60 cm)  [VSR_nec > FR·1.1√f\'c·b·d]'
                  : 'S_max = min(d/2, 60 cm)  [VSR_nec ≤ FR·1.1√f\'c·b·d]'}
                resultado={fmt(resC.SmaxGeom,2)} unidad="cm"/>
              <Linea simbolo="S_min" formula="S_min = 6 cm  [requisito constructivo NTC-2023 art. 14.4]"
                resultado="6" unidad="cm"/>
              {resC.SminAlert && (
                <div style={{ marginTop:4, padding:'6px 10px', background:'#fffbeb',
                  border:'1px solid #fcd34d', borderRadius:4, fontSize:11, color:'#92400e', fontWeight:700 }}>
                  ⚠ S calculado ({fmt(resC.SCalc,2)} cm) &lt; 6 cm — Se adopta S = 6 cm.
                </div>
              )}
              <div style={{ marginTop:8, padding:'10px 14px', borderRadius:6,
                background:'#f8fafc', border:'1px solid #cbd5e1', fontSize:13 }}>
                <span style={{ fontWeight:700 }}>S adoptado = </span>
                <span style={{ fontFamily:"'DM Mono',monospace", fontWeight:800,
                  fontSize:18, color: resC.SminAlert ? '#d97706' : '#1e40af' }}>{resC.Suso} cm</span>
                <span style={{ color:'#6b7280', marginLeft:8 }}>
                  E #{varEstNum} @ {resC.Suso} cm ({nramas} ramas)
                </span>
              </div>
            </PasoBloque>

            <PasoBloque id="c-paso5" num="5" titulo="Resistencia total Vr  ·  NTC-2023 ec. 5.5.1.1">
              <Linea simbolo="VSR"
                formula="VSR = FR · Av · fy · d / S  [ec. 5.5.3.6.1.b]  [ton]"
                sust={`${resC.FR} × ${fmt(resC.Av,2)} × ${fy} × ${fmt(resC.d,2)} / ${resC.Suso}`}
                resultado={fmt(resC.VsrReal,4)} unidad="ton"/>
              <Linea simbolo="Vr"
                formula="Vr = VCR + VSR  [ec. 5.5.1.1]  [ton]"
                sust={`${fmt(resC.Vcr,4)} + ${fmt(resC.VsrReal,4)}`}
                resultado={fmt(resC.Vr,4)} unidad="ton"
                ok={resC.okVr} nota={`Vu = ${fmt(VuTon,4)} ton`}/>
            </PasoBloque>

            {/* Conclusion */}
            <div style={{
              background: resC.okVr ? '#f0fdf4' : '#fef2f2',
              border: `2px solid ${resC.okVr?'#86efac':'#fca5a5'}`,
              borderRadius: 6, padding: '12px 16px', marginBottom: 8,
              fontWeight: 700, fontSize: 14,
              color: resC.okVr ? '#15803d' : '#dc2626',
            }}>
              {resC.okVr
                ? `✓ DISEÑO VÁLIDO — E #${varEstNum} @ ${resC.Suso} cm (${nramas} ramas)${resC.SminAlert?' [S = mín. 6 cm]':''} — Vr = ${fmt(resC.Vr,4)} ton ≥ Vu = ${fmt(VuTon,4)} ton`
                : resC.seccionInsuficiente
                  ? '✗ SECCIÓN INSUFICIENTE — Vu supera Va_max (ec. 5.5.2.2) — Redimensionar sección'
                  : `✗ DISEÑO NO VÁLIDO — Vr = ${fmt(resC.Vr,4)} ton < Vu = ${fmt(VuTon,4)} ton — Reducir S o aumentar estribos`}
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ borderTop: '2px solid #4ecac4', paddingTop: 10, marginTop: 24,
          fontSize: 10, color: '#9ca3af', textAlign: 'right' }}>
          IV Ingenierías · Auxiliar IV NTC-2023 · (q conforme NTC-2017, ver nota)
        </div>
      </div>
    </div>
  )
}
