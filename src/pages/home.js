import { html, raw } from '../core/html.js';
import { t, tl, ago } from '../core/i18n.js';
import { page, on, S, money } from '../app.js';
import { walletStatement } from '../core/ledger.js';
import { transact } from '../core/store.js';
import { PRODUCTS, CATS, byId } from '../domain/catalog.js';
import { storage } from '../domain/pricing.js';
import * as svc from '../domain/services.js';
import { ic } from '../ui/icons.js';
import { orb, pcard, dealCard, artOf, countdown } from '../ui/parts.js';
import { topUp } from '../flows.js';

const PLANE = '<svg viewBox="-9 -6 18 12"><path d="M8 0 2.3 -1.3 -.9 -5.8 -2.9 -5.8 -1.4 -1.3 -5.2 -1.3 -6.9 -3.5 -8.4 -3.5 -7.2 0 -8.4 3.5 -6.9 3.5 -5.2 1.3 -1.4 1.3 -2.9 5.8 -.9 5.8 2.3 1.3Z"/></svg>';
// Seamless sea: each layer is twice the card's width and repeats exactly, so sliding it by half loops forever.
function wave() {
  const layer = (y, amp, per, fill, cls, line) => { let d = `M0 ${y}`; for (let x = 0; x < 1600; x += per) d += ` Q${x + per / 4} ${y - amp} ${x + per / 2} ${y} T${x + per} ${y}`; return `<svg class="${cls}" viewBox="0 0 1600 24" preserveAspectRatio="none" aria-hidden="true"><path d="${d} V24 H0Z" fill="${fill}"/>${line ? `<path d="${d}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.2" vector-effect="non-scaling-stroke"/>` : ''}</svg>`; };
  return layer(10, 5, 100, 'rgba(255,255,255,.14)', 'w1', false) + layer(14, 4, 80, 'rgba(255,255,255,.22)', 'w2', true);
}

export function nextFlight(now = Date.now()) {
  // Air cargo cut-off: 22:00 Malaysia time (UTC+8) every day.
  const d = new Date(now), utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 14, 0, 0);
  return utc > now ? utc : utc + 864e5;
}

let cat = 'all';
page('home', {
  title: () => t('Home'),
  view() {
    const s = S(), bal = s.prefs.showBal ? money(svc.walletSen(s)) : 'RM ••••••';
    const hour = +new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kuala_Lumpur' });
    const hi = hour < 12 ? t('Good morning') : hour < 18 ? t('Good afternoon') : t('Good evening');
    const stored = s.parcels.filter((p) => p.state === 'stored');
    const minDays = stored.length ? Math.min(...stored.map((p) => storage(p).daysLeft)) : null;
    const active = s.orders.filter((o) => !['delivered', 'refunded'].includes(o.state)).length;
    const cr = svc.creditInfo(s);
    const ship = s.shipments.find((x) => x.state !== 'delivered');
    const recent = walletStatement(s.ledger).slice(0, 3);
    const keep = s.recent.map(byId).filter(Boolean).slice(0, 8);
    const initials = s.profile.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    const list = PRODUCTS.filter((p) => cat === 'all' || p.c === cat).slice(0, 12);
    return html`
    <section class="tcard" aria-label="${t('Your EZI account')}">
      <div class="tc-sky" aria-hidden="true"><span class="tc-plane"><i>${raw(PLANE)}</i></span></div>
      <div class="tc-top"><span class="tc-av" aria-hidden="true">${initials}</span><span class="tc-hi"><small>${hi},</small><b>${s.profile.name.split(' ')[0]}</b></span><button class="tc-code" data-copy="${s.profile.code}" aria-label="${t('Copy customer code')}">${s.profile.code} ${ic('copy', 12)}</button></div>
      <div class="tc-l">${t('EZI Wallet balance')}</div>
      <div class="tc-bal"><b class="num" data-bal>${bal}</b><button class="tc-eye" data-a="eye" aria-label="${s.prefs.showBal ? t('Hide balance') : t('Show balance')}">${ic('eye', 18)}</button></div>
      <div class="tc-chips"><a href="#orders">${ic('shield', 12)} ${t('Escrow')} <b class="num">${s.prefs.showBal ? money(svc.escrowSen(s), { dec: 0 }) : '••••'}</b></a><a href="#credit">${ic('credit', 12)} ${t('Credit')} <b class="num">${money(cr.available, { dec: 0 })}</b></a></div>
      <div class="tc-btns"><button class="btn b1" data-a="topup">${ic('plus', 16)} ${t('Top up')}</button><a class="btn b2" href="#wallet">${ic('list', 16)} ${t('History')}</a></div>
      <div class="tc-sea" aria-hidden="true">${raw(wave())}</div>
    </section>

    <section class="card svc-card sec" aria-label="${t('Services')}"><div class="orbs">${['ship', 'shop', 'group', 'pay', 'orders', 'track', 'credit', 'help'].map((k, i) => orb(k, i))}</div></section>

    <section class="strip sec" aria-label="${t('Today')}">
      <a class="st" href="#ship"><b>${stored.length}</b><span>${t('parcels in your bay')}${minDays != null ? ' · ' + t('{n} free days left', { n: minDays }) : ''}</span></a>
      <a class="st" href="#ship"><b class="num" data-end="${nextFlight()}">${countdown(nextFlight() - Date.now())}</b><span>${t('next flight closes')}</span></a>
      <a class="st" href="#orders"><b>${active}</b><span>${t('active orders')}</span></a>
    </section>

    ${ship ? html`<a class="card journey sec" href="#track/${ship.tracking}"><div class="jr-top"><b>${ship.name}</b><span class="pill blue">${t(stateLabel(ship.state))}</span></div>
      <div class="jr-line" aria-hidden="true"><svg viewBox="0 0 300 30" preserveAspectRatio="none"><path class="jr-path" d="M6 22 Q150 -6 294 22" vector-effect="non-scaling-stroke"/><path class="jr-done" d="M6 22 Q150 -6 294 22" pathLength="100" stroke-dasharray="${Math.round(ship.progress * 100)} 100"/></svg><i class="jr-a"></i><i class="jr-b"></i></div>
      <div class="jr-ends"><span>Guangzhou</span><span>${ship.tracking}</span><span>${t('Port Klang')}</span></div></a>` : ''}

    <section class="sec"><div class="bn" aria-label="${t('Offers')}">
      <a class="bn-c bn-1" href="#group/g1"><div><small>${t('Group deal')}</small><b>${tl(byId('p1').n)}</b><span>${t('{n} shops joined · ends soon', { n: s.groups[0].shops })}</span></div><span class="bn-art">${artOf(byId('p1'), 1)}</span></a>
      <a class="bn-c bn-2" href="#ship"><div><small>EZI Ship</small><b>${t('Your own warehouse in Guangzhou')}</b><span>${t('14 days free storage · photos on arrival')}</span></div><span class="bn-art">${artOf(byId('p13'))}</span></a>
      <a class="bn-c bn-3" href="#wallet/pay"><div><small>EZI Wallet</small><b>${t('Pay any Chinese supplier in yuan')}</b><span>${t('Same day · Alipay, WeChat Pay or bank')}</span></div><span class="bn-art">${artOf(byId('p15'))}</span></a>
    </div></section>

    ${recent.length ? html`<section class="sec"><div class="sec-h"><h2>${t('Recent activity')}</h2><a href="#wallet">${t('See all')}</a></div><div class="card list">${recent.map((r) => html`<a class="li" href="#wallet"><span class="ic ${r.v > 0 ? 'in' : r.kind === 'hold' || r.kind === 'deposit' ? 'esc' : 'out'}">${ic(r.v > 0 ? 'plus' : r.kind === 'hold' ? 'shield' : 'arrow', 15)}</span><span class="mid"><b>${r.memo}</b><small>${ago(r.at)}</small></span><span class="end num ${r.v > 0 ? 'amt-in' : ''}">${s.prefs.showBal ? money(r.v, { plus: true }) : '••••'}</span></a>`)}</div></section>` : ''}


    <section class="sec"><div class="sec-h"><h2>${t('Group deals closing soon')}</h2><a href="#group">${t('See all')}</a></div><div class="hs">${s.groups.filter((g) => g.state === 'open').slice(0, 5).map(dealCard)}</div></section>

    ${keep.length ? html`<section class="sec"><div class="sec-h"><h2>${t('Keep shopping')}</h2><button class="link" data-a="clearRecent">${t('Clear')}</button></div><div class="hs" style="grid-auto-columns:88px">${keep.map((p) => html`<a class="pc" href="#p/${p.id}"><div class="im">${artOf(p)}</div></a>`)}</div></section>` : ''}

    <section class="sec"><div class="sec-h"><h2>${t('From verified factories')}</h2><a href="#shop">${t('See all')}</a></div>
      <div class="chips" role="group" aria-label="${t('Categories')}">${CATS.slice(0, 7).map((c) => html`<button class="chip" data-a="homeCat" data-c="${c}" aria-pressed="${c === cat}">${t(catName(c))}</button>`)}</div>
      <div class="pgrid" style="margin-top:6px">${list.map(pcard)}</div></section>`;
  },
});

export function catName(c) { return { all: 'All', home: 'Home & kitchen', tech: 'Phone & tech', fashion: 'Fashion', beauty: 'Beauty', bags: 'Bags', toys: 'Toys', lighting: 'Lighting', packaging: 'Packaging' }[c]; }
export function stateLabel(st) { return { packing: 'Packing', departed: 'Departed', at_sea: 'At sea', customs: 'Customs', out: 'Out for delivery', delivered: 'Delivered' }[st] || st; }

on('topup', () => topUp());
on('eye', () => transact((s) => { s.prefs.showBal = !s.prefs.showBal; }));
on('homeCat', (el) => { cat = el.dataset.c; transact(() => {}); });
on('clearRecent', () => transact((s) => { s.recent = []; }));
