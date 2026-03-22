import { create } from 'zustand'

const CAL_TO_NUM = { '2': 2, '2.5': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10 }
const NUM_TO_CAL = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10' }

const defaultCalc = () => ({
  fy: 4200,
  MuP: 0, MuN: 0,
  varPNum: 3, varPCount: 0,
  bastonPNum: 3, bastonPCount: 0,
  varNNum: 3, varNCount: 0,
  bastonNNum: 3, bastonNCount: 0,
  L: 0, VuTon: 0,
  varEstNum: 2, nramas: 2,
  SL4: null, SLresto: null,
  asManual: null,
  conCompresion: false, MuCorte: 0,
})

const defaultSection = (nombre = '') => ({
  nombre,
  peralte: 20,
  ancho: 15,
  recub: 3,
  calSup: '3',
  cantSup: 2,
  calInf: '3',
  cantInf: 2,
  fc: 250,
  cantBastonSup: 0,
  calBastonSup: '3',
  cantBastonInf: 0,
  calBastonInf: '3',
  calEst: '2.5',
  sepLcuarto: 8,
  sepRest: 16,
  mrPos: '',
  muPos: '',
  mrNeg: '',
  muNeg: '',
  vu: '',
  vr: '',
  calc: defaultCalc(),
})

let counter = 0

const useBeamStore = create((set, get) => ({
  sections: [],
  selectedIdx: -1,
  form: defaultSection(),
  calcAlert: false,
  dbStatus: null, // { status: 'db_match'|'db_partial'|'new_design', gid }

  setDbStatus: (v) => set({ dbStatus: v }),

  setCalcAlert: (v) => set({ calcAlert: v }),

  // Set form AND auto-save + sync form → calc
  setForm: (patch) => set((s) => {
    const newForm = { ...s.form, ...patch }
    // Sync form → calc for rebar, moments, stirrups
    const cp = {}
    if ('calSup' in patch) cp.varNNum = CAL_TO_NUM[patch.calSup] || 3
    if ('cantSup' in patch) cp.varNCount = Number(patch.cantSup) || 0
    if ('calInf' in patch) cp.varPNum = CAL_TO_NUM[patch.calInf] || 3
    if ('cantInf' in patch) cp.varPCount = Number(patch.cantInf) || 0
    if ('calBastonSup' in patch) cp.bastonNNum = CAL_TO_NUM[patch.calBastonSup] || 3
    if ('cantBastonSup' in patch) cp.bastonNCount = Number(patch.cantBastonSup) || 0
    if ('calBastonInf' in patch) cp.bastonPNum = CAL_TO_NUM[patch.calBastonInf] || 3
    if ('cantBastonInf' in patch) cp.bastonPCount = Number(patch.cantBastonInf) || 0
    if ('calEst' in patch) cp.varEstNum = CAL_TO_NUM[patch.calEst] || 2
    if ('sepLcuarto' in patch) cp.SL4 = Number(patch.sepLcuarto) || null
    if ('sepRest' in patch) cp.SLresto = Number(patch.sepRest) || null
    if ('muPos' in patch) cp.MuP = Number(patch.muPos) || 0
    if ('muNeg' in patch) cp.MuN = Number(patch.muNeg) || 0
    if ('vu' in patch) cp.VuTon = Number(patch.vu) || 0
    if (Object.keys(cp).length > 0) {
      newForm.calc = { ...(newForm.calc || defaultCalc()), ...cp }
    }
    if (s.selectedIdx >= 0 && s.selectedIdx < s.sections.length) {
      const updated = [...s.sections]
      updated[s.selectedIdx] = { ...newForm }
      return { form: newForm, sections: updated }
    }
    return { form: newForm }
  }),

  // Set calc sub-object AND auto-save + sync calc → form
  setCalc: (patch) => set((s) => {
    const newCalc = { ...s.form.calc, ...patch }
    const newForm = { ...s.form, calc: newCalc }
    // Sync calc → form
    if ('varNNum' in patch) newForm.calSup = NUM_TO_CAL[patch.varNNum] || String(patch.varNNum)
    if ('varNCount' in patch && Number(patch.varNCount) > 0) newForm.cantSup = Number(patch.varNCount)
    if ('varPNum' in patch) newForm.calInf = NUM_TO_CAL[patch.varPNum] || String(patch.varPNum)
    if ('varPCount' in patch && Number(patch.varPCount) > 0) newForm.cantInf = Number(patch.varPCount)
    if ('bastonNNum' in patch) newForm.calBastonSup = NUM_TO_CAL[patch.bastonNNum] || String(patch.bastonNNum)
    if ('bastonNCount' in patch) newForm.cantBastonSup = Number(patch.bastonNCount)
    if ('bastonPNum' in patch) newForm.calBastonInf = NUM_TO_CAL[patch.bastonPNum] || String(patch.bastonPNum)
    if ('bastonPCount' in patch) newForm.cantBastonInf = Number(patch.bastonPCount)
    if ('varEstNum' in patch) newForm.calEst = NUM_TO_CAL[patch.varEstNum] || String(patch.varEstNum)
    if ('MuP' in patch) newForm.muPos = Number(patch.MuP) || ''
    if ('MuN' in patch) newForm.muNeg = Number(patch.MuN) || ''
    if ('VuTon' in patch) newForm.vu = Number(patch.VuTon) || ''
    if ('SL4' in patch && patch.SL4 !== null) newForm.sepLcuarto = Number(patch.SL4)
    if ('SLresto' in patch && patch.SLresto !== null) newForm.sepRest = Number(patch.SLresto)
    if (s.selectedIdx >= 0 && s.selectedIdx < s.sections.length) {
      const updated = [...s.sections]
      updated[s.selectedIdx] = { ...newForm }
      return { form: newForm, sections: updated }
    }
    return { form: newForm }
  }),

  // Write calculator results back to the detailer fields
  syncCalcResults: (results) => set((s) => {
    const patch = {}
    if (results.mrPos !== undefined && results.mrPos !== null) patch.mrPos = results.mrPos
    if (results.mrNeg !== undefined && results.mrNeg !== null) patch.mrNeg = results.mrNeg
    if (results.vr !== undefined && results.vr !== null) patch.vr = results.vr
    if (results.vu !== undefined && results.vu !== null) patch.vu = results.vu
    if (results.muPos !== undefined && results.muPos !== null) patch.muPos = results.muPos
    if (results.muNeg !== undefined && results.muNeg !== null) patch.muNeg = results.muNeg
    if (results.sepLcuarto !== undefined && results.sepLcuarto !== null) patch.sepLcuarto = results.sepLcuarto
    if (results.sepRest !== undefined && results.sepRest !== null) patch.sepRest = results.sepRest
    if (Object.keys(patch).length === 0) return {}
    const newForm = { ...s.form, ...patch }
    if (s.selectedIdx >= 0 && s.selectedIdx < s.sections.length) {
      const updated = [...s.sections]
      updated[s.selectedIdx] = { ...newForm }
      return { form: newForm, sections: updated }
    }
    return { form: newForm }
  }),

  selectSection: (idx) => {
    const sec = get().sections[idx]
    if (!sec) return
    // Ensure calc block exists (backwards compat with old saved projects)
    const form = { ...sec, calc: sec.calc || defaultCalc() }
    set({ selectedIdx: idx, form })
  },

  createSection: () => {
    counter++
    const sec = defaultSection(`T-${counter}`)
    const sections = [...get().sections, sec]
    const idx = sections.length - 1
    set({ sections, selectedIdx: idx, form: { ...sec } })
  },

  loadProject: (sections) => {
    // Ensure all sections have calc block
    const fixed = sections.map((s) => ({ ...defaultSection(), ...s, calc: { ...defaultCalc(), ...(s.calc || {}) } }))
    const form = fixed.length > 0 ? { ...fixed[0] } : defaultSection()
    set({ sections: fixed, selectedIdx: fixed.length > 0 ? 0 : -1, form })
  },

  removeSection: (idx) => set((s) => {
    const sections = s.sections.filter((_, i) => i !== idx)
    let selectedIdx = s.selectedIdx
    if (idx === selectedIdx) {
      selectedIdx = Math.min(selectedIdx, sections.length - 1)
    } else if (idx < selectedIdx) {
      selectedIdx--
    }
    const form = selectedIdx >= 0 && sections[selectedIdx]
      ? { ...sections[selectedIdx] }
      : defaultSection()
    return { sections, selectedIdx, form }
  }),
}))

// Expose for postMessage / BD patch integration
window.__BEAM_STORE__ = useBeamStore

export default useBeamStore
