import test from 'node:test';
import assert from 'node:assert/strict';
import { cnyToMyr, pct, parseMoney, fmt } from '../../src/core/money.js';
import { txn, balance, isBalanced, ACC, LedgerError, walletStatement } from '../../src/core/ledger.js';
import { html, raw, esc, safeHref, safeImg } from '../../src/core/html.js';
import { PRODUCTS, byId } from '../../src/domain/catalog.js';
import { unitFen, nextTier, shipQuote, landed, storage, combinedLoad, cartonsFor } from '../../src/domain/pricing.js';
import { canMove, move, TransitionError, STEPS } from '../../src/domain/escrow.js';
import { groupPrice, settleGroup, trustScore, creditLimit, band, makeCode, validCode, pinFormatOk, hashPin, checkPin, PIN_TRIES } from '../../src/domain/rules.js';
import * as store from '../../src/core/store.js';
import { seed, DEMO_PIN } from '../../src/domain/seed.js';
import * as svc from '../../src/domain/services.js';

// ---------- money ----------
test('money: integer only, conversion and rounding', () => {
  assert.equal(cnyToMyr(16437), 10000);
  assert.equal(pct(10000, 150), 150);
  assert.equal(pct(333, 50), 2);
  assert.throws(() => pct(1.5, 10), TypeError);
  assert.equal(parseMoney('1,234.50'), 123450);
  assert.equal(parseMoney('RM 20'), 2000);
  assert.equal(parseMoney('1.2.3'), null);
  assert.equal(parseMoney('-5'), null);
  assert.equal(parseMoney('1e5'), null);
  assert.equal(parseMoney('12.345'), null);
  assert.equal(parseMoney('RM 1,000'), 100000);
  assert.equal(fmt(123450), 'RM1,234.50');
  assert.equal(fmt(-500), '−RM5.00');
  assert.equal(fmt(500, 'MYR', { plus: true }), '+RM5.00');
});

// ---------- ledger ----------
test('ledger: transactions must balance', () => {
  assert.throws(() => txn({ id: 'x', memo: 'bad', lines: [{ a: 'a', v: 10 }, { a: 'b', v: -9 }] }), LedgerError);
  assert.throws(() => txn({ id: 'x', memo: 'bad', lines: [{ a: 'a', v: 10 }] }), LedgerError);
  assert.throws(() => txn({ id: 'x', memo: '', lines: [{ a: 'a', v: 1 }, { a: 'b', v: -1 }] }), LedgerError);
  assert.throws(() => txn({ id: 'x', memo: 'float', lines: [{ a: 'a', v: 0.5 }, { a: 'b', v: -0.5 }] }), TypeError);
  const L = [txn({ id: '1', memo: 'top', lines: [{ a: ACC.WALLET, v: 1000 }, { a: ACC.CLEARING, v: -1000 }] })];
  assert.equal(balance(L, ACC.WALLET), 1000);
  assert.ok(isBalanced(L));
  assert.equal(walletStatement(L)[0].v, 1000);
});

// ---------- safe html ----------
test('html: escapes everything that is not marked safe', () => {
  const evil = '<img src=x onerror=alert(1)>"\'';
  const out = String(html`<p title="${evil}">${evil}</p>`);
  assert.ok(!out.includes('<img'));
  assert.ok(out.includes('&lt;img'));
  assert.ok(!out.includes('"\''));
  assert.equal(String(html`${raw('<b>ok</b>')}`), '<b>ok</b>');
  assert.equal(String(html`${[html`<i>a</i>`, '<x>']}`), '<i>a</i>&lt;x&gt;');
  assert.equal(esc('`'), '&#96;');
  assert.equal(safeHref('javascript:alert(1)'), '#');
  assert.equal(safeHref('#p-p1'), '#p-p1');
  assert.equal(safeImg('javascript:1'), '');
  assert.equal(safeImg('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
});

// ---------- pricing ----------
test('pricing: tiers, next tier and minimum order', () => {
  const p = byId('p1');
  assert.equal(unitFen(p, 99), null);
  assert.equal(unitFen(p, 100), 2600);
  assert.equal(unitFen(p, 499), 2600);
  assert.equal(unitFen(p, 500), 2200);
  assert.equal(unitFen(p, 3000), 1900);
  assert.deepEqual(nextTier(p, 450), { need: 50, fen: 2200, min: 500 });
  assert.equal(nextTier(p, 3000), null);
  for (const q of PRODUCTS) { for (let i = 1; i < q.t.length; i++) { assert.ok(q.t[i][0] > q.t[i - 1][0], q.id + ' tiers ascend'); assert.ok(q.t[i][1] < q.t[i - 1][1], q.id + ' price falls'); } }
});

test('pricing: shipping uses the larger of real and volume weight', () => {
  const light = shipQuote({ grams: 1000, cm3: 60000, dest: 'MY', mode: 'air' }); // 60000/6000 = 10 kg volume
  assert.equal(light.chargeG, 10000);
  assert.equal(light.sen, 18000);
  const heavy = shipQuote({ grams: 20000, cm3: 6000, dest: 'MY', mode: 'air' });
  assert.equal(heavy.chargeG, 20000);
  const sea = shipQuote({ grams: 1, cm3: 1000, dest: 'MY', mode: 'sea' });
  assert.equal(sea.chargeCm3, 250000); // minimum 0.25 CBM
  assert.equal(sea.sen, 16250);
  assert.throws(() => shipQuote({ grams: -1, cm3: 0 }), RangeError);
});

test('pricing: landed cost adds up exactly', () => {
  for (const p of PRODUCTS) {
    const l = landed(p, p.t[1][0], { dest: 'SA', mode: 'air', insp: 'full', pay: 'card' });
    assert.equal(l.total, l.goods + l.inspection + l.ship + l.fee, p.id);
    assert.ok(Number.isInteger(l.total) && l.total > 0);
    assert.equal(l.cartons, cartonsFor(p.cbm * p.t[1][0]));
  }
  assert.equal(landed(byId('p1'), 10), null);
});

test('pricing: storage days and rent', () => {
  const D = 864e5, t0 = Date.now();
  assert.deepEqual(storage({ arrivedAt: t0 - 3 * D, cartons: 2 }, t0), { daysLeft: 11, rent: 0 });
  assert.deepEqual(storage({ arrivedAt: t0 - 16 * D, cartons: 2 }, t0), { daysLeft: -2, rent: 480 });
  assert.equal(storage({ arrivedAt: t0 - 16 * D, cartons: 2, extraDays: 14 }, t0).daysLeft, 12);
  assert.equal(combinedLoad([{ grams: 1, cm3: 100, cartons: 1 }, { grams: 2, cm3: 100, cartons: 2 }], true).cm3, 156);
});

// ---------- escrow ----------
test('escrow: only allowed steps, money only on release or refund', () => {
  assert.ok(canMove('paid', 'confirmed'));
  assert.ok(!canMove('paid', 'released'));
  assert.ok(!canMove('released', 'refunded'));
  assert.ok(!canMove('delivered', 'paid'));
  let o = { id: 'o', state: 'paid', history: [] };
  const seen = [];
  for (const s of STEPS.slice(1)) { const r = move(o, s); seen.push(r.money); o = r.order; }
  assert.deepEqual(seen.filter(Boolean), ['release']);
  assert.equal(o.history.length, 7);
  assert.throws(() => move(o, 'refunded'), TransitionError);
  assert.equal(move({ id: 'x', state: 'arrived' }, 'refunded').money, 'refund');
});

// ---------- rules ----------
test('group buy: price follows the ladder; deadline settles', () => {
  const ladder = [[1000, 2200], [3000, 1900]];
  assert.equal(groupPrice(ladder, 999, 2600), 2600);
  assert.equal(groupPrice(ladder, 1000, 2600), 2200);
  assert.equal(groupPrice(ladder, 5000, 2600), 1900);
  const g = { state: 'open', committed: 900, ladder, endsAt: 10 };
  assert.equal(settleGroup(g, 5).state, 'open');
  assert.equal(settleGroup(g, 11).state, 'failed');
  assert.equal(settleGroup({ ...g, committed: 1200 }, 11).state, 'producing');
});

test('credit: score bounds, bands and limits', () => {
  assert.equal(trustScore({}), 520);
  assert.equal(trustScore({ onTimePayments: 999, volumeSen: 1e12, monthsActive: 999 }), 850);
  assert.equal(trustScore({ latePayments: 99 }), 300);
  assert.equal(band(800), 'excellent'); assert.equal(band(710), 'good'); assert.equal(band(650), 'fair'); assert.equal(band(500), 'building');
  assert.equal(creditLimit(600), 0);
  assert.equal(creditLimit(742), 2000000);
});

test('customer codes carry a check letter', () => {
  const c = makeCode('MY', 10482);
  assert.match(c, /^MY-[A-Z]\d{5}$/);
  assert.ok(validCode(c));
  assert.ok(!validCode(c.replace(/\d$/, (d) => String((+d + 1) % 10))));
  assert.ok(!validCode('MY-10482'));
});

test('PIN: weak PINs refused, hash check, lock after 5 tries', async () => {
  assert.ok(!pinFormatOk('111111')); assert.ok(!pinFormatOk('123456')); assert.ok(!pinFormatOk('12345')); assert.ok(pinFormatOk('246810'));
  let sec = { salt: 's', pinHash: await hashPin('246810', 's'), fails: 0, lockUntil: 0 };
  assert.ok((await checkPin(sec, '246810')).ok);
  for (let i = 0; i < PIN_TRIES; i++) { const r = await checkPin(sec, '000001', 1000); sec = r.sec; if (i < PIN_TRIES - 1) assert.equal(r.left, PIN_TRIES - 1 - i); else assert.ok(r.locked); }
  assert.ok((await checkPin(sec, '246810', 2000)).locked);
});

// ---------- services, end to end on the real store ----------
function fresh() { store.reset(() => seed()); return store.get(); }

test('seed: ledger balances and demo PIN works', async () => {
  const s = fresh();
  assert.ok(isBalanced(s.ledger));
  assert.ok(svc.walletSen(s) > 0);
  assert.ok((await svc.verifyPin(DEMO_PIN)).ok);
});

test('checkout: pays into escrow, empties cart, keeps ledger balanced', () => {
  const s = fresh();
  const w0 = svc.walletSen(s), e0 = svc.escrowSen(s);
  const q = svc.quoteCart(s, { dest: 'MY', mode: 'sea', insp: 'std', pay: 'wallet' });
  const r = svc.checkout({ dest: 'MY', mode: 'sea', insp: 'std', pay: 'wallet', addrId: 'a1', name: 'Test' });
  const s2 = store.get();
  assert.equal(r.ids.length, 2);
  assert.equal(svc.walletSen(s2), w0 - q.total);
  assert.equal(svc.escrowSen(s2) - e0, q.goods + q.inspection);
  assert.equal(s2.cart.length, 0);
  assert.ok(isBalanced(s2.ledger));
});

test('checkout: refuses when the wallet is short and changes nothing', () => {
  const s = fresh();
  store.transact((st) => { st.cart = [{ pid: 'p11', qty: 1000, col: 0 }]; });
  const before = JSON.stringify(store.get());
  assert.throws(() => svc.checkout({ dest: 'MY', mode: 'air', insp: 'full', pay: 'wallet', addrId: 'a1' }), /Not enough money/);
  assert.equal(JSON.stringify(store.get()), before);
  assert.throws(() => svc.checkout({ dest: 'MY', mode: 'sea', insp: 'std', pay: 'wallet', addrId: 'nope' }), /address/);
});

test('order release pays the factory; refund returns everything', () => {
  fresh();
  const { ids } = svc.checkout({ dest: 'MY', mode: 'sea', insp: 'std', pay: 'wallet', addrId: 'a1' });
  const [a, b] = ids;
  for (const st of ['confirmed', 'production', 'arrived', 'inspected', 'released']) svc.advanceOrder(a, st);
  const s = store.get();
  const o = s.orders.find((x) => x.id === a);
  assert.equal(balance(s.ledger, ACC.FACTORY) >= o.goods, true);
  const w = svc.walletSen(s);
  svc.advanceOrder(b, 'refunded', 'control', 'failed inspection');
  const ob = store.get().orders.find((x) => x.id === b);
  assert.equal(svc.walletSen(store.get()) - w, ob.goods + ob.insp + ob.ship + ob.fee);
  assert.throws(() => svc.advanceOrder(a, 'refunded'), TransitionError);
  assert.ok(isBalanced(store.get().ledger));
});

test('credit checkout adds debt and repay clears it', () => {
  fresh();
  svc.checkout({ dest: 'MY', mode: 'sea', insp: 'std', pay: 'credit', addrId: 'a1' });
  const owed = svc.owedSen();
  assert.ok(owed > 0);
  const paid = svc.repayCredit(owed + 999);
  assert.equal(paid, owed);
  assert.equal(svc.owedSen(), 0);
});

test('warehouse: declare, receive, inspect, keep, ship, return', () => {
  fresh();
  assert.throws(() => svc.declareParcel({ contents: 'x', cartons: 1 }), /inside/);
  const id = svc.declareParcel({ contents: 'Bags', source: 'Taobao', courier: 'SF 1', cartons: 2, valueSen: 50000 });
  assert.throws(() => svc.shipParcels({ ids: [id], mode: 'air', dest: 'MY', addrId: 'a1', pay: 'wallet' }), /not in your bay/);
  svc.receiveParcel(id, { grams: 9000, cm3: 90000 });
  const fee = svc.inspectParcel(id, 'photo');
  assert.equal(fee, 1000);
  svc.keepParcels([id], 14);
  assert.equal(store.get().parcels.find((p) => p.id === id).extraDays, 14);
  const sh = svc.shipParcels({ ids: [id, 'EZ-P-20877'], mode: 'air', dest: 'MY', addrId: 'a1', repack: true, insurance: true, pay: 'wallet' });
  assert.ok(svc.validTracking(sh.tracking));
  assert.equal(store.get().parcels.find((p) => p.id === id).state, 'shipped');
  svc.returnParcels(['EZ-P-20891']);
  assert.equal(store.get().parcels.find((p) => p.id === 'EZ-P-20891').state, 'returning');
  for (let i = 0; i < 5; i++) svc.advanceShipment(sh.id);
  assert.equal(store.get().parcels.find((p) => p.id === id).state, 'delivered');
  assert.ok(isBalanced(store.get().ledger));
});

test('group buy: join takes a 30% deposit; create needs the second price step', () => {
  fresh();
  const s = store.get(); const g = s.groups[0]; const c0 = g.committed;
  const { dep } = svc.joinGroup(g.id, 100);
  assert.ok(dep > 0);
  assert.equal(store.get().groups[0].committed, c0 + 100);
  assert.throws(() => svc.joinGroup(g.id, 3), /at least 10/);
  assert.throws(() => svc.createGroup({ pid: 'p5', goal: 10, days: 3, pcs: 50 }), /second price step/);
  const gid = svc.createGroup({ pid: 'p5', goal: 1000, days: 3, pcs: 50 });
  assert.equal(store.get().groups.find((x) => x.id === gid).committed, 50);
});

test('supplier payment, top-up limits, rename and addresses validate input', () => {
  fresh();
  assert.throws(() => svc.topUp(500, 'FPX'), /between/);
  svc.topUp(100000, 'FPX');
  assert.throws(() => svc.paySupplier({ supplierId: 's1', sen: 100000, invoice: '' }), /invoice/);
  const r = svc.paySupplier({ supplierId: 's1', sen: 100000, invoice: 'INV-1', escrow: true });
  assert.equal(r.fee, 500);
  assert.throws(() => svc.rename('parcel', 'EZ-P-20877', 'x'), /2 to 60/);
  svc.rename('parcel', 'EZ-P-20877', '  Raya   tumblers ');
  assert.equal(store.get().parcels.find((p) => p.id === 'EZ-P-20877').name, 'Raya tumblers');
  assert.throws(() => svc.saveAddress({ name: 'A', phone: '1', line: 'x', city: 'y', postcode: 'abc' }), /Postcode/);
  const a = svc.saveAddress({ name: 'A B', phone: '+60 12 3456789', line: 'Jalan 1', city: 'KL', postcode: '50000', isDefault: true });
  assert.equal(svc.defaultAddr().id, a.id);
  svc.deleteAddress(a.id);
  assert.ok(svc.defaultAddr());
  assert.throws(() => svc.setProfile('email', 'nope'), /valid email/);
  assert.ok(isBalanced(store.get().ledger));
});

test('PIN change refuses weak PINs and old PIN stops working', async () => {
  fresh();
  await assert.rejects(() => svc.changePin('000000', '135790'), /wrong/);
  await assert.rejects(() => svc.changePin(DEMO_PIN, '123456'), /6 digits/);
  await svc.changePin(DEMO_PIN, '135790');
  assert.ok(!(await svc.verifyPin(DEMO_PIN)).ok);
  assert.ok((await svc.verifyPin('135790')).ok);
});

test('tracking numbers validate', () => {
  const t = svc.tracking(204418);
  assert.ok(svc.validTracking(t));
  assert.ok(!svc.validTracking(t.slice(0, -1) + ((+t.at(-1) + 1) % 10)));
});

test('review fixes: refunds follow the payment method, credit refunds never over-credit', () => {
  fresh();
  const { ids } = svc.checkout({ dest: 'MY', mode: 'sea', insp: 'std', pay: 'credit', addrId: 'a1' });
  svc.repayCredit(svc.owedSen());
  const w = svc.walletSen();
  svc.advanceOrder(ids[0], 'refunded', 'control');
  const o = store.get().orders.find((x) => x.id === ids[0]);
  assert.equal(svc.owedSen(), 0);
  assert.equal(svc.walletSen() - w, o.goods + o.insp + o.ship + o.fee, 'repaid credit order refunds to the wallet');
  assert.ok(svc.creditInfo().available <= svc.creditInfo().limit);
  store.transact((s) => { s.cart = [{ pid: 'p2', qty: 200, col: 0 }]; });
  const w2 = svc.walletSen();
  const r = svc.checkout({ dest: 'MY', mode: 'sea', insp: 'std', pay: 'card', addrId: 'a1' });
  svc.advanceOrder(r.ids[0], 'refunded', 'control');
  assert.equal(svc.walletSen(), w2, 'card refund goes back to the card, not the wallet');
  assert.ok(isBalanced(store.get().ledger));
});

test('review fixes: credit goods are handed over only after repayment', () => {
  fresh();
  const { ids } = svc.checkout({ dest: 'MY', mode: 'sea', insp: 'std', pay: 'credit', addrId: 'a1' });
  for (const st of ['confirmed', 'production', 'arrived', 'inspected', 'released', 'shipped']) svc.advanceOrder(ids[0], st);
  assert.throws(() => svc.advanceOrder(ids[0], 'delivered'), /repaid/);
  svc.repayCredit(svc.owedSen());
  svc.advanceOrder(ids[0], 'delivered');
});

test('review fixes: failed group deals return deposits; supplier holds can be settled; checks are not sold twice', () => {
  fresh();
  const w = svc.walletSen();
  const gid = svc.createGroup({ pid: 'p5', goal: 1000, days: 3, pcs: 50 });   // 50 pcs is below the 300 minimum
  assert.ok(svc.walletSen() < w, 'deposit taken');
  store.transact((s) => { s.groups.find((x) => x.id === gid).endsAt = Date.now() - 1; });
  assert.equal(svc.settleGroups(), 1);
  assert.equal(store.get().groups.find((x) => x.id === gid).state, 'failed');
  assert.equal(svc.walletSen(), w, 'deposit returned in full');
  assert.equal(svc.settleGroups(), 0, 'settling twice does nothing');
  const r = svc.paySupplier({ supplierId: 's1', sen: 20000, invoice: 'INV-9', escrow: true });
  const e0 = svc.escrowSen();
  svc.settleSupplierHold(r.ref, false);
  assert.equal(e0 - svc.escrowSen(), 20000);
  assert.throws(() => svc.settleSupplierHold(r.ref, true), /Already/);
  svc.inspectParcel('EZ-P-20891', 'photo');
  assert.throws(() => svc.inspectParcel('EZ-P-20891', 'photo'), /already done/);
  assert.ok(isBalanced(store.get().ledger));
});
