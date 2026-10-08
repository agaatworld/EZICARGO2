// All step-by-step flows. Each one: choose → review → confirm (+PIN for money) → receipt.
import { html, raw } from './core/html.js';
import { t, tl } from './core/i18n.js';
import { parseMoney, fmtCny, cnyToMyr, myrToCny, pct } from './core/money.js';
import { byId, DESTS } from './domain/catalog.js';
import * as svc from './domain/services.js';
import { groupPrice, DEPOSIT_BPS, pinFormatOk } from './domain/rules.js';
import { unitFen, landed, PAY_FEE_BPS } from './domain/pricing.js';
import { wizard, prompt, confirm, toast, field } from './ui/ui.js';
import { ic } from './ui/icons.js';
import { artOf } from './ui/parts.js';
import { S, money } from './app.js';

const destName = (id) => t({ MY: 'Malaysia (West)', EM: 'Malaysia (East)', SG: 'Singapore', BN: 'Brunei', SA: 'Saudi Arabia', AE: 'United Arab Emirates' }[id] || id);
export { destName };
const payName = (m) => t({ wallet: 'EZI Wallet', fpx: 'FPX online banking', duitnow: 'DuitNow QR', card: 'Debit or credit card', credit: 'EZI Credit' }[m]);
export { payName };
const val = (el, sel) => (el.querySelector(sel) || {}).value;
const checked = (el, name) => (el.querySelector(`input[name="${name}"]:checked`) || {}).value;

function radio(name, items, cur) {
  return html`<div class="opts" role="radiogroup">${items.map((it) => html`<label class="opt"><input type="radio" name="${name}" value="${it.v}" ${it.v === cur ? raw('checked') : ''} ${it.disabled ? raw('disabled') : ''}><span class="grow"><b>${it.t}</b>${it.s ? html`<small>${it.s}</small>` : ''}</span>${it.end ? html`<span class="end">${it.end}</span>` : ''}</label>`)}</div>`;
}

function payStep(ctx, amount) {
  const s = S(), w = svc.walletSen(s), c = svc.creditInfo(s);
  return {
    title: t('Payment'),
    render: () => html`<h3 class="wz-h">${t('How do you want to pay?')}</h3>${radio('pay', [
      { v: 'wallet', t: payName('wallet'), s: t('Balance {b}', { b: money(w) }), disabled: w < amount(ctx, 'wallet') },
      ...(ctx.allowCredit ? [{ v: 'credit', t: payName('credit'), s: t('Available {b} · pay within 30 days', { b: money(c.available) }), disabled: c.available < amount(ctx, 'credit') }] : []),
      { v: 'fpx', t: payName('fpx'), s: t('Fee {p}', { p: '0.5%' }) },
      { v: 'duitnow', t: payName('duitnow'), s: t('Fee {p}', { p: '0.5%' }) },
      { v: 'card', t: payName('card'), s: t('Fee {p}', { p: '1.5%' }) },
    ], ctx.pay && !(ctx.pay === 'wallet' && w < amount(ctx, 'wallet')) ? ctx.pay : (w >= amount(ctx, 'wallet') ? 'wallet' : 'fpx'))}`,
    collect: (el) => { ctx.pay = checked(el, 'pay'); return ctx.pay ? '' : t('Choose how to pay'); },
  };
}

function addrStep(ctx) {
  const s = S();
  return {
    title: t('Delivery'),
    render: () => html`<h3 class="wz-h">${t('Where should we deliver?')}</h3>${radio('addr', s.addresses.map((a) => ({ v: a.id, t: `${a.label} · ${a.name}`, s: `${a.line}, ${a.postcode} ${a.city}`, end: a.isDefault ? t('Default') : '' })), ctx.addrId || svc.defaultAddr(s)?.id)}
      <button type="button" class="link" data-new-addr>${ic('plus', 14)} ${t('Add a new address')}</button>`,
    mount: (el, c, goTo) => { el.querySelector('[data-new-addr]').onclick = async () => { const a = await addressForm(); if (a) { c.addrId = a.id; goTo(c._addrStep); } }; },
    collect: (el) => { ctx.addrId = checked(el, 'addr'); return ctx.addrId ? '' : t('Choose a delivery address'); },
  };
}

// ---------- top up ----------
export function topUp() {
  const ctx = { amt: 100000, method: 'FPX' };
  wizard({
    title: t('Top up wallet'), pin: false, verifyPin: svc.verifyPin, ctx,
    steps: [
      { title: t('Amount'), render: () => html`<h3 class="wz-h">${t('How much?')}</h3><div class="chips">${[20000, 50000, 100000, 500000].map((v) => html`<button type="button" class="chip" data-v="${v}">${money(v, { dec: 0 })}</button>`)}</div>${field({ name: 'amt', label: t('Amount (RM)'), value: (ctx.amt / 100).toFixed(2), inputmode: 'decimal' })}<p class="hint">${t('Between RM 10 and RM 50,000')}</p>`,
        mount: (el) => el.querySelectorAll('[data-v]').forEach((b) => { b.onclick = () => { el.querySelector('input[name=amt]').value = (+b.dataset.v / 100).toFixed(2); }; }),
        collect: (el) => { const v = parseMoney(val(el, 'input[name=amt]')); if (v == null || v < 1000 || v > 5000000) return t('Top up between RM 10 and RM 50,000'); ctx.amt = v; return ''; } },
      { title: t('Method'), render: () => html`<h3 class="wz-h">${t('Pay with')}</h3>${radio('m', [{ v: 'FPX', t: payName('fpx'), s: 'Maybank2u · CIMB · Public Bank · RHB' }, { v: 'DuitNow QR', t: payName('duitnow'), s: t('Scan with any Malaysian banking app') }, { v: 'Card', t: payName('card'), s: 'Visa · Mastercard' }], ctx.method)}`,
        collect: (el) => { ctx.method = checked(el, 'm'); return ''; } },
    ],
    review: (c) => [[t('Top up'), money(c.amt)], [t('Method'), c.method], [t('Wallet after'), money(svc.walletSen() + c.amt), true]],
    run: (c) => { const tx = svc.topUp(c.amt, c.method); return { title: t('Top-up received'), rows: [[t('Amount'), money(c.amt)], [t('New balance'), money(svc.walletSen()), true]], ref: tx.id, actions: [{ label: t('Go to wallet'), href: '#wallet' }] }; },
  });
}

// ---------- checkout ----------
export function checkout() {
  const s = S();
  if (!s.cart.length) { toast(t('Your cart is empty'), 'bad'); return; }
  const d = s.prefs.defaults;
  const ctx = { dest: d.dest, mode: d.mode, insp: d.insp, pay: d.pay, addrId: svc.defaultAddr(s)?.id, name: '', allowCredit: true, _addrStep: 1 };
  const q = (c, pay = c.pay) => svc.quoteCart(S(), { dest: c.dest, mode: c.mode, insp: c.insp, pay });
  wizard({
    title: t('Checkout'), pin: true, verifyPin: svc.verifyPin, ctx, confirmLabel: t('Pay now'),
    steps: [
      { title: t('Shipping'), render: (c) => html`<h3 class="wz-h">${t('Ship to')}</h3>
          <div class="field"><label for="co-d">${t('Country')}</label><select id="co-d" name="dest">${DESTS.map((x) => html`<option value="${x.id}" ${x.id === c.dest ? raw('selected') : ''}>${destName(x.id)}</option>`)}</select></div>
          ${radio('mode', [{ v: 'sea', t: t('Sea · {a}–{b} days', { a: 14, b: 21 }), s: t('Cheapest for bulk stock') }, { v: 'air', t: t('Air · {a}–{b} days', { a: 5, b: 7 }), s: t('Fastest, priced by weight') }], c.mode)}
          <h3 class="wz-h">${t('Inspection in Guangzhou')}</h3>${radio('insp', [{ v: 'photo', t: t('Photo check'), s: t('RM 5 per carton') }, { v: 'std', t: t('Standard quality check'), s: t('1.5% of goods · recommended') }, { v: 'full', t: t('Full count and quality'), s: t('3% of goods') }], c.insp)}`,
        collect: (el, c) => { c.dest = val(el, '[name=dest]'); c.mode = checked(el, 'mode'); c.insp = checked(el, 'insp'); return ''; } },
      addrStep(ctx),
      { title: t('Name'), render: (c) => html`<h3 class="wz-h">${t('Name this order')}</h3>${field({ name: 'nm', label: t('Order name (optional)'), value: c.name, placeholder: t('e.g. Raya stock'), max: 60 })}<p class="hint">${t('A name you recognise makes it easy to find later.')}</p>`,
        collect: (el, c) => { c.name = val(el, '[name=nm]').trim(); return ''; } },
      payStep(ctx, (c, pay) => q(c, pay).total),
    ],
    review: (c) => { const x = q(c); return [[t('Goods ({n} items)', { n: x.lines.length }), money(x.goods)], [t('Inspection'), money(x.inspection)], [t('Shipping'), money(x.ship)], [t('Payment fee'), money(x.fee)], [t('Pay with'), payName(c.pay)], [t('Total'), money(x.total), true]]; },
    run: (c) => {
      const r = svc.checkout({ dest: c.dest, mode: c.mode, insp: c.insp, pay: c.pay, addrId: c.addrId, name: c.name });
      return { title: t('Payment successful'), text: t('Your money is held in escrow. The factory is paid only after our inspection passes.'), rows: [[t('Orders'), r.ids.join(', ')], [t('Paid'), money(r.total), true]], ref: r.ids[0], actions: [{ label: t('Track my order'), href: '#order/' + r.ids[0] }, { label: t('Continue shopping'), href: '#shop' }] };
    },
  });
}

// ---------- buy now from a product ----------
export function buyNow(pid, qty, col) {
  try { svc.cartAdd(pid, qty, col); } catch (e) { toast(t(e.message), 'bad'); return; }
  checkout();
}

// ---------- ship parcels ----------
export function shipFlow(ids) {
  const s = S();
  if (!ids.length) { toast(t('Choose parcels to ship'), 'bad'); return; }
  const d = s.prefs.defaults;
  const ctx = { ids, mode: d.mode, dest: d.dest, repack: ids.length > 1, insurance: false, addrId: svc.defaultAddr(s)?.id, name: '', pay: 'wallet', _addrStep: 1 };
  const q = (c) => svc.shipQuoteFor(S(), c.ids, c);
  const total = (c, pay = c.pay) => { const x = q(c); return x.total + pct(x.total, PAY_FEE_BPS[pay] ?? 0); };
  wizard({
    title: t('Ship parcels'), pin: true, verifyPin: svc.verifyPin, ctx, confirmLabel: t('Pay and ship'),
    steps: [
      { title: t('Parcels'), render: (c) => { const x = q(c); return html`<h3 class="wz-h">${t('These parcels will ship together')}</h3><div class="card list">${x.parcels.map((p) => html`<div class="li"><span class="ic">${ic('box', 16)}</span><span class="mid"><b>${p.name}</b><small>${p.id} · ${t('{n} ctn', { n: p.cartons })} · ${(p.grams / 1000).toFixed(1)} kg</small></span></div>`)}</div>
          <label class="check"><input type="checkbox" name="repack" ${c.repack ? raw('checked') : ''}><span>${t('Repack into fewer cartons (saves about 22% volume, RM 3 per carton)')}</span></label>
          <label class="check"><input type="checkbox" name="ins" ${c.insurance ? raw('checked') : ''}><span>${t('Shipping insurance (1% of goods value)')}</span></label>`; },
        collect: (el, c) => { c.repack = el.querySelector('[name=repack]').checked; c.insurance = el.querySelector('[name=ins]').checked; return ''; } },
      addrStep(ctx),
      { title: t('Method'), render: (c) => { const air = svc.shipQuoteFor(S(), c.ids, { ...c, mode: 'air' }), sea = svc.shipQuoteFor(S(), c.ids, { ...c, mode: 'sea' }); return html`<h3 class="wz-h">${t('Air or sea?')}</h3>
          <div class="field"><label for="sh-d">${t('Country')}</label><select id="sh-d" name="dest">${DESTS.map((x) => html`<option value="${x.id}" ${x.id === c.dest ? raw('selected') : ''}>${destName(x.id)}</option>`)}</select></div>
          ${radio('mode', [{ v: 'sea', t: t('Sea · {a}–{b} days', { a: sea.days[0], b: sea.days[1] }), end: money(sea.ship) }, { v: 'air', t: t('Air · {a}–{b} days', { a: air.days[0], b: air.days[1] }), end: money(air.ship) }], c.mode)}
          ${field({ name: 'nm', label: t('Name this shipment (optional)'), value: c.name, placeholder: t('e.g. Raya stock'), max: 60 })}`; },
        mount: (el, c, goTo) => { el.querySelector('[name=dest]').onchange = (e) => { c.dest = e.target.value; c.mode = checked(el, 'mode') || c.mode; c.name = val(el, '[name=nm]').trim(); goTo(2); }; },
        collect: (el, c) => { c.dest = val(el, '[name=dest]'); c.mode = checked(el, 'mode'); c.name = val(el, '[name=nm]').trim(); return ''; } },
      payStep(ctx, total),
    ],
    review: (c) => { const x = q(c), tot = total(c); return [[t('Parcels'), String(x.parcels.length)], [t('Shipping'), money(x.ship)], ...(x.repack ? [[t('Repack'), money(x.repack)]] : []), ...(x.insurance ? [[t('Insurance'), money(x.insurance)]] : []), ...(x.rent ? [[t('Storage fee'), money(x.rent)]] : []), [t('Payment fee'), money(tot - x.total)], [t('Total'), money(tot), true]]; },
    run: (c) => { const sh = svc.shipParcels(c); return { title: t('Shipment booked'), rows: [[t('Shipment'), sh.name], [t('Tracking number'), sh.tracking], [t('Paid'), money(sh.sen), true]], ref: sh.tracking, actions: [{ label: t('Track now'), href: '#track/' + sh.tracking }] }; },
  });
}

// ---------- inspection ----------
export function inspectFlow(id) {
  const p = S().parcels.find((x) => x.id === id);
  if (!p) return;
  const price = (k) => k === 'full' ? Math.max(1000, pct(p.valueSen, 150)) : svc.CHECKS[k].perCarton * p.cartons;
  const done = p.checks || [];
  const ctx = { kind: ['photo', 'video', 'full'].find((k) => !done.includes(k)) };
  if (!ctx.kind) { toast(t('Every check is already done for this parcel'), 'good'); return; }
  wizard({
    title: t('Order an inspection'), pin: true, verifyPin: svc.verifyPin, ctx,
    steps: [{ title: t('Check'), render: () => html`<h3 class="wz-h">${p.name}</h3>${radio('k', [{ v: 'photo', t: t('Photo check'), s: done.includes('photo') ? t('Already done') : t('Photos of every carton'), end: money(price('photo')), disabled: done.includes('photo') }, { v: 'video', t: t('Video check'), s: done.includes('video') ? t('Already done') : t('Short video of the goods'), end: money(price('video')), disabled: done.includes('video') }, { v: 'full', t: t('Count and quality'), s: done.includes('full') ? t('Already done') : t('Every piece counted and checked'), end: money(price('full')), disabled: done.includes('full') }], ctx.kind)}`,
      collect: (el, c) => { c.kind = checked(el, 'k'); return ''; } }],
    review: (c) => [[t('Parcel'), p.id], [t('Check'), t({ photo: 'Photo check', video: 'Video check', full: 'Count and quality' }[c.kind])], [t('Pay with'), payName('wallet')], [t('Total'), money(price(c.kind)), true]],
    run: (c) => { const sen = svc.inspectParcel(id, c.kind); return { title: t('Inspection ordered'), text: t('Our Guangzhou team will add the results to this parcel within 24 hours.'), rows: [[t('Paid'), money(sen), true]], actions: [{ label: t('Back to warehouse'), href: '#ship' }] }; },
  });
}

export function keepFlow(ids) {
  const ps = S().parcels.filter((p) => ids.includes(p.id));
  const sen = ps.reduce((a, p) => a + 14 * 120 * p.cartons, 0);
  wizard({
    title: t('Keep longer'), pin: true, verifyPin: svc.verifyPin, ctx: {},
    steps: [{ title: t('Days'), render: () => html`<h3 class="wz-h">${t('Keep {n} parcel(s) 14 more days', { n: ps.length })}</h3><p class="muted">${t('RM 1.20 per carton per day, paid now.')}</p>` }],
    review: () => [[t('Parcels'), ps.map((p) => p.id).join(', ')], [t('Extra days'), '14'], [t('Total'), money(sen), true]],
    run: () => { const v = svc.keepParcels(ids, 14); return { title: t('Storage extended'), rows: [[t('Paid'), money(v), true]], actions: [{ label: t('Back to warehouse'), href: '#ship' }] }; },
  });
}

export function returnFlow(ids) {
  const ps = S().parcels.filter((p) => ids.includes(p.id));
  wizard({
    title: t('Return to seller'), pin: true, verifyPin: svc.verifyPin, ctx: {}, danger: true, confirmLabel: t('Book the return'),
    steps: [{ title: t('Parcels'), render: () => html`<h3 class="wz-h">${t('Send these back to the seller in China?')}</h3><div class="card list">${ps.map((p) => html`<div class="li"><span class="ic">${ic('box', 16)}</span><span class="mid"><b>${p.name}</b><small>${p.id}</small></span></div>`)}</div><p class="muted">${t('This cannot be undone once the courier collects them.')}</p>` }],
    review: () => [[t('Parcels'), String(ps.length)], [t('Total'), money(1500 * ps.length), true]],
    run: () => { const v = svc.returnParcels(ids); return { title: t('Return booked'), rows: [[t('Paid'), money(v), true]], actions: [{ label: t('Back to warehouse'), href: '#ship' }] }; },
  });
}

export function declareFlow() {
  const ctx = { contents: '', source: 'Taobao', courier: '', cartons: 1, value: '', name: '' };
  wizard({
    title: t('Declare a parcel'), ctx, confirmLabel: t('Declare parcel'),
    steps: [
      { title: t('Contents'), render: (c) => html`<h3 class="wz-h">${t('What is coming?')}</h3>${field({ name: 'contents', label: t('What is inside'), value: c.contents, placeholder: t('e.g. Phone cases'), max: 60 })}
          <div class="field"><label for="dc-s">${t('Bought from')}</label><select id="dc-s" name="source">${['Taobao', '1688', 'Pinduoduo', 'Yiwu market', 'Factory direct', 'Other'].map((x) => html`<option ${x === c.source ? raw('selected') : ''}>${x}</option>`)}</select></div>`,
        collect: (el, c) => { c.contents = val(el, '[name=contents]').trim(); c.source = val(el, '[name=source]'); return c.contents.length >= 2 ? '' : t('Say what is inside'); } },
      { title: t('Delivery'), render: (c) => html`<h3 class="wz-h">${t('How is it coming to us?')}</h3>${field({ name: 'courier', label: t('China courier tracking number'), value: c.courier, placeholder: 'SF1402886631', max: 40 })}<div class="grid2">${field({ name: 'ctn', label: t('Cartons'), value: c.cartons, type: 'number', inputmode: 'numeric' })}${field({ name: 'val', label: t('Goods value (RM)'), value: c.value, inputmode: 'decimal' })}</div>`,
        collect: (el, c) => { c.courier = val(el, '[name=courier]').trim(); c.cartons = parseInt(val(el, '[name=ctn]'), 10); c.value = val(el, '[name=val]'); if (!(c.cartons >= 1 && c.cartons <= 500)) return t('Cartons must be 1 to 500'); if (!c.courier) return t('Add the courier tracking number so we can match it'); return ''; } },
      { title: t('Name'), render: (c) => html`<h3 class="wz-h">${t('Name this cargo')}</h3>${field({ name: 'nm', label: t('Cargo name (optional)'), value: c.name, placeholder: `${c.contents} · ${c.source}`, max: 60 })}`,
        collect: (el, c) => { c.name = val(el, '[name=nm]').trim(); return ''; } },
    ],
    review: (c) => [[t('Contents'), c.contents], [t('Bought from'), c.source], [t('Courier'), c.courier], [t('Cartons'), String(c.cartons)], [t('Goods value'), money(parseMoney(c.value) || 0)]],
    run: (c) => { const id = svc.declareParcel({ contents: c.contents, source: c.source, courier: c.courier, cartons: c.cartons, valueSen: parseMoney(c.value) || 0, name: c.name }); return { title: t('Parcel declared'), text: t('We will weigh and photograph it when it arrives in Guangzhou.'), rows: [[t('Parcel'), id]], ref: id, actions: [{ label: t('Back to warehouse'), href: '#ship' }] }; },
  });
}

export function paySupplierFlow() {
  const s = S();
  const ctx = { sup: s.suppliers[0].id, newName: '', via: 'Alipay', amt: '', invoice: '', escrow: true };
  const amtOf = (c) => parseMoney(c.amt) || 0;
  wizard({
    title: t('Pay a supplier'), pin: true, verifyPin: svc.verifyPin, ctx, confirmLabel: t('Send payment'),
    steps: [
      { title: t('Supplier'), render: (c) => html`<h3 class="wz-h">${t('Who are you paying?')}</h3>${radio('sup', [...S().suppliers.map((x) => ({ v: x.id, t: x.name, s: x.via })), { v: 'new', t: t('New supplier'), s: 'Alipay · WeChat Pay · bank' }], c.sup)}
          <div class="new-sup stack ${c.sup === 'new' ? '' : 'hide'}">${field({ name: 'nn', label: t('Supplier name'), value: c.newName, max: 60 })}<div class="field"><label for="ps-v">${t('Pay to')}</label><select id="ps-v" name="via">${['Alipay', 'WeChat Pay', 'Bank transfer'].map((x) => html`<option ${x === c.via ? raw('selected') : ''}>${x}</option>`)}</select></div></div>`,
        mount: (el) => el.querySelectorAll('[name=sup]').forEach((r) => { r.onchange = () => el.querySelector('.new-sup').classList.toggle('hide', r.value !== 'new' || !r.checked); }),
        collect: (el, c) => { c.sup = checked(el, 'sup'); c.newName = (val(el, '[name=nn]') || '').trim(); c.via = val(el, '[name=via]'); return c.sup === 'new' && c.newName.length < 2 ? t('Enter the supplier name') : ''; } },
      { title: t('Amount'), render: (c) => html`<h3 class="wz-h">${t('How much?')}</h3>${field({ name: 'amt', label: t('You pay (RM)'), value: c.amt, inputmode: 'decimal' })}<p class="muted" data-fx>${t('Supplier receives')} <b>${fmtCny(myrToCny(amtOf(c)))}</b> · 1 MYR = ¥1.6437</p>${field({ name: 'inv', label: t('Invoice or order number'), value: c.invoice, max: 40 })}<label class="check"><input type="checkbox" name="esc" ${c.escrow ? raw('checked') : ''}><span>${t('Hold in escrow until our inspection passes')}</span></label>`,
        mount: (el) => { const i = el.querySelector('[name=amt]'), o = el.querySelector('[data-fx] b'); i.oninput = () => { o.textContent = fmtCny(myrToCny(parseMoney(i.value) || 0)); }; },
        collect: (el, c) => { c.amt = val(el, '[name=amt]'); c.invoice = val(el, '[name=inv]').trim(); c.escrow = el.querySelector('[name=esc]').checked; const v = amtOf(c); if (v < 5000) return t('Minimum supplier payment is RM 50'); if (v + pct(v, 50) > svc.walletSen()) return t('Not enough money in your wallet'); return c.invoice.length >= 3 ? '' : t('Add the invoice or order number'); } },
    ],
    review: (c) => { const v = amtOf(c), fee = pct(v, 50); return [[t('Supplier'), c.sup === 'new' ? c.newName : S().suppliers.find((x) => x.id === c.sup).name], [t('Supplier receives'), fmtCny(myrToCny(v))], [t('Fee {p}', { p: '0.5%' }), money(fee)], [t('Arrives'), t('Same day')], [t('Total'), money(v + fee), true]]; },
    run: (c) => { const r = svc.paySupplier({ supplierId: c.sup, newName: c.newName, via: c.via, sen: amtOf(c), invoice: c.invoice, escrow: c.escrow }); return { title: t('Payment sent'), text: c.escrow ? t('Held in escrow until our inspection passes.') : '', rows: [[t('Supplier'), r.sup.name], [t('Paid'), money(amtOf(c) + r.fee), true]], ref: r.ref, actions: [{ label: t('Go to wallet'), href: '#wallet' }] }; },
  });
}

export function joinFlow(gid) {
  const g = S().groups.find((x) => x.id === gid); if (!g) return;
  const p = byId(g.pid);
  const ctx = { pcs: 100, pay: 'wallet' };
  const dep = (c) => pct(cnyToMyr(groupPrice(g.ladder, g.committed + c.pcs, p.t[0][1]) * c.pcs), DEPOSIT_BPS);
  wizard({
    title: t('Join group deal'), pin: true, verifyPin: svc.verifyPin, ctx, confirmLabel: t('Pay deposit'),
    steps: [
      { title: t('Pieces'), render: (c) => html`<div class="row">${raw('<span style="width:56px;height:56px;border-radius:12px;overflow:hidden;display:block">' + artOf(p) + '</span>')}<b class="grow">${tl(p.n)}</b></div>${field({ name: 'pcs', label: t('Pieces for your shop'), value: c.pcs, type: 'number', inputmode: 'numeric' })}<p class="muted" data-dep>${t('Deposit now (30%)')}: <b>${money(dep(c))}</b></p><p class="hint">${t('If the group does not reach the minimum, your deposit comes back in full.')}</p>`,
        mount: (el, c) => { const i = el.querySelector('[name=pcs]'); i.oninput = () => { const n = parseInt(i.value, 10) || 0; el.querySelector('[data-dep] b').textContent = money(n >= 1 ? dep({ pcs: n }) : 0); }; },
        collect: (el, c) => { c.pcs = parseInt(val(el, '[name=pcs]'), 10); return c.pcs >= 10 && c.pcs <= 100000 ? '' : t('Join with at least 10 pieces'); } },
      payStep(ctx, (c) => dep(c)),
    ],
    review: (c) => [[t('Product'), tl(p.n)], [t('Pieces'), c.pcs.toLocaleString('en-US')], [t('Price now'), fmtCny(groupPrice(g.ladder, g.committed + c.pcs, p.t[0][1]))], [t('Pay with'), payName(c.pay)], [t('Deposit (30%)'), money(dep(c)), true]],
    run: (c) => { const r = svc.joinGroup(gid, c.pcs, c.pay); return { title: t('You joined the deal'), text: t('Your deposit waits in escrow until the deadline.'), rows: [[t('Deposit'), money(r.dep), true]], actions: [{ label: t('See the deal'), href: '#group/' + gid }] }; },
  });
}

export function newGroupFlow(pid) {
  const ctx = { pid: pid || 'p1', goal: 0, days: 3, pcs: 100, pay: 'wallet' };
  wizard({
    title: t('Start a group deal'), pin: true, verifyPin: svc.verifyPin, ctx, confirmLabel: t('Start the deal'),
    steps: [
      { title: t('Product'), render: (c) => html`<h3 class="wz-h">${t('Which product?')}</h3><div class="field"><label for="ng-p">${t('Product')}</label><select id="ng-p" name="pid">${[...new Set([c.pid, ...['p1', 'p2', 'p3', 'p4', 'p5', 'p7', 'p9', 'p10', 'p13', 'p15', 'p16']])].map((id) => html`<option value="${id}" ${id === c.pid ? raw('selected') : ''}>${tl(byId(id).n)}</option>`)}</select></div>`,
        collect: (el, c) => { c.pid = val(el, '[name=pid]'); c.goal = c.goal || byId(c.pid).t.at(-1)[0]; return ''; } },
      { title: t('Target'), render: (c) => { const p = byId(c.pid); return html`<h3 class="wz-h">${t('Group target and deadline')}</h3><div class="tiers">${p.t.map((x) => html`<div><small>${x[0].toLocaleString('en-US')}+ ${t('pcs')}</small><b>${fmtCny(x[1])}</b></div>`)}</div>${field({ name: 'goal', label: t('Group target (pieces)'), value: c.goal, type: 'number', inputmode: 'numeric' })}<div class="field"><label for="ng-d">${t('Deadline')}</label><select id="ng-d" name="days">${[1, 2, 3, 5, 7].map((d) => html`<option value="${d}" ${d === c.days ? raw('selected') : ''}>${t('{n} days', { n: d })}</option>`)}</select></div>${field({ name: 'pcs', label: t('Your pieces'), value: c.pcs, type: 'number', inputmode: 'numeric' })}`; },
        collect: (el, c) => { const p = byId(c.pid); c.goal = parseInt(val(el, '[name=goal]'), 10); c.days = parseInt(val(el, '[name=days]'), 10); c.pcs = parseInt(val(el, '[name=pcs]'), 10); if (!(c.goal >= p.t[1][0])) return t('Target must reach at least {n} pieces', { n: p.t[1][0].toLocaleString('en-US') }); return c.pcs >= 10 ? '' : t('Join with at least 10 pieces'); } },
    ],
    review: (c) => { const p = byId(c.pid), d = pct(cnyToMyr(groupPrice(p.t.slice(1), c.pcs, p.t[0][1]) * c.pcs), DEPOSIT_BPS); return [[t('Product'), tl(p.n)], [t('Target'), c.goal.toLocaleString('en-US') + ' ' + t('pcs')], [t('Deadline'), t('{n} days', { n: c.days })], [t('Your pieces'), String(c.pcs)], [t('Deposit (30%)'), money(d), true]]; },
    run: (c) => { const gid = svc.createGroup(c); return { title: t('Your group deal is live'), text: t('Share it with other shops. The price drops as they join.'), actions: [{ label: t('See the deal'), href: '#group/' + gid }] }; },
  });
}

export function repayFlow() {
  const owed = svc.owedSen();
  if (owed <= 0) { toast(t('Nothing to repay')); return; }
  wizard({
    title: t('Repay EZI Credit'), pin: true, verifyPin: svc.verifyPin, ctx: {},
    steps: [{ title: t('Amount'), render: () => html`<h3 class="wz-h">${t('Repay in full')}</h3><p class="muted">${t('Paying on time raises your trust score and your limit.')}</p>` }],
    review: () => [[t('Owed'), money(owed)], [t('Pay with'), payName('wallet')], [t('Total'), money(owed), true]],
    run: () => { const v = svc.repayCredit(owed); return { title: t('Credit repaid'), rows: [[t('Paid'), money(v), true]], actions: [{ label: t('Back to credit'), href: '#credit' }] }; },
  });
}

export function changePinFlow() {
  const ctx = {};
  wizard({
    title: t('Change payment PIN'), ctx, confirmLabel: t('Change PIN'),
    steps: [
      { title: t('Current'), render: () => html`${field({ name: 'o', label: t('Current PIN'), type: 'password', inputmode: 'numeric', max: 6 })}<p class="hint">${t('Test mode PIN: 246810')}</p>`, collect: (el, c) => { c.o = val(el, '[name=o]'); return /^\d{6}$/.test(c.o) ? '' : t('Enter all 6 digits'); } },
      { title: t('New'), render: () => html`${field({ name: 'n1', label: t('New PIN'), type: 'password', inputmode: 'numeric', max: 6 })}${field({ name: 'n2', label: t('Type it again'), type: 'password', inputmode: 'numeric', max: 6 })}<p class="hint">${t('6 digits, not all the same and not in a row.')}</p>`,
        collect: (el, c) => { c.n = val(el, '[name=n1]'); if (!pinFormatOk(c.n)) return t('Use 6 digits that are not all the same or in a row'); return c.n === val(el, '[name=n2]') ? '' : t('The two PINs do not match'); } },
    ],
    review: () => [[t('Payment PIN'), '••••••'], [t('Asked before'), t('every payment')]],
    run: async (c) => { await svc.changePin(c.o, c.n); return { title: t('PIN changed'), text: t('Use your new PIN for the next payment.') }; },
  });
}

export async function renameFlow(kind, id, current) {
  const v = await prompt({ title: t('Rename'), fields: [{ name: 'n', label: t('Name'), value: current || '', max: 60, required: true, validate: (x) => (x.trim().length < 2 ? t('Name must be 2 to 60 characters') : '') }] });
  if (!v) return;
  try { svc.rename(kind, id, v.n); toast(t('Renamed'), 'good'); } catch (e) { toast(t(e.message), 'bad'); }
}

export async function addressForm(a = {}) {
  const v = await prompt({
    title: a.id ? t('Edit address') : t('Add an address'),
    fields: [
      { name: 'label', label: t('Label'), value: a.label || t('Shop'), max: 20 },
      { name: 'name', label: t('Receiver name'), value: a.name || S().profile.name, required: true, max: 60 },
      { name: 'phone', label: t('Phone'), value: a.phone || S().profile.phone, required: true, max: 20, type: 'tel' },
      { name: 'line', label: t('Street address'), value: a.line || '', required: true, max: 120 },
      { name: 'city', label: t('City'), value: a.city || '', required: true, max: 40 },
      { name: 'postcode', label: t('Postcode'), value: a.postcode || '', required: true, max: 6, inputmode: 'numeric', validate: (x) => (/^\d{4,6}$/.test(x.trim()) ? '' : t('Postcode must be 4 to 6 digits')) },
      { name: 'state', label: t('State'), value: a.state || '', max: 40 },
      { name: 'isDefault', label: t('Make this my default address'), type: 'check', value: a.isDefault },
    ],
  });
  if (!v) return null;
  try { const r = svc.saveAddress({ ...a, ...v, isDefault: v.isDefault === '1' }); toast(t('Address saved'), 'good'); return r; } catch (e) { toast(t(e.message), 'bad'); return null; }
}

export async function confirmThen(opts, fn) { if (await confirm(opts)) { try { const r = fn(); toast(opts.done || t('Done'), 'good'); return r; } catch (e) { toast(t(e.message), 'bad'); } } }
export { unitFen, landed };
