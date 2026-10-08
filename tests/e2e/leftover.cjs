// Lists visible English phrases left on screen in Chinese mode (brands, names and codes excluded).
const { chromium } = require('playwright');
const routes = ['home','shop','p/p1','cart','orders','order/EZO-3021','ship','wallet','group','group/g1','credit','track','track/EZ7715204418','me','settings','settings/profile','settings/addresses','settings/shipping','settings/payments','settings/security','settings/privacy','settings/notifications','settings/app','settings/business','settings/support','help','control','control/orders','control/warehouse','control/customers','control/factories','control/money','control/support','control/audit','alerts','factories','factories/f1','chat/f1/p1'];
const OK = /^(EZI (Wallet|Credit|Ship|Select)|EZICARGO[\w ]*|BAIYUN WAREHOUSE · GUANGZHOU|FPX[\w ·]*|DuitNow( QR)?|Visa|Mastercard|Alipay|WeChat Pay|[A-Z]{2,}[\w-]*|.*(Steelware|Goods|Works|Textiles|Lighting|Cosmetics|Audio|Footwear|Bags|Toys|Optics|Print|Kitchenware|Textile|Trading|Store|Hub|Jeddah|Dubai|Riang|SnapCase|JB).*|Aisyah.*|.*Jalan.*|.*Residensi.*|Shah Alam|Petaling Jaya|Selangor|.*, (Zhejiang|Guangdong|Fujian|Jiangsu|Hebei)|Guangzhou|Port Klang|Shop|Home|Kuala Lumpur, MY|Shah Alam, MY|This browser|Maybank2u.*|Visa ·.*|Top-up · .*|Order EZO.*|Shipping · .*|Supplier payment · .*|Membership · lifetime|Released to factory.*|Refund · .*|Group deal deposit.*|Storage · .*|Inspection · .*|Return to seller · .*|Paid with EZI Credit.*|Credit repaid|Mixed|.*@example.com|Raya stock · sea|Desk lamps for Raya|Tumblers · Taobao|Phone cases · 1688|Scarves · Yiwu market|Test|.*(Paid order|Started production|Received and measured|Order moved|Customer |Factory application|Booked|Declared|Extended|Ordered|Shipment |Joined|Changed|Wallet top-up|Supplier payment|Return to seller).*|customer|support|factory|control|Control|Warehouse GZ.*|Logistics|system)$/;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 820 } });
  await p.addInitScript(() => sessionStorage.setItem('ezc-intro', '1'));
  await p.goto(process.argv[2]); await p.waitForTimeout(500);
  await p.evaluate((lg) => { const s = JSON.parse(localStorage.getItem('ezc-v2')); s.prefs.lang = lg; localStorage.setItem('ezc-v2', JSON.stringify(s)); }, process.argv[3] || 'zh');
  await p.reload(); await p.waitForTimeout(500);
  const found = {};
  for (const r of routes) {
    await p.evaluate((x) => { location.hash = x; }, r); await p.waitForTimeout(200);
    const xs = await p.evaluate(() => { const o = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const v = n.nodeValue.trim(); if (!v || !n.parentElement.offsetParent && getComputedStyle(n.parentElement).position !== 'fixed') continue; if (n.parentElement.closest('script,style,svg,.num,.code,pre')) continue; if (/[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(v) || /^[A-Z][a-z]{3,}$/.test(v)) o.push(v); } return o; });
    xs.forEach((v) => { if (!OK.test(v)) (found[v] = found[v] || []).push(r); });
  }
  Object.entries(found).forEach(([k, v]) => console.log(JSON.stringify(k), v.slice(0, 3).join(',')));
  console.log('LEFT', Object.keys(found).length);
  await b.close();
})();
