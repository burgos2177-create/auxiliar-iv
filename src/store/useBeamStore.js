import { create } from 'zustand'

import { CAL_TO_NUM, NUM_TO_CAL } from '../core/constants'

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
  // Envolvente de elementos mecánicos (reporte RAM) — opcional
  envelope: null, // { archivo, combo, invertir, points:[...] }
})

// Cada bastón se amarra a una varilla del lecho: nunca puede haber más
// bastones que varillas principales. Se respeta el valor tal cual mientras
// alguno de los dos campos esté vacío (el usuario sigue escribiendo).
const clampBastones = (nb, nv) => {
  const b = Number(nb), v = Number(nv)
  if (nb === '' || nv === '' || !Number.isFinite(b) || !Number.isFinite(v) || v <= 0) return nb
  return Math.max(0, Math.min(b, v))
}

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
    // Un bastón por varilla como máximo (también al bajar la cantidad de varillas)
    if ('cantSup' in patch || 'cantBastonSup' in patch) {
      newForm.cantBastonSup = clampBastones(newForm.cantBastonSup, newForm.cantSup)
    }
    if ('cantInf' in patch || 'cantBastonInf' in patch) {
      newForm.cantBastonInf = clampBastones(newForm.cantBastonInf, newForm.cantInf)
    }
    // Sync form → calc for rebar, moments, stirrups
    const cp = {}
    if ('calSup' in patch) cp.varNNum = CAL_TO_NUM[patch.calSup] || 3
    if ('cantSup' in patch) cp.varNCount = Number(patch.cantSup) || 0
    if ('calInf' in patch) cp.varPNum = CAL_TO_NUM[patch.calInf] || 3
    if ('cantInf' in patch) cp.varPCount = Number(patch.cantInf) || 0
    if ('calBastonSup' in patch) cp.bastonNNum = CAL_TO_NUM[patch.calBastonSup] || 3
    if ('cantBastonSup' in patch || 'cantSup' in patch) cp.bastonNCount = Number(newForm.cantBastonSup) || 0
    if ('calBastonInf' in patch) cp.bastonPNum = CAL_TO_NUM[patch.calBastonInf] || 3
    if ('cantBastonInf' in patch || 'cantInf' in patch) cp.bastonPCount = Number(newForm.cantBastonInf) || 0
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
    // Un bastón por varilla como máximo (varCount = 0 significa "automático")
    if ('bastonNCount' in patch || 'varNCount' in patch) {
      newCalc.bastonNCount = clampBastones(newCalc.bastonNCount, newCalc.varNCount)
    }
    if ('bastonPCount' in patch || 'varPCount' in patch) {
      newCalc.bastonPCount = clampBastones(newCalc.bastonPCount, newCalc.varPCount)
    }
    const newForm = { ...s.form, calc: newCalc }
    // Sync calc → form
    if ('varNNum' in patch) newForm.calSup = NUM_TO_CAL[patch.varNNum] || String(patch.varNNum)
    if ('varNCount' in patch && Number(patch.varNCount) > 0) newForm.cantSup = Number(patch.varNCount)
    if ('varPNum' in patch) newForm.calInf = NUM_TO_CAL[patch.varPNum] || String(patch.varPNum)
    if ('varPCount' in patch && Number(patch.varPCount) > 0) newForm.cantInf = Number(patch.varPCount)
    if ('bastonNNum' in patch) newForm.calBastonSup = NUM_TO_CAL[patch.bastonNNum] || String(patch.bastonNNum)
    if ('bastonNCount' in patch || 'varNCount' in patch) newForm.cantBastonSup = Number(newCalc.bastonNCount) || 0
    if ('bastonPNum' in patch) newForm.calBastonInf = NUM_TO_CAL[patch.bastonPNum] || String(patch.bastonPNum)
    if ('bastonPCount' in patch || 'varPCount' in patch) newForm.cantBastonInf = Number(newCalc.bastonPCount) || 0
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

  // Adjunta / quita la envolvente de la sección activa
  setEnvelope: (env) => set((s) => {
    const newForm = { ...s.form, envelope: env }
    if (s.selectedIdx >= 0 && s.selectedIdx < s.sections.length) {
      const updated = [...s.sections]
      updated[s.selectedIdx] = { ...newForm }
      return { form: newForm, sections: updated }
    }
    return { form: newForm }
  }),

  // Envolvente de cualquier sección por índice (la usa la pestaña Modelo)
  setEnvelopeAt: (idx, env) => set((s) => {
    if (idx < 0 || idx >= s.sections.length) return {}
    const updated = [...s.sections]
    updated[idx] = { ...updated[idx], envelope: env }
    const form = idx === s.selectedIdx ? { ...s.form, envelope: env } : s.form
    return { sections: updated, form }
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
    // Que "+ Nueva" siga numerando después de las existentes (T-7 tras T-6)
    counter = fixed.reduce((m, s) => Math.max(m, +(/^T-(\d+)$/.exec(s.nombre || '')?.[1] || 0)), 0)
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
