// App shell: router, header, bottom bar, action dispatch, theme and language.
import { html, raw } from './core/html.js';
import * as store from './core/store.js';
import { t, setLang, getLang, LANGS, SHORT } from './core/i18n.js';
import { fmt } from './core/money.js';
import { seed } from './domain/seed.js';
import { walletSen, settleGroups } from './domain/services.js';
import { ic } from './ui/icons.js';
import { sheet, toast, closeAll } from './ui/ui.js';

export const actions = Object.create(null);
/** Pages register their button handlers here: <button data-a="name" data-x="…">. */
export function on(name, fn) { actions[name] = fn; }

const pages = Object.create(null);
export function page(name, def) { pages[name] = def; }

export const S = () => store.get();
export const money = (sen, o) => fmt(sen, S().prefs.cur, o);

let current = { name: '', args: [] };
export function route() { return current; }
export function go(hash) { if (location.hash === '#' + hash) render(); else location.hash = hash; }

function parse() {
  let h;
  try { h = decodeURIComponent(location.hash.replace(/^#\/?/, '')) || 'home'; } catch { h = 'home'; }
  const [name, ...args] = h.split('/');
  return { name: pages[name] ? name : 'home', args };
}

// Navigation: five main places always in reach (bottom bar on phones, top bar on desktop).
// Warehouse is our unique service, so it sits in the raised centre button.
// Each main place has a row of sub-pages right under the header, so nothing is more than two taps away.
const TABS = [['home', 'home', 'Home'], ['shop', 'shop', 'Shop'], ['ship', 'box', 'Warehouse'], ['wallet', 'wallet', 'Wallet'], ['me', 'user', 'Account']];
const TAB_OF = { home: 'home', shop: 'shop', p: 'shop', cart: 'shop', factories: 'shop', chat: 'shop', group: 'shop', orders: 'shop', order: 'shop', ship: 'ship', track: 'ship', wallet: 'wallet', credit: 'wallet', me: 'me', settings: 'me', help: 'me', alerts: 'me', control: 'me' };
const SUB = {
  shop: [['shop', 'Products'], ['group', 'Group deals'], ['orders', 'My orders'], ['factories', 'Factories'], ['cart', 'Cart']],
  ship: [['ship', 'My warehouse'], ['track', 'Track'], ['ship/rates', 'Rates'], ['a:declare', 'Declare a parcel']],
  wallet: [['wallet', 'Wallet'], ['a:paysup', 'Pay supplier'], ['a:topup', 'Top up'], ['credit', 'EZI Credit']],
  me: [['me', 'Account'], ['alerts', 'Alerts'], ['settings', 'Settings'], ['help', 'Help'], ['control', 'Control centre']],
};
const subOn = (k) => {
  const [n, x] = k.split('/'), c = current.name, a0 = current.args[0];
  if (n === 'ship') return c === 'ship' && (x ? a0 === x : a0 !== 'rates');
  if (n === 'orders') return c === 'orders' || c === 'order';
  if (n === 'shop') return c === 'shop' || c === 'p';
  if (n === 'factories') return c === 'factories' || c === 'chat';
  return c === n;
};
function subnav() {
  const tab = TAB_OF[current.name];
  const list = SUB[tab];
  if (!list) return '';
  return html`<nav class="subnav" aria-label="${t('Sections')}"><div class="subnav-in">${list.map(([k, n]) => k.startsWith('a:')
    ? html`<button class="chip" data-a="${k.slice(2)}">${ic('plus', 13)} ${t(n)}</button>`
    : html`<a class="chip ${subOn(k) ? 'on' : ''}" href="#${k}" ${subOn(k) ? raw('aria-current="page"') : ''}>${t(n)}</a>`)}</div></nav>`;
}

function header() {
  const s = S(), unread = s.notices.filter((n) => !n.read).length, cartN = s.cart.length, on = TAB_OF[current.name] || current.name;
  return html`<div class="hd-in">
    <a class="brand" href="#home" aria-label="EZICARGO"><img src="assets/ezicargo-mark.png" alt="" width="34" height="26"><b>EZICARGO</b></a>
    <form class="search" role="search" data-form="search"><input name="q" type="search" placeholder="${t('Search products and factories')}" aria-label="${t('Search')}" maxlength="60"><button aria-label="${t('Search')}">${ic('search', 18)}</button></form>
    <nav class="hd-act" aria-label="${t('Quick actions')}">
      <button class="icon-btn" data-a="services" aria-label="${t('Services')}">${ic('grid', 20)}</button>
      <button class="icon-btn" data-a="lang" aria-label="${t('Language')}">${ic('globe', 20)}<em class="lang-code">${SHORT[getLang()]}</em></button>
      <button class="icon-btn" data-a="theme" aria-label="${t('Display')}">${ic('sun', 20)}</button>
      <a class="icon-btn" href="#alerts" aria-label="${t('Alerts')}">${ic('bell', 20)}${unread ? html`<em class="dot">${unread}</em>` : ''}</a>
      <a class="icon-btn" href="#cart" aria-label="${t('Cart')}">${ic('cart', 20)}${cartN ? html`<em class="dot">${cartN}</em>` : ''}</a>
    </nav></div>
    <nav class="topnav" aria-label="${t('Main')}"><div class="topnav-in">${TABS.map(([k, icn, label]) => html`<a href="#${k}" class="${on === k ? 'on' : ''}">${ic(icn, 17)} ${t(label)}</a>`)}<a href="#group" class="${current.name === 'group' ? 'on' : ''}">${ic('group', 17)} ${t('Group buy')}</a><a href="#track" class="${current.name === 'track' ? 'on' : ''}">${ic('pin', 17)} ${t('Track')}</a><a href="#help" class="${current.name === 'help' ? 'on' : ''}">${ic('chat', 17)} ${t('Help')}</a></div></nav>`;
}

function tabs() {
  const on = TAB_OF[current.name] || current.name;
  return html`${TABS.map(([k, icn, label]) => k === 'ship'
    ? html`<a href="#ship" class="tab-svc ${on === k ? 'on' : ''}" ${on === k ? raw('aria-current="page"') : ''}><span>${ic(icn, 22)}</span><b>${t(label)}</b></a>`
    : html`<a href="#${k}" class="${on === k ? 'on' : ''}" ${on === k ? raw('aria-current="page"') : ''}>${ic(icn, 21)}<b>${t(label)}</b></a>`)}<i class="tab-pill" aria-hidden="true"></i>`;
}

let lastKey = '', scrollMem = {};
export function render() {
  const next = parse();
  const key = next.name + '/' + next.args.join('/');
  const sameView = key === lastKey;
  if (!sameView) scrollMem[lastKey] = window.scrollY;
  current = next;
  const s = S();
  document.documentElement.dataset.theme = s.prefs.theme;
  document.documentElement.classList.toggle('calm', !!s.prefs.calm);
  setLang(s.prefs.lang);
  document.body.dataset.view = current.name;
  const p = pages[current.name];
  let body;
  try { body = p.view(...current.args); } catch (e) { console.error(e); body = html`<section class="empty"><h2>${t('Something went wrong')}</h2><p class="muted">${t('Please go back and try again.')}</p><a class="btn primary" href="#home">${t('Home')}</a></section>`; }
  document.getElementById('hd').innerHTML = String(header());
  document.getElementById('tabs').innerHTML = String(tabs());
  const app = document.getElementById('app');
  app.innerHTML = String(html`${subnav()}<div class="view v-${current.name}">${body}</div>`);
  document.title = (p.title ? p.title(...current.args) + ' · ' : '') + 'EZICARGO';
  p.mount && p.mount(app, ...current.args);
  movePill();
  if (!sameView) window.scrollTo(0, scrollMem[key] && next.name === 'home' ? scrollMem[key] : 0);
  lastKey = key;
  document.dispatchEvent(new CustomEvent('ezc:view', { detail: current }));
}

function movePill() {
  const pill = document.querySelector('.tab-pill'), a = document.querySelector('#tabs a.on:not(.tab-svc)');
  if (!pill) return;
  if (!a) { pill.style.opacity = '0'; return; }
  const w = Math.min(56, a.offsetWidth - 8);
  pill.style.width = w + 'px';
  pill.style.opacity = '1';
  pill.style.transform = `translateX(${a.offsetLeft + (a.offsetWidth - w) / 2}px)`;
}

let queued = false;
function scheduleRender() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; render(); }); }

// ---------- shell actions ----------
on('services', () => import('./pages/services.js').then((m) => m.openServices()));
on('lang', () => {
  const s = sheet({ title: t('Language'), body: html`<div class="pick">${Object.entries(LANGS).map(([k, n]) => html`<button class="pick-i ${getLang() === k ? 'on' : ''}" data-lang="${k}"><b>${n}</b><small>${{ en: 'English', ms: 'Malay', zh: 'Chinese', ar: 'Arabic · right to left' }[k]}</small></button>`)}</div>` });
  s.el.addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (!b) return; store.transact((st) => { st.prefs.lang = b.dataset.lang; }); s.close(); });
});
on('theme', () => {
  const cur = S().prefs.theme;
  const s = sheet({ title: t('Display'), body: html`<div class="themes">${[['light', 'Light'], ['mist', 'Mist'], ['dark', 'Dark']].map(([k, n]) => html`<button class="th th-${k} ${cur === k ? 'on' : ''}" data-theme-pick="${k}"><i></i><b>${t(n)}</b></button>`)}</div><p class="muted small">${t('Mist is an ocean-blue look between light and dark.')}</p>` });
  s.el.addEventListener('click', (e) => { const b = e.target.closest('[data-theme-pick]'); if (!b) return; store.transact((st) => { st.prefs.theme = b.dataset.themePick; }); s.close(); });
});

// ---------- global events ----------
document.addEventListener('click', (e) => {
  const skip = e.target.closest('a.sr[href="#app"]');
  if (skip) { e.preventDefault(); document.getElementById('app').focus(); return; }
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  const fn = actions[el.dataset.a];
  if (!fn) return;
  e.preventDefault();
  try { const r = fn(el, e); if (r && r.catch) r.catch(fail); } catch (err) { fail(err); }
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-form]'); if (!f) return;
  e.preventDefault();
  const fn = actions['form:' + f.dataset.form];
  if (fn) try { fn(f, Object.fromEntries(new FormData(f).entries())); } catch (err) { fail(err); }
});
on('form:search', (f, v) => { const q = String(v.q || '').trim().slice(0, 60); go('shop/all/' + encodeURIComponent(q)); });

export function fail(err) { console.error(err); toast(err && err.message ? t(err.message) : t('Something went wrong'), 'bad'); }

window.addEventListener('hashchange', () => { closeAll(); render(); });
window.addEventListener('resize', movePill);

// scrolling pauses decorative animation for smoothness
let st;
window.addEventListener('scroll', () => { document.documentElement.classList.add('scrolling'); clearTimeout(st); st = setTimeout(() => document.documentElement.classList.remove('scrolling'), 160); }, { passive: true });
document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('paused', document.hidden));

export async function boot() {
  store.load(() => seed());
  store.subscribe(scheduleRender);
  const settle = () => { try { settleGroups(); } catch (e) { console.error(e); } };
  settle(); setInterval(settle, 30000);
  await Promise.all(['home', 'shop', 'product', 'cart', 'orders', 'ship', 'wallet', 'group', 'credit', 'track', 'account', 'settings', 'help', 'control', 'alerts', 'factories'].map((n) => import(`./pages/${n}.js`)));
  render();
  intro();
}

function intro() {
  let skip = false;
  try { skip = !!sessionStorage.getItem('ezc-intro') || matchMedia('(prefers-reduced-motion: reduce)').matches; sessionStorage.setItem('ezc-intro', '1'); } catch { skip = true; }
  if (skip) return;
  const el = document.createElement('div');
  el.className = 'intro'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="in-c"><div class="in-ship"><img src="assets/ezicargo-mark.png" alt="" width="96" height="72"><div class="in-sea"><svg viewBox="0 0 400 16" preserveAspectRatio="none"><path d="M0 8 Q12.5 3 25 8 T50 8 T75 8 T100 8 T125 8 T150 8 T175 8 T200 8 T225 8 T250 8 T275 8 T300 8 T325 8 T350 8 T375 8 T400 8 V16 H0Z" fill="rgba(30,95,168,.25)"/></svg></div></div><div class="in-w"><span>EZI</span>CARGO</div>
    <svg class="in-route" viewBox="0 0 300 60"><path class="in-path" d="M10 50 Q150 -10 290 50"/><g class="in-plane"><path d="M8 0 2.3 -1.3 -.9 -5.8 -2.9 -5.8 -1.4 -1.3 -5.2 -1.3 -6.9 -3.5 -8.4 -3.5 -7.2 0 -8.4 3.5 -6.9 3.5 -5.2 1.3 -1.4 1.3 -2.9 5.8 -.9 5.8 2.3 1.3Z"/></g><circle class="in-a" cx="10" cy="50" r="4"/><circle class="in-b" cx="290" cy="50" r="4"/></svg>
    <p class="in-t">China · Malaysia · Gulf</p></div>`;
  document.body.appendChild(el);
  const end = () => { el.classList.add('out'); setTimeout(() => el.remove(), 400); };
  el.addEventListener('click', end);
  setTimeout(end, 2400);
}
