import { html, raw } from '../core/html.js';
import { t, tl } from '../core/i18n.js';
import { page, on, S, money, go } from '../app.js';
import { fmtCny, cnyToMyr, parseMoney, shortNum } from '../core/money.js';
import { byId, factoryOf, DESTS, PRODUCTS } from '../domain/catalog.js';
import { unitFen, nextTier, landed, tierIndex, moq } from '../domain/pricing.js';
import * as svc from '../domain/services.js';
import { ic } from '../ui/icons.js';
import { artOf, vtick, pcard, dealCard } from '../ui/parts.js';
import { toast } from '../ui/ui.js';
import { buyNow, newGroupFlow, destName } from '../flows.js';
import { reviewsBlock, mountReviews } from './reviews.js';

let PD = null;
function state(p) {
  if (!PD || PD.id !== p.id) { const d = S().prefs.defaults; PD = { id: p.id, qty: p.t[1][0], col: 0, dest: d.dest, mode: d.mode, insp: d.insp, sell: Math.round(cnyToMyr(p.t[0][1]) * 3) }; }
  return PD;
}

function calc(p) {
  const d = state(p), l = landed(p, d.qty, { dest: d.dest, mode: d.mode, insp: d.insp, pay: 'wallet' });
  if (!l) return html`<p class="err">${t('Minimum order is {n} pcs', { n: moq(p) })}</p>`;
  const profit = d.sell * d.qty - l.total;
  return html`<div class="sum">
    <div class="sum-r"><span>${t('Goods')} · ${d.qty.toLocaleString('en-US')} × ${fmtCny(l.fen)}</span><b>${money(l.goods)}</b></div>
    <div class="sum-r"><span>${t('Inspection')}</span><b>${money(l.inspection)}</b></div>
    <div class="sum-r"><span>${t('Shipping')} · ${t('{a}–{b} days', { a: l.days[0], b: l.days[1] })}</span><b>${money(l.ship)}</b></div>
    <div class="sum-r strong"><span>${t('Total to your door')}</span><b>${money(l.total)}</b></div>
    <div class="sum-r"><span>${t('Per piece at your door')}</span><b>${money(l.perPc)}</b></div>
    <div class="sum-r"><span>${t('Profit at your price')}</span><b class="${profit >= 0 ? 'amt-in' : ''}">${money(profit)}</b></div></div>`;
}

function tierHtml(p) {
  const i = tierIndex(p, state(p).qty);
  return html`${p.t.map(([min, fen], k) => html`<div class="${k === i ? 'on' : ''}"><small>${min.toLocaleString('en-US')}${k < p.t.length - 1 ? '–' + (p.t[k + 1][0] - 1).toLocaleString('en-US') : '+'} ${t('pcs')}</small><b>${fmtCny(fen)}</b><small>${money(cnyToMyr(fen))}</small></div>`)}`;
}
function hint(p) {
  const d = state(p), n = nextTier(p, d.qty);
  if (d.qty < moq(p)) return t('Minimum order is {n} pcs', { n: moq(p) });
  return n ? t('Add {n} pcs to pay {p} per piece', { n: n.need.toLocaleString('en-US'), p: fmtCny(n.fen) }) : t('Best price reached');
}

page('p', {
  title: (id) => tl(byId(id)?.n) || t('Product'),
  view(id) {
    const p = byId(id);
    if (!p) return html`<div class="empty"><h2>${t('Product not found')}</h2><a class="btn primary" href="#shop">${t('Browse products')}</a></div>`;
    const f = factoryOf(p), d = state(p), g = S().groups.find((x) => x.pid === p.id && x.state === 'open');
    return html`<nav class="crumb"><a href="#shop">${t('Shop')}</a> / ${tl(p.n)}</nav>
    <div class="pdp">
      <div class="gal"><div class="main" data-main>${artOf(p, d.col, 0)}</div><div class="ths">${p.col.map((c, k) => html`<button data-a="pcol" data-k="${k}" aria-pressed="${k === d.col}" aria-label="${t('Colour {n}', { n: k + 1 })}">${artOf(p, k, 0)}</button>`)}</div></div>
      <div class="stack">
        <div class="row">${f.lv === 'select' ? html`<span class="pill dark">EZI Select</span>` : ''}${g ? html`<span class="pill red">${ic('group', 12)} ${t('Group deal live')}</span>` : ''}<span class="pill">${t('Lead time {a}–{b} days', { a: p.lead[0], b: p.lead[1] })}</span></div>
        <h1>${tl(p.n)}</h1>
        <p class="muted small">${shortNum(p.sold)} ${t('sold')} · ${vtick()} ${f.n} · ${t('MOQ {n}', { n: moq(p) })}</p>
        <div class="tiers" data-tiers>${tierHtml(p)}</div>
        <div><b class="small">${t('Colour')}</b><div class="swatches" style="margin-top:6px">${p.col.map((c, k) => html`<button data-a="pcol" data-k="${k}" aria-pressed="${k === d.col}" style="background:${c}" aria-label="${t('Colour {n}', { n: k + 1 })}"></button>`)}</div></div>
        <div><b class="small">${t('Quantity')}</b><div class="row" style="margin-top:6px"><div class="qty"><button data-a="pq" data-d="-1" aria-label="${t('Less')}">${ic('minus', 16)}</button><input data-qty inputmode="numeric" value="${d.qty}" aria-label="${t('Quantity')}"><button data-a="pq" data-d="1" aria-label="${t('More')}">${ic('plus', 16)}</button></div><span class="muted small" data-hint>${hint(p)}</span></div></div>
        <section class="card pad stack"><b>${t('Full cost to your shop')}</b>
          <div class="grid2"><div class="field"><label for="pd-d">${t('Ship to')}</label><select id="pd-d" data-k="dest">${DESTS.map((x) => html`<option value="${x.id}" ${x.id === d.dest ? raw('selected') : ''}>${destName(x.id)}</option>`)}</select></div>
          <div class="field"><label for="pd-m">${t('Method')}</label><select id="pd-m" data-k="mode"><option value="sea" ${d.mode === 'sea' ? raw('selected') : ''}>${t('Sea')}</option><option value="air" ${d.mode === 'air' ? raw('selected') : ''}>${t('Air')}</option></select></div>
          <div class="field"><label for="pd-i">${t('Inspection')}</label><select id="pd-i" data-k="insp"><option value="photo" ${d.insp === 'photo' ? raw('selected') : ''}>${t('Photo check')}</option><option value="std" ${d.insp === 'std' ? raw('selected') : ''}>${t('Standard quality check')}</option><option value="full" ${d.insp === 'full' ? raw('selected') : ''}>${t('Full count and quality')}</option></select></div>
          <div class="field"><label for="pd-s">${t('Your selling price / pc (RM)')}</label><input id="pd-s" data-sell inputmode="decimal" value="${(d.sell / 100).toFixed(2)}"></div></div>
          <div data-calc>${calc(p)}</div></section>
        <a class="card fac" href="#factories/${p.f}"><span class="ring" style="--p:${f.score}"><b>${f.score}</b></span><span class="grow"><b>${f.n}</b><br><small class="muted">${f.city} · ${t('Replies in {n} h', { n: f.reply })} · ${t('Pass rate {n}%', { n: f.pass })}</small></span>${ic('arrow', 18)}</a>
        ${g ? dealCard(g) : html`<section class="card pad stack"><b>${t('No group deal for this product yet')}</b><p class="muted small" style="margin:0">${t('Start one: other shops join, and when the total reaches {n} pcs everyone pays {p}.', { n: p.t.at(-1)[0].toLocaleString('en-US'), p: fmtCny(p.t.at(-1)[1]) })}</p><button class="btn ghost sm" data-a="pgroup">${ic('plus', 14)} ${t('Start a group deal')}</button></section>`}
        <p class="note">${ic('shield', 14)} ${t('Escrow: the factory is paid only after our inspection passes. No brand copies are allowed.')}</p>
        ${reviewsBlock(p.id)}
      </div>
    </div>
    <section class="sec"><div class="sec-h"><h2>${t('More from verified factories')}</h2></div><div class="pgrid">${PRODUCTS.filter((x) => x.id !== p.id && (x.c === p.c || x.f === p.f)).concat(PRODUCTS.filter((x) => x.c !== p.c)).slice(0, 6).map(pcard)}</div></section>
    <div class="buybar"><a class="icon-btn" href="#chat/${p.f}/${p.id}" aria-label="${t('Chat with factory')}">${ic('chat', 18)}<span>${t('Chat')}</span></a><button class="btn ghost" data-a="padd">${ic('cart', 16)} ${t('Add to cart')}</button><button class="btn primary" data-a="pbuy">${t('Buy now')}</button></div>`;
  },
  mount(root, id) {
    const p = byId(id); if (!p) return;
    svc.viewed(p.id);
    const d = state(p);
    const upd = () => { root.querySelector('[data-calc]').innerHTML = String(calc(p)); root.querySelector('[data-tiers]').innerHTML = String(tierHtml(p)); root.querySelector('[data-hint]').textContent = hint(p); };
    const q = root.querySelector('[data-qty]');
    q.oninput = () => { const v = parseInt(q.value.replace(/\D/g, ''), 10); d.qty = Number.isFinite(v) ? Math.min(v, 1000000) : 0; upd(); };
    root.querySelectorAll('select[data-k]').forEach((sel) => { sel.onchange = () => { d[sel.dataset.k] = sel.value; upd(); }; });
    const sell = root.querySelector('[data-sell]');
    sell.oninput = () => { d.sell = parseMoney(sell.value) || 0; upd(); };
    mountReviews(root, p.id);
  },
});

on('pcol', (el) => { PD.col = +el.dataset.k; const p = byId(PD.id); document.querySelector('[data-main]').innerHTML = String(artOf(p, PD.col, 0)); document.querySelectorAll('[data-a="pcol"]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.k === PD.col))); });
on('pq', (el) => { const p = byId(PD.id), step = PD.qty >= 1000 ? 100 : PD.qty >= 200 ? 50 : 10; PD.qty = Math.max(moq(p), PD.qty + step * +el.dataset.d); const i = document.querySelector('[data-qty]'); i.value = PD.qty; i.dispatchEvent(new Event('input')); });
on('padd', (el) => { try { svc.cartAdd(PD.id, PD.qty, PD.col); toast(t('Added to cart'), 'good'); } catch (e) { toast(t(e.message), 'bad'); } });
on('pbuy', () => buyNow(PD.id, PD.qty, PD.col));
on('pgroup', () => newGroupFlow(PD.id));
