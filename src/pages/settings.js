import { html, raw } from '../core/html.js';
import { t, LANGS } from '../core/i18n.js';
import { page, on, S } from '../app.js';
import { CURRENCIES } from '../core/money.js';
import * as store from '../core/store.js';
import { seed } from '../domain/seed.js';
import * as svc from '../domain/services.js';
import { DESTS } from '../domain/catalog.js';
import { ic } from '../ui/icons.js';
import { confirm, toast, sheet } from '../ui/ui.js';
import { changePinFlow, addressForm, destName, payName } from '../flows.js';

const SECTIONS = [['profile', 'user', 'Profile'], ['addresses', 'pin', 'Addresses'], ['shipping', 'truck', 'Shipping and naming'], ['payments', 'wallet', 'Payments'], ['security', 'lock', 'Security'], ['privacy', 'shield', 'Privacy'], ['notifications', 'bell', 'Notifications'], ['app', 'globe', 'Language and display'], ['business', 'factory', 'Business'], ['support', 'chat', 'Help and legal']];

const sw = (path, on, label, sub) => html`<label class="li" style="cursor:pointer"><span class="mid"><b style="white-space:normal">${label}</b>${sub ? html`<small style="white-space:normal">${sub}</small>` : ''}</span><span class="sw"><input type="checkbox" data-set="${path}" ${on ? raw('checked') : ''} aria-label="${label}"><i></i></span></label>`;
const sel = (path, cur, label, opts) => html`<div class="field" style="padding:8px 12px"><label>${label}</label><select data-set="${path}" aria-label="${label}">${opts.map(([v, n]) => html`<option value="${v}" ${String(v) === String(cur) ? raw('selected') : ''}>${n}</option>`)}</select></div>`;
const inp = (field, v, label, type = 'text') => html`<div class="field" style="padding:8px 12px"><label>${label}</label><input data-prof="${field}" type="${type}" value="${v}" maxlength="80" aria-label="${label}"></div>`;

function section(k) {
  const s = S(), p = s.prefs;
  switch (k) {
    case 'profile': return html`<div class="card">${inp('name', s.profile.name, t('Your name'))}${inp('shop', s.profile.shop, t('Shop or business name'))}${inp('phone', s.profile.phone, t('Phone'), 'tel')}${inp('email', s.profile.email, t('Email'), 'email')}<p class="hint" style="padding:0 12px 12px">${t('Changes save when you leave a field.')}</p></div>
      <div class="card list sec"><div class="li"><span class="mid"><b>${t('Customer code')}</b><small>${t('Give this code to sellers so we can match your parcels')}</small></span><button class="code" data-copy="${s.profile.code}">${s.profile.code}</button></div><div class="li"><span class="mid"><b>${t('Identity (eKYC)')}</b><small>MyKad</small></span><span class="pill good">${t('Verified')}</span></div><div class="li"><span class="mid"><b>${t('Business (SSM)')}</b><small>${t('Needed for large supplier payments and credit')}</small></span><span class="pill warn">${t('Not yet')}</span></div></div>`;
    case 'addresses': return html`<div class="card list">${s.addresses.map((a) => html`<div class="li" style="align-items:flex-start"><span class="ic">${ic('pin', 15)}</span><span class="mid"><b>${a.label} · ${a.name}${a.isDefault ? html` <span class="pill good">${t('Default')}</span>` : ''}</b><small style="white-space:normal">${a.line}, ${a.postcode} ${a.city}${a.state ? ', ' + a.state : ''} · ${a.phone}</small><span class="row" style="margin-top:4px">${a.isDefault ? '' : html`<button class="link" data-a="adef" data-id="${a.id}">${t('Make default')}</button>`}<button class="link" data-a="aedit" data-id="${a.id}">${t('Edit')}</button>${s.addresses.length > 1 ? html`<button class="link" style="color:var(--muted)" data-a="adel" data-id="${a.id}">${t('Delete')}</button>` : ''}</span></span></div>`)}</div><button class="btn ghost block sec" data-a="aadd">${ic('plus', 15)} ${t('Add an address')}</button>`;
    case 'shipping': return html`<div class="card">${sel('defaults.dest', p.defaults.dest, t('Default country'), DESTS.map((d) => [d.id, destName(d.id)]))}${sel('defaults.mode', p.defaults.mode, t('Default shipping'), [['sea', t('Sea · cheapest')], ['air', t('Air · fastest')]])}${sel('defaults.insp', p.defaults.insp, t('Default inspection'), [['photo', t('Photo check')], ['std', t('Standard quality check')], ['full', t('Full count and quality')]])}</div>
      <div class="card sec"><div class="pad" style="padding-bottom:0"><b>${t('Naming')}</b><p class="muted small" style="margin:2px 0 0">${t('Patterns for new cargo and shipments. You can rename any of them later.')}</p></div>${sel('naming.cargo', p.naming.cargo, t('Cargo name'), [['{contents} · {source}', t('Contents · where bought')], ['{contents} · {date}', t('Contents · date')], ['{source} · {date}', t('Where bought · date')]])}${sel('naming.shipment', p.naming.shipment, t('Shipment name'), [['{dest} · {date}', t('Country · date')], ['{contents}', t('Contents')], ['{date} · {dest}', t('Date · country')]])}</div>`;
    case 'payments': return html`<div class="card">${sel('defaults.pay', p.defaults.pay, t('Default payment method'), ['wallet', 'fpx', 'duitnow', 'card'].map((m) => [m, payName(m)]))}</div><div class="card list sec"><div class="li"><span class="ic">${ic('wallet', 15)}</span><span class="mid"><b>FPX · Maybank2u</b><small>${t('Linked')}</small></span></div><div class="li"><span class="ic">${ic('credit', 15)}</span><span class="mid"><b>Visa •••• 4821</b><small>${t('Expires {d}', { d: '08/28' })}</small></span></div></div><p class="note sec">${ic('lock', 14)} ${t('Cards are stored by the licensed payment partner, never by EZICARGO.')}</p>`;
    case 'security': return html`<div class="card list"><div class="li"><span class="mid"><b>${t('Payment PIN')}</b><small>${t('6 digits, asked before every payment. 5 wrong tries lock payments for 5 minutes.')}</small></span><button class="btn ghost sm" data-a="pin">${t('Change')}</button></div>${sw('_sec.loginAlerts', s.sec.loginAlerts, t('Login alerts'), t('Tell me when someone signs in on a new device'))}</div>
      <div class="card sec">${sel('_sec.twoStep', s.sec.twoStep, t('Two-step verification'), [['sms', t('SMS code')], ['app', t('Authenticator app')]])}</div>
      <div class="card list sec">${s.sec.devices.map((d) => html`<div class="li"><span class="ic">${ic(d.now ? 'globe' : 'user', 15)}</span><span class="mid"><b>${d.name}</b><small>${d.where}${d.now ? ' · ' + t('This device') : ''}</small></span>${d.now ? '' : html`<button class="btn ghost sm" data-a="devout" data-id="${d.id}">${t('Sign out')}</button>`}</div>`)}</div>
      <section class="card pad sec stack"><b>${t('Emergency')}</b><p class="muted small" style="margin:0">${t('Lost your phone? Freeze your account to stop all payments at once.')}</p><button class="btn danger sm" data-a="freeze">${t('Freeze my account')}</button></section>`;
    case 'privacy': return html`<div class="card list">${sw('privacy.anonReviews', p.privacy?.anonReviews, t('Post reviews as “EZICARGO customer”'))}${sw('privacy.personal', p.privacy?.personal ?? true, t('Personalised recommendations'), t('Use my orders to suggest products'))}${sw('privacy.showShop', p.privacy?.showShop ?? true, t('Show my shop name to factories'), t('When I ask for quotes'))}</div>
      <div class="card list sec"><button class="li" data-a="mydata"><span class="mid"><b>${t('See my data')}</b><small>${t('Orders, parcels, payments and settings')}</small></span>${ic('arrow', 16)}</button><button class="li" data-a="delacc"><span class="mid"><b>${t('Delete my account')}</b><small>${t('After all orders and escrow are settled')}</small></span>${ic('arrow', 16)}</button></div><p class="note sec">${ic('shield', 14)} ${t('We follow Malaysia’s Personal Data Protection Act (PDPA).')}</p>`;
    case 'notifications': return html`<div class="card list">${sw('notify.orders', p.notify.orders, t('Orders and escrow'))}${sw('notify.parcels', p.notify.parcels, t('Parcels and shipments'))}${sw('notify.payments', p.notify.payments, t('Payments and wallet'))}${sw('notify.promos', p.notify.promos, t('Offers and group deals'))}</div>`;
    case 'app': return html`<div class="card">${sel('lang', p.lang, t('Language'), Object.entries(LANGS))}${sel('theme', p.theme, t('Theme'), [['light', t('Light')], ['mist', t('Mist')], ['dark', t('Dark')]])}${sel('cur', p.cur, t('Show prices in'), Object.keys(CURRENCIES).map((c) => [c, c]))}</div><div class="card list sec">${sw('showBal', p.showBal, t('Show balance on home'))}${sw('calm', p.calm, t('Calm mode'), t('Fewer moving effects'))}</div>`;
    case 'business': return html`<div class="card list"><div class="li"><span class="mid"><b>${t('Company name on invoices')}</b><small>${s.profile.shop}</small></span></div><div class="li"><span class="mid"><b>${t('SSM number')}</b><small>${t('Add it to unlock large supplier payments')}</small></span><span class="pill warn">${t('Not yet')}</span></div><div class="li"><span class="mid"><b>${t('Invoices sent to')}</b><small>${s.profile.email}</small></span></div></div>`;
    case 'support': return html`<div class="card list"><a class="li" href="#help"><span class="mid"><b>${t('AI assistant and customer service')}</b></span>${ic('arrow', 16)}</a>${['Terms of use', 'Privacy policy (PDPA)', 'Escrow rules', 'Prohibited and restricted items', 'Refund and dispute policy'].map((n) => html`<button class="li" data-a="legal" data-n="${n}"><span class="mid"><b>${t(n)}</b></span>${ic('doc', 16)}</button>`)}</div><button class="btn ghost block sec" data-a="reset">${t('Reset sample data')}</button><p class="hint" style="text-align:center">EZICARGO RICH SDN. BHD. · 201601014585 (1185516-M) · v2.0</p>`;
    default: return '';
  }
}

page('settings', {
  title: () => t('Settings'),
  view(k) {
    if (!k || !SECTIONS.some((x) => x[0] === k)) return html`<div class="page-h"><h1>${t('Settings')}</h1><p>${t('Everything about your account in one place.')}</p></div><div class="card list">${SECTIONS.map(([id, icn, n]) => html`<a class="li" href="#settings/${id}"><span class="ic">${ic(icn, 16)}</span><span class="mid"><b>${t(n)}</b></span>${ic('arrow', 16)}</a>`)}</div>`;
    const n = SECTIONS.find((x) => x[0] === k)[2];
    return html`<nav class="crumb"><a href="#settings">${t('Settings')}</a> / ${t(n)}</nav><div class="page-h"><h1>${t(n)}</h1></div>${section(k)}`;
  },
  mount(root) {
    root.querySelectorAll('[data-set]').forEach((el) => {
      el.onchange = () => {
        const path = el.dataset.set, v = el.type === 'checkbox' ? el.checked : el.value;
        try {
          if (path.startsWith('_sec.')) store.transact((s) => { s.sec[path.slice(5)] = v; });
          else svc.setPref(path, v);
          toast(t('Saved'), 'good');
        } catch (e) { toast(t(e.message), 'bad'); }
      };
    });
    root.querySelectorAll('[data-prof]').forEach((el) => { el.onchange = () => { try { svc.setProfile(el.dataset.prof, el.value); toast(t('Saved'), 'good'); } catch (e) { toast(t(e.message), 'bad'); el.value = S().profile[el.dataset.prof]; } }; });
  },
});

on('pin', () => changePinFlow());
on('aadd', () => addressForm());
on('aedit', (el) => addressForm(S().addresses.find((a) => a.id === el.dataset.id)));
on('adef', (el) => { svc.setDefaultAddress(el.dataset.id); toast(t('Default address changed'), 'good'); });
on('adel', async (el) => { const a = S().addresses.find((x) => x.id === el.dataset.id); if (await confirm({ title: t('Delete this address?'), text: `${a.label} · ${a.line}`, ok: t('Delete'), danger: true })) { try { svc.deleteAddress(a.id); toast(t('Address deleted')); } catch (e) { toast(t(e.message), 'bad'); } } });
on('devout', async (el) => { if (await confirm({ title: t('Sign out this device?'), text: S().sec.devices.find((d) => d.id === el.dataset.id).name, ok: t('Sign out') })) { store.transact((s) => { s.sec.devices = s.sec.devices.filter((d) => d.id !== el.dataset.id); }); toast(t('Signed out'), 'good'); } });
on('freeze', async () => { if (await confirm({ title: t('Freeze your account?'), text: t('All payments stop until you contact support. Parcels stay safe in the warehouse.'), ok: t('Freeze'), danger: true })) toast(t('Test mode: in the live app this freezes payments at once.')); });
on('delacc', async () => { if (await confirm({ title: t('Delete your account?'), text: t('We close your wallet after every order and escrow payment is settled. This cannot be undone.'), ok: t('Request deletion'), danger: true })) toast(t('Request received. Support will contact you within 2 working days.'), 'good'); });
on('mydata', () => { const s = S(); sheet({ title: t('My data'), wide: true, body: html`<p class="muted small">${t('A copy of what this app stores for you.')}</p><pre style="white-space:pre-wrap;word-break:break-all;font-size:11px;max-height:50dvh;overflow:auto;background:var(--surface-2);padding:10px;border-radius:10px">${JSON.stringify({ profile: s.profile, addresses: s.addresses, orders: s.orders, parcels: s.parcels, shipments: s.shipments, prefs: s.prefs }, null, 2)}</pre>` }); });
on('legal', (el) => sheet({ title: t(el.dataset.n), body: html`<p class="muted">${t('Summary for this preview. The full legal text is published with the live app.')}</p><ul class="small" style="padding-inline-start:18px">${[t('Money for factory orders is held in escrow until our inspection passes.'), t('Listings that copy another brand are removed; customs seize them.'), t('Refunds go back to the method you paid with.')].map((x) => html`<li>${x}</li>`)}</ul>` }));
on('reset', async () => { if (await confirm({ title: t('Reset sample data?'), text: t('Orders, parcels and wallet go back to the starting sample.'), ok: t('Reset'), danger: true })) { store.reset(() => seed()); toast(t('Sample data reset'), 'good'); } });
