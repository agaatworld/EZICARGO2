import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { DICT } from '../../src/core/dict.js';
import { t, setLang } from '../../src/core/i18n.js';

test('every UI string has Malay, Chinese and Arabic with the same placeholders', () => {
  execSync('node tests/extract.mjs');
  const keys = JSON.parse(fs.readFileSync('tests/strings.json', 'utf8'));
  const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
  const missing = keys.filter((k) => !DICT[k] || DICT[k].some((v) => !v));
  assert.deepEqual(missing, [], 'missing translations');
  for (const k of keys) for (const v of DICT[k]) assert.equal(ph(v), ph(k), `placeholders differ for "${k}" → "${v}"`);
});

test('t() switches language and fills placeholders', () => {
  setLang('ms'); assert.notEqual(t('Top up'), 'Top up');
  setLang('zh'); assert.match(t('MOQ {n}', { n: 100 }), /100/);
  setLang('ar'); assert.match(t('{n} min ago', { n: 5 }), /5/);
  setLang('en'); assert.equal(t('Top up'), 'Top up');
});
