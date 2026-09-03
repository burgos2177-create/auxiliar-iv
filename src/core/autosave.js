// ══════════════════════════════════════════════════════════════
// Autoguardado del proyecto abierto + lista de recientes.
// localStorage: el proyecto son KBs (secciones, columnas y las
// envolventes del modelo), cabe de sobra. Todo va en try/catch porque
// el navegador puede negar el acceso (modo privado, cuota, etc.).
// ══════════════════════════════════════════════════════════════

const KEY = 'iv_autosave_v1'
const RECENTS = 'iv_recents_v1'
const MAX_RECENTS = 6

export const PROJECT_VERSION = 3

/** Empaqueta el estado del proyecto tal como se guarda en el .json */
export function packProject({ projectName = '', dxfScale = 1, sections = [], columns = [] }) {
  return { version: PROJECT_VERSION, projectName, dxfScale, sections, columns, savedAt: new Date().toISOString() }
}

export function isEmptyProject(p) {
  return !p || ((p.sections?.length || 0) === 0 && (p.columns?.length || 0) === 0)
}

export function saveSnapshot(project) {
  try {
    if (isEmptyProject(project)) { localStorage.removeItem(KEY); return true }
    localStorage.setItem(KEY, JSON.stringify(project))
    return true
  } catch { return false }
}

export function loadSnapshot() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    return isEmptyProject(p) ? null : p
  } catch { return null }
}

export function clearSnapshot() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}

// ── Recientes: se alimentan al Guardar / Abrir, no en cada tecla ──
export function pushRecent(project) {
  try {
    if (isEmptyProject(project)) return
    const name = (project.projectName || '').trim() || 'Sin nombre'
    const list = listRecents().filter((r) => r.name !== name)
    list.unshift({ name, savedAt: project.savedAt || new Date().toISOString(),
      trabes: project.sections?.length || 0, columnas: project.columns?.length || 0, project })
    localStorage.setItem(RECENTS, JSON.stringify(list.slice(0, MAX_RECENTS)))
  } catch { /* cuota — silencioso */ }
}

export function listRecents() {
  try {
    const raw = localStorage.getItem(RECENTS)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function removeRecent(name) {
  try {
    localStorage.setItem(RECENTS, JSON.stringify(listRecents().filter((r) => r.name !== name)))
  } catch { /* ignore */ }
}

/** "hace 3 min", "hace 2 h", "ayer"… para la UI */
export function timeAgo(iso) {
  const t = Date.parse(iso)
  if (!t) return ''
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'hace un momento'
  if (s < 3600) return `hace ${Math.round(s / 60)} min`
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`
  const d = Math.round(s / 86400)
  return d === 1 ? 'ayer' : `hace ${d} días`
}

/** Debounce sencillo para no escribir en cada tecla */
export function debounce(fn, ms = 600) {
  let h = null
  const d = (...args) => { clearTimeout(h); h = setTimeout(() => fn(...args), ms) }
  d.flush = (...args) => { clearTimeout(h); fn(...args) }
  return d
}
