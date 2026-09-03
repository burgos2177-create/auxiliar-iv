import { create } from 'zustand'
import { parseRamEnvelope, parseRamMemberData, autoAssign } from '../core/modelEnvelope'
import { normName } from '../core/constants'
import useBeamStore from './useBeamStore'
import useColumnStore from './useColumnStore'

// Modelo completo de RAM (un .txt para todo) + asignación miembro → sección.
// Las envolventes por sección se DERIVAN de aquí: cada vez que cambia la
// asignación se empujan a las trabes/columnas (envelope.fromModel = true),
// así que los paneles, informes y memoria siguen funcionando sin cambios.

const emptyModel = () => ({
  archivo: '', combo: '', unidades: '',
  points: [],          // todos los puntos Max/Min del reporte
  memberData: null,    // filas del reporte de datos de miembros (opcional)
  assignment: {},      // { [miembro]: { name, kind } }
})

const useModelStore = create((set, get) => ({
  model: emptyModel(),
  warnings: [],
  lastAuto: null, // resultado de la última auto-asignación

  loadModelText: (text, filename = '') => {
    const parsed = parseRamEnvelope(text)
    if (!parsed.points.length) {
      set({ warnings: parsed.warnings })
      return { ok: false, warnings: parsed.warnings }
    }
    const prev = get().model
    const ids = new Set(parsed.points.map((p) => p.member))
    // Conservar la asignación de los miembros que siguen existiendo
    const assignment = {}
    for (const [id, a] of Object.entries(prev.assignment || {})) if (ids.has(id)) assignment[id] = a
    set({
      model: { ...prev, archivo: filename, combo: parsed.combo, unidades: parsed.unidades, points: parsed.points, assignment },
      warnings: parsed.warnings,
    })
    get().applyToSections()
    return { ok: true, points: parsed.points.length, members: ids.size, warnings: parsed.warnings }
  },

  loadMemberDataText: (text) => {
    const parsed = parseRamMemberData(text)
    set((s) => ({ model: { ...s.model, memberData: parsed.rows }, warnings: parsed.warnings }))
    if (parsed.rows.length) get().autoAssign()
    return parsed
  },

  // Asignación automática por nombre (sección/descripción del reporte de miembros)
  autoAssign: () => {
    const { model } = get()
    if (!model.memberData?.length) return null
    const sections = useBeamStore.getState().sections
    const columns = useColumnStore.getState().columns
    const res = autoAssign(model.memberData, sections, columns)
    // Sólo se pisan los miembros que el reporte sí empató; el resto conserva lo manual
    set((s) => ({ model: { ...s.model, assignment: { ...s.model.assignment, ...res.assignment } }, lastAuto: res }))
    get().applyToSections()
    return res
  },

  assign: (ids, name, kind) => {
    if (!name) return
    set((s) => {
      const assignment = { ...s.model.assignment }
      for (const id of ids) assignment[String(id)] = { name, kind }
      return { model: { ...s.model, assignment } }
    })
    get().applyToSections()
  },

  unassign: (ids) => {
    set((s) => {
      const assignment = { ...s.model.assignment }
      for (const id of ids) delete assignment[String(id)]
      return { model: { ...s.model, assignment } }
    })
    get().applyToSections()
  },

  clear: () => {
    set({ model: emptyModel(), warnings: [], lastAuto: null })
    get().applyToSections()
  },

  // Desde un proyecto guardado / autosave
  restore: (model) => {
    set({ model: { ...emptyModel(), ...(model || {}) }, warnings: [], lastAuto: null })
    get().applyToSections()
  },

  // Empuja a cada trabe/columna la envolvente con SUS miembros.
  // Si una sección se queda sin miembros y su envolvente venía del modelo, se quita.
  applyToSections: () => {
    const { model } = get()
    const byName = new Map()
    for (const [id, a] of Object.entries(model.assignment || {})) {
      if (!a?.name) continue
      const k = normName(a.name)
      if (!byName.has(k)) byName.set(k, new Set())
      byName.get(k).add(id)
    }
    const ptsFor = (k) => {
      const ids = byName.get(k)
      return ids ? model.points.filter((p) => ids.has(p.member)) : []
    }
    const base = { archivo: model.archivo, combo: model.combo, unidades: model.unidades, fromModel: true }

    const bs = useBeamStore.getState()
    bs.sections.forEach((t, idx) => {
      const pts = ptsFor(normName(t.nombre))
      const cur = t.envelope
      if (pts.length) {
        // Conserva la opción "invertir" si ya existía
        if (cur?.fromModel && cur.points?.length === pts.length && cur.points.every((p, i) => p.id === pts[i].id)) return
        bs.setEnvelopeAt(idx, { ...base, invertir: !!cur?.invertir, points: pts })
      } else if (cur?.fromModel) {
        bs.setEnvelopeAt(idx, null)
      }
    })

    const cs = useColumnStore.getState()
    cs.columns.forEach((c, idx) => {
      const pts = ptsFor(normName(c.nombre))
      const cur = c.envelope
      if (pts.length) {
        if (cur?.fromModel && cur.points?.length === pts.length && cur.points.every((p, i) => p.id === pts[i].id)) return
        cs.setEnvelopeAt(idx, { ...base, mapping: cur?.mapping || 'M33X', points: pts })
      } else if (cur?.fromModel) {
        cs.setEnvelopeAt(idx, null)
      }
    })
  },
}))

export default useModelStore
