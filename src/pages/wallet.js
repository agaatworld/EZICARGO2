import { html } from '../core/html.js';
import { t, ago, dateStr } from '../core/i18n.js';
import { page, on, S, money, render } from '../app.js';
import { walletStatement } from '../core/ledger.js';
import { FX } from '../core/money.js';
import * as svc from '../domain/services.js';
import { ic } from '../ui/icons.js';
import { topUp, paySupplierFlow } from '../flows.js';

let filter = 'all';
page('wallet', {
  title: () => t('Wallet'),
  view() {
    const s = S(), st = walletStatement(s.ledger), cr = svc.creditInfo(s);
    const list = st.filter((r) => filter === 'all' || (filter === 'in' ? r.v > 0 : filter === 'esc' ? ['hold', 'deposit'].includes(r.kind) : r.v < 0));
    return html`<div class="page-h"><h1>${t('EZI Wallet')}</h1><p>${t('Top up in ringgit, pay Chinese suppliers in yuan, and keep factory money in escrow until goods pass inspection.')}</p></div>
    <div class="split"><div class="stack">
      <section class="tcard" style="padding-bottom:16px"><div class="tc-l" style="margin:0">${t('Available balance')}</div><div class="tc-bal" style="margin-top:4px"><b class="num">${money(svc.walletSen(s))}</b></div>
        <div class="tc-chips"><a href="#orders">${ic('shield', 12)} ${t('Escrow')} <b class="num">${money(svc.escrowSen(s))}</b></a><a href="#credit">${ic('credit', 12)} ${t('Credit owed')} <b class="num">${money(cr.used)}</b></a></div>
        <div class="tc-btns"><button class="btn b1" data-a="topup">${ic('plus', 16)} ${t('Top up')}</button><button class="btn b2" data-a="paysup">${ic('swap', 16)} ${t('Pay supplier')}</button></div></section>
      <section class="card"><div class="row between pad" style="padding-bottom:6px"><b>${t('Statement')}</b><span class="muted small">${t('Double-entry ledger · every move recorded')}</span></div>
        <div class="chips" style="padding:0 14px 6px">${[['all', 'All'], ['in', 'Money in'], ['out', 'Money out'], ['esc', 'Escrow']].map(([k, n]) => html`<button class="chip" data-a="wf" data-f="${k}" aria-pressed="${k === filter}">${t(n)}</button>`)}</div>
        <div class="list">${list.length ? list.map((r) => html`<div class="li"><span class="ic ${r.v > 0 ? 'in' : ['hold', 'deposit'].includes(r.kind) ? 'esc' : 'out'}">${ic(r.v > 0 ? 'plus' : r.kind === 'hold' ? 'shield' : 'arrow', 15)}</span><span class="mid"><b>${r.memo}</b><small>${dateStr(r.at)} · ${ago(r.at)} · ${r.id}</small></span><span class="end num ${r.v > 0 ? 'amt-in' : ''}">${money(r.v, { plus: true })}</span></div>`) : html`<p class="muted pad">${t('Nothing here yet.')}</p>`}</div></section>
    </div>
    <aside class="side stack"><section class="card pad stack"><b>${t('Pay a supplier in yuan')}</b><p class="muted small" style="margin:0">${t('Alipay, WeChat Pay or Chinese bank. Arrives the same day.')}</p><div class="sum"><div class="sum-r"><span>${t('Rate')}</span><b>1 MYR = ¥${FX.MYR_CNY}</b></div><div class="sum-r"><span>${t('Fee')}</span><b>0.5%</b></div></div><button class="btn primary block" data-a="paysup">${t('Pay a supplier')}</button><p class="hint">${t('Large payments need a verified business account and the supplier invoice.')}</p></section>
      <section class="card pad"><b>${t('Methods')}</b><p class="muted small" style="margin:4px 0 0">FPX · DuitNow QR · Visa · Mastercard</p><p class="note" style="margin-top:8px">${ic('lock', 14)} ${t('Test mode. Real payments go through a licensed payment partner.')}</p></section></aside></div>`;
  },
  mount(root, sub) { if (sub === 'pay') { history.replaceState(null, '', '#wallet'); setTimeout(() => paySupplierFlow(), 60); } },
});

on('paysup', () => paySupplierFlow());
on('wf', (el) => { filter = el.dataset.f; render(); });
