// Smoothness: frames per second while scrolling, with the CPU slowed 6× to act like a budget phone.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const r of ['home', 'shop', 'ship', 'p/p1']) {
    const p = await b.newPage({ viewport: { width: 390, height: 820 }, isMobile: true, hasTouch: true });
    await p.addInitScript(() => sessionStorage.setItem('ezc-intro', '1'));
    await p.goto(process.argv[2] + '#' + r); await p.waitForTimeout(800);
    const c = await p.context().newCDPSession(p); await c.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    const t0 = Date.now();
    const x = await p.evaluate(() => new Promise((res) => { let f = 0, worst = 0, last = performance.now(), y = 0; const st = performance.now(); function tick(t) { f++; worst = Math.max(worst, t - last); last = t; y += 14; scrollTo(0, y); if (t - st < 3000) requestAnimationFrame(tick); else res({ fps: Math.round(f / 3), worst: Math.round(worst) }); } requestAnimationFrame(tick); }));
    const nav = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return Math.round(n.domContentLoadedEventEnd); });
    console.log(r.padEnd(6), JSON.stringify(x), 'DOM ready (unthrottled load) ms', nav);
    await p.close();
  }
  await b.close();
})();
