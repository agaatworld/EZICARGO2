import { html, raw } from '../core/html.js';
import { t } from '../core/i18n.js';
import { page, on, S, money, render } from '../app.js';
import { DESTS } from '../domain/catalog.js';
import { storage, shipQuote, STORAGE } from '../domain/pricing.js';
import { ic } from '../ui/icons.js';
import { boxSvg } from '../ui/parts.js';
import { sheet, toast } from '../ui/ui.js';
import { shipFlow, inspectFlow, keepFlow, returnFlow, declareFlow, renameFlow, destName } from '../flows.js';
import { stateLabel } from './home.js';

const SEL = new Set();
const ADDRESS = (code) => `广东省广州市白云区太和镇 EZICARGO 国际仓 B2-18 收件人: ${code}`;

function calcBox() {
  return html`<section class="card pad stack" id="rates"><b>${t('Shipping calculator')}</b>
    <div class="grid2"><div class="field"><label for="rc-d">${t('Ship to')}</label><select id="rc-d" data-rc="dest">${DESTS.map((d) => html`<option value="${d.id}">${destName(d.id)}</option>`)}</select></div>
    <div class="field"><label for="rc-kg">${t('Weight (kg)')}</label><input id="rc-kg" data-rc="kg" inputmode="decimal" value="25"></div>
    <div class="field"><label for="rc-l">${t('Carton size L × W × H (cm)')}</label><input id="rc-l" data-rc="dim" value="60 × 40 × 35"></div>
    <div class="field"><label for="rc-n">${t('Cartons')}</label><input id="rc-n" data-rc="n" inputmode="numeric" value="2"></div></div>
    <div data-rc-out></div><p class="hint">${t('Air uses the larger of real weight and volume weight (L × W × H ÷ 6000). Sample rates.')}</p></section>`;
}
function calcOut(root) {
  const g = (k) => root.querySelector(`[data-rc="${k}"]`).value;
  const kg = Math.max(0, parseFloat(g('kg')) || 0), n = Math.max(1, parseInt(g('n'), 10) || 1);
  const dims = (g('dim').match(/\d+(\.\d+)?/g) || []).map(Number);
  const cm3 = dims.length === 3 ? Math.round(dims[0] * dims[1] * dims[2] * n) : 0;
  const air = shipQuote({ grams: Math.round(kg * 1000), cm3, dest: g('dest'), mode: 'air' }), sea = shipQuote({ grams: Math.round(kg * 1000), cm3, dest: g('dest'), mode: 'sea' });
  root.querySelector('[data-rc-out]').innerHTML = String(html`<div class="sum"><div class="sum-r"><span>${t('Volume')}</span><b>${(cm3 / 1e6).toFixed(3)} CBM</b></div><div class="sum-r"><span>${t('Air · {a}–{b} days', { a: air.days[0], b: air.days[1] })} · ${(air.chargeG / 1000).toFixed(1)} kg</span><b>${money(air.sen)}</b></div><div class="sum-r"><span>${t('Sea · {a}–{b} days', { a: sea.days[0], b: sea.days[1] })}</span><b>${money(sea.sen)}</b></div></div>`);
}

page('ship', {
  title: () => t('My warehouse'),
  view() {
    const s = S(), stored = s.parcels.filter((p) => p.state === 'stored'), coming = s.parcels.filter((p) => p.state === 'coming'), out = s.shipments.filter((x) => x.state !== 'delivered');
    [...SEL].forEach((id) => { if (!stored.some((p) => p.id === id)) SEL.delete(id); });
    const minD = stored.length ? Math.min(...stored.map((p) => storage(p).daysLeft)) : STORAGE.freeDays;
    const n = SEL.size;
    return html`<section class="wh"><div class="wh-stripe"></div><div class="wh-in">
      <span class="wh-tag">BAIYUN WAREHOUSE · GUANGZHOU</span><h1>${t('My warehouse')} <span class="pill" style="background:#F5B400;color:#1B1D20">B2-18</span></h1>
      <p>${t('We receive, weigh and photograph every carton. Free storage for 14 days.')}</p>
      <div class="wh-stats"><div><b>${stored.length}</b><span>${t('in my bay')}</span></div><div><b>${coming.length}</b><span>${t('arriving')}</span></div><div><b>${out.length}</b><span>${t('on the way')}</span></div><div><b>${minD}d</b><span>${t('free days left')}</span></div></div>
      <div class="wh-btns"><button class="btn yel sm" data-a="declare">${ic('plus', 15)} ${t('Declare a parcel')}</button><button class="btn yel-o sm" data-copy="${ADDRESS(s.profile.code)}">${ic('copy', 14)} ${t('Copy China address')}</button></div></div></section>

    ${coming.length ? html`<section class="sec"><div class="sec-h"><h2>${ic('truck', 16)} ${t('Arriving at our warehouse')}</h2></div><div class="lane">${coming.map((p) => html`<a href="#track/${p.id}"><b>${p.id}</b><small>${p.name}</small><small>${p.courier}</small></a>`)}</div></section>` : ''}

    <section class="sec"><div class="sec-h"><h2>${t('My bay · rack B2 shelf 18')}</h2><button class="link" data-a="selAll">${n && n === stored.length ? t('Clear') : t('Select all')}</button></div>
      <div class="bay">${stored.map((p, i) => { const st = storage(p), on = SEL.has(p.id), pct = Math.max(4, Math.min(100, (st.daysLeft / (STORAGE.freeDays + (p.extraDays || 0))) * 100)); return html`<div class="pcell ${on ? 'on' : ''} ${st.daysLeft < 5 ? 'late' : ''}" data-a="sel" data-id="${p.id}" role="checkbox" aria-checked="${on}" tabindex="0">
          <span class="ck">${ic('check', 12)}</span>
          <div class="pc-t">${boxSvg((i % 3) + 1)}<span style="min-width:0"><b>${p.id}</b><small>${p.name}</small></span></div>
          <div class="pc-m num">${t('{n} ctn', { n: p.cartons })} · ${(p.grams / 1000).toFixed(1)} kg · ${t('{n} photos', { n: p.photos })}</div>
          <div class="free"><i style="width:${pct}%"></i></div><div class="pc-m">${st.daysLeft >= 0 ? t('{n} free days left', { n: st.daysLeft }) : t('Storage fee {m}', { m: money(st.rent) })}${p.checks?.length ? ' · ' + t('checked') : ''}</div>
          <div class="pc-a"><button type="button" data-a="pinsp" data-id="${p.id}">${ic('shield', 14)}${t('Check')}</button><button type="button" data-a="pphotos" data-id="${p.id}">${ic('cam', 14)}${t('Photos')}</button><button type="button" data-a="pedit" data-id="${p.id}">${ic('edit', 14)}${t('Edit')}</button></div></div>`; })}
        <button type="button" class="pcell add" data-a="declare">${ic('plus', 22)}<b>${t('Add a parcel')}</b><small class="muted">${t('Tell us what is coming to your China address')}</small></button></div>
      ${n ? html`<div class="selbar" role="region" aria-label="${t('Selected parcels')}"><div class="row between"><b>${t('{n} selected', { n })}</b><button class="link" style="color:#F5B400" data-a="selNone">${t('Clear')}</button></div><div class="acts">
        <button class="main" data-a="bship">${ic('truck', 16)}${t('Ship')}</button><button data-a="bship" ${n < 2 ? raw('disabled') : ''}>${ic('layers', 16)}${t('Combine')}</button><button data-a="binsp" ${n !== 1 ? raw('disabled') : ''}>${ic('shield', 16)}${t('Inspect')}</button><button data-a="bkeep">${ic('box', 16)}${t('Keep')}</button><button data-a="bret">${ic('swap', 16)}${t('Return')}</button></div></div>` : ''}</section>

    ${out.length ? html`<section class="sec"><div class="sec-h"><h2>${ic('plane', 16)} ${t('On the way to you')}</h2></div><div class="card list">${out.map((x) => html`<a class="li" href="#track/${x.tracking}"><span class="ic esc">${ic(x.mode === 'air' ? 'plane' : 'boat', 16)}</span><span class="mid"><b>${x.name}</b><small>${x.tracking} · ${t(stateLabel(x.state))}</small></span><span class="end">${ic('arrow', 16)}</span></a>`)}</div></section>` : ''}

    <div class="sec split"><div>${calcBox()}</div><section class="card pad stack"><b>${t('Services and prices')}</b><div class="sum">${[['Photo check', 'RM 5 / carton'], ['Video check', 'RM 12 / carton'], ['Count and quality', '1.5% of goods'], ['Repack and combine', 'RM 3 / carton'], ['Storage after 14 days', 'RM 1.20 / carton / day'], ['Return to seller in China', 'RM 15 / parcel']].map(([a, b]) => html`<div class="sum-r"><span>${t(a)}</span><b>${t(b)}</b></div>`)}</div></section></div>`;
  },
  mount(root, sub) {
    root.querySelectorAll('[data-rc]').forEach((i) => { i.oninput = i.onchange = () => calcOut(root); });
    calcOut(root);
    root.querySelectorAll('.pcell[data-id]').forEach((c) => c.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); c.click(); } }));
    if (sub === 'rates') setTimeout(() => root.querySelector('#rates')?.scrollIntoView({ block: 'start' }), 50);
  },
});

on('declare', () => declareFlow());
on('sel', (el, e) => { if (e.target.closest('.pc-a')) return; const id = el.dataset.id; SEL.has(id) ? SEL.delete(id) : SEL.add(id); render(); });
on('selAll', () => { const st = S().parcels.filter((p) => p.state === 'stored'); if (SEL.size === st.length) SEL.clear(); else st.forEach((p) => SEL.add(p.id)); render(); });
on('selNone', () => { SEL.clear(); render(); });
on('bship', () => shipFlow(take()));
// Selection clears once an action starts, so the bay shows the new state afterwards.
const take = () => { const ids = [...SEL]; SEL.clear(); render(); return ids; };
on('binsp', () => inspectFlow(take()[0]));
on('bkeep', () => keepFlow(take()));
on('bret', () => returnFlow(take()));
on('pinsp', (el) => inspectFlow(el.dataset.id));
on('pedit', (el) => { const p = S().parcels.find((x) => x.id === el.dataset.id); renameFlow('parcel', p.id, p.name); });
on('pphotos', (el) => {
  const p = S().parcels.find((x) => x.id === el.dataset.id);
  const ph = (k) => raw(`<svg viewBox="0 0 120 90" aria-hidden="true"><rect width="120" height="90" fill="#E9E4DD"/><path d="M28 34l32-14 32 14v34l-32 14-32-14z" fill="#D9A15E"/><path d="M28 34l32 14 32-14M60 48v34" stroke="#9B6A33" stroke-width="1.5" fill="none"/><rect x="40" y="56" width="18" height="10" fill="#fff"/><text x="6" y="84" font-size="7" font-family="monospace" fill="#555">${p.id} · ${k + 1}/${p.photos}</text></svg>`);
  sheet({ title: t('{id} · {n} photos', { id: p.id, n: p.photos }), body: p.photos ? html`<div class="grid2">${Array.from({ length: p.photos }, (_, k) => html`<figure style="margin:0;border-radius:12px;overflow:hidden;border:1px solid var(--line)">${ph(k)}</figure>`)}</div><p class="hint" style="margin-top:8px">${t('Taken on arrival in Guangzhou. Sample images in this preview.')}</p>` : html`<p class="muted">${t('Photos are taken when the parcel arrives.')}</p>` });
});
