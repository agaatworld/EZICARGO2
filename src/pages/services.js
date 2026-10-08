import { html } from '../core/html.js';
import { t } from '../core/i18n.js';
import { sheet } from '../ui/ui.js';
import { orb } from '../ui/parts.js';

export function openServices() {
  const s = sheet({
    title: t('Services'),
    body: html`<div class="orbs" style="padding:4px 0 10px">${['ship', 'shop', 'pay', 'group', 'escrow', 'credit', 'track', 'help', 'factories', 'inspect', 'rates', 'newgroup'].map((k, i) => orb(k, i))}</div>`,
  });
  s.el.addEventListener('click', (e) => { if (e.target.closest('a.orb')) s.close(); });
}
