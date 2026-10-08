// Pricing rules: price tiers, shipping quotes and the full landed cost. Pure functions, unit tested.
import { cnyToMyr, pct } from '../core/money.js';
import { destOf } from './catalog.js';

export const CARTON_CM3 = 60 * 40 * 35;       // standard export carton
export const VOL_DIVISOR = 6000;              // air volumetric: cm³ / 6000 = kg
export const SEA_MIN_CM3 = 250000;            // 0.25 CBM minimum sea charge
export const INSPECTION = Object.freeze({ none: { bps: 0 }, photo: { perCarton: 500 }, std: { bps: 150 }, full: { bps: 300 } });
export const PAY_FEE_BPS = Object.freeze({ wallet: 0, credit: 0, fpx: 50, duitnow: 50, card: 150 });
export const STORAGE = Object.freeze({ freeDays: 14, perCartonDay: 120 });

export function moq(p) { return p.t[0][0]; }

/** CNY fen per piece at this quantity, or null below the minimum order. */
export function unitFen(p, qty) {
  if (!Number.isInteger(qty) || qty < moq(p)) return null;
  let f = p.t[0][1];
  for (const [min, fen] of p.t) if (qty >= min) f = fen;
  return f;
}

export function tierIndex(p, qty) {
  let i = -1;
  p.t.forEach(([min], k) => { if (qty >= min) i = k; });
  return i;
}

/** How many more pieces unlock the next price, or null at the best price. */
export function nextTier(p, qty) {
  const i = tierIndex(p, qty);
  const n = p.t[i + 1];
  return n ? { need: n[0] - Math.max(qty, 0), fen: n[1], min: n[0] } : null;
}

export function lowestFen(p) { return p.t[p.t.length - 1][1]; }

/** Shipping for a load. grams and cm3 are integers. mode 'air' | 'sea'. Returns sen and days. */
export function shipQuote({ grams, cm3, dest = 'MY', mode = 'sea' }) {
  if (!(grams >= 0) || !(cm3 >= 0)) throw new RangeError('grams and cm3 must be positive');
  const d = destOf(dest);
  if (mode === 'air') {
    const volG = Math.ceil((cm3 / VOL_DIVISOR) * 1000);
    const chargeG = Math.max(grams, volG, 500);          // 0.5 kg minimum
    return { sen: Math.round((chargeG * d.air) / 1000), chargeG, volG, days: d.ad, mode };
  }
  const chargeCm3 = Math.max(cm3, SEA_MIN_CM3);
  return { sen: Math.round((chargeCm3 * d.sea) / 1e6), chargeCm3, days: d.sd, mode };
}

export function cartonsFor(cm3) { return Math.max(1, Math.ceil(cm3 / CARTON_CM3)); }

export function inspectionSen(kind, goodsSen, cartons) {
  const r = INSPECTION[kind] || INSPECTION.none;
  if (r.perCarton) return r.perCarton * cartons;
  return pct(goodsSen, r.bps);
}

/** Everything a trader pays to get the goods to their door. */
export function landed(p, qty, { dest = 'MY', mode = 'sea', insp = 'std', pay = 'wallet' } = {}) {
  const fen = unitFen(p, qty);
  if (fen == null) return null;
  const goods = cnyToMyr(fen * qty);
  const grams = p.g * qty, cm3 = p.cbm * qty, cartons = cartonsFor(cm3);
  const ship = shipQuote({ grams, cm3, dest, mode });
  const inspection = inspectionSen(insp, goods, cartons);
  const sub = goods + inspection + ship.sen;
  const fee = pct(sub, PAY_FEE_BPS[pay] ?? 0);
  const total = sub + fee;
  return { fen, goods, inspection, ship: ship.sen, days: ship.days, fee, total, perPc: Math.round(total / qty), cartons, grams, cm3 };
}

/** Storage: free days left (can be negative) and rent owed so far. */
export function storage(parcel, now = Date.now()) {
  if (!parcel.arrivedAt) return { daysLeft: STORAGE.freeDays + (parcel.extraDays || 0), rent: 0 };
  const used = Math.floor((now - parcel.arrivedAt) / 864e5);
  const daysLeft = STORAGE.freeDays + (parcel.extraDays || 0) - used;
  const rent = daysLeft < 0 ? -daysLeft * STORAGE.perCartonDay * parcel.cartons : 0;
  return { daysLeft, rent };
}

/** Parcels combined: one shipment, repacked volume is ~22% less. */
export function combinedLoad(parcels, repack = false) {
  const grams = parcels.reduce((a, x) => a + x.grams, 0);
  const cm3 = parcels.reduce((a, x) => a + x.cm3, 0);
  return { grams, cm3: repack ? Math.round(cm3 * 0.78) : cm3, cartons: parcels.reduce((a, x) => a + x.cartons, 0) };
}
