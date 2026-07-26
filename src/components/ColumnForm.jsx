import useColumnStore from '../store/useColumnStore'
import { BD_VARILLAS, bdLookup } from '../core/columnCalculator'

const NUM_OPTS = BD_VARILLAS.filter((v) => v.num >= 3).map((v) => v.num)
const EST_OPTS = [2, 2.5, 3, 4]

function Field({ label, children }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  )
}
const Row = ({ children }) => <div className="grid grid-cols-2 gap-2">{children}</div>

export default function ColumnForm() {
  const form = useColumnStore((s) => s.form)
  const set = useColumnStore((s) => s.setForm)
  const setLecho = useColumnStore((s) => s.setLecho)
  const selectedIdx = useColumnStore((s) => s.selectedIdx)
  const columns = useColumnStore((s) => s.columns)

  const hasSel = selectedIdx >= 0 && selectedIdx < columns.length
  const num = (k) => (e) => set({ [k]: e.target.value === '' ? '' : Number(e.target.value) })

  if (!hasSel) {
    return (
      <div className="sidebar">
        <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          Crea una columna con el bot&oacute;n &ldquo;+ Nueva&rdquo;
        </div>
      </div>
    )
  }

  return (
    <div className="sidebar">
      <div>
        <div className="section-title">Identificaci&oacute;n</div>
        <div className="mt-2">
          <Field label="Nombre de columna">
            <input className="field-input" value={form.nombre} onChange={(e) => set({ nombre: e.target.value })} placeholder="ej: C-1" />
          </Field>
        </div>
      </div>

      <div>
        <div className="section-title">Geometr&iacute;a (cm)</div>
        <div className="mt-2 flex flex-col gap-2">
          <Row>
            <Field label="Base (b)">
              <input className="field-input" type="number" min="10" max="200" value={form.b} onChange={num('b')} />
            </Field>
            <Field label="Peralte (h)">
              <input className="field-input" type="number" min="10" max="200" value={form.h} onChange={num('h')} />
            </Field>
          </Row>
          <Row>
            <Field label="Recubrimiento (r)">
              <input className="field-input" type="number" min="1" max="10" step="0.5" value={form.r} onChange={num('r')} />
            </Field>
            <Field label="f'c (kg/cm²)">
              <input className="field-input" type="number" min="100" max="700" step="10" value={form.fc} onChange={num('fc')} />
            </Field>
          </Row>
          <Row>
            <Field label="fy (kg/cm²)">
              <input className="field-input" type="number" min="2000" max="6000" step="100" value={form.fy} onChange={num('fy')} />
            </Field>
            <Field label="εc (concreto)">
              <input className="field-input" type="number" min="0.002" max="0.004" step="0.0005" value={form.epsC} onChange={num('epsC')} />
            </Field>
          </Row>
        </div>
      </div>

      <div>
        <div className="section-title" style={{ color: 'var(--color-steel-top)' }}>Acero longitudinal</div>
        <div className="mt-2 flex flex-col gap-2">
          <Field label="N&uacute;mero de lechos (2–8)">
            <input className="field-input" type="number" min="2" max="8" step="1" value={form.nLechos} onChange={num('nLechos')} />
          </Field>
          {(form.lechos || []).map((L, i) => (
            <div key={i} style={{ paddingLeft: 8, borderLeft: '2px solid var(--color-steel-top)' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)', marginBottom: 3, textTransform: 'uppercase' }}>
                Lecho {i + 1}{i === 0 ? ' · cara sup.' : i === form.lechos.length - 1 ? ' · cara inf.' : ''}
              </div>
              <Row>
                <Field label="Varillas (n)">
                  <input className="field-input" type="number" min="1" max="12" step="1" value={L.n}
                    onChange={(e) => setLecho(i, { n: e.target.value === '' ? '' : Number(e.target.value) })} />
                </Field>
                <Field label="Calibre (#)">
                  <select className="field-select" value={L.num} onChange={(e) => setLecho(i, { num: e.target.value })}>
                    {NUM_OPTS.map((n) => <option key={n} value={n}>#{n}</option>)}
                  </select>
                </Field>
              </Row>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)', marginTop: 2 }}>
                As = {(bdLookup(L.num).area * (+L.n || 0)).toFixed(2)} cm²
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="section-title" style={{ color: '#9333ea' }}>Elementos mec&aacute;nicos (&uacute;ltimos)</div>
        <div className="mt-2 flex flex-col gap-2">
          <Field label="Pu — carga axial (ton)">
            <input className="field-input" type="number" step="0.01" value={form.Pu} onChange={num('Pu')} />
          </Field>
          <Row>
            <Field label="Mux (ton·m)">
              <input className="field-input" type="number" step="0.01" value={form.MuX} onChange={num('MuX')} />
            </Field>
            <Field label="Muy (ton·m)">
              <input className="field-input" type="number" step="0.01" value={form.MuY} onChange={num('MuY')} />
            </Field>
          </Row>
        </div>
      </div>

      <div>
        <div className="section-title" style={{ color: 'var(--color-accent2)' }}>Estribos</div>
        <div className="mt-2">
          <Field label="Calibre del estribo (#)">
            <select className="field-select" value={form.estriboNum} onChange={(e) => set({ estriboNum: e.target.value })}>
              {EST_OPTS.map((n) => <option key={n} value={n}>#{n}</option>)}
            </select>
          </Field>
        </div>
      </div>
    </div>
  )
}
