import { create } from 'zustand'

// Lecho por defecto
const defaultLecho = () => ({ n: 2, num: '4' })

const defaultColumn = (nombre = '') => ({
  nombre,
  b: 30,          // base (cm) — dimensión en X
  h: 30,          // peralte (cm) — dimensión en Y
  r: 3,
  fc: 250,
  fy: 4200,
  E: 2000000,
  epsC: 0.003,
  nLechos: 2,
  lechos: [defaultLecho(), defaultLecho()], // lecho 1 = cara superior
  Pu: 0,
  MuX: 0,         // momento que trabaja el peralte h (hoja de Excel tal cual)
  MuY: 0,         // momento en la otra dirección
  estriboNum: '2.5',
})

let counter = 0

const useColumnStore = create((set, get) => ({
  columns: [],
  selectedIdx: -1,
  form: defaultColumn(),

  setForm: (patch) => set((s) => {
    const newForm = { ...s.form, ...patch }
    // Ajustar arreglo de lechos cuando cambia nLechos
    if ('nLechos' in patch) {
      const n = Math.max(2, Math.min(8, Number(patch.nLechos) || 2))
      newForm.nLechos = n
      const lechos = [...(newForm.lechos || [])]
      while (lechos.length < n) lechos.push(defaultLecho())
      lechos.length = n
      newForm.lechos = lechos
    }
    if (s.selectedIdx >= 0 && s.selectedIdx < s.columns.length) {
      const updated = [...s.columns]
      updated[s.selectedIdx] = { ...newForm }
      return { form: newForm, columns: updated }
    }
    return { form: newForm }
  }),

  setLecho: (idx, patch) => set((s) => {
    const lechos = (s.form.lechos || []).map((L, i) => (i === idx ? { ...L, ...patch } : L))
    const newForm = { ...s.form, lechos }
    if (s.selectedIdx >= 0 && s.selectedIdx < s.columns.length) {
      const updated = [...s.columns]
      updated[s.selectedIdx] = { ...newForm }
      return { form: newForm, columns: updated }
    }
    return { form: newForm }
  }),

  selectColumn: (idx) => {
    const col = get().columns[idx]
    if (!col) return
    set({ selectedIdx: idx, form: { ...defaultColumn(), ...col } })
  },

  createColumn: () => {
    counter++
    const col = defaultColumn(`C-${counter}`)
    const columns = [...get().columns, col]
    const idx = columns.length - 1
    set({ columns, selectedIdx: idx, form: { ...col } })
  },

  removeColumn: (idx) => set((s) => {
    const columns = s.columns.filter((_, i) => i !== idx)
    let selectedIdx = s.selectedIdx
    if (idx === selectedIdx) selectedIdx = Math.min(selectedIdx, columns.length - 1)
    else if (idx < selectedIdx) selectedIdx--
    const form = selectedIdx >= 0 && columns[selectedIdx]
      ? { ...defaultColumn(), ...columns[selectedIdx] }
      : defaultColumn()
    return { columns, selectedIdx, form }
  }),

  loadColumns: (columns) => {
    const fixed = (columns || []).map((c) => ({ ...defaultColumn(), ...c }))
    set({
      columns: fixed,
      selectedIdx: fixed.length > 0 ? 0 : -1,
      form: fixed.length > 0 ? { ...fixed[0] } : defaultColumn(),
    })
  },
}))

export default useColumnStore
