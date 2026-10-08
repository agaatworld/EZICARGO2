import { html, raw } from '../core/html.js';
import { t, tl } from '../core/i18n.js';
import { page, on, go } from '../app.js';
import { PRODUCTS, CATS, FACTORIES } from '../domain/catalog.js';
import { lowestFen, moq } from '../domain/pricing.js';
import { pcard } from '../ui/parts.js';
import { catName } from './home.js';

let sort = 'best';
page('shop', {
  title: () => t('Shop'),
  view(cat = 'all', q = '') {
    if (!CATS.includes(cat)) cat = 'all';
    const needle = q.trim().toLowerCase();
    let list = PRODUCTS.filter((p) => (cat === 'all' || p.c === cat) && (!needle || Object.values(p.n).some((n) => n.toLowerCase().includes(needle)) || FACTORIES[p.f].n.toLowerCase().includes(needle)));
    list = [...list].sort((a, b) => sort === 'price' ? lowestFen(a) - lowestFen(b) : sort === 'moq' ? moq(a) - moq(b) : sort === 'score' ? FACTORIES[b.f].score - FACTORIES[a.f].score : b.sold - a.sold);
    return html`<div class="page-h"><h1>${needle ? t('Results for “{q}”', { q }) : t(catName(cat))}</h1><p>${t('{n} products from verified factories. Every order is paid into escrow and inspected in Guangzhou.', { n: list.length })}</p></div>
      <div class="chips" role="group" aria-label="${t('Categories')}">${CATS.map((c) => html`<a class="chip ${c === cat ? 'on' : ''}" href="#shop/${c}">${t(catName(c))}</a>`)}</div>
      <div class="row between" style="margin:8px 0"><span class="muted small">${t('{n} results', { n: list.length })}</span>
        <label class="row small"><span class="muted">${t('Sort')}</span><select class="inp" style="min-height:34px;width:auto;padding:4px 8px" data-sort>${[['best', 'Best selling'], ['price', 'Lowest price'], ['moq', 'Lowest MOQ'], ['score', 'Factory score']].map(([k, n]) => html`<option value="${k}" ${k === sort ? raw('selected') : ''}>${t(n)}</option>`)}</select></label></div>
      ${list.length ? html`<div class="pgrid">${list.map(pcard)}</div>` : html`<div class="empty card"><h2>${t('Nothing found')}</h2><p class="muted">${t('Try another word or ask for a quote.')}</p><a class="btn primary" href="#help">${t('Request a quote')}</a></div>`}`;
  },
  mount(root, cat, q) { const s = root.querySelector('[data-sort]'); if (s) s.onchange = () => { sort = s.value; go('shop/' + (cat || 'all') + (q ? '/' + encodeURIComponent(q) : '')); }; },
});
