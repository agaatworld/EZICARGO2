// Visual scan: every page × theme × language × width. Reports page errors, horizontal overflow,
// low text contrast, unlabelled buttons, and English text left untranslated. Usage: node scan.cjs <baseUrl>
const { chromium } = require('playwright');
const BASE = process.argv[2];
const routes = ['home', 'shop', 'shop/beauty', 'p/p1', 'p/p15', 'cart', 'orders', 'order/EZO-3021', 'ship', 'wallet', 'group', 'group/g1', 'credit', 'track', 'track/EZ7715204418', 'track/EZ-P-20877', 'me', 'settings', 'settings/profile', 'settings/addresses', 'settings/shipping', 'settings/payments', 'settings/security', 'settings/privacy', 'settings/notifications', 'settings/app', 'settings/business', 'settings/support', 'help', 'control', 'control/orders', 'control/warehouse', 'control/customers', 'control/factories', 'control/money', 'control/support', 'control/audit', 'alerts', 'factories', 'factories/f7', 'chat/f1/p1'];
const combos = [[360, 'light', 'en'], [412, 'mist', 'ms'], [390, 'dark', 'zh'], [375, 'light', 'ar'], [1366, 'light', 'en'], [1366, 'dark', 'ar']];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const dict = await (async () => { const p = await b.newPage(); await p.goto(BASE); await p.waitForTimeout(500); const d = await p.evaluate(async () => (await import('./src/core/dict.js')).DICT); await p.close(); return d; })();
  const EN = Object.keys(dict).filter((k) => /[a-z]{3}/.test(k) && k.split(' ').length >= 2 && !/^(EZI (Wallet|Credit|Ship|Select)|Port Klang|WeChat Pay|DuitNow QR)$/.test(k));
  let total = 0;
  for (const [W, theme, lang] of combos) {
    const p = await b.newPage({ viewport: { width: W, height: 820 }, isMobile: W < 500, hasTouch: W < 500 });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(([th, lg]) => { sessionStorage.setItem('ezc-intro', '1'); const k = 'ezc-v2'; const raw = localStorage.getItem(k); if (raw) { const s = JSON.parse(raw); s.prefs.theme = th; s.prefs.lang = lg; localStorage.setItem(k, JSON.stringify(s)); } window.__th = th; window.__lg = lg; }, [theme, lang]);
    await p.goto(BASE); await p.waitForTimeout(600);
    await p.evaluate(([th, lg]) => { const s = JSON.parse(localStorage.getItem('ezc-v2')); s.prefs.theme = th; s.prefs.lang = lg; localStorage.setItem('ezc-v2', JSON.stringify(s)); }, [theme, lang]);
    await p.reload(); await p.waitForTimeout(600);
    const issues = [];
    for (const r of routes) {
      await p.evaluate((x) => { location.hash = x; }, r); await p.waitForTimeout(230);
      const x = await p.evaluate(({ lang, EN }) => {
        const out = [], W = innerWidth;
        if (document.documentElement.scrollWidth > W + 1) {
          const wide = [...document.querySelectorAll('body *')].filter((e) => { const rr = e.getBoundingClientRect(); if (rr.right <= W + 1 || !rr.width) return false; let a = e.parentElement; while (a && a !== document.body) { const cs = getComputedStyle(a); if (/auto|scroll|hidden|clip/.test(cs.overflowX)) return false; a = a.parentElement; } return true; }).slice(0, 3).map((e) => e.className || e.tagName);
          out.push('overflow ' + document.documentElement.scrollWidth + ' ' + wide.join(','));
        }
        const lum = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return { L: 0.2126 * f(+m[0]) + 0.7152 * f(+m[1]) + 0.0722 * f(+m[2]), a: m.length > 3 ? +m[3] : 1 }; };
        const bgOf = (el) => { while (el && el !== document.documentElement) { const cs = getComputedStyle(el); if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; const l = lum(cs.backgroundColor); if (l && l.a > 0.85) return l; el = el.parentElement; } return lum(getComputedStyle(document.body).backgroundColor); };
        const low = [];
        document.querySelectorAll('#app *, #hd *, #tabs *').forEach((e) => {
          const own = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue.trim()).join('');
          if (!own) return; const r = e.getBoundingClientRect(); if (!r.width || r.top > innerHeight * 4) return;
          const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity < 0.4) return;
          const fg = lum(cs.color), bg = bgOf(e); if (!fg || !bg) return;
          const c = (Math.max(fg.L, bg.L) + 0.05) / (Math.min(fg.L, bg.L) + 0.05);
          if (c < 3) low.push(own.slice(0, 24) + ' ' + c.toFixed(1));
        });
        if (low.length) out.push('contrast: ' + [...new Set(low)].slice(0, 4).join(' | '));
        const nob = [...document.querySelectorAll('#app button, #app a, #hd button, #hd a')].filter((e) => e.offsetParent && !e.textContent.trim() && !e.getAttribute('aria-label') && !e.title);
        if (nob.length) out.push('unlabelled ' + nob.length + ' ' + (nob[0].className || nob[0].tagName));
        if (lang !== 'en') {
          const txt = document.querySelector('#app').innerText + '\n' + document.querySelector('#tabs').innerText;
          const left = EN.filter((k) => !/\{/.test(k) && txt.includes(k)).slice(0, 5);
          if (left.length) out.push('english: ' + left.join(' | '));
        }
        return out;
      }, { lang, EN });
      if (x.length) issues.push(r + ' → ' + x.join(' ; '));
    }
    total += issues.length + errs.length;
    console.log(`\n== ${W}px ${theme} ${lang}: ${issues.length} pages with issues, ${errs.length} errors ${errs.slice(0, 3).join(' | ')}`);
    issues.slice(0, 40).forEach((i) => console.log('  ' + i));
    await p.close();
  }
  console.log('\nTOTAL ISSUES', total);
  await b.close();
})();
