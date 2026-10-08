// Product reviews stored in the artifact's shared database. No reviews are made up: the list starts empty.
import { html } from '../core/html.js';
import { t, ago } from '../core/i18n.js';
import { ic } from '../ui/icons.js';
import { toast } from '../ui/ui.js';

let dbP = null, userP = null;
function db() { if (!dbP) dbP = (window.claude && window.claude.use) ? window.claude.use('db').catch(() => null) : Promise.resolve(null); return dbP; }
function user() { if (!userP) userP = (window.claude && window.claude.use) ? window.claude.use('user').catch(() => null) : Promise.resolve(null); return userP; }

export function reviewsBlock(pid) {
  return html`<section class="card pad stack" data-reviews="${pid}"><div class="row between"><b>${t('Reviews')}</b><span class="muted small" data-rv-sum>…</span></div><div data-rv-list class="stack"><p class="muted small">${t('Loading reviews…')}</p></div><div data-rv-form></div></section>`;
}

const unsubs = new Map();
export async function mountReviews(root, pid) {
  const box = root.querySelector(`[data-reviews="${pid}"]`); if (!box) return;
  const d = await db();
  if (!document.body.contains(box)) return;
  if (!d) { box.querySelector('[data-rv-list]').innerHTML = String(html`<p class="muted small">${t('Reviews show when this page is opened from its EZICARGO link.')}</p>`); box.querySelector('[data-rv-sum]').textContent = ''; return; }
  const u = await user();
  unsubs.get(pid)?.();
  const col = d.collection('reviews');
  const unsub = col.where('pid', '==', pid).onSnapshot(async (snap) => {
    const list = snap.docs.map((x) => ({ id: x.id, ...x.data() })).filter((r) => r && typeof r.stars === 'number').sort((a, b) => (b.at || 0) - (a.at || 0));
    const ids = [...new Set(list.map((r) => r.by).filter(Boolean))];
    const names = u && ids.length ? await u.profiles(ids).catch(() => ({})) : {};
    const avg = list.length ? list.reduce((a, r) => a + r.stars, 0) / list.length : 0;
    const L = box.querySelector('[data-rv-list]'); if (!L) return;
    box.querySelector('[data-rv-sum]').textContent = list.length ? `${avg.toFixed(1)} ★ · ${t('{n} reviews', { n: list.length })}` : t('No reviews yet');
    L.innerHTML = String(list.length ? html`${list.slice(0, 20).map((r) => html`<div class="li" style="padding:8px 0;align-items:flex-start"><span class="ic">${ic('user', 15)}</span><span class="mid"><b>${r.anon ? t('EZICARGO customer') : (names[r.by]?.name || t('EZICARGO customer'))} · ${'★'.repeat(Math.max(1, Math.min(5, r.stars)))}</b><small style="white-space:normal">${String(r.text || '').slice(0, 600)}</small><small>${ago(r.at || Date.now())}</small></span></div>`)}` : html`<p class="muted small">${t('Be the first to review this product after your order arrives.')}</p>`);
  });
  unsubs.set(pid, unsub);
  const canWrite = u && (await u.can?.('data.write')) !== false;
  if (!canWrite) return;
  const F = box.querySelector('[data-rv-form]');
  F.innerHTML = String(html`<form class="stack" data-rvf><div class="row" role="radiogroup" aria-label="${t('Rating')}">${[1, 2, 3, 4, 5].map((n) => html`<label class="chip"><input type="radio" name="stars" value="${n}" class="sr" ${n === 5 ? 'checked' : ''}>${'★'.repeat(n)}</label>`)}</div><textarea class="inp" name="text" rows="2" maxlength="600" placeholder="${t('How was the quality, packing and delivery?')}"></textarea><label class="check"><input type="checkbox" name="anon"><span>${t('Post as “EZICARGO customer”')}</span></label><button class="btn ghost sm" type="submit">${t('Post review')}</button></form>`);
  F.querySelectorAll('.chip input').forEach((i) => { const sync = () => F.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.querySelector('input').checked)); i.onchange = sync; sync(); });
  F.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const v = new FormData(e.target), text = String(v.get('text') || '').trim();
    if (text.length < 5) { toast(t('Write a few words about the product'), 'bad'); return; }
    try {
      const by = await u.id();
      await col.doc(`${pid}-${by}`).set({ pid, by, stars: +v.get('stars'), text: text.slice(0, 600), anon: !!v.get('anon'), at: Date.now() });
      e.target.reset(); toast(t('Thank you for your review'), 'good');
    } catch { toast(t('Could not post the review. Try again.'), 'bad'); }
  };
}
