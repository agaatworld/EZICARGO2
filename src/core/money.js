// Money is always an integer in the smallest unit (sen for MYR, fen for CNY).
// No floating point money anywhere in the app: every amount goes through here.

export const FX = Object.freeze({ MYR_CNY: 1.6437 }); // 1 MYR = 1.6437 CNY (sample rate)

export const CURRENCIES = Object.freeze({
  MYR: { sym: 'RM', rate: 1 },
  CNY: { sym: '¥', rate: FX.MYR_CNY },
  SGD: { sym: 'S$', rate: 0.2946 },
  USD: { sym: 'US$', rate: 0.2366 },
  SAR: { sym: 'SAR ', rate: 0.8874 },
  AED: { sym: 'AED ', rate: 0.8689 },
  BND: { sym: 'B$', rate: 0.2946 },
});

export function assertInt(n, name = 'amount') {
  if (!Number.isInteger(n)) throw new TypeError(`${name} must be an integer number of cents, got ${n}`);
  return n;
}

/** CNY fen -> MYR sen, rounded half away from zero. */
export function cnyToMyr(fen) {
  assertInt(fen, 'fen');
  return Math.round(fen / FX.MYR_CNY);
}

/** MYR sen -> CNY fen. */
export function myrToCny(sen) {
  assertInt(sen, 'sen');
  return Math.round(sen * FX.MYR_CNY);
}

/** Percentage of an amount, rounded to the cent. bps = basis points (1% = 100). */
export function pct(sen, bps) {
  assertInt(sen); assertInt(bps, 'bps');
  return Math.round((sen * bps) / 10000);
}

export function sum(list) { return list.reduce((a, b) => a + assertInt(b), 0); }

/** Parse user text ("1,234.50", "RM 20") into sen. Returns null when invalid. */
export function parseMoney(text) {
  if (typeof text === 'number') return Number.isFinite(text) && text >= 0 ? Math.round(text * 100) : null;
  const t = String(text ?? '').trim().replace(/^(RM|MYR)\s*/i, '');
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(t)) return null;   // digits, optional thousands commas, up to 2 decimals
  const v = Number(t.replace(/,/g, ''));
  if (!Number.isFinite(v) || v > 10_000_000) return null;
  return Math.round(v * 100);
}

/** Format sen as text. cur = display currency code; amounts are converted from MYR. */
export function fmt(sen, cur = 'MYR', opts = {}) {
  assertInt(sen);
  const c = CURRENCIES[cur] || CURRENCIES.MYR;
  const v = (sen / 100) * c.rate;
  const dec = opts.dec ?? (Math.abs(v) >= 100000 ? 0 : 2);
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (sen < 0 ? '−' : opts.plus && sen > 0 ? '+' : '') + c.sym + s;
}

/** Format CNY fen directly as ¥. */
export function fmtCny(fen, dec = 2) {
  assertInt(fen, 'fen');
  return '¥' + (fen / 100).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function fmtNum(n, dec = 0) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function shortNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(n);
}
