// Business rules for group buys, credit, customer codes and the payment PIN. Pure and unit tested.

// ---------- Group buy ----------
/** Price per piece (fen) the whole group pays at this committed total. ladder = [[minPcs, fen], ...] ascending. */
export function groupPrice(ladder, committed, baseFen) {
  let f = baseFen;
  for (const [min, fen] of ladder) if (committed >= min) f = fen;
  return f;
}
export function groupProgress(g) { return Math.min(1, g.committed / g.goal); }
export function groupOpen(g, now = Date.now()) { return g.state === 'open' && now < g.endsAt; }
export const DEPOSIT_BPS = 3000; // 30%

/** At the deadline: reached the goal → produce; else everyone is refunded in full. */
export function settleGroup(g, now = Date.now()) {
  if (g.state !== 'open' || now < g.endsAt) return g;
  return { ...g, state: g.committed >= g.ladder[0][0] ? 'producing' : 'failed' };
}

// ---------- EZI Credit ----------
/** Trust score 300–850 from payment history, trading volume (sen, last 12 months) and late payments. */
export function trustScore({ onTimePayments = 0, latePayments = 0, volumeSen = 0, monthsActive = 0, openDebtSen = 0 }) {
  let s = 520;
  s += Math.min(160, onTimePayments * 8);
  s -= latePayments * 45;
  s += Math.min(110, Math.floor(volumeSen / 100 / 2000) * 5);   // +5 per RM 2,000 traded
  s += Math.min(60, monthsActive * 4);
  if (openDebtSen > 0) s -= Math.min(80, Math.floor(openDebtSen / 100 / 1000) * 4);
  return Math.max(300, Math.min(850, s));
}
export function band(score) { return score >= 760 ? 'excellent' : score >= 700 ? 'good' : score >= 640 ? 'fair' : 'building'; }
/** Credit limit in sen for a score band. Below 640 there is no credit yet. */
export function creditLimit(score) {
  if (score >= 760) return 5000000;   // RM 50,000
  if (score >= 700) return 2000000;   // RM 20,000
  if (score >= 640) return 500000;    // RM 5,000
  return 0;
}
export const CREDIT_DAYS = 30;

// ---------- Customer codes ----------
// Format CC-L#####: country, one letter, five digits. The letter is a check letter so typos are caught.
const LET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export function checkLetter(country, digits) {
  let s = 0;
  for (const ch of country + digits) s = (s * 31 + ch.charCodeAt(0)) % 9973;
  return LET[s % LET.length];
}
export function makeCode(country, n) {
  const d = String(n % 100000).padStart(5, '0');
  return `${country}-${checkLetter(country, d)}${d}`;
}
export function validCode(code) {
  const m = /^([A-Z]{2})-([A-Z])(\d{5})$/.exec(String(code || ''));
  return !!m && checkLetter(m[1], m[3]) === m[2];
}

// ---------- Payment PIN ----------
// The PIN is never stored: only a salted SHA-256 hash. Five wrong tries lock payments for 5 minutes.
export const PIN_TRIES = 5, PIN_LOCK_MS = 5 * 60e3;
export function pinFormatOk(pin) {
  if (!/^\d{6}$/.test(pin)) return false;
  if (/^(\d)\1{5}$/.test(pin)) return false;               // 111111
  if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) return false; // 123456, 654321
  return true;
}
export async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
/** Returns {ok, lock} and the updated security record. */
export async function checkPin(sec, pin, now = Date.now()) {
  if (sec.lockUntil && now < sec.lockUntil) return { ok: false, locked: true, sec };
  const ok = (await hashPin(pin, sec.salt)) === sec.pinHash;
  if (ok) return { ok: true, sec: { ...sec, fails: 0, lockUntil: 0 } };
  const fails = (sec.fails || 0) + 1;
  return { ok: false, left: Math.max(0, PIN_TRIES - fails), sec: { ...sec, fails: fails >= PIN_TRIES ? 0 : fails, lockUntil: fails >= PIN_TRIES ? now + PIN_LOCK_MS : 0 }, locked: fails >= PIN_TRIES };
}
