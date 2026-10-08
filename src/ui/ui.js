// UI kit: toasts, sheets, confirm dialogs, the step-by-step wizard with PIN and receipt.
// Every action that changes money or goods opens a wizard: review → choose → confirm (→ PIN) → receipt.
import { html, raw } from '../core/html.js';
import { t } from '../core/i18n.js';
import { ic } from './icons.js';

const $ = (s, r = document) => r.querySelector(s);
const stack = [];

export function toast(msg, kind = '') {
  let box = $('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const d = document.createElement('div');
  d.className = 'toast ' + kind;
  d.setAttribute('role', 'status');
  d.textContent = msg;
  box.appendChild(d);
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 300); }, kind === 'bad' ? 4200 : 2600);
}

/** Open a bottom sheet (phone) / centred panel (desktop). Returns {el, close}. */
export function sheet({ title, body, cls = '', onMount, onClose, wide = false, full = false }) {
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  const el = document.createElement('div');
  el.className = `sheet ${wide ? 'wide' : ''} ${full ? 'full' : ''} ${cls}`;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  if (title) el.setAttribute('aria-label', String(title));
  el.innerHTML = String(html`${title ? html`<header class="sh-h"><h2>${title}</h2><button class="icon-btn" data-close aria-label="${t('Close')}">${ic('close', 20)}</button></header>` : ''}<div class="sh-b">${body}</div>`);
  const prev = document.activeElement;
  document.body.append(scrim, el);
  document.documentElement.classList.add('layer-open');
  requestAnimationFrame(() => { scrim.classList.add('on'); el.classList.add('on'); });
  const api = {
    el,
    close(result) {
      if (api.closed) return; api.closed = true;
      const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
      el.classList.remove('on'); scrim.classList.remove('on');
      setTimeout(() => { el.remove(); scrim.remove(); if (!stack.length) document.documentElement.classList.remove('layer-open'); }, 220);
      if (prev && prev.focus) try { prev.focus({ preventScroll: true }); } catch { /* ignore */ }
      onClose && onClose(result);
    },
  };
  scrim.addEventListener('click', () => api.close());
  el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) api.close(); });
  stack.push(api);
  onMount && onMount(el, api);
  const f = el.querySelector('[autofocus], input, select, textarea, button:not([data-close])');
  if (f && window.matchMedia('(hover:hover)').matches) f.focus({ preventScroll: true });
  return api;
}

export function closeAll() { [...stack].reverse().forEach((s) => s.close()); }
export function topLayer() { return stack.at(-1) || null; }

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) { e.preventDefault(); stack.at(-1).close(); } });

/** Yes/no question. Resolves true when confirmed. */
export function confirm({ title, text, ok = t('Confirm'), danger = false }) {
  return new Promise((res) => {
    let answered = false;
    const s = sheet({
      title, cls: 'confirm',
      body: html`<p class="muted">${text}</p><div class="row end gap"><button class="btn ghost" data-no>${t('Cancel')}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${ok}</button></div>`,
      onMount: (el, api) => {
        el.querySelector('[data-no]').onclick = () => { answered = true; api.close(); res(false); };
        el.querySelector('[data-yes]').onclick = () => { answered = true; api.close(); res(true); };
      },
      onClose: () => { if (!answered) res(false); },
    });
    return s;
  });
}

/** A short form in a sheet. fields: [{name,label,type,value,placeholder,options,max}] → resolves values or null. */
export function prompt({ title, text, fields, ok = t('Save') }) {
  return new Promise((res) => {
    let done = false;
    sheet({
      title,
      body: html`${text ? html`<p class="muted">${text}</p>` : ''}<form class="stack" data-pf novalidate>${fields.map((f) => field(f))}<p class="err" role="alert"></p><div class="row end gap"><button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary" type="submit">${ok}</button></div></form>`,
      onMount: (el, api) => {
        el.querySelector('form').onsubmit = (e) => {
          e.preventDefault();
          const v = Object.fromEntries(new FormData(e.target).entries());
          const bad = fields.find((f) => f.required && !String(v[f.name] || '').trim());
          if (bad) { el.querySelector('.err').textContent = t('Please fill in {f}', { f: bad.label }); return; }
          if (fields.some((f) => f.validate)) {
            for (const f of fields) { const m = f.validate && f.validate(v[f.name], v); if (m) { el.querySelector('.err').textContent = m; return; } }
          }
          done = true; api.close(); res(v);
        };
      },
      onClose: () => { if (!done) res(null); },
    });
  });
}

export function field(f) {
  const id = 'f-' + f.name + '-' + Math.random().toString(36).slice(2, 7);
  const lab = html`<label for="${id}">${f.label}</label>`;
  if (f.type === 'select') return html`<div class="field">${lab}<select id="${id}" name="${f.name}">${f.options.map((o) => html`<option value="${o[0]}" ${String(o[0]) === String(f.value) ? raw('selected') : ''}>${o[1]}</option>`)}</select></div>`;
  if (f.type === 'textarea') return html`<div class="field">${lab}<textarea id="${id}" name="${f.name}" rows="3" maxlength="${f.max || 500}" placeholder="${f.placeholder || ''}">${f.value || ''}</textarea></div>`;
  if (f.type === 'check') return html`<label class="check"><input type="checkbox" name="${f.name}" value="1" ${f.value ? raw('checked') : ''}><span>${f.label}</span></label>`;
  return html`<div class="field">${lab}<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${f.value ?? ''}" placeholder="${f.placeholder || ''}" maxlength="${f.max || 80}" ${f.inputmode ? raw(`inputmode="${f.inputmode}"`) : ''} ${f.required ? raw('required') : ''}></div>`;
}

/**
 * Step-by-step flow.
 * steps: [{ title, render(ctx) → html, mount?(el, ctx, go), collect?(el, ctx) → error message | '' }]
 * review(ctx) → rows [[label, value, strong?]] shown on the confirm step.
 * pin: true to ask for the payment PIN before finishing.
 * run(ctx) → { title, text, rows, ref, actions:[{label, href}] } (may throw a RuleError; the message is shown)
 */
export function wizard({ title, steps, ctx = {}, review, pin = false, confirmLabel = t('Confirm'), run, verifyPin, danger = false }) {
  const all = [...steps, { title: t('Confirm'), confirm: true }];
  let i = 0, busy = false;
  const s = sheet({ title, full: true, cls: 'wz', body: html`<ol class="wz-steps" aria-label="${t('Steps')}"></ol><div class="wz-body"></div><p class="err" role="alert"></p><footer class="wz-nav"><button class="btn ghost" data-wz-back>${ic('back', 18)} ${t('Back')}</button><button class="btn primary grow" data-wz-next>${t('Next')}</button></footer>` });
  const el = s.el, body = el.querySelector('.wz-body'), err = el.querySelector('.err');
  const back = el.querySelector('[data-wz-back]'), nextBtn = el.querySelector('[data-wz-next]');

  function paint() {
    el.querySelector('.wz-steps').innerHTML = String(html`${all.map((st, k) => html`<li class="${k < i ? 'done' : k === i ? 'now' : ''}"><i>${k < i ? ic('check', 12) : k + 1}</i><span>${st.title}</span></li>`)}`);
    err.textContent = '';
    const st = all[i];
    if (st.confirm) {
      const rows = review ? review(ctx) : [];
      body.innerHTML = String(html`<h3 class="wz-h">${t('Check and confirm')}</h3><div class="sum">${rows.map((r) => html`<div class="sum-r ${r[2] ? 'strong' : ''}"><span>${r[0]}</span><b>${r[1]}</b></div>`)}</div>
        ${pin ? html`<div class="pin" data-pin><p class="muted">${t('Enter your 6-digit payment PIN')}</p><div class="pin-dots" aria-live="polite">${[0, 1, 2, 3, 4, 5].map(() => html`<i></i>`)}</div><div class="pin-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((k) => k === '' ? html`<span></span>` : html`<button type="button" data-k="${k}" aria-label="${k === '⌫' ? t('Delete') : k}">${k}</button>`)}</div><p class="hint">${t('Test mode PIN: 246810')}</p></div>` : ''}
        <p class="note">${ic('shield', 14)} ${t('Test mode. No real money moves.')}</p>`);
      nextBtn.textContent = confirmLabel;
      nextBtn.classList.toggle('danger', danger);
      if (pin) mountPin();
    } else {
      body.innerHTML = String(st.render(ctx));
      nextBtn.textContent = i === all.length - 2 ? t('Review') : t('Next');
      nextBtn.classList.remove('danger');
      st.mount && st.mount(body, ctx, (to) => { i = to; paint(); });
    }
    back.style.visibility = i === 0 ? 'hidden' : 'visible';
    body.scrollTop = 0;
    const f = body.querySelector('input:not([type=radio]):not([type=checkbox]), select');
    if (f && window.matchMedia('(hover:hover)').matches) f.focus({ preventScroll: true });
  }

  let pinVal = '';
  function mountPin() {
    pinVal = '';
    const dots = [...body.querySelectorAll('.pin-dots i')];
    const draw = () => dots.forEach((d, k) => d.classList.toggle('on', k < pinVal.length));
    body.querySelector('.pin-pad').addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      const k = b.getAttribute('data-k');
      if (k === '⌫') pinVal = pinVal.slice(0, -1); else if (pinVal.length < 6) pinVal += k;
      draw();
    });
    el.addEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (!all[i].confirm || !pin) return;
    if (/^\d$/.test(e.key) && pinVal.length < 6) { pinVal += e.key; e.preventDefault(); }
    else if (e.key === 'Backspace') { pinVal = pinVal.slice(0, -1); e.preventDefault(); }
    else if (e.key === 'Enter') { e.preventDefault(); nextBtn.click(); return; }
    else return;
    body.querySelectorAll('.pin-dots i').forEach((d, k) => d.classList.toggle('on', k < pinVal.length));
  }

  back.onclick = () => { if (i > 0 && !busy) { const st = all[i]; if (!st.confirm && st.collect) try { st.collect(body, ctx); } catch { /* keep going back */ } i--; paint(); } };
  nextBtn.onclick = async () => {
    if (busy) return;
    const st = all[i];
    if (!st.confirm) {
      const m = st.collect ? st.collect(body, ctx) : '';
      if (m) { err.textContent = m; shake(err); return; }
      i++; paint(); return;
    }
    busy = true; nextBtn.disabled = true;
    try {
      if (pin) {
        if (pinVal.length !== 6) { err.textContent = t('Enter all 6 digits'); shake(err); return; }
        const r = await verifyPin(pinVal);
        if (!r.ok) { err.textContent = r.locked ? t('Too many tries. Payments are locked for 5 minutes.') : t('Wrong PIN. {n} tries left.', { n: r.left }); pinVal = ''; body.querySelectorAll('.pin-dots i').forEach((d) => d.classList.remove('on')); shake(body.querySelector('.pin-dots')); return; }
      }
      const out = await run(ctx);
      el.removeEventListener('keydown', onKey);
      receipt(s, out);
    } catch (e) {
      err.textContent = e && e.message ? t(e.message) : t('Something went wrong. Nothing was charged.');
      shake(err);
    } finally { busy = false; nextBtn.disabled = false; }
  };
  paint();
  return s;
}

function receipt(s, out) {
  const el = s.el;
  el.querySelector('.sh-b').innerHTML = String(html`<div class="rc">
    <div class="rc-tick" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div>
    <h2>${out.title}</h2>${out.text ? html`<p class="muted">${out.text}</p>` : ''}
    ${out.rows ? html`<div class="sum">${out.rows.map((r) => html`<div class="sum-r ${r[2] ? 'strong' : ''}"><span>${r[0]}</span><b>${r[1]}</b></div>`)}</div>` : ''}
    ${out.ref ? html`<button class="ref" data-copy="${out.ref}">${ic('copy', 14)} <span>${out.ref}</span></button>` : ''}
    <div class="rc-act">${(out.actions || []).map((a, k) => html`<a class="btn ${k ? 'ghost' : 'primary'}" href="${a.href}" data-close>${a.label}</a>`)}<button class="btn ghost" data-close>${t('Done')}</button></div></div>`);
  el.classList.add('done');
  burst(el.querySelector('.rc-tick'));
}

export function shake(node) { if (!node) return; node.classList.remove('shake'); void node.offsetWidth; node.classList.add('shake'); }

/** Small celebratory sparks (transform/opacity only). */
export function burst(anchor, n = 14) {
  if (!anchor || document.documentElement.classList.contains('calm')) return;
  const r = anchor.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const cols = ['#D40B0B', '#F5A400', '#1E5FA8', '#138A4A', '#16181C'];
  for (let k = 0; k < n; k++) {
    const p = document.createElement('i'); p.className = 'spark';
    const a = (Math.PI * 2 * k) / n, d = 44 + Math.random() * 40;
    p.style.cssText = `left:${cx}px;top:${cy}px;background:${cols[k % cols.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`;
    document.body.appendChild(p); setTimeout(() => p.remove(), 800);
  }
}

document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-copy]'); if (!c) return;
  const v = c.getAttribute('data-copy');
  const ok = () => toast(t('Copied {v}', { v }), 'good');
  try { navigator.clipboard.writeText(v).then(ok, () => toast(v)); } catch { toast(v); }
});
