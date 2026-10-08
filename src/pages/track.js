import { html } from '../core/html.js';
import { t, tl, ago, dateStr } from '../core/i18n.js';
import { page, on, S, go } from '../app.js';
import { byId } from '../domain/catalog.js';
import { validTracking } from '../domain/services.js';
import { ic } from '../ui/icons.js';
import { stepsList } from '../ui/parts.js';
import { renameFlow } from '../flows.js';
import { stateLabel } from './home.js';
import { STEP_TEXT, stateText } from './orders.js';
import { STEPS, stepIndex } from '../domain/escrow.js';

const SHIP_STEPS = ['packing', 'departed', 'at_sea', 'customs', 'out', 'delivered'];

function find(no) {
  const s = S(), n = String(no || '').trim().toUpperCase();
  return s.shipments.find((x) => x.tracking === n || x.id === n) && { kind: 'ship', x: s.shipments.find((x) => x.tracking === n || x.id === n) }
    || s.parcels.find((x) => x.id === n) && { kind: 'parcel', x: s.parcels.find((x) => x.id === n) }
    || s.orders.find((x) => x.id === n) && { kind: 'order', x: s.orders.find((x) => x.id === n) } || null;
}

page('track', {
  title: () => t('Track'),
  view(no) {
    const s = S(), hit = no ? find(no) : null;
    const all = [...s.shipments.map((x) => ({ id: x.tracking, name: x.name, sub: t(stateLabel(x.state)) })), ...s.parcels.filter((p) => p.state !== 'delivered').map((p) => ({ id: p.id, name: p.name, sub: t({ coming: 'Arriving', stored: 'In warehouse', shipped: 'Shipped', returning: 'Returning to seller' }[p.state] || p.state) })), ...s.orders.map((o) => ({ id: o.id, name: o.name || tl(byId(o.pid).n), sub: stateText(o.state) }))];
    return html`<div class="page-h"><h1>${t('Track')}</h1><p>${t('Every parcel, shipment and order has a number. Type one or tap below.')}</p></div>
    <form class="row" data-form="track" style="flex-wrap:nowrap;margin-bottom:12px"><input class="inp" name="no" value="${no || ''}" placeholder="EZ7715204418 · EZ-P-20877 · EZO-3021" aria-label="${t('Tracking number')}" maxlength="20"><button class="btn primary">${t('Track')}</button></form>
    ${no && !hit ? html`<div class="card pad"><b>${t('Not found')}</b><p class="muted small" style="margin:4px 0 0">${/^EZ\d{10}$/.test(String(no).toUpperCase()) && !validTracking(no) ? t('This number has a typo: the check digit does not match.') : t('Check the number and try again.')}</p></div>` : ''}
    ${hit ? detail(hit) : ''}
    <section class="sec"><div class="sec-h"><h2>${t('My tracking numbers')}</h2></div><div class="card list">${all.map((a) => html`<a class="li" href="#track/${a.id}"><span class="mid"><b>${a.name}</b><small class="num">${a.id}</small></span><span class="end small muted">${a.sub}</span></a>`)}</div></section>`;
  },
});

function detail(h) {
  const x = h.x;
  if (h.kind === 'ship') {
    const i = SHIP_STEPS.indexOf(x.state);
    return html`<section class="card pad stack"><div class="row between"><div><b>${x.name}</b><div class="muted small num">${x.tracking} · ${x.id}</div></div><button class="link" data-a="srename" data-id="${x.id}">${ic('edit', 13)} ${t('Rename')}</button></div>
      <div class="bar" style="height:8px"><i style="width:${Math.round(x.progress * 100)}%"></i></div><div class="muted small">${t('Estimated arrival {d}', { d: dateStr(x.eta) })}</div>
      ${stepsList(SHIP_STEPS.map((k) => [t(stateLabel(k)), '']), x.state === 'delivered' ? SHIP_STEPS.length : i)}</section>`;
  }
  if (h.kind === 'parcel') {
    const i = ['coming', 'stored', 'shipped', 'delivered'].indexOf(x.state);
    return html`<section class="card pad stack"><b>${x.name}</b><div class="muted small num">${x.id} · ${x.courier}</div>${stepsList([[t('Declared'), ''], [t('Received, weighed and photographed'), x.arrivedAt ? ago(x.arrivedAt) : ''], [t('Shipped'), x.shipmentId || ''], [t('Delivered'), '']], i < 0 ? 1 : i + 1)}</section>`;
  }
  const idx = x.state === 'refunded' ? -1 : stepIndex(x.state);
  return html`<section class="card pad stack"><b>${x.name || tl(byId(x.pid).n)}</b><div class="muted small">${x.id}</div>${x.state === 'refunded' ? html`<p class="muted">${t('Refunded')}</p>` : stepsList(STEPS.map((k) => [t(STEP_TEXT[k][0]), '']), x.state === 'delivered' ? STEPS.length : idx)}<a class="btn ghost sm" href="#order/${x.id}">${t('Order details')}</a></section>`;
}

on('form:track', (f, v) => go('track/' + encodeURIComponent(String(v.no || '').trim().toUpperCase().slice(0, 20))));
on('srename', (el) => { const x = S().shipments.find((y) => y.id === el.dataset.id); renameFlow('shipment', x.id, x.name); });
