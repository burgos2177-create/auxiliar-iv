// Bar diameters in mm (Mexican rebar standard)
export const DIAM = {
  '2': 6.35,
  '2.5': 7.94,
  '3': 9.53,
  '4': 12.7,
  '5': 15.88,
  '6': 19.05,
  '8': 25.4,
}

export const REBAR_OPTIONS = ['2', '2.5', '3', '4', '5', '6', '8']
export const STIRRUP_OPTIONS = ['2', '2.5', '3', '4']

// Calibre del detallador (string) ↔ número de varilla de la tabla VARILLAS.
// Una sola copia: antes vivía duplicada en el store, la calculadora y los informes,
// y el #2.5 se convertía en #2 al pasar por la calculadora (cambiaba el detalle y
// el área del estribo). Ahora el viaje es de ida y vuelta.
export const CAL_TO_NUM = { '2': 2, '2.5': 2.5, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10 }
export const NUM_TO_CAL = { 2: '2', 2.5: '2.5', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10' }

// Normaliza nombres de elementos para empatarlos entre fuentes
// (trabe "T-1" del proyecto, "T1" del .dcheck, "t 1" de un reporte…).
export const normName = (s) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
