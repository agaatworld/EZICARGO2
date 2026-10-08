import { html } from '../core/html.js';
import { t } from '../core/i18n.js';
import { page, on, S, money } from '../app.js';
import { band, CREDIT_DAYS } from '../domain/rules.js';
import * as svc from '../domain/services.js';
import { ic } from '../ui/icons.js';
import { stepsList } from '../ui/parts.js';
import { repayFlow } from '../flows.js';

page('credit', {
  title: () => t('EZI Credit'),
  view() {
    const s = S(), c = svc.creditInfo(s), b = band(c.score);
    const pct = Math.round(((c.score - 300) / 550) * 100);
    return html`<div class="page-h"><h1>${t('EZI Credit')}</h1><p>${t('Ship now, pay when the goods arrive. Your goods stay under EZICARGO control until you pay.')}</p></div>
    <div class="split"><div class="stack">
      <section class="card pad row" style="gap:16px;flex-wrap:nowrap"><div class="ring" style="--p:${pct};width:86px;height:86px"><b style="width:70px;height:70px;font-size:20px">${c.score}</b></div><div class="grow"><span class="pill ${b === 'excellent' || b === 'good' ? 'good' : 'warn'}">${t({ excellent: 'Excellent', good: 'Good', fair: 'Fair', building: 'Building' }[b])}</span><div class="sum" style="margin-top:8px"><div class="sum-r"><span>${t('Available')}</span><b>${money(c.available)}</b></div><div class="sum-r"><span>${t('Used')}</span><b>${money(c.used)}</b></div><div class="sum-r"><span>${t('Limit')}</span><b>${money(c.limit)}</b></div></div></div></section>
      <section class="card pad"><b>${t('How it works')}</b><div style="margin-top:10px">${stepsList([[t('Choose EZI Credit at checkout'), t('No money leaves your wallet yet.')], [t('We ship your goods'), t('They stay under our control on the way.')], [t('Pay within {n} days of arrival', { n: CREDIT_DAYS }), t('Then the goods are released to you.')]], -1)}</div></section>
      <section class="card pad"><b>${t('Grow your limit')}</b><ul class="muted small" style="margin:6px 0 0;padding-inline-start:18px"><li>${t('Pay on time: every on-time payment raises your score.')}</li><li>${t('Trade regularly with EZICARGO.')}</li><li>${t('Verify your business (SSM) in Settings.')}</li></ul></section></div>
    <aside class="side card pad stack"><b>${t('Owed now')}</b><b class="num" style="font-size:24px">${money(c.used)}</b>${c.used > 0 ? html`<button class="btn primary block" data-a="repay">${t('Repay now')}</button>` : html`<p class="muted small" style="margin:0">${t('Nothing owed. Use credit at checkout.')}</p>`}<p class="note">${ic('lock', 14)} ${t('Credit is provided with a licensed financing partner. Test mode.')}</p></aside></div>`;
  },
});
on('repay', () => repayFlow());
