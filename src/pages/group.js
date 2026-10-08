import { html } from '../core/html.js';
import { t, tl } from '../core/i18n.js';
import { page, on, S, money } from '../app.js';
import { fmtCny, cnyToMyr } from '../core/money.js';
import { byId, factoryOf } from '../domain/catalog.js';
import { groupPrice, groupProgress, groupOpen } from '../domain/rules.js';
import { ic } from '../ui/icons.js';
import { dealCard, artOf, countdown, vtick } from '../ui/parts.js';
import { joinFlow, newGroupFlow } from '../flows.js';

page('group', {
  title: () => t('Group buy'),
  view(id) {
    const s = S();
    if (id && id !== 'new') {
      const g = s.groups.find((x) => x.id === id);
      if (!g) return html`<div class="empty"><h2>${t('Deal not found')}</h2><a class="btn primary" href="#group">${t('Group deals')}</a></div>`;
      const p = byId(g.pid), now = groupPrice(g.ladder, g.committed, p.t[0][1]), mine = s.joins.filter((j) => j.gid === g.id).reduce((a, j) => a + j.pcs, 0), open = groupOpen(g);
      return html`<nav class="crumb"><a href="#group">${t('Group deals')}</a> / ${tl(p.n)}</nav>
      <div class="split"><div class="stack"><section class="card pad row" style="flex-wrap:nowrap;align-items:flex-start"><a href="#p/${p.id}" aria-label="${tl(p.n)}" style="width:84px;height:84px;border-radius:14px;overflow:hidden;flex-shrink:0">${artOf(p)}</a><div class="grow" style="min-width:0"><b>${tl(p.n)}</b><div class="muted small">${vtick()} ${factoryOf(p).n}</div><div class="row" style="margin-top:6px"><span class="pill red">${ic('group', 12)} ${t('{n} shops', { n: g.shops })}</span>${open ? html`<span class="pill">${t('Ends in')} <span class="cd" data-end="${g.endsAt}">${countdown(g.endsAt - Date.now())}</span></span>` : html`<span class="pill warn">${t('Closed')}</span>`}</div></div></section>
        <section class="card pad stack"><b>${t('Price drops for everyone as shops join')}</b><div class="bar" style="height:10px"><i style="width:${Math.round(groupProgress(g) * 100)}%"></i></div><div class="row between small"><span>${g.committed.toLocaleString('en-US')} ${t('pcs committed')}</span><span class="muted">${t('Target {n}', { n: g.goal.toLocaleString('en-US') })}</span></div>
          <div class="tiers"><div class="${now === p.t[0][1] ? 'on' : ''}"><small>${t('Now')}</small><b>${fmtCny(p.t[0][1])}</b></div>${g.ladder.map(([m, f]) => html`<div class="${g.committed >= m && now === f ? 'on' : ''}"><small>${m.toLocaleString('en-US')}+</small><b>${fmtCny(f)}</b></div>`)}</div></section>
        <section class="card pad"><b>${t('How it works')}</b><ol class="muted small" style="margin:6px 0 0;padding-inline-start:18px"><li>${t('Join with your pieces and a 30% deposit, held in escrow.')}</li><li>${t('At the deadline everyone pays the price the group reached.')}</li><li>${t('One production run and one inspection, then split delivery to each shop.')}</li><li>${t('If the minimum is not reached, deposits come back in full.')}</li></ol></section></div>
      <aside class="side card pad stack"><div class="sum"><div class="sum-r"><span>${t('Price now')}</span><b>${fmtCny(now)} · ${money(cnyToMyr(now))}</b></div><div class="sum-r"><span>${t('Your pieces')}</span><b>${mine.toLocaleString('en-US')}</b></div></div>${open ? html`<button class="btn primary lg block" data-a="gjoin" data-id="${g.id}">${mine ? t('Add more pieces') : t('Join this deal')}</button>` : ''}<a class="btn ghost block" href="#p/${p.id}">${t('See product')}</a></aside></div>`;
    }
    const open = s.groups.filter((g) => g.state === 'open');
    return html`<div class="page-h row between" style="align-items:flex-end"><div><h1>${t('Group buy')}</h1><p>${t('Shops join one factory order to reach the lower price before the timer ends.')}</p></div><button class="btn primary sm" data-a="gnew">${ic('plus', 15)} ${t('Start a group deal')}</button></div>
      ${s.joins.length ? html`<section class="card pad stack" style="margin-bottom:12px"><b>${t('My group deals')}</b>${[...new Set(s.joins.map((j) => j.gid))].map((gid) => { const g = s.groups.find((x) => x.id === gid), p = byId(g.pid); return html`<a class="li" style="padding:6px 0" href="#group/${gid}"><span class="mid"><b>${tl(p.n)}</b><small>${s.joins.filter((j) => j.gid === gid).reduce((a, j) => a + j.pcs, 0)} ${t('pcs')} · ${t('deposit {m}', { m: money(s.joins.filter((j) => j.gid === gid).reduce((a, j) => a + j.dep, 0)) })}</small></span></a>`; })}</section>` : ''}
      <div class="stack">${open.map(dealCard)}</div>`;
  },
  mount(root, id) { if (id === 'new') { history.replaceState(null, '', '#group'); setTimeout(() => newGroupFlow(), 60); } },
});

on('gjoin', (el) => joinFlow(el.dataset.id));
on('gnew', () => newGroupFlow());
