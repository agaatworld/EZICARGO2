// Double-entry ledger. Every transaction is a set of lines whose amounts sum to zero.
// Balances are never stored: they are always computed from the lines, so they cannot drift.
import { assertInt } from './money.js';

// Account names. A positive balance on WALLET means money the customer can spend.
export const ACC = Object.freeze({
  WALLET: 'cust:wallet',        // customer's spendable money
  ESCROW: 'escrow',             // held until inspection passes
  DEPOSIT: 'escrow:groupbuy',   // group-buy deposits
  CLEARING: 'bank:clearing',    // money arriving from FPX / DuitNow / card partner
  FACTORY: 'factory:payable',   // owed to factories after release
  SUPPLIER: 'supplier:payout',  // yuan paid out to outside suppliers
  FEES: 'revenue:fees',
  SHIPPING: 'revenue:shipping',
  STORAGE: 'revenue:storage',
  CREDIT: 'credit:receivable',  // shipped on credit, not yet paid
  MEMBERSHIP: 'revenue:membership',
});

export class LedgerError extends Error {}

/** Build a transaction object; throws if it does not balance. */
export function txn({ id, at = Date.now(), memo, kind, ref, lines }) {
  if (!Array.isArray(lines) || lines.length < 2) throw new LedgerError('A transaction needs at least two lines');
  let total = 0;
  for (const l of lines) {
    if (!l || typeof l.a !== 'string' || !l.a) throw new LedgerError('Each line needs an account');
    assertInt(l.v, 'line amount');
    if (l.v === 0) throw new LedgerError('Zero lines are not allowed');
    total += l.v;
  }
  if (total !== 0) throw new LedgerError(`Transaction does not balance (off by ${total})`);
  if (!memo) throw new LedgerError('A transaction needs a memo');
  return Object.freeze({ id, at, memo, kind: kind || 'other', ref: ref || null, lines: Object.freeze(lines.map((l) => Object.freeze({ ...l }))) });
}

export function balance(ledger, account) {
  let b = 0;
  for (const t of ledger) for (const l of t.lines) if (l.a === account) b += l.v;
  return b;
}

export function trialBalance(ledger) {
  const m = {};
  for (const t of ledger) for (const l of t.lines) m[l.a] = (m[l.a] || 0) + l.v;
  return m;
}

/** The whole ledger must always sum to zero. Used by tests and by the control centre health check. */
export function isBalanced(ledger) {
  return Object.values(trialBalance(ledger)).reduce((a, b) => a + b, 0) === 0;
}

/** Customer-facing statement: the lines that touch the wallet, newest first. */
export function walletStatement(ledger) {
  const out = [];
  for (const t of ledger) {
    const v = t.lines.filter((l) => l.a === ACC.WALLET).reduce((a, l) => a + l.v, 0);
    if (v !== 0) out.push({ id: t.id, at: t.at, memo: t.memo, kind: t.kind, ref: t.ref, v });
  }
  return out.sort((a, b) => b.at - a.at);
}

// Ready-made transaction shapes, so pages never write raw lines.
export const post = {
  topUp: (id, sen, method) => txn({ id, memo: `Top-up · ${method}`, kind: 'topup', lines: [{ a: ACC.WALLET, v: sen }, { a: ACC.CLEARING, v: -sen }] }),
  hold: (id, sen, ref, memo) => txn({ id, memo, kind: 'hold', ref, lines: [{ a: ACC.WALLET, v: -sen }, { a: ACC.ESCROW, v: sen }] }),
  release: (id, sen, ref) => txn({ id, memo: `Released to factory · ${ref}`, kind: 'release', ref, lines: [{ a: ACC.ESCROW, v: -sen }, { a: ACC.FACTORY, v: sen }] }),
  refund: (id, sen, ref, why) => txn({ id, memo: `Refund · ${ref}${why ? ' · ' + why : ''}`, kind: 'refund', ref, lines: [{ a: ACC.ESCROW, v: -sen }, { a: ACC.WALLET, v: sen }] }),
  fee: (id, sen, ref, memo, acc = ACC.FEES) => txn({ id, memo, kind: 'fee', ref, lines: [{ a: ACC.WALLET, v: -sen }, { a: acc, v: sen }] }),
  supplier: (id, sen, feeSen, ref, memo) => txn({ id, memo, kind: 'supplier', ref, lines: [{ a: ACC.WALLET, v: -(sen + feeSen) }, { a: ACC.SUPPLIER, v: sen }, ...(feeSen ? [{ a: ACC.FEES, v: feeSen }] : [])] }),
  deposit: (id, sen, ref) => txn({ id, memo: `Group deal deposit · ${ref}`, kind: 'deposit', ref, lines: [{ a: ACC.WALLET, v: -sen }, { a: ACC.DEPOSIT, v: sen }] }),
  depositBack: (id, sen, ref) => txn({ id, memo: `Deposit returned · ${ref}`, kind: 'refund', ref, lines: [{ a: ACC.DEPOSIT, v: -sen }, { a: ACC.WALLET, v: sen }] }),
  // Credit: the financing partner funds escrow; the customer's debt is the negative balance of CREDIT.
  creditHold: (id, sen, ref) => txn({ id, memo: `Paid with EZI Credit · ${ref}`, kind: 'credit', ref, lines: [{ a: ACC.ESCROW, v: sen }, { a: ACC.CREDIT, v: -sen }] }),
  creditRepay: (id, sen, ref) => txn({ id, memo: `Credit repaid · ${ref}`, kind: 'repay', ref, lines: [{ a: ACC.WALLET, v: -sen }, { a: ACC.CREDIT, v: sen }] }),
};

/** Money the customer owes on EZI Credit. */
export function creditOwed(ledger) { return 0 - balance(ledger, ACC.CREDIT) || 0; }
