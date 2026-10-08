// Translations. Source text is English; every string shown to people goes through t().
// A unit test checks that every t('…') used in the code has Malay, Chinese and Arabic text.
import { DICT } from './dict.js';

export const LANGS = Object.freeze({ en: 'English', ms: 'Bahasa Melayu', zh: '中文', ar: 'العربية' });
export const SHORT = Object.freeze({ en: 'EN', ms: 'BM', zh: '中', ar: 'ع' });
const IDX = { ms: 0, zh: 1, ar: 2 };
let lang = 'en';

export function setLang(l) {
  lang = LANGS[l] ? l : 'en';
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }
  return lang;
}
export function getLang() { return lang; }

/** Translate an English source string. {name} placeholders are filled from vars. */
export function t(src, vars) {
  let s = src;
  if (lang !== 'en') { const row = DICT[src]; if (row && row[IDX[lang]]) s = row[IDX[lang]]; }
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  return s;
}

/** Product names and other multi-language data objects {en, ms, zh, ar}. */
export function tl(obj) { return (obj && (obj[lang] || obj.en)) || ''; }

export function plural(n, one, many, vars = {}) { return t(n === 1 ? one : many, { n, ...vars }); }

export function ago(ts, now = Date.now()) {
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 60) return t('just now');
  if (s < 3600) return t('{n} min ago', { n: Math.floor(s / 60) });
  if (s < 86400) return t('{n} h ago', { n: Math.floor(s / 3600) });
  return t('{n} d ago', { n: Math.floor(s / 86400) });
}

export function dateStr(ts) {
  const loc = { en: 'en-GB', ms: 'ms-MY', zh: 'zh-CN', ar: 'ar-SA-u-nu-latn' }[lang];
  try { return new Date(ts).toLocaleDateString(loc, { day: 'numeric', month: 'short' }); } catch { return new Date(ts).toISOString().slice(0, 10); }
}
