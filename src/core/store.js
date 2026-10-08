// Single source of truth. Changes run inside transact(): if any rule is broken the state is rolled back,
// so a half-finished payment can never be saved.
import { isBalanced } from './ledger.js';

const KEY = 'ezc-v2';
export const SCHEMA = 2;
let S = null;
const subs = new Set();

function storage() { try { return window.localStorage; } catch { return null; } }

export function load(seed) {
  const ls = storage();
  let data = null;
  try { data = ls && JSON.parse(ls.getItem(KEY) || 'null'); } catch { data = null; }
  S = data && data.v === SCHEMA && checkShape(data) ? data : seed();
  save();
  return S;
}

function checkShape(d) {
  return d && d.profile && Array.isArray(d.ledger) && Array.isArray(d.orders) && Array.isArray(d.parcels) && d.prefs && d.sec;
}

export function save() {
  const ls = storage();
  try { ls && ls.setItem(KEY, JSON.stringify(S)); } catch { /* storage full or blocked: keep working in memory */ }
}

export function get() { return S; }

export function reset(seed) { S = seed(); save(); emit(); }

/** Run a change. Invariants are checked afterwards; on failure everything is restored and the error re-thrown. */
export function transact(fn) {
  const before = JSON.stringify(S);
  try {
    const out = fn(S);
    invariants(S);
    save();
    emit();
    return out;
  } catch (e) {
    S = JSON.parse(before);
    throw e;
  }
}

export class RuleError extends Error { constructor(msg, code) { super(msg); this.code = code; } }

function invariants(s) {
  if (!isBalanced(s.ledger)) throw new RuleError('Ledger does not balance', 'ledger');
  const ids = new Set();
  for (const t of s.ledger) { if (ids.has(t.id)) throw new RuleError('Duplicate transaction id ' + t.id, 'dup'); ids.add(t.id); }
}

export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
function emit() { subs.forEach((f) => { try { f(S); } catch (e) { console.error(e); } }); }

/** Next id in a named sequence, e.g. next('order') → 3022. */
export function next(s, name) {
  s.seq = s.seq || {};
  s.seq[name] = (s.seq[name] || 0) + 1;
  return s.seq[name];
}
