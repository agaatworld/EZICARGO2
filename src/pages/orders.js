import { html } from '../core/html.js';
import { t, tl, ago, dateStr } from '../core/i18n.js';
import { page, on, S, money } from '../app.js';
import { fmtCny } from '../core/money.js';
import { byId, factoryOf } from '../domain/catalog.js';
import { STEPS, stepIndex } from '../domain/escrow.js';
import { ic } from '../ui/icons.js';
import { artOf, stepsList } from '../ui/parts.js';
import { renameFlow, destName, payName } from '../flows.js';

export const STEP_TEXT = {
  paid: ['Paid into escrow', 'Money held by EZICARGO, not the factory'],
  confirmed: ['Factory confirmed', 'Production slot booked'],
  production: ['In production', 'Factory sends progress photos'],
  arrived: ['Arrived at our warehouse', 'Weighed and photographed in Guangzhou'],
  inspected: ['Inspection passed', 'Count, quality and labels checked'],
  released: ['Factory paid from escrow', 'Released only after the pass'],
  shipped: ['Shipped to you', 'Air or sea, tracked to your door'],
  delivered: ['Delivered', 'Signed for at your address'],
};
export const stateText = (st) => st === 'refunded' ? t('Refunded') : t(STEP_TEXT[st][0]);

page('orders', {
  title: () => t('My orders'),
  view() {
    const s = S();
    return html`<div class="page-h"><h1>${t('My orders')}</h1><p>${t('Factory orders paid into escrow. Tap one to see every step.')}</p></div>
    ${s.orders.length ? html`<div class="card list">${s.orders.map((o) => { const p = byId(o.pid); return html`<a class="li" href="#order/${o.id}"><span class="th">${artOf(p, o.col)}</span><span class="mid"><b>${o.name || tl(p.n)}</b><small>${o.id} · ${o.qty.toLocaleString('en-US')} ${t('pcs')} · ${ago(o.createdAt)}</small></span><span class="end"><span class="pill ${o.state === 'refunded' ? 'warn' : o.state === 'delivered' ? 'good' : 'blue'}">${stateText(o.state)}</span></span></a>`; })}</div>`
      : html`<div class="empty card"><h2>${t('No orders yet')}</h2><a class="btn primary" href="#shop">${t('Browse products')}</a></div>`}`;
  },
});

page('order', {
  title: (id) => id,
  view(id) {
    const s = S(), o = s.orders.find((x) => x.id === id);
    if (!o) return html`<div class="empty"><h2>${t('Order not found')}</h2><a class="btn primary" href="#orders">${t('My orders')}</a></div>`;
    const p = byId(o.pid), f = factoryOf(p), idx = o.state === 'refunded' ? -1 : stepIndex(o.state);
    const held = o.goods + o.insp, released = idx >= stepIndex('released');
    const addr = s.addresses.find((a) => a.id === o.addrId);
    return html`<nav class="crumb"><a href="#orders">${t('My orders')}</a> / ${o.id}</nav>
    <div class="split"><div class="stack">
      <section class="card pad row" style="align-items:flex-start;flex-wrap:nowrap"><span style="width:64px;height:64px;border-radius:12px;overflow:hidden;flex-shrink:0">${artOf(p, o.col)}</span><div class="grow" style="min-width:0"><b>${o.name || tl(p.n)}</b><div class="muted small">${o.id} · ${f.n}</div><div class="muted small">${o.qty.toLocaleString('en-US')} × ${fmtCny(o.fen)}</div><button class="link" data-a="orename" data-id="${o.id}">${ic('edit', 13)} ${t('Rename')}</button></div><span class="pill ${o.state === 'refunded' ? 'warn' : 'blue'}">${stateText(o.state)}</span></section>
      <section class="card pad"><b>${t('How your order moves')}</b><div style="margin-top:10px">${o.state === 'refunded' ? html`<p class="muted">${t('This order was refunded to you.')} ${o.history.at(-1).note || ''}</p>` : stepsList(STEPS.map((k) => [t(STEP_TEXT[k][0]), t(STEP_TEXT[k][1])]), o.state === 'delivered' ? STEPS.length : idx)}</div></section>
      <section class="card pad stack"><b>${t('History')}</b><div class="list">${[...o.history].reverse().map((h) => html`<div class="li" style="padding:6px 0"><span class="mid"><b>${stateText(h.state)}</b><small>${dateStr(h.at)} · ${ago(h.at)} · ${t('by {w}', { w: h.by })}</small></span></div>`)}</div></section>
    </div>
    <aside class="side stack"><section class="card pad stack"><b>${t('Escrow')}</b><div class="sum">
      <div class="sum-r"><span>${t('Goods')}</span><b>${money(o.goods)}</b></div><div class="sum-r"><span>${t('Inspection')}</span><b>${money(o.insp)}</b></div><div class="sum-r"><span>${t('Shipping')} · ${t(o.mode === 'air' ? 'Air' : 'Sea')} → ${destName(o.dest)}</span><b>${money(o.ship)}</b></div>${o.fee ? html`<div class="sum-r"><span>${t('Payment fee')}</span><b>${money(o.fee)}</b></div>` : ''}<div class="sum-r strong"><span>${t('Paid with {m}', { m: payName(o.pay) })}</span><b>${money(o.goods + o.insp + o.ship + o.fee)}</b></div></div>
      <p class="note">${ic('shield', 14)} ${o.state === 'refunded' ? t('Refunded in full.') : released ? t('Released to the factory after inspection.') : t('{m} is held by EZICARGO until inspection passes.', { m: money(held) })}</p></section>
      ${addr ? html`<section class="card pad"><b>${t('Deliver to')}</b><p class="muted small" style="margin:4px 0 0">${addr.name} · ${addr.phone}<br>${addr.line}, ${addr.postcode} ${addr.city}</p></section>` : ''}
      <a class="btn ghost block" href="#chat/${p.f}/${p.id}">${ic('chat', 16)} ${t('Message factory')}</a></aside></div>`;
  },
});

on('orename', (el) => { const o = S().orders.find((x) => x.id === el.dataset.id); renameFlow('order', o.id, o.name); });
