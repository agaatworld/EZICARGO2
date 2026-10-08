// Help: AI assistant (Claude via the page's sample capability, with an offline fallback) and customer service tickets.
import { html } from '../core/html.js';
import { t, ago, getLang, LANGS } from '../core/i18n.js';
import { page, on, S, render, money } from '../app.js';
import * as svc from '../domain/services.js';
import { ic } from '../ui/icons.js';
import { toast } from '../ui/ui.js';

const chat = [];
let tab = 'ai', thinking = false, ctrl = null;

const FAQ = [
  [/escrow|safe|trust|scam|selamat|托管|ضمان/i, 'Your money waits in escrow with EZICARGO. The factory is paid only after our team in Guangzhou inspects the goods. If inspection fails, you get a refund.'],
  [/ship|air|sea|hantar|运|شحن/i, 'Sea to West Malaysia takes 14–21 days and is cheapest for bulk. Air takes 5–7 days and is priced by the larger of real and volume weight (L×W×H ÷ 6000). Use the calculator on the warehouse page.'],
  [/address|alamat|地址|عنوان/i, 'Your China address is on the warehouse page. Put your customer code as the receiver so we can match your parcels.'],
  [/group|kumpulan|拼团|جماعي/i, 'Group buy: shops join one factory order before a deadline. You pay a 30% deposit into escrow. If the group does not reach the minimum, the deposit comes back in full.'],
  [/credit|kredit|信用|ائتمان/i, 'EZI Credit lets trusted traders ship now and pay within 30 days of arrival. Your limit grows as you pay on time.'],
  [/pin|password|kata laluan|密码|رمز/i, 'Your payment PIN has 6 digits. After 5 wrong tries payments lock for 5 minutes. Change it in Settings → Security.'],
];
const localAnswer = (q) => (FAQ.find(([r]) => r.test(q)) || [null, 'I can help with orders, escrow, shipping, the warehouse, group buy, credit and payments. For anything else, open a ticket with customer service.'])[1];

async function ask(q) {
  chat.push({ me: true, text: q }); thinking = true; render();
  const s = S();
  let answer = null;
  try {
    const sample = window.claude && window.claude.use ? await window.claude.use('sample') : null;
    if (sample) {
      ctrl = new AbortController();
      const ctxText = `Customer ${s.profile.code}. Wallet ${money(svc.walletSen(s))}. ${s.parcels.filter((p) => p.state === 'stored').length} parcels in warehouse. ${s.orders.length} orders. Reply in ${LANGS[getLang()]}.`;
      const turns = [{ role: 'user', content: `You are the EZICARGO help assistant for small traders buying from Chinese factories (escrow, China warehouse in Guangzhou, air/sea shipping to Malaysia, Singapore, Brunei and the Gulf, group buy, EZI Credit). Payments in this preview are test mode. Be brief (under 90 words), practical and friendly. Never invent prices beyond: sea MY 14–21 days, air 5–7 days, storage free 14 days then RM 1.20/carton/day, photo check RM 5/carton, supplier payment fee 0.5%. If unsure, suggest a customer-service ticket. ${ctxText}` }, { role: 'assistant', content: 'Understood.' },
        ...chat.slice(-8).map((m) => ({ role: m.me ? 'user' : 'assistant', content: m.text }))];
      const r = await sample(turns, { modelTier: 'quick', cache: false, signal: ctrl.signal });
      answer = (r && r.text || '').trim();
    }
  } catch (e) { answer = null; }
  chat.push({ me: false, text: answer || t(localAnswer(q)) });
  thinking = false; render();
}

page('help', {
  title: () => t('Help'),
  view() {
    const s = S(), mine = s.tickets.filter((x) => x.who === s.profile.code);
    return html`<div class="page-h"><h1>${t('Help')}</h1><p>${t('Ask the AI assistant or talk to our customer service team.')}</p></div>
    <div class="seg" role="tablist" style="margin-bottom:10px"><button role="tab" data-a="htab" data-k="ai" aria-pressed="${tab === 'ai'}">${ic('sparkle', 14)} ${t('AI assistant')}</button><button role="tab" data-a="htab" data-k="cs" aria-pressed="${tab === 'cs'}">${ic('chat', 14)} ${t('Customer service')}</button></div>
    ${tab === 'ai' ? html`<section class="card pad stack"><div class="chat" data-chat aria-live="polite">${chat.length ? '' : html`<div class="msg bot">${t('Hi! Ask me about orders, escrow, shipping, the warehouse, group buy or credit.')}</div>`}${chat.map((m) => html`<div class="msg ${m.me ? 'me' : 'bot'}">${m.text}</div>`)}${thinking ? html`<div class="msg bot typing" aria-label="${t('Thinking')}"><i></i><i></i><i></i></div>` : ''}</div>
        <div class="chips">${['How does escrow work?', 'Air or sea for 20 kg?', 'Where is my China address?', 'How do group deals work?'].map((q) => html`<button class="chip" data-a="hq" data-q="${t(q)}">${t(q)}</button>`)}</div>
        <form class="composer" data-form="ask"><input class="inp" name="q" maxlength="400" placeholder="${t('Type your question')}" aria-label="${t('Type your question')}" ${thinking ? 'disabled' : ''}><button class="btn primary" aria-label="${t('Send')}" ${thinking ? 'disabled' : ''}>${ic('send', 16)}</button></form>
        <p class="hint">${t('AI answers can be wrong. For money or orders, our team will confirm.')}</p></section>`
      : html`<section class="card pad stack"><b>${t('Open a ticket')}</b><form class="stack" data-form="ticket"><input class="inp" name="subject" maxlength="80" placeholder="${t('Subject')}" aria-label="${t('Subject')}"><textarea class="inp" name="text" rows="3" maxlength="1000" placeholder="${t('Tell us what happened, with order or parcel numbers')}" aria-label="${t('Message')}"></textarea><button class="btn primary">${t('Send to customer service')}</button></form><p class="hint">${t('We reply within 2 hours, 9 am – 10 pm.')}</p></section>
        <section class="sec"><div class="sec-h"><h2>${t('My tickets')}</h2></div>${mine.length ? html`<div class="card list">${mine.map((x) => html`<div class="li" style="align-items:flex-start"><span class="ic">${ic('chat', 15)}</span><span class="mid"><b>${x.subject}</b><small>${x.id} · ${ago(x.at)}</small>${x.msgs.slice(-2).map((m) => html`<small style="white-space:normal">${m.from === 'support' ? t('Support') : t('You')}: ${m.text}</small>`)}</span><span class="pill ${x.state === 'open' ? 'warn' : 'good'}">${t(x.state === 'open' ? 'Waiting' : 'Answered')}</span></div>`)}</div>` : html`<p class="muted">${t('No tickets yet.')}</p>`}</section>`}`;
  },
  mount(root) { const c = root.querySelector('[data-chat]'); if (c) c.scrollTop = c.scrollHeight; },
});

on('htab', (el) => { tab = el.dataset.k; render(); });
on('hq', (el) => { if (!thinking) ask(el.dataset.q); });
on('form:ask', (f, v) => { const q = String(v.q || '').trim(); if (q && !thinking) ask(q.slice(0, 400)); });
on('form:ticket', (f, v) => { try { const id = svc.addTicket(v.subject, v.text); toast(t('Ticket {id} sent', { id }), 'good'); } catch (e) { toast(t(e.message), 'bad'); } });
