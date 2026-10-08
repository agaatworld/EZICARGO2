// Collects every UI string: t('…') literals, RuleError messages, and strings in label tables passed to t() indirectly.
import fs from 'node:fs'; import path from 'node:path';
const files = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js') && !['dict.js', 'art.js'].includes(path.basename(p))) files.push(p); } })('src');
const out = new Set();
const lit = /(?:\bt|plural)\(\s*'((?:[^'\\]|\\.)*)'/g, err = /RuleError\(\s*'((?:[^'\\]|\\.)*)'/g;
// label tables: quoted strings inside known constant blocks
const tables = [/const SVC = Object\.freeze\(\{([\s\S]*?)\}\);/, /const TABS = \[([\s\S]*?)\];/, /catName\(c\) \{ return \{([\s\S]*?)\}\[c\]/, /stateLabel\(st\) \{ return \{([\s\S]*?)\}\[st\]/, /STEP_TEXT = \{([\s\S]*?)\n\};/, /const FAQ = \[([\s\S]*?)\n\];/, /const REPLIES = \[([\s\S]*?)\];/, /const SECTIONS = \[([\s\S]*?)\];/, /const TYPE = \{([\s\S]*?)\};/, /localAnswer = [\s\S]*?\[null, '([^']*)'/];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(lit)) out.add(m[1].replace(/\\'/g, "'"));
  for (const m of src.matchAll(err)) out.add(m[1]);
  // every quoted phrase inside a t( … ) call, including ternaries and lookup maps
  for (const m of src.matchAll(/(?<![\w.])t\(/g)) {
    let i = m.index + 2, depth = 1, q = null;
    for (; i < src.length && depth; i++) { const c = src[i]; if (q) { if (c === '\\') i++; else if (c === q) q = null; } else if (c === "'" || c === '`') q = c; else if (c === '(') depth++; else if (c === ')') depth--; }
    const span = src.slice(m.index + 2, i - 1);
    for (const q2 of span.matchAll(/'((?:[^'\\]|\\.)*)'/g)) { const v = q2[1]; if (/^[A-Z0-9]/.test(v) && /[a-z]{2}/.test(v) && !/^[A-Z][a-z]+[A-Z]/.test(v)) out.add(v.replace(/\\'/g, "'")); }
  }
  for (const re of tables) { const m = src.match(re); if (m) for (const q of m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) { const v = q[1]; if (/[A-Za-z]{2}/.test(v) && /[ A-Z]/.test(v) && !/^#|^[a-z]+$|^\{|^[A-Z]{2}$|var\(|^M\d|\.js$/.test(v) && !/^[a-z_]+$/.test(v)) out.add(v.replace(/\\'/g, "'")); } }
  // t(x) on inline arrays like [['best','Best selling'],...].map(([k,n]) => ... t(n)
  for (const m of src.matchAll(/\[\[(?:'[^']*',\s*'[^']*'(?:,\s*'[^']*')?\]\s*,?\s*\[?)+\]?\]/g)) for (const q of m[0].matchAll(/'([^']*)'/g)) if (/^[A-Z]/.test(q[1]) && /[a-z]/.test(q[1])) out.add(q[1]);
  for (const m of src.matchAll(/\[('[A-Z][^']*'(?:,\s*'[A-Z][^']*')+)\]\.map/g)) for (const q of m[1].matchAll(/'([^']*)'/g)) out.add(q[1]);
}
const list = [...out].filter((s) => s.trim() && !/^(EZI Select|EZICARGO|MY|RM)$/.test(s)).sort();
fs.writeFileSync('tests/strings.json', JSON.stringify(list, null, 1));
console.log(list.length);
