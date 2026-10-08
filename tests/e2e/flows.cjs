// End-to-end tests of every main flow in a real browser. Usage: node flows.cjs <baseUrl> [width]
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/index.html';
const W = +(process.argv[3] || 390);
let pass = 0, fail = 0;
const results = [];
async function step(name, fn) {
  try { await fn(); pass++; results.push('ok   ' + name); }
  catch (e) { fail++; results.push('FAIL ' + name + ' :: ' + String(e.message).split('\n')[0]); }
}
function expect(c, msg) { if (!c) throw new Error(msg || 'expectation failed'); }

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: W, height: 840 }, isMobile: W < 500, hasTouch: W < 500 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => { errs.push('dialog ' + d.message()); d.dismiss(); });
  await p.addInitScript(() => { sessionStorage.setItem('ezc-intro', '1'); });
  await p.goto(BASE); await p.waitForTimeout(700);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);

  const go = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(250); };
  const click = async (sel) => { await p.click(sel); await p.waitForTimeout(220); };
  const text = (sel) => p.$eval(sel, (e) => e.textContent.trim()).catch(() => '');
  const state = () => p.evaluate(() => JSON.parse(localStorage.getItem('ezc-v2')));
  const wallet = async () => (await state()).ledger.reduce((a, tx) => a + tx.lines.filter((l) => l.a === 'cust:wallet').reduce((x, l) => x + l.v, 0), 0);
  const balanced = async () => (await state()).ledger.reduce((a, tx) => a + tx.lines.reduce((x, l) => x + l.v, 0), 0) === 0;
  async function wizardToEnd(pin = '246810') {
    for (let i = 0; i < 10; i++) {
      if (await p.$('.wz.done')) return;
      const err = await text('.wz .err');
      if (err) throw new Error('wizard error: ' + err);
      const confirmStep = (await text('.wz .wz-h')) === 'Check and confirm';
      if (confirmStep) {
        if (await p.$('.wz .pin')) for (const d of pin) await p.click(`.pin-pad [data-k="${d}"]`);
        await click('[data-wz-next]');
        await p.waitForTimeout(400);
        const e2 = await text('.wz .err');
        if (e2 && !(await p.$('.wz.done'))) throw new Error('confirm error: ' + e2);
        return;
      }
      await click('[data-wz-next]');
    }
    throw new Error('wizard did not reach the confirm step');
  }
  const receipt = async () => { await p.waitForSelector('.wz.done .rc h2', { timeout: 3000 }); return text('.wz.done .rc h2'); };
  const closeLayer = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(300); };

  await step('home renders with balance, services and products', async () => {
    await go('home');
    expect(await p.$('.tcard [data-bal]'), 'balance');
    expect((await p.$$('.svc-card .orb')).length === 8, '8 services in reach');
    expect(await p.$('#tabs a.tab-svc[href="#ship"]'), 'warehouse in the bottom bar');
    expect((await p.$$('.pgrid .pc')).length >= 6, 'products');
  });

  await step('wrong PIN is refused and counts down tries', async () => {
    await go('cart'); await click('[data-a="checkout"]');
    for (let i = 0; i < 5; i++) { if (await p.$('.wz .pin')) break; await click('[data-wz-next]'); }
    for (const d of '111112') await p.click(`.pin-pad [data-k="${d}"]`);
    await click('[data-wz-next]');
    const e = await text('.wz .err');
    expect(/4/.test(e), 'tries left message: ' + e);
    await closeLayer();
  });

  await step('checkout: cart → escrow with PIN, cart empties, ledger balances', async () => {
    const w0 = await wallet(), n0 = (await state()).orders.length;
    await go('cart'); await click('[data-a="checkout"]');
    await wizardToEnd();
    const h = await receipt();
    expect(/Payment successful/.test(h), 'receipt: ' + h);
    const s = await state();
    expect(s.cart.length === 0, 'cart empty');
    expect(s.orders.length === n0 + 2, 'two orders');
    expect((await wallet()) < w0, 'wallet charged');
    expect(await balanced(), 'ledger balanced');
    await closeLayer();
  });

  await step('product: quantity changes the tier, add to cart and buy now with FPX', async () => {
    await go('p/p3');
    await p.fill('[data-qty]', '600'); await p.waitForTimeout(150);
    expect(/on/.test(await p.$eval('[data-tiers] div:nth-child(2)', (e) => e.className)), 'second tier active');
    await click('[data-a="padd"]');
    expect((await state()).cart.some((c) => c.pid === 'p3' && c.qty === 600), 'in cart');
    await click('[data-a="pbuy"]');
    for (let i = 0; i < 4; i++) { if (await p.$('.wz [name=pay]')) break; await click('[data-wz-next]'); }
    await p.check('.wz input[name=pay][value=fpx]');
    await wizardToEnd();
    expect(/Payment successful/.test(await receipt()), 'paid');
    await closeLayer();
  });

  await step('warehouse: select two parcels and ship them', async () => {
    await go('ship');
    const cells = await p.$$('.pcell[data-id]');
    expect(cells.length >= 2, 'two parcels');
    await cells[0].click(); await p.waitForTimeout(150);
    await (await p.$$('.pcell[data-id]'))[1].click(); await p.waitForTimeout(150);
    expect(/2/.test(await text('.selbar b')), 'selected 2');
    await click('.selbar [data-a="bship"]');
    await wizardToEnd();
    expect(/Shipment booked/.test(await receipt()), 'booked');
    const s = await state();
    expect(/^EZ\d{10}$/.test(s.shipments[0].tracking), 'tracking number');
    await closeLayer();
    await go('track/' + s.shipments[0].tracking);
    expect(/EZ\d{10}/.test(await text('#app .card.pad .num')), 'tracking detail');
  });

  await step('declare a parcel, receive it in control, then inspect, photos, rename, keep and return', async () => {
    await go('ship'); await click('[data-a="declare"]');
    await p.fill('.wz [name=contents]', 'Bags'); await click('[data-wz-next]');
    await p.fill('.wz [name=courier]', 'SF123456'); await p.fill('.wz [name=ctn]', '2'); await click('[data-wz-next]');
    await click('[data-wz-next]'); await click('[data-wz-next]');
    expect(/Parcel declared/.test(await receipt()), 'declared');
    await closeLayer();
    const id = (await state()).parcels[0].id;
    await go('control/warehouse');
    await click(`[data-a="crecv"][data-id="${id}"]`);
    await click('.sheet form button[type=submit]');
    expect((await state()).parcels.find((x) => x.id === id).state === 'stored', 'stored');
    await go('ship');
    await click(`[data-a="pinsp"][data-id="${id}"]`); await wizardToEnd();
    expect(/Inspection ordered/.test(await receipt()), 'inspected'); await closeLayer();
    await go('ship'); await click(`[data-a="pphotos"][data-id="${id}"]`);
    expect((await p.$$('.sheet figure')).length > 0, 'photos'); await closeLayer();
    await click(`[data-a="pedit"][data-id="${id}"]`);
    await p.fill('.sheet input[name=n]', 'Raya bags'); await click('.sheet form button[type=submit]');
    expect((await state()).parcels.find((x) => x.id === id).name === 'Raya bags', 'renamed');
    await go('ship'); await click(`.pcell[data-id="${id}"]`); await click('.selbar [data-a="bkeep"]'); await wizardToEnd();
    expect(/Storage extended/.test(await receipt()), 'kept'); await closeLayer();
    await go('ship'); await click(`.pcell[data-id="${id}"]`); await click('.selbar [data-a="bret"]'); await wizardToEnd();
    expect(/Return booked/.test(await receipt()), 'returned'); await closeLayer();
    expect(await balanced(), 'balanced');
  });

  await step('top up from home raises the wallet by the amount', async () => {
    const w0 = await wallet();
    await go('home'); await click('[data-a="topup"]');
    await p.fill('.wz [name=amt]', '250'); await click('[data-wz-next]'); await click('[data-wz-next]'); await click('[data-wz-next]');
    expect(/Top-up received/.test(await receipt()), 'received');
    expect((await wallet()) - w0 === 25000, 'plus RM250'); await closeLayer();
  });

  await step('pay a new supplier in yuan held in escrow', async () => {
    await go('wallet'); await click('.tcard [data-a="paysup"]');
    await p.check('.wz input[name=sup][value=new]'); await p.fill('.wz [name=nn]', '广州新供应商'); await click('[data-wz-next]');
    await p.fill('.wz [name=amt]', '300'); await p.fill('.wz [name=inv]', 'INV-2026-01');
    await wizardToEnd();
    expect(/Payment sent/.test(await receipt()), 'sent'); await closeLayer();
  });

  await step('join a group deal and start a new one', async () => {
    await go('group/g2'); await click('[data-a="gjoin"]');
    await p.fill('.wz [name=pcs]', '500'); await wizardToEnd();
    expect(/joined/.test(await receipt()), 'joined'); await closeLayer();
    await go('group'); await click('[data-a="gnew"]');
    await click('[data-wz-next]');
    await p.fill('.wz [name=goal]', '3000'); await p.fill('.wz [name=pcs]', '200'); await wizardToEnd();
    expect(/live/.test(await receipt()), 'created'); await closeLayer();
  });

  await step('credit: pay with EZI Credit, then repay', async () => {
    await go('p/p9'); await click('[data-a="pbuy"]');
    for (let i = 0; i < 4; i++) { if (await p.$('.wz [name=pay]')) break; await click('[data-wz-next]'); }
    await p.check('.wz input[name=pay][value=credit]'); await wizardToEnd();
    expect(/Payment successful/.test(await receipt()), 'paid on credit'); await closeLayer();
    await go('credit'); await click('[data-a="repay"]'); await wizardToEnd();
    expect(/repaid/.test(await receipt()), 'repaid'); await closeLayer();
  });

  await step('control centre: release escrow and refund with a reason', async () => {
    const s0 = await state(), o = s0.orders.find((x) => x.state === 'paid');
    await go('control/orders');
    for (let i = 0; i < 5; i++) { await click(`[data-a="cadv"][data-id="${o.id}"]`); await click('.sheet [data-yes]'); }
    expect((await state()).orders.find((x) => x.id === o.id).state === 'released', 'released');
    const o2 = (await state()).orders.find((x) => x.state === 'paid');
    await click(`[data-a="crefund"][data-id="${o2.id}"]`); await click('.sheet form button[type=submit]');
    expect((await state()).orders.find((x) => x.id === o2.id).state === 'refunded', 'refunded');
    await go('control/money');
    expect(/balanced/i.test(await text('.health')), 'health ok');
  });

  await step('control centre: customers search, freeze, factory approve, ticket reply', async () => {
    await go('control/customers'); await p.fill('[data-cq]', 'SG'); await p.waitForTimeout(200);
    expect((await p.$$('.tbl tbody tr')).length === 1, 'filtered to 1');
    await click('[data-a="cstate"]'); await click('.sheet [data-yes]');
    await go('control/factories'); await click('[data-a="capp"][data-ok="1"]'); await click('.sheet [data-yes]');
    expect((await state()).applications[0].state === 'approved', 'approved');
    await go('control/support'); await click('[data-a="creply"]'); await p.fill('.sheet textarea', 'Yes, you can.'); await click('.sheet form button[type=submit]');
    expect((await state()).tickets[0].state === 'answered', 'answered');
  });

  await step('settings: language switches everything, Arabic is right to left, theme changes', async () => {
    await go('settings/app');
    await p.selectOption('[data-set="lang"]', 'ms'); await p.waitForTimeout(300);
    expect(/Utama/.test(await text('#tabs')), 'Malay tabs: ' + await text('#tabs'));
    await p.selectOption('[data-set="lang"]', 'ar'); await p.waitForTimeout(300);
    expect(await p.evaluate(() => document.documentElement.dir) === 'rtl', 'rtl');
    expect(/ع/.test(await text('.lang-code')), 'badge');
    await p.selectOption('[data-set="lang"]', 'en'); await p.waitForTimeout(300);
    expect(await p.evaluate(() => document.documentElement.dir) === 'ltr' && /EN/.test(await text('.lang-code')), 'back to English');
    await p.selectOption('[data-set="theme"]', 'mist'); await p.waitForTimeout(200);
    expect(await p.evaluate(() => document.documentElement.dataset.theme) === 'mist', 'mist');
    await p.selectOption('[data-set="theme"]', 'light');
  });

  await step('profile: invalid email is refused and not saved', async () => {
    await go('settings/profile');
    await p.fill('[data-prof="email"]', 'not-an-email'); await p.dispatchEvent('[data-prof="email"]', 'change'); await p.waitForTimeout(300);
    expect((await state()).profile.email === 'aisyah@example.com', 'unchanged');
  });

  await step('addresses: add, make default, delete', async () => {
    await go('settings/addresses'); await click('[data-a="aadd"]');
    await p.fill('.sheet [name=line]', 'Lot 5, Jalan Ampang'); await p.fill('.sheet [name=city]', 'Kuala Lumpur'); await p.fill('.sheet [name=postcode]', '50450');
    await click('.sheet form button[type=submit]');
    const a = (await state()).addresses.at(-1);
    await go('settings/addresses'); await click(`[data-a="adef"][data-id="${a.id}"]`);
    expect((await state()).addresses.find((x) => x.id === a.id).isDefault, 'default');
    await click(`[data-a="adel"][data-id="${a.id}"]`); await click('.sheet [data-yes]');
    const s = await state();
    expect(!s.addresses.some((x) => x.id === a.id) && s.addresses.some((x) => x.isDefault), 'deleted, another default');
  });

  await step('security: change PIN, then the new PIN pays and the old one fails', async () => {
    await go('settings/security'); await click('[data-a="pin"]');
    await p.fill('.wz [name=o]', '246810'); await click('[data-wz-next]');
    await p.fill('.wz [name=n1]', '135790'); await p.fill('.wz [name=n2]', '135790'); await click('[data-wz-next]'); await click('[data-wz-next]');
    await p.waitForTimeout(400);
    expect(/PIN changed/.test(await receipt()), 'changed'); await closeLayer();
    await go('home'); await click('[data-a="topup"]'); await click('[data-wz-next]'); await click('[data-wz-next]'); await click('[data-wz-next]');
    await closeLayer();
    await go('p/p2'); await click('[data-a="pbuy"]');
    for (let i = 0; i < 4; i++) { if (await p.$('.wz .pin')) break; await click('[data-wz-next]'); }
    for (const d of '246810') await p.click(`.pin-pad [data-k="${d}"]`); await click('[data-wz-next]');
    expect(/Wrong PIN/.test(await text('.wz .err')), 'old PIN refused');
    for (const d of '135790') await p.click(`.pin-pad [data-k="${d}"]`); await click('[data-wz-next]'); await p.waitForTimeout(400);
    expect(/Payment successful/.test(await receipt()), 'new PIN works'); await closeLayer();
  });

  await step('security: injected markup in a name is shown as text, never run', async () => {
    const id = (await state()).orders[0].id;
    await go('order/' + id); await click('[data-a="orename"]');
    await p.fill('.sheet input[name=n]', '<img src=x onerror="window.__pwn=1">'); await click('.sheet form button[type=submit]');
    await go('orders'); await p.waitForTimeout(300);
    expect(!(await p.evaluate(() => window.__pwn)), 'script did not run');
    expect(!(await p.$('#app img[src="x"]')), 'no injected image');
    expect(/onerror/.test(await p.evaluate(() => document.querySelector('#app').textContent)), 'shown as text');
  });

  await step('help: AI assistant answers offline and a ticket can be sent', async () => {
    await go('help'); await click('[data-a="hq"]'); await p.waitForTimeout(1500);
    expect((await p.$$('.msg.bot')).length >= 2 || (await p.$$('.msg.bot')).length >= 1, 'answer');
    await click('[data-a="htab"][data-k="cs"]');
    await p.fill('[data-form="ticket"] [name=subject]', 'Test'); await p.fill('[data-form="ticket"] textarea', 'Where is my parcel EZ-P-20877?');
    await click('[data-form="ticket"] button');
    expect((await state()).tickets[0].subject === 'Test', 'ticket saved');
  });

  await step('factory chat gets a reply', async () => {
    await go('chat/f1/p1'); await click('[data-a="fq"]'); await p.waitForTimeout(1600);
    expect((await p.$$('.chat .msg.bot')).length >= 1 && (await p.$$('.chat .msg.me')).length >= 1, 'conversation');
  });

  await step('search finds products and shows an empty state for nonsense', async () => {
    await p.fill('.search input', 'lamp'); await p.press('.search input', 'Enter'); await p.waitForTimeout(300);
    expect((await p.$$('.pgrid .pc')).length >= 1, 'found lamp');
    await p.fill('.search input', 'zzzzqqq'); await p.press('.search input', 'Enter'); await p.waitForTimeout(300);
    expect(await p.$('.empty'), 'empty state');
  });

  await step('ledger still balances after everything and no page errors', async () => {
    expect(await balanced(), 'balanced');
    expect(errs.length === 0, 'errors: ' + errs.join(' | '));
  });

  console.log(results.join('\n'));
  console.log(`\n${W}px: ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
