// Sample catalogue. Clearly labelled as sample data in the UI. Prices are CNY fen per piece; tiers = [min qty, fen].
// Names are given in all four languages so product text never falls back to English.

export const DESTS = Object.freeze([
  { id: 'MY', air: 1800, sea: 65000, ad: [5, 7], sd: [14, 21] },   // air sen/kg, sea sen/CBM
  { id: 'EM', air: 2200, sea: 82000, ad: [6, 9], sd: [18, 25] },
  { id: 'SG', air: 2100, sea: 70000, ad: [4, 6], sd: [12, 18] },
  { id: 'BN', air: 2400, sea: 72000, ad: [6, 9], sd: [18, 25] },
  { id: 'SA', air: 2800, sea: 98000, ad: [7, 10], sd: [28, 35] },
  { id: 'AE', air: 2600, sea: 90000, ad: [6, 9], sd: [24, 30] },
]);

export const CATS = Object.freeze(['all', 'home', 'tech', 'fashion', 'beauty', 'bags', 'toys', 'lighting', 'packaging']);

export const FACTORIES = Object.freeze({
  f1: { n: 'Yongkang Steelware', city: 'Yongkang, Zhejiang', lv: 'select', score: 96, yrs: 12, reply: 2, pass: 99.1, onTime: 98, type: 'oem' },
  f2: { n: 'Yiwu Home Goods', city: 'Yiwu, Zhejiang', lv: 'gold', score: 91, yrs: 9, reply: 3, pass: 97.8, onTime: 96, type: 'unbranded' },
  f3: { n: 'Shenzhen Case Works', city: 'Shenzhen, Guangdong', lv: 'gold', score: 90, yrs: 7, reply: 1, pass: 97.2, onTime: 97, type: 'odm' },
  f4: { n: 'Yiwu Silk Road Textiles', city: 'Yiwu, Zhejiang', lv: 'gold', score: 89, yrs: 11, reply: 4, pass: 96.9, onTime: 95, type: 'oem' },
  f5: { n: 'Foshan Bright Lighting', city: 'Foshan, Guangdong', lv: 'silver', score: 85, yrs: 6, reply: 5, pass: 95.4, onTime: 93, type: 'oem' },
  f6: { n: 'Guangzhou Glow Cosmetics', city: 'Guangzhou, Guangdong', lv: 'silver', score: 84, yrs: 5, reply: 3, pass: 95.0, onTime: 94, type: 'private' },
  f7: { n: 'Shenzhen Loop Audio', city: 'Shenzhen, Guangdong', lv: 'gold', score: 88, yrs: 8, reply: 2, pass: 96.1, onTime: 95, type: 'odm' },
  f8: { n: 'Jinjiang Stride Footwear', city: 'Jinjiang, Fujian', lv: 'silver', score: 82, yrs: 10, reply: 6, pass: 94.2, onTime: 92, type: 'own' },
  f9: { n: 'Baigou Carry Bags', city: 'Baigou, Hebei', lv: 'silver', score: 83, yrs: 7, reply: 4, pass: 94.8, onTime: 93, type: 'oem' },
  f10: { n: 'Yangzhou Soft Toys', city: 'Yangzhou, Jiangsu', lv: 'gold', score: 90, yrs: 14, reply: 3, pass: 97.5, onTime: 96, type: 'oem' },
  f11: { n: 'Xiamen Clear Optics', city: 'Xiamen, Fujian', lv: 'silver', score: 81, yrs: 6, reply: 5, pass: 93.9, onTime: 91, type: 'unbranded' },
  f12: { n: 'Dongguan Pack Print', city: 'Dongguan, Guangdong', lv: 'select', score: 95, yrs: 13, reply: 1, pass: 99.0, onTime: 99, type: 'print' },
});

const P = (id, f, c, art, col, t, g, cbm, sold, lead, n) => ({ id, f, c, art, col, t, g, cbm, sold, lead, n });
// g = packed grams per piece, cbm = packed cubic metres per piece (x1e6 as integer), lead = [min, max] days
export const PRODUCTS = Object.freeze([
  P('p1', 'f1', 'home', 'tumbler', ['#D9C7B8', '#9FB7A8', '#1F2227', '#E7A5A5'], [[100, 2600], [500, 2200], [3000, 1900]], 420, 2800, 18240, [12, 15],
    { en: 'Stainless tumbler 900 ml with straw lid', ms: 'Tumbler keluli 900 ml dengan penutup straw', zh: '900毫升不锈钢吸管杯', ar: 'كوب ستانلس 900 مل بغطاء وشفاطة' }),
  P('p2', 'f3', 'tech', 'phonecase', ['#CFE3F2', '#F2D0DA', '#D9D9DE', '#1F2227'], [[200, 480], [1000, 390], [5000, 320]], 50, 250, 64100, [5, 7],
    { en: 'Clear magnetic phone case, 14 models', ms: 'Sarung telefon magnet jernih, 14 model', zh: '透明磁吸手机壳，14款机型', ar: 'غطاء هاتف مغناطيسي شفاف، 14 طرازًا' }),
  P('p3', 'f7', 'tech', 'earbuds', ['#F4F4F6', '#1F2227', '#C9D6E8'], [[100, 4800], [500, 4100], [2000, 3600]], 120, 600, 9320, [10, 12],
    { en: 'ANC wireless earbuds, 30 h battery', ms: 'Fon telinga ANC tanpa wayar, bateri 30 jam', zh: '主动降噪无线耳机，续航30小时', ar: 'سماعات لاسلكية بعزل الضوضاء، 30 ساعة' }),
  P('p4', 'f4', 'fashion', 'scarf', ['#C9A38A', '#8FA9C8', '#D98E9E', '#7FAE9A'], [[100, 750], [600, 620], [3000, 510]], 80, 300, 41800, [3, 5],
    { en: 'Chiffon scarf 180 × 75 cm, 36 colours', ms: 'Selendang sifon 180 × 75 cm, 36 warna', zh: '雪纺围巾 180×75 厘米，36色', ar: 'وشاح شيفون 180×75 سم، 36 لونًا' }),
  P('p5', 'f5', 'lighting', 'lamp', ['#F4F4F6', '#1F2227', '#C9D6E8'], [[50, 3900], [300, 3300], [1000, 2900]], 600, 4000, 7610, [8, 10],
    { en: 'Foldable LED desk lamp, USB-C', ms: 'Lampu meja LED boleh lipat, USB-C', zh: '折叠LED台灯，USB-C', ar: 'مصباح مكتب LED قابل للطي، USB-C' }),
  P('p6', 'f8', 'fashion', 'sneaker', ['#F4F4F6', '#1F2227', '#D9C7B8', '#9FB7A8'], [[60, 5800], [300, 4900], [1200, 4400]], 700, 6000, 5230, [15, 20],
    { en: 'STRIDA knit running sneaker, 36–45', ms: 'Kasut lari rajut STRIDA, 36–45', zh: 'STRIDA针织跑鞋，36–45码', ar: 'حذاء جري STRIDA منسوج، 36–45' }),
  P('p7', 'f6', 'beauty', 'lipstick', ['#B3122A', '#C75A5A', '#8A2D3B', '#E08A8A'], [[300, 520], [2000, 410], [10000, 340]], 30, 120, 88000, [20, 25],
    { en: 'Velvet matte lip tint, your brand', ms: 'Pewarna bibir matte, jenama anda', zh: '丝绒哑光唇釉，可贴牌', ar: 'صبغة شفاه مطفية بعلامتك' }),
  P('p8', 'f9', 'bags', 'backpack', ['#1F2227', '#5C6B7A', '#9C7A5B', '#7A8C6E'], [[50, 4500], [300, 3800], [1000, 3300]], 800, 8000, 6110, [10, 14],
    { en: 'Water-resistant backpack 30 L', ms: 'Beg galas kalis air 30 L', zh: '30升防水背包', ar: 'حقيبة ظهر مقاومة للماء 30 لتر' }),
  P('p9', 'f10', 'toys', 'bear', ['#C69C72', '#EDE3D6', '#E6B8C4', '#8A6A50'], [[100, 1200], [500, 980], [2000, 840]], 250, 4000, 22400, [7, 10],
    { en: 'Soft plush bear 30 cm, EN71 tested', ms: 'Beruang plush 30 cm, diuji EN71', zh: '30厘米毛绒熊，EN71认证', ar: 'دب قطيفة 30 سم، مختبر EN71' }),
  P('p10', 'f1', 'home', 'pan', ['#2A2D33', '#6E5B4E', '#4F6D64'], [[100, 3500], [500, 2900], [2000, 2500]], 1100, 6500, 12900, [12, 15],
    { en: 'Granite non-stick pan 28 cm', ms: 'Kuali granit tidak melekat 28 cm', zh: '28厘米麦饭石不粘锅', ar: 'مقلاة جرانيت غير لاصقة 28 سم' }),
  P('p11', 'f7', 'tech', 'watch', ['#1F2227', '#C9CCD2', '#D9B99B', '#8FA9C8'], [[50, 8900], [300, 7600], [1000, 6800]], 150, 800, 8840, [10, 12],
    { en: 'AMOLED smart watch with calls', ms: 'Jam pintar AMOLED dengan panggilan', zh: 'AMOLED通话智能手表', ar: 'ساعة ذكية AMOLED بالمكالمات' }),
  P('p12', 'f11', 'fashion', 'glasses', ['#1F2227', '#9C7A5B', '#C75A5A', '#5C6B7A'], [[120, 950], [600, 780], [3000, 660]], 60, 400, 30500, [5, 7],
    { en: 'Polarised sunglasses UV400', ms: 'Cermin mata hitam terpolarisasi UV400', zh: 'UV400偏光太阳镜', ar: 'نظارات شمسية مستقطبة UV400' }),
  P('p13', 'f2', 'home', 'boxes', ['#DCE6EA', '#E9DFD3', '#E3E8DA'], [[100, 1600], [500, 1350], [2000, 1180]], 900, 12000, 15700, [6, 8],
    { en: 'Stackable storage box set', ms: 'Set kotak simpanan boleh susun', zh: '可叠放收纳盒套装', ar: 'طقم صناديق تخزين قابلة للتكديس' }),
  P('p14', 'f5', 'lighting', 'strip', ['#1F2227', '#F4F4F6'], [[100, 1100], [500, 920], [3000, 790]], 200, 900, 27300, [5, 7],
    { en: 'RGB LED strip 5 m with app', ms: 'Jalur LED RGB 5 m dengan aplikasi', zh: '5米RGB灯带，带App', ar: 'شريط LED RGB بطول 5 م مع تطبيق' }),
  P('p15', 'f12', 'packaging', 'mailer', ['#C9A06C', '#F4F4F6', '#1F2227'], [[1000, 90], [5000, 72], [20000, 58]], 50, 600, 410000, [7, 9],
    { en: 'Printed kraft mailer box, your logo', ms: 'Kotak pos kraf bercetak, logo anda', zh: '定制Logo牛皮纸快递盒', ar: 'صندوق شحن كرافت بشعارك' }),
  P('p16', 'f4', 'fashion', 'pins', ['#D9B99B', '#C9CCD2', '#E08A8A', '#1F2227'], [[200, 320], [1000, 260], [5000, 210]], 20, 100, 52600, [3, 5],
    { en: 'Magnetic hijab pins, set of 12', ms: 'Pin tudung magnet, set 12', zh: '磁吸头巾别针，12枚装', ar: 'دبابيس حجاب مغناطيسية، 12 قطعة' }),
]);

export const byId = (id) => PRODUCTS.find((p) => p.id === id) || null;
export const factoryOf = (p) => FACTORIES[p.f];
export const destOf = (id) => DESTS.find((d) => d.id === id) || DESTS[0];
