// Safe HTML templating. Every interpolated value is escaped unless it was produced by html`` or raw().
// This is the app's main defence against injected markup (XSS): pages never concatenate strings into innerHTML.

class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
export function esc(v) { return String(v ?? '').replace(/[&<>"'`]/g, (c) => ESC[c]); }

function part(v) {
  if (v == null || v === false) return '';
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(v);
}

export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
  return new Safe(out);
}

/** Only for markup the app itself generated (icons, SVG art). Never for user or network text. */
export function raw(s) { return new Safe(String(s)); }

export function isSafe(v) { return v instanceof Safe; }

/** Attribute value helper for URLs: only allows in-app hash links and https. */
export function safeHref(u) {
  const s = String(u || '');
  return /^(#[\w\-/.]*|https:\/\/[^\s"'<>]+)$/.test(s) ? s : '#';
}

/** Image source: only data:image or our own relative asset paths. */
export function safeImg(u) {
  const s = String(u || '');
  return /^(data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+|assets\/[\w\-.]+)$/.test(s) ? s : '';
}
