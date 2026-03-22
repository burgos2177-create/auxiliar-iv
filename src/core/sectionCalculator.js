// ══════════════════════════════════════════════════════════════
// Section Calculator — Pure functions extracted from DisenoVigas_2.html
// Zero modifications to logic — only exports added
// ══════════════════════════════════════════════════════════════

// ── Rebar table ───────────────────────────────────────────────
export const VARILLAS = [
  { num: 2,  diam: 0.635, area: 0.32 },
  { num: 3,  diam: 0.950, area: 0.71 },
  { num: 4,  diam: 1.270, area: 1.27 },
  { num: 5,  diam: 1.590, area: 1.98 },
  { num: 6,  diam: 1.910, area: 2.85 },
  { num: 7,  diam: 2.220, area: 3.88 },
  { num: 8,  diam: 2.540, area: 5.07 },
  { num: 9,  diam: 2.870, area: 6.45 },
  { num: 10, diam: 3.230, area: 8.19 },
];

// ── Beta1 ─────────────────────────────────────────────────────
export function beta1(fc) {
  if (fc <= 280) return 0.85;
  return Math.max(0.65, 0.85 - 0.05 * (fc - 280) / 70);
}

// ── Flexion design ────────────────────────────────────────────
export function calcFlexion({ fc, fy, b, h, r, MuTm, varNum, varCount, bastonNum, bastonCount }) {
  const d = h - r;
  const fcRed = 0.85 * fc;
  const FR = 0.9;
  const b1 = beta1(fc);
  const MuKgcm = MuTm * 100000;

  const Rn = MuKgcm / (FR * b * d * d);
  const inner = 1 - (2 * Rn) / fcRed;
  if (inner < 0) return { error: "Sección insuficiente (aumenta b o d)" };

  const rhoCalc = (fcRed / fy) * (1 - Math.sqrt(inner));
  const AsCalc  = rhoCalc * b * d;
  const AsMin   = (0.7 * Math.sqrt(fc) / fy) * b * d;
  const rhoBal  = (b1 * fcRed / fy) * (6000 / (6000 + fy));
  const AsBal   = rhoBal * b * d;
  const AsMax   = 0.9 * AsBal;
  const AsReq   = Math.max(AsCalc, AsMin);

  const vr = VARILLAS.find(v => v.num === varNum) || VARILLAS[2];
  const nCalc = Math.ceil(AsReq / vr.area);
  const nUsed = varCount || nCalc;
  const AsBarras = nUsed * vr.area;

  const vb = VARILLAS.find(v => v.num === bastonNum) || VARILLAS[2];
  const nBastones = bastonCount || 0;
  const AsBastones = nBastones * vb.area;
  const AsTotal = AsBarras + AsBastones;

  const rhoReal = AsTotal / (b * d);
  const q = rhoReal * fy / fcRed;

  const a = (AsTotal * fy) / (fcRed * b);
  const MRT = FR * AsTotal * fy * (d - a / 2) / 100000;
  const MRC = FR * b * d * d * fcRed * q * (1 - 0.5 * q) / 100000;
  const bMin = 2 * r + (2 * nUsed - 1) * vr.diam;

  return {
    d, Rn, rhoCalc, rhoReal, q, AsCalc, AsMin, AsBal, AsMax, AsReq,
    nCalc, nUsed, AsBarras, AsBastones, AsTotal,
    MRT, MRC, bMin, b1, rhoBal, a,
    vr, vb, nBastones, FR, fcRed,
    okMin: AsTotal >= AsMin,
    okMax: AsTotal <= AsMax,
    okMR:  MRT >= MuTm,
    okBmin: b >= bMin,
  };
}

// ── Shear design ──────────────────────────────────────────────
export function calcCortante({ fc, fy, b, h, r, L, VuTon, AsUsada, varEstNum, nramas, conCompresion, MuCorte }) {
  const d    = h - r;
  const FR   = 0.75;
  const lh   = (L * 100) / h;
  const lhZone = lh > 5 ? "mayor5" : lh < 4 ? "menor4" : "entre4y5";
  const rho  = AsUsada / (b * d);

  const sqrtFc = Math.sqrt(fc);
  const VuKg   = VuTon * 1000;

  let VCR_a, VCR_b, VcrKg, ecVcr;

  if (lhZone === "menor4") {
    if (conCompresion) {
      const MuKgcm = (MuCorte ?? 0) * 100000;
      const MVd    = VuKg > 0 ? MuKgcm / (VuKg * d) : 0;
      const factor = Math.max(1.0, Math.min(3.5, 3.5 - MVd));
      VCR_a  = FR * factor * 0.5 * sqrtFc * b * d;
      VCR_b  = VCR_a;
      VcrKg  = VCR_a;
      ecVcr  = `5.3.3 CON compresión (factor ${factor.toFixed(3)})`;
    } else {
      VCR_a  = FR * 0.5 * sqrtFc * b * d;
      VCR_b  = VCR_a;
      VcrKg  = VCR_a;
      ecVcr  = "5.3.2 SIN compresión";
    }
  } else {
    VCR_a = FR * 0.5 * sqrtFc * b * d;
    VCR_b = FR * 2   * Math.pow(rho, 1/3) * sqrtFc * b * d;
    ecVcr = VCR_b >= VCR_a ? "5.5.3.1.1.b" : "5.5.3.1.1.a";

    const VCR_max = FR * 1.25 * sqrtFc * b * d;
    const VCR_min = FR * 0.25 * sqrtFc * b * d;
    VcrKg = Math.min(Math.max(Math.max(VCR_a, VCR_b), VCR_min), VCR_max);
  }

  const VCR_max_lim = FR * 1.25 * sqrtFc * b * d;
  const VCR_min_lim = FR * 0.25 * sqrtFc * b * d;

  const VaMaxKg = VcrKg + FR * 2.2 * sqrtFc * b * d;
  const seccionInsuficiente = VuKg > VaMaxKg;

  const VsrNecKg = VuKg - VcrKg;

  const ve = VARILLAS.find(v => v.num === varEstNum) || VARILLAS[1];
  const Av = nramas * ve.area;

  let SCalc = null;
  if (VsrNecKg > 0) SCalc = (FR * Av * fy * d) / VsrNecKg;

  const VsrLimSmax = FR * 1.1 * sqrtFc * b * d;
  const SmaxGeom   = VsrNecKg > VsrLimSmax ? Math.min(d / 4, 60) : Math.min(d / 2, 60);

  const Smin = 6;

  const SusoCalc  = SCalc ? Math.min(SCalc, SmaxGeom) : SmaxGeom;
  const SusoPrev  = Math.floor(SusoCalc);
  const Suso      = Math.max(SusoPrev, Smin);
  const SminAlert = SusoPrev < Smin;

  const VsrRealKg = (FR * Av * fy * d) / Suso;
  const Vr        = (VcrKg + VsrRealKg) / 1000;

  return {
    d, FR, lh, lhZone, rho, ecVcr, conCompresion: !!conCompresion,
    VCR_a: VCR_a/1000, VCR_b: VCR_b/1000,
    VCR_min: VCR_min_lim/1000, VCR_max: VCR_max_lim/1000,
    VcrKg, Vcr: VcrKg/1000,
    VaMax: VaMaxKg/1000,
    VuKg, VsrNec: VsrNecKg/1000,
    ve, Av, SCalc, Smin, SmaxGeom, Suso, SminAlert,
    seccionInsuficiente,
    VsrReal: VsrRealKg/1000,
    Vr,
    okSmin:  !SminAlert,
    okVaMax: !seccionInsuficiente,
    okVr:    Vr >= VuTon && !seccionInsuficiente,
    necesitaEstribos: VsrNecKg > 0,
  };
}

// ── Quick-fill optimizer ──────────────────────────────────────
export function optimizeFlexion({ fc, fy, b, h, r, MuTm }) {
  const fcRed = 0.85 * fc;
  const FR = 0.9;
  const d = h - r;
  const b1 = fc <= 280 ? 0.85 : Math.max(0.65, 0.85 - 0.05 * (fc - 280) / 70);
  const MuKgcm = MuTm * 100000;
  const Rn = MuKgcm / (FR * b * d * d);
  const inner = 1 - (2 * Rn) / fcRed;
  if (inner < 0) return null;
  const rhoCalc = (fcRed / fy) * (1 - Math.sqrt(inner));
  const AsMin   = (0.7 * Math.sqrt(fc) / fy) * b * d;
  const rhoBal  = (b1 * fcRed / fy) * (6000 / (6000 + fy));
  const AsMax   = 0.9 * rhoBal * b * d;
  const AsReq   = Math.max(rhoCalc * b * d, AsMin);

  for (const vr of VARILLAS) {
    if (vr.num < 3) continue;
    const nCalc = Math.ceil(AsReq / vr.area);
    for (let nBast = 0; nBast <= 2; nBast++) {
      const nMain = nBast > 0 ? Math.max(2, nCalc - nBast) : nCalc;
      const AsTotal = nMain * vr.area + nBast * vr.area;
      const bMin = 2 * r + (2 * nMain - 1) * vr.diam;
      if (AsTotal >= AsReq && AsTotal <= AsMax && b >= bMin) {
        return {
          varNum: vr.num, varCount: nMain,
          bastonNum: vr.num, bastonCount: nBast,
        };
      }
    }
  }
  return null;
}
