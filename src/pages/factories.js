import { html } from '../core/html.js';
import { t, tl, ago } from '../core/i18n.js';
import { page, on, S, render } from '../app.js';
import { transact } from '../core/store.js';
import { FACTORIES, PRODUCTS, byId } from '../domain/catalog.js';
import { ic } from '../ui/icons.js';
import { pcard, artOf, vtick } from '../ui/parts.js';

const LV = { select: 'EZI Select', gold: 'Gold', silver: 'Silver' };
const TYPE = { oem: 'OEM · own brand', unbranded: 'Unbranded · OEM', odm: 'ODM · unbranded', private: 'OEM · private label', own: 'Factory own brand', print: 'Custom print' };

page('factories', {
  title: () => t('Factories'),
  view(fid) {
    if (fid && FACTORIES[fid]) {
      const f = FACTORIES[fid], ps = PRODUCTS.filter((p) => p.f === fid);
      return html`<nav class="crumb"><a href="#factories">${t('Factories')}</a> / ${f.n}</nav>
      <section class="card pad row" style="gap:14px;flex-wrap:nowrap"><span class="ring" style="--p:${f.score};width:64px;height:64px"><b style="width:52px;height:52px;font-size:16px">${f.score}</b></span><div class="grow"><b style="font-size:16px">${f.n} ${vtick()}</b><div class="muted small">${f.city} · ${t('{n} years', { n: f.yrs })} · ${t(TYPE[f.type])}</div><div class="row" style="margin-top:6px"><span class="pill ${f.lv === 'select' ? 'dark' : ''}">${LV[f.lv]}</span><span class="pill good">${t('Pass rate {n}%', { n: f.pass })}</span><span class="pill">${t('On time {n}%', { n: f.onTime })}</span><span class="pill">${t('Replies in {n} h', { n: f.reply })}</span></div></div></section>
      <p class="note sec">${ic('shield', 14)} ${t('Scored daily from inspection pass rate, on-time delivery and buyer ratings. Below 75 for 14 days means paused and replaced.')}</p>
      <section class="sec"><div class="sec-h"><h2>${t('Products')}</h2></div><div class="pgrid">${ps.map(pcard)}</div></section>
      <a class="btn primary block sec" href="#chat/${fid}/${ps[0]?.id || ''}">${ic('chat', 16)} ${t('Chat with factory')}</a>`;
    }
    const list = Object.entries(FACTORIES).sort((a, b) => b[1].score - a[1].score);
    return html`<div class="page-h"><h1>${t('Verified factories')}</h1><p>${t('Invite only. We check licences, test samples and inspect every order. No brand copies.')}</p></div>
      <div class="card list">${list.map(([id, f]) => html`<a class="li" href="#factories/${id}"><span class="ring" style="--p:${f.score}"><b>${f.score}</b></span><span class="mid"><b>${f.n}</b><small>${f.city} · ${LV[f.lv]} · ${t('Pass rate {n}%', { n: f.pass })}</small></span>${ic('arrow', 16)}</a>`)}</div>`;
  },
});

// Factory chat. Factory replies are simulated in this preview and say so.
const REPLIES = ['Thank you! Lead time is {lead} days after the deposit.', 'Yes, we can print your logo. Send us the file in AI or PDF.', 'Mixed colours are fine from the second price step.', 'We can send a sample within 3 days.'];
page('chat', {
  title: () => t('Chat'),
  view(fid, pid) {
    const f = FACTORIES[fid]; if (!f) return html`<div class="empty"><h2>${t('Factory not found')}</h2></div>`;
    const p = byId(pid), msgs = S().chats[fid] || [];
    return html`<nav class="crumb"><a href="#factories/${fid}">${f.n}</a> / ${t('Chat')}</nav>
    <section class="card pad stack"><div class="row"><span class="ring" style="--p:${f.score}"><b>${f.score}</b></span><div class="grow"><b>${f.n}</b><div class="muted small">● ${t('Online')} · ${t('Replies in {n} h', { n: f.reply })}</div></div></div>
      ${p ? html`<a class="li" href="#p/${p.id}" style="border:1px solid var(--line);border-radius:12px"><span class="th">${artOf(p)}</span><span class="mid"><b>${tl(p.n)}</b><small>${t('Asking about this product')}</small></span></a>` : ''}
      <div class="chat" data-chat>${msgs.length ? '' : html`<div class="msg bot">${t('Hello! How can we help?')}</div>`}${msgs.map((m) => html`<div class="msg ${m.me ? 'me' : 'bot'}">${m.text}<br><small class="muted">${ago(m.at)}</small></div>`)}</div>
      <div class="chips">${['What is the lead time?', 'Can you print my logo?', 'Can I mix colours?', 'Please send a sample'].map((q) => html`<button class="chip" data-a="fq" data-q="${t(q)}" data-f="${fid}" data-p="${pid || ''}">${t(q)}</button>`)}</div>
      <form class="composer" data-form="fchat" data-f="${fid}" data-p="${pid || ''}"><input class="inp" name="m" maxlength="500" placeholder="${t('Write to the factory')}" aria-label="${t('Message')}"><button class="btn primary" aria-label="${t('Send')}">${ic('send', 16)}</button></form>
      <p class="hint">${t('Messages are translated between your language and Chinese. Factory replies are simulated in this preview.')}</p></section>`;
  },
  mount(root) { const c = root.querySelector('[data-chat]'); if (c) c.scrollTop = c.scrollHeight; },
});

function send(fid, pid, text) {
  const v = String(text || '').trim().slice(0, 500); if (!v) return;
  transact((s) => { (s.chats[fid] = s.chats[fid] || []).push({ me: true, text: v, at: Date.now() }); });
  const p = byId(pid);
  setTimeout(() => transact((s) => { const k = /logo|cetak|印|شعار/i.test(v) ? 1 : /colou?r|warna|颜色|لون/i.test(v) ? 2 : /sample|sampel|样|عين/i.test(v) ? 3 : 0; s.chats[fid].push({ me: false, text: t(REPLIES[k], { lead: p ? `${p.lead[0]}–${p.lead[1]}` : '7–10' }), at: Date.now() }); }), 1200);
}
on('fq', (el) => send(el.dataset.f, el.dataset.p, el.dataset.q));
on('form:fchat', (f, v) => { send(f.dataset.f, f.dataset.p, v.m); });
