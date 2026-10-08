import { html } from '../core/html.js';
import { t, tl } from '../core/i18n.js';
import { page, on, S, money } from '../app.js';
import { fmtCny } from '../core/money.js';
import { byId, factoryOf } from '../domain/catalog.js';
import { unitFen, moq } from '../domain/pricing.js';
import * as svc from '../domain/services.js';
import { ic } from '../ui/icons.js';
import { artOf } from '../ui/parts.js';
import { confirm, toast } from '../ui/ui.js';
import { checkout } from '../flows.js';

page('cart', {
  title: () => t('Cart'),
  view() {
    const s = S();
    if (!s.cart.length) return html`<div class="empty card"><h2>${t('Your cart is empty')}</h2><p class="muted">${t('Buy direct from verified factories, paid through escrow.')}</p><a class="btn primary" href="#shop">${t('Browse products')}</a></div>`;
    const d = s.prefs.defaults, q = svc.quoteCart(s, { dest: d.dest, mode: d.mode, insp: d.insp, pay: 'wallet' });
    return html`<div class="page-h"><h1>${t('Cart')}</h1><p>${t('Money goes into escrow. Each factory is paid only after its goods pass inspection in Guangzhou.')}</p></div>
    <div class="split"><div class="card list">${s.cart.map((c, i) => { const p = byId(c.pid), f = unitFen(p, c.qty); return html`<div class="li" style="align-items:flex-start"><a class="th" href="#p/${p.id}" aria-label="${tl(p.n)}">${artOf(p, c.col)}</a><span class="mid"><b style="white-space:normal">${tl(p.n)}</b><small>${factoryOf(p).n}</small><span class="row" style="margin-top:6px"><span class="qty" style="transform:scale(.9);transform-origin:left"><button data-a="cq" data-i="${i}" data-d="-1" aria-label="${t('Less')}">${ic('minus', 14)}</button><input value="${c.qty}" inputmode="numeric" data-cqi="${i}" aria-label="${t('Quantity')}"><button data-a="cq" data-i="${i}" data-d="1" aria-label="${t('More')}">${ic('plus', 14)}</button></span><button class="link" data-a="crm" data-i="${i}">${t('Remove')}</button></span></span><span class="end">${f ? fmtCny(f) : '—'}<br><small class="muted">${t('per pc')}</small></span></div>`; })}</div>
    <aside class="side card pad stack"><b>${t('Order summary')}</b><div class="sum">
      <div class="sum-r"><span>${t('Goods')}</span><b>${money(q.goods)}</b></div><div class="sum-r"><span>${t('Inspection')}</span><b>${money(q.inspection)}</b></div><div class="sum-r"><span>${t('Shipping')} (${t(d.mode === 'air' ? 'Air' : 'Sea')})</span><b>${money(q.ship)}</b></div><div class="sum-r strong"><span>${t('Estimated total')}</span><b>${money(q.total)}</b></div></div>
      <p class="hint">${t('You can change country, air or sea and inspection in the next steps.')}</p>
      <button class="btn primary lg block" data-a="checkout">${t('Checkout')} · ${money(q.total)}</button></aside></div>`;
  },
  mount(root) {
    root.querySelectorAll('[data-cqi]').forEach((inp) => { inp.onchange = () => { const i = +inp.dataset.cqi, v = parseInt(inp.value.replace(/\D/g, ''), 10) || 0; try { svc.cartSet(i, v); } catch (e) { toast(t(e.message), 'bad'); inp.value = S().cart[i].qty; } }; });
  },
});

on('checkout', () => checkout());
on('cq', (el) => { const i = +el.dataset.i, c = S().cart[i], p = byId(c.pid), step = c.qty >= 1000 ? 100 : 50; try { svc.cartSet(i, Math.max(moq(p), c.qty + step * +el.dataset.d)); } catch (e) { toast(t(e.message), 'bad'); } });
on('crm', async (el) => { const i = +el.dataset.i, p = byId(S().cart[i].pid); if (await confirm({ title: t('Remove from cart?'), text: tl(p.n), ok: t('Remove'), danger: true })) { svc.cartRemove(i); toast(t('Removed')); } });
