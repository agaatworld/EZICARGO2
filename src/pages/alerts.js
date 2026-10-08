import { html } from '../core/html.js';
import { t, ago } from '../core/i18n.js';
import { page, on, S, money } from '../app.js';
import { markRead } from '../domain/services.js';
import { ic } from '../ui/icons.js';

const TEXT = {
  'n.measured': (v) => t('{id} arrived: weighed and photographed', v),
  'n.groupFull': (v) => t('A group deal you follow is {pct}% full', v),
  'n.topup': (v) => t('Top-up of {amt} received', { amt: money(v.amt) }),
  'n.paid': (v) => t('Paid into escrow: {ids}', v),
  'n.refund': (v) => t('Refund for {id} is on its way back to how you paid', v),
  'n.inspected': (v) => t('{id} passed inspection', v),
  'n.shipped': (v) => t('{id} has shipped', v),
  'n.shipBooked': (v) => t('Shipment {id} booked', v),
  'n.delivered': (v) => t('Shipment {id} delivered', v),
  'n.depositBack': (v) => t('Group deal {id} did not reach its minimum. Your deposit is back in your wallet.', v),
};
export const noticeText = (n) => (TEXT[n.key] ? TEXT[n.key](n.vars || {}) : n.key);

page('alerts', {
  title: () => t('Alerts'),
  view() {
    const s = S();
    return html`<div class="page-h row between"><h1>${t('Alerts')}</h1>${s.notices.some((n) => !n.read) ? html`<button class="btn ghost sm" data-a="readAll">${t('Mark all read')}</button>` : ''}</div>
    ${s.notices.length ? html`<div class="card list">${s.notices.map((n) => html`<a class="li" href="#${n.route}"><span class="ic ${n.read ? '' : 'esc'}">${ic('bell', 15)}</span><span class="mid"><b style="white-space:normal">${noticeText(n)}</b><small>${ago(n.at)}</small></span>${n.read ? '' : html`<span class="pill red">${t('New')}</span>`}</a>`)}</div>` : html`<div class="empty card"><h2>${t('No alerts')}</h2></div>`}`;
  },
});
on('readAll', () => markRead());
