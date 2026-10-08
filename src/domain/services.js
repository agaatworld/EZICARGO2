// Application services: every change to money, goods or settings goes through one of these functions.
// Each runs inside a store transaction, so a failed rule leaves nothing half-done.
import { transact, next, get, RuleError } from '../core/store.js';
import { txn, ACC, balance, creditOwed } from '../core/ledger.js';
import { pct, assertInt } from '../core/money.js';
import { byId } from './catalog.js';
import { landed, shipQuote, combinedLoad, inspectionSen, PAY_FEE_BPS, STORAGE, cartonsFor } from './pricing.js';
import { move, canRefund } from './escrow.js';
import { groupPrice, DEPOSIT_BPS, trustScore, creditLimit, checkPin, pinFormatOk, hashPin, groupOpen, settleGroup } from './rules.js';

const now = () => Date.now();
const tid = (s) => 'T-' + String(next(s, 'txn')).padStart(6, '0');

export const PAY_METHODS = ['wallet', 'fpx', 'duitnow', 'card', 'credit'];

// ---------- reads ----------
export const walletSen = (s = get()) => balance(s.ledger, ACC.WALLET);
export const escrowSen = (s = get()) => balance(s.ledger, ACC.ESCROW) + balance(s.ledger, ACC.DEPOSIT);
export const owedSen = (s = get()) => creditOwed(s.ledger);
export function creditInfo(s = get()) {
  const score = trustScore({ ...s.credit, openDebtSen: owedSen(s) });
  const limit = creditLimit(score);
  return { score, limit, used: owedSen(s), available: Math.max(0, limit - owedSen(s)) };
}
export function defaultAddr(s = get()) { return s.addresses.find((a) => a.isDefault) || s.addresses[0] || null; }

export function tracking(n) {
  // EZ + 10 digits; the last digit is a Luhn check digit so a mistyped number is rejected.
  const body = String(n).padStart(9, '0').slice(-9);
  let sum = 0;
  body.split('').reverse().forEach((d, i) => { let v = +d; if (i % 2 === 0) { v *= 2; if (v > 9) v -= 9; } sum += v; });
  return 'EZ' + body + ((10 - (sum % 10)) % 10);
}
export function validTracking(t) {
  const m = /^EZ(\d{9})(\d)$/.exec(String(t || '').replace(/\s/g, '').toUpperCase());
  return !!m && tracking(+m[1]) === 'EZ' + m[1] + m[2];
}

function notice(s, key, vars, route) { s.notices.unshift({ id: 'n' + next(s, 'notice'), at: now(), key, vars, route, read: false }); }
function audit(s, what, ref, who) { s.audit.unshift({ at: now(), who: who || s.profile.code, what, ref }); if (s.audit.length > 400) s.audit.length = 400; }

/** Charge a payment: `to` lines say where the money goes and must add up to `total`. */
function charge(s, method, total, to, memo, ref, kind = 'pay') {
  assertInt(total);
  if (total <= 0) throw new RuleError('Amount must be more than zero', 'amount');
  if (to.reduce((a, l) => a + l.v, 0) !== total) throw new RuleError('Payment split does not add up', 'split');
  let src;
  if (method === 'wallet') {
    if (walletSen(s) < total) throw new RuleError('Not enough money in your wallet', 'funds');
    src = ACC.WALLET;
  } else if (method === 'credit') {
    if (creditInfo(s).available < total) throw new RuleError('Not enough EZI Credit available', 'credit');
    src = ACC.CREDIT;
  } else if (['fpx', 'duitnow', 'card'].includes(method)) {
    src = ACC.CLEARING;
  } else throw new RuleError('Unknown payment method', 'method');
  const t = txn({ id: tid(s), at: now(), memo, kind, ref, lines: [{ a: src, v: -total }, ...to.filter((l) => l.v !== 0)] });
  s.ledger.push(t);
  return t;
}

// ---------- checkout ----------
export function quoteCart(s, { dest, mode, insp, pay }) {
  const lines = s.cart.map((c) => { const p = byId(c.pid); return p && { c, p, q: landed(p, c.qty, { dest, mode, insp, pay }) }; }).filter(Boolean);
  const bad = lines.filter((l) => !l.q);
  const ok = lines.filter((l) => l.q);
  const sum = (k) => ok.reduce((a, l) => a + l.q[k], 0);
  return { lines, bad, goods: sum('goods'), inspection: sum('inspection'), ship: sum('ship'), fee: sum('fee'), total: sum('total') };
}

export function checkout({ dest, mode, insp, pay, addrId, name }) {
  return transact((s) => {
    if (!s.cart.length) throw new RuleError('Your cart is empty', 'empty');
    if (!s.addresses.some((a) => a.id === addrId)) throw new RuleError('Choose a delivery address', 'addr');
    const q = quoteCart(s, { dest, mode, insp, pay });
    if (q.bad.length) throw new RuleError('Some items are below the minimum order', 'moq');
    const ids = [];
    for (const { c, p, q: l } of q.lines) {
      const oid = 'EZO-' + next(s, 'order');
      charge(s, pay, l.total, [{ a: ACC.ESCROW, v: l.goods + l.inspection }, { a: ACC.SHIPPING, v: l.ship }, { a: ACC.FEES, v: l.fee }], `Order ${oid} · into escrow`, oid, 'hold');
      s.orders.unshift({ id: oid, name: name ? `${name}${q.lines.length > 1 ? ' · ' + (ids.length + 1) : ''}` : '', pid: p.id, qty: c.qty, col: c.col, fen: l.fen, goods: l.goods, insp: l.inspection, ship: l.ship, fee: l.fee, pay, dest, mode, inspKind: insp,
        state: 'paid', createdAt: now(), addrId, history: [{ state: 'paid', at: now(), by: 'customer' }] });
      ids.push(oid);
      audit(s, `Paid order into escrow (${pay})`, oid);
    }
    s.cart = [];
    s.credit.volumeSen += q.total;
    notice(s, 'n.paid', { ids: ids.join(', ') }, 'orders');
    return { ids, total: q.total };
  });
}

// ---------- orders (factory, warehouse and control actions) ----------
export function advanceOrder(id, to, by = 'control', note = '') {
  return transact((s) => {
    const i = s.orders.findIndex((o) => o.id === id);
    if (i < 0) throw new RuleError('Order not found', 'nf');
    const o = s.orders[i];
    if (to === 'delivered' && o.pay === 'credit' && owedSen(s) > 0) throw new RuleError('Credit must be repaid before the goods are handed over', 'credit');
    const r = move(o, to, { by, note });
    const held = o.goods + o.insp;
    if (r.money === 'release') {
      s.ledger.push(txn({ id: tid(s), memo: `Released to factory · ${id}`, kind: 'release', ref: id, lines: [{ a: ACC.ESCROW, v: -held }, { a: ACC.FACTORY, v: o.goods }, ...(o.insp ? [{ a: ACC.FEES, v: o.insp }] : [])] }));
      s.credit.onTimePayments += o.pay === 'credit' ? 0 : 1;
    }
    if (r.money === 'refund') {
      const back = held + o.ship + o.fee;
      const lines = [{ a: ACC.ESCROW, v: -held }];
      if (o.ship) lines.push({ a: ACC.SHIPPING, v: -o.ship });
      if (o.fee) lines.push({ a: ACC.FEES, v: -o.fee });
      if (o.pay === 'credit') {
        // Pay down what is still owed first; anything already repaid comes back to the wallet.
        const toCredit = Math.min(back, Math.max(0, owedSen(s)));
        if (toCredit) lines.push({ a: ACC.CREDIT, v: toCredit });
        if (back - toCredit) lines.push({ a: ACC.WALLET, v: back - toCredit });
      } else if (o.pay === 'wallet') lines.push({ a: ACC.WALLET, v: back });
      else lines.push({ a: ACC.CLEARING, v: back });  // back to the card or bank account that paid
      s.ledger.push(txn({ id: tid(s), memo: `Refund · ${id}${note ? ' · ' + note : ''}`, kind: 'refund', ref: id, lines }));
      notice(s, 'n.refund', { id }, 'orders');
    }
    s.orders[i] = r.order;
    audit(s, `Order moved to ${to}`, id, by);
    if (to === 'inspected') notice(s, 'n.inspected', { id }, 'orders');
    if (to === 'shipped') notice(s, 'n.shipped', { id }, 'orders');
    return r.order;
  });
}
export { canRefund };

// ---------- wallet ----------
export function topUp(sen, method) {
  return transact((s) => {
    assertInt(sen);
    if (sen < 1000 || sen > 5000000) throw new RuleError('Top up between RM 10 and RM 50,000', 'range');
    const t = txn({ id: tid(s), memo: `Top-up · ${method}`, kind: 'topup', lines: [{ a: ACC.WALLET, v: sen }, { a: ACC.CLEARING, v: -sen }] });
    s.ledger.push(t);
    notice(s, 'n.topup', { amt: sen }, 'wallet');
    audit(s, 'Wallet top-up', t.id);
    return t;
  });
}

export const SUPPLIER_FEE_BPS = 50;
export function paySupplier({ supplierId, newName, via, sen, invoice, escrow }) {
  return transact((s) => {
    assertInt(sen);
    if (sen < 5000) throw new RuleError('Minimum supplier payment is RM 50', 'range');
    if (!invoice || String(invoice).trim().length < 3) throw new RuleError('Add the invoice or order number', 'invoice');
    let sup = s.suppliers.find((x) => x.id === supplierId);
    if (!sup) { if (!newName) throw new RuleError('Choose a supplier', 'sup'); sup = { id: 's' + (s.suppliers.length + 1), name: newName.slice(0, 60), via: via || 'Alipay' }; s.suppliers.push(sup); }
    const fee = pct(sen, SUPPLIER_FEE_BPS);
    const ref = 'PAY-' + new Date().toISOString().slice(5, 10).replace('-', '') + '-' + next(s, 'pay');
    charge(s, 'wallet', sen + fee, [{ a: escrow ? ACC.ESCROW : ACC.SUPPLIER, v: sen }, { a: ACC.FEES, v: fee }], `Supplier payment · ${sup.via} · ${sup.name}`, ref, 'supplier');
    if (escrow) (s.supplierHolds = s.supplierHolds || []).unshift({ ref, sen, sup: sup.name, via: sup.via, state: 'held', at: now() });
    audit(s, `Supplier payment${escrow ? ' held in escrow' : ''}`, ref);
    return { ref, fee, sup };
  });
}

/** Control: pay a held supplier payment out (after inspection) or return it to the wallet. */
export function settleSupplierHold(ref, release) {
  return transact((s) => {
    const h = (s.supplierHolds || []).find((x) => x.ref === ref);
    if (!h || h.state !== 'held') throw new RuleError('Already decided', 'state');
    s.ledger.push(txn({ id: tid(s), memo: `${release ? 'Supplier paid from escrow' : 'Supplier payment refunded'} · ${ref}`, kind: release ? 'release' : 'refund', ref, lines: [{ a: ACC.ESCROW, v: -h.sen }, { a: release ? ACC.SUPPLIER : ACC.WALLET, v: h.sen }] }));
    h.state = release ? 'paid' : 'refunded';
    audit(s, release ? 'Released supplier payment' : 'Refunded supplier payment', ref, 'Control');
    return h;
  });
}

// ---------- warehouse ----------
export function nameFor(pattern, vars) {
  return String(pattern || '{contents}').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '').replace(/\s·\s(?=\s|$)/g, '').trim().slice(0, 60);
}

export function declareParcel({ contents, source, courier, cartons, valueSen, name }) {
  return transact((s) => {
    if (!contents || contents.trim().length < 2) throw new RuleError('Say what is inside', 'contents');
    if (!Number.isInteger(cartons) || cartons < 1 || cartons > 500) throw new RuleError('Cartons must be 1 to 500', 'cartons');
    const pid = 'EZ-P-' + next(s, 'parcel');
    const nm = name?.trim() || nameFor(s.prefs.naming.cargo, { contents: contents.trim(), source: source || '', date: new Date().toISOString().slice(0, 10) });
    s.parcels.unshift({ id: pid, name: nm, contents: contents.trim().slice(0, 60), source: (source || '').slice(0, 40), cartons, grams: 0, cm3: 0, valueSen: valueSen || 0, state: 'coming', arrivedAt: 0, extraDays: 0, photos: 0, courier: (courier || '').slice(0, 40), checks: [] });
    audit(s, 'Declared parcel', pid);
    return pid;
  });
}

export function receiveParcel(id, { grams, cm3, photos = 4 }) {
  return transact((s) => {
    const p = s.parcels.find((x) => x.id === id);
    if (!p || p.state !== 'coming') throw new RuleError('Parcel is not waiting to be received', 'state');
    if (!(grams > 0) || !(cm3 > 0)) throw new RuleError('Enter weight and size', 'measure');
    Object.assign(p, { state: 'stored', grams, cm3, photos, arrivedAt: now() });
    notice(s, 'n.measured', { id }, 'ship');
    audit(s, 'Received and measured parcel', id, 'Warehouse GZ');
    return p;
  });
}

export const EXTRAS = Object.freeze({ repackPerCarton: 300, insuranceBps: 100, returnPerParcel: 1500 });
export const CHECKS = Object.freeze({ photo: { perCarton: 500 }, video: { perCarton: 1200 }, full: { bps: 150 } });

export function shipQuoteFor(s, ids, { mode, dest, repack, insurance }) {
  const ps = s.parcels.filter((p) => ids.includes(p.id) && p.state === 'stored');
  const load = combinedLoad(ps, repack);
  const q = shipQuote({ grams: load.grams, cm3: load.cm3, dest, mode });
  const rp = repack ? EXTRAS.repackPerCarton * load.cartons : 0;
  const ins = insurance ? pct(ps.reduce((a, p) => a + p.valueSen, 0), EXTRAS.insuranceBps) : 0;
  const rent = ps.reduce((a, p) => { const d = STORAGE.freeDays + (p.extraDays || 0) - Math.floor((now() - p.arrivedAt) / 864e5); return a + (d < 0 ? -d * STORAGE.perCartonDay * p.cartons : 0); }, 0);
  return { parcels: ps, load, ship: q.sen, days: q.days, repack: rp, insurance: ins, rent, total: q.sen + rp + ins + rent };
}

export function shipParcels({ ids, mode, dest, addrId, name, repack, insurance, pay }) {
  return transact((s) => {
    if (!ids?.length) throw new RuleError('Choose parcels to ship', 'none');
    if (!s.addresses.some((a) => a.id === addrId)) throw new RuleError('Choose a delivery address', 'addr');
    const q = shipQuoteFor(s, ids, { mode, dest, repack, insurance });
    if (q.parcels.length !== ids.length) throw new RuleError('Some parcels are not in your bay', 'state');
    const sid = 'EZ-S-' + next(s, 'shipment');
    const fee = pct(q.total, PAY_FEE_BPS[pay] ?? 0);
    charge(s, pay, q.total + fee, [{ a: ACC.SHIPPING, v: q.ship + q.repack + q.insurance }, { a: ACC.STORAGE, v: q.rent }, { a: ACC.FEES, v: fee }], `Shipping · ${sid} · ${mode}`, sid, 'fee');
    const nm = name?.trim() || nameFor(s.prefs.naming.shipment, { dest, date: new Date().toISOString().slice(0, 10), contents: q.parcels.map((p) => p.contents).join(', ') });
    s.shipments.unshift({ id: sid, name: nm.slice(0, 60), parcelIds: ids.slice(), cartons: q.load.cartons, grams: q.load.grams, mode, dest, sen: q.total + fee, createdAt: now(), state: 'packing', progress: 0.05, eta: now() + q.days[1] * 864e5, tracking: tracking(next(s, 'trk') + 204400000), addrId });
    q.parcels.forEach((p) => { p.state = 'shipped'; p.shipmentId = sid; });
    notice(s, 'n.shipBooked', { id: sid }, 'track');
    audit(s, `Booked ${mode} shipment for ${ids.length} parcels`, sid);
    return s.shipments[0];
  });
}

export function inspectParcel(id, kind, pay = 'wallet') {
  return transact((s) => {
    const p = s.parcels.find((x) => x.id === id && x.state === 'stored');
    if (!p) throw new RuleError('Parcel is not in your bay', 'state');
    const r = CHECKS[kind]; if (!r) throw new RuleError('Choose a check', 'kind');
    if ((p.checks || []).includes(kind)) throw new RuleError('This check is already done for this parcel', 'dup');
    const sen = r.perCarton ? r.perCarton * p.cartons : Math.max(1000, pct(p.valueSen, r.bps));
    charge(s, pay, sen, [{ a: ACC.FEES, v: sen }], `Inspection · ${kind} · ${id}`, id, 'fee');
    p.checks = [...new Set([...(p.checks || []), kind])];
    audit(s, `Ordered ${kind} inspection`, id);
    return sen;
  });
}

export function keepParcels(ids, days = 14) {
  return transact((s) => {
    const ps = s.parcels.filter((p) => ids.includes(p.id) && p.state === 'stored');
    if (!ps.length) throw new RuleError('Choose parcels in your bay', 'none');
    const sen = ps.reduce((a, p) => a + days * STORAGE.perCartonDay * p.cartons, 0);
    charge(s, 'wallet', sen, [{ a: ACC.STORAGE, v: sen }], `Storage · ${days} more days · ${ps.length} parcel(s)`, ids.join(','), 'fee');
    ps.forEach((p) => { p.extraDays = (p.extraDays || 0) + days; });
    audit(s, `Extended storage ${days} days`, ids.join(','));
    return sen;
  });
}

export function returnParcels(ids) {
  return transact((s) => {
    const ps = s.parcels.filter((p) => ids.includes(p.id) && p.state === 'stored');
    if (!ps.length) throw new RuleError('Choose parcels in your bay', 'none');
    const sen = EXTRAS.returnPerParcel * ps.length;
    charge(s, 'wallet', sen, [{ a: ACC.SHIPPING, v: sen }], `Return to seller · ${ps.map((p) => p.id).join(', ')}`, ids.join(','), 'fee');
    ps.forEach((p) => { p.state = 'returning'; });
    audit(s, 'Return to seller booked', ids.join(','));
    return sen;
  });
}

export function rename(kind, id, name) {
  return transact((s) => {
    const nm = String(name || '').trim().replace(/\s+/g, ' ');
    if (nm.length < 2 || nm.length > 60) throw new RuleError('Name must be 2 to 60 characters', 'name');
    const list = kind === 'parcel' ? s.parcels : kind === 'shipment' ? s.shipments : s.orders;
    const x = list.find((v) => v.id === id); if (!x) throw new RuleError('Not found', 'nf');
    x.name = nm;
    return x;
  });
}

export function advanceShipment(id) {
  return transact((s) => {
    const sh = s.shipments.find((x) => x.id === id); if (!sh) throw new RuleError('Not found', 'nf');
    const order = ['packing', 'departed', 'at_sea', 'customs', 'out', 'delivered'];
    const i = order.indexOf(sh.state);
    if (i < 0 || i === order.length - 1) throw new RuleError('Shipment already delivered', 'state');
    sh.state = order[i + 1]; sh.progress = [0.05, 0.2, 0.58, 0.8, 0.93, 1][i + 1];
    if (sh.state === 'delivered') { s.parcels.forEach((p) => { if (p.shipmentId === id) p.state = 'delivered'; }); notice(s, 'n.delivered', { id }, 'track'); }
    audit(s, `Shipment ${sh.state}`, id, 'Logistics');
    return sh;
  });
}

// ---------- group buy ----------
export function joinGroup(gid, pcs, pay = 'wallet') {
  return transact((s) => {
    const g = s.groups.find((x) => x.id === gid);
    if (!g || !groupOpen(g)) throw new RuleError('This deal is closed', 'closed');
    if (!Number.isInteger(pcs) || pcs < 10) throw new RuleError('Join with at least 10 pieces', 'pcs');
    const p = byId(g.pid);
    const fen = groupPrice(g.ladder, g.committed + pcs, p.t[0][1]);
    const dep = pct(Math.round((fen * pcs) / 1.6437), DEPOSIT_BPS);
    charge(s, pay, dep, [{ a: ACC.DEPOSIT, v: dep }], `Group deal deposit · ${gid}`, gid, 'deposit');
    g.committed += pcs; g.shops += s.joins.some((j) => j.gid === gid) ? 0 : 1;
    s.joins.push({ gid, pcs, dep, at: now() });
    audit(s, `Joined group deal with ${pcs} pcs`, gid);
    return { dep, fen };
  });
}

/** Close groups whose deadline has passed. Failed groups return every deposit in full. Safe to call often. */
export function settleGroups(at = now()) {
  const due = get().groups.filter((g) => g.state === 'open' && at >= g.endsAt);
  if (!due.length) return 0;
  return transact((s) => {
    let n = 0;
    for (const g of s.groups) {
      if (g.state !== 'open' || at < g.endsAt) continue;
      const st = settleGroup(g, at).state;
      g.state = st;
      if (st === 'failed') {
        const dep = s.joins.filter((j) => j.gid === g.id && !j.returned).reduce((a, j) => a + j.dep, 0);
        if (dep) s.ledger.push(txn({ id: tid(s), memo: `Deposit returned · ${g.id}`, kind: 'refund', ref: g.id, lines: [{ a: ACC.DEPOSIT, v: -dep }, { a: ACC.WALLET, v: dep }] }));
        s.joins.forEach((j) => { if (j.gid === g.id) j.returned = true; });
        if (dep) notice(s, 'n.depositBack', { id: g.id }, 'wallet');
      }
      n++;
    }
    return n;
  });
}

export function createGroup({ pid, goal, days, pcs, pay = 'wallet' }) {
  const p = byId(pid);
  if (!p) throw new RuleError('Choose a product', 'pid');
  if (!Number.isInteger(goal) || goal < p.t[1][0]) throw new RuleError('Goal must reach the second price step', 'goal');
  if (![1, 2, 3, 5, 7].includes(days)) throw new RuleError('Choose a deadline', 'days');
  const gid = transact((s) => {
    const id = 'g' + (next(s, 'group'));
    s.groups.unshift({ id, pid, ladder: p.t.slice(1).map(([m, f]) => [m, f]), committed: 0, goal, endsAt: now() + days * 864e5, shops: 0, state: 'open', mine: true });
    return id;
  });
  try { joinGroup(gid, pcs, pay); }
  catch (e) { transact((s) => { s.groups = s.groups.filter((g) => g.id !== gid); }); throw e; }
  return gid;
}

// ---------- credit ----------
export function repayCredit(sen) {
  return transact((s) => {
    const owed = owedSen(s);
    if (owed <= 0) throw new RuleError('Nothing to repay', 'none');
    const v = Math.min(sen, owed);
    charge(s, 'wallet', v, [{ a: ACC.CREDIT, v }], 'Credit repaid', 'credit', 'repay');
    s.credit.onTimePayments += 1;
    return v;
  });
}

// ---------- account ----------
export function setPref(path, value) {
  return transact((s) => {
    const keys = path.split('.'); let o = s.prefs;
    keys.slice(0, -1).forEach((k) => { o = o[k] = o[k] || {}; });
    o[keys.at(-1)] = value;
  });
}
export function setProfile(field, value) {
  return transact((s) => {
    if (!['name', 'shop', 'phone', 'email'].includes(field)) throw new RuleError('Unknown field', 'field');
    const v = String(value || '').trim();
    if (field === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new RuleError('Enter a valid email', 'email');
    if (field === 'phone' && v && !/^\+?[\d\s-]{7,18}$/.test(v)) throw new RuleError('Enter a valid phone number', 'phone');
    if ((field === 'name' || field === 'shop') && v.length < 2) throw new RuleError('Too short', 'short');
    s.profile[field] = v.slice(0, 80);
  });
}
export function saveAddress(a) {
  return transact((s) => {
    for (const k of ['name', 'phone', 'line', 'city', 'postcode']) if (!String(a[k] || '').trim()) throw new RuleError('Fill in every address line', 'addr');
    if (!/^\d{4,6}$/.test(String(a.postcode).trim())) throw new RuleError('Postcode must be 4 to 6 digits', 'postcode');
    const clean = { id: a.id || 'a' + next(s, 'addr'), label: (a.label || 'Address').slice(0, 20), name: a.name.trim().slice(0, 60), phone: a.phone.trim().slice(0, 20), line: a.line.trim().slice(0, 120), city: a.city.trim().slice(0, 40), postcode: String(a.postcode).trim(), state: (a.state || '').slice(0, 40), country: a.country || 'MY', isDefault: !!a.isDefault || !s.addresses.length };
    if (clean.isDefault) s.addresses.forEach((x) => { x.isDefault = false; });
    const i = s.addresses.findIndex((x) => x.id === clean.id);
    if (i >= 0) s.addresses[i] = clean; else s.addresses.push(clean);
    return clean;
  });
}
export function setDefaultAddress(id) { return transact((s) => { if (!s.addresses.some((a) => a.id === id)) throw new RuleError('Not found', 'nf'); s.addresses.forEach((a) => { a.isDefault = a.id === id; }); }); }
export function deleteAddress(id) {
  return transact((s) => {
    if (s.addresses.length <= 1) throw new RuleError('Keep at least one address', 'last');
    const was = s.addresses.find((a) => a.id === id); if (!was) throw new RuleError('Not found', 'nf');
    s.addresses = s.addresses.filter((a) => a.id !== id);
    if (was.isDefault) s.addresses[0].isDefault = true;
  });
}

/** Verify the payment PIN. Updates the attempt counter; returns {ok, left, locked}. */
export async function verifyPin(pin) {
  const s = get();
  const r = await checkPin(s.sec, pin);
  transact((st) => { st.sec = r.sec; });
  return r;
}
export async function changePin(oldPin, newPin) {
  const r = await verifyPin(oldPin);
  if (!r.ok) throw new RuleError(r.locked ? 'Too many tries. Try again in 5 minutes' : 'Current PIN is wrong', 'pin');
  if (!pinFormatOk(newPin)) throw new RuleError('Use 6 digits that are not all the same or in a row', 'weak');
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
  const hash = await hashPin(newPin, salt);
  transact((s) => { s.sec.salt = salt; s.sec.pinHash = hash; s.sec.fails = 0; });
  transact((s) => audit(s, 'Changed payment PIN', 'security'));
}

export function markRead() { transact((s) => { s.notices.forEach((n) => { n.read = true; }); }); }

export function addTicket(subject, text) {
  return transact((s) => {
    const t = String(text || '').trim(); if (t.length < 5) throw new RuleError('Tell us a little more', 'short');
    const id = 'EZT-' + next(s, 'ticket');
    s.tickets.unshift({ id, who: s.profile.code, subject: String(subject || t).slice(0, 80), state: 'open', at: now(), msgs: [{ from: 'customer', text: t.slice(0, 1000), at: now() }] });
    return id;
  });
}

export function cartAdd(pid, qty, col = 0) {
  return transact((s) => {
    const p = byId(pid); if (!p) throw new RuleError('Product not found', 'nf');
    if (!Number.isInteger(qty) || qty < p.t[0][0]) throw new RuleError('Below the minimum order', 'moq');
    if (qty > 1000000) throw new RuleError('Quantity too large', 'max');
    const it = s.cart.find((c) => c.pid === pid && c.col === col);
    if (it) it.qty = qty; else s.cart.push({ pid, qty, col });
  });
}
export function cartSet(i, qty) { return transact((s) => { const it = s.cart[i]; if (!it) return; const p = byId(it.pid); if (qty < p.t[0][0]) throw new RuleError('Below the minimum order', 'moq'); it.qty = qty; }); }
export function cartRemove(i) { return transact((s) => { s.cart.splice(i, 1); }); }

export function viewed(pid) { if (get().recent[0] === pid) return; transact((s) => { s.recent = [pid, ...s.recent.filter((x) => x !== pid)].slice(0, 12); }); }

// ---------- control centre ----------
export function decideApplication(id, ok) { return transact((s) => { const a = s.applications.find((x) => x.id === id); if (!a || a.state !== 'pending') throw new RuleError('Already decided', 'state'); a.state = ok ? 'approved' : 'rejected'; audit(s, `Factory application ${a.state}`, id, 'Control'); }); }
export function setCustomerState(code, state) { return transact((s) => { const c = s.customers.find((x) => x.code === code); if (!c) throw new RuleError('Not found', 'nf'); c.state = state; audit(s, `Customer ${state}`, code, 'Control'); }); }
export function replyTicket(id, text, from = 'support') { return transact((s) => { const t = s.tickets.find((x) => x.id === id); if (!t) throw new RuleError('Not found', 'nf'); const v = String(text || '').trim(); if (!v) throw new RuleError('Write a reply', 'empty'); t.msgs.push({ from, text: v.slice(0, 1000), at: now() }); if (from === 'support') t.state = 'answered'; }); }
export { cartonsFor, inspectionSen };
