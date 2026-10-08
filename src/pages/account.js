import { html } from '../core/html.js';
import { t } from '../core/i18n.js';
import { page, S, money } from '../app.js';
import * as svc from '../domain/services.js';
import { ic } from '../ui/icons.js';
import { orb } from '../ui/parts.js';

page('me', {
  title: () => t('Account'),
  view() {
    const s = S(), p = s.profile, c = svc.creditInfo(s);
    const initials = p.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    return html`<section class="card pad row" style="gap:12px;flex-wrap:nowrap"><span class="tc-av" style="width:52px;height:52px;background:var(--ink);color:var(--surface);font-size:17px;flex-shrink:0">${initials}</span><div class="grow" style="min-width:0"><b style="font-size:16px">${p.shop}</b><div class="muted small">${p.name} · ${p.phone}</div><div class="row" style="margin-top:6px"><button class="code" data-copy="${p.code}" aria-label="${t('Copy customer code')}">${p.code}</button>${p.kyc ? html`<span class="pill good">${ic('check', 11)} ${t('Verified')}</span>` : ''}${p.member ? html`<span class="pill">${t('Lifetime member')}</span>` : ''}</div></div><a class="icon-btn" href="#settings/profile" aria-label="${t('Edit profile')}">${ic('edit', 18)}</a></section>
    <section class="kpis sec"><a class="card kpi" href="#wallet" style="text-decoration:none"><span>${t('Wallet')}</span><b class="num">${money(svc.walletSen(s))}</b></a><a class="card kpi" href="#orders" style="text-decoration:none"><span>${t('In escrow')}</span><b class="num">${money(svc.escrowSen(s))}</b></a><a class="card kpi" href="#credit" style="text-decoration:none"><span>${t('Credit available')}</span><b class="num">${money(c.available)}</b></a><a class="card kpi" href="#credit" style="text-decoration:none"><span>${t('Trust score')}</span><b>${c.score}</b></a></section>
    <section class="card pad sec"><div class="orbs">${['orders', 'ship', 'group', 'track', 'credit', 'pay', 'factories', 'help'].map((k, i) => orb(k, i))}</div></section>
    <section class="card sec list">
      ${[['#settings/addresses', 'pin', t('Addresses'), t('{n} saved · default {d}', { n: s.addresses.length, d: svc.defaultAddr(s)?.label || '' })], ['#settings/shipping', 'truck', t('Shipping and naming'), t('Defaults for new orders and cargo')], ['#settings/payments', 'wallet', t('Payments'), t('Default method and saved cards')], ['#settings/security', 'lock', t('Security'), t('Payment PIN, two-step, devices')], ['#settings/app', 'globe', t('Language and display'), t('Language, theme, currency')], ['#settings', 'gear', t('All settings'), ''], ['#help', 'chat', t('Help and support'), t('AI assistant, chat and tickets')], ['#control', 'grid', t('Control centre (staff)'), t('Preview of the admin tools')]].map(([h, icn, n, sub]) => html`<a class="li" href="${h}"><span class="ic">${ic(icn, 16)}</span><span class="mid"><b>${n}</b>${sub ? html`<small>${sub}</small>` : ''}</span>${ic('arrow', 16)}</a>`)}</section>
    <section class="card pad sec stack"><b>${t('Your China warehouse address')}</b><p class="muted small num" style="margin:0">广东省广州市白云区太和镇 EZICARGO 国际仓 B2-18 · ${t('Receiver')}: ${p.code}</p><button class="btn ghost sm" data-copy="广东省广州市白云区太和镇 EZICARGO 国际仓 B2-18 收件人: ${p.code}">${ic('copy', 14)} ${t('Copy address')}</button></section>`;
  },
});
