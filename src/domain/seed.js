// Starting sample data. Everything here is labelled "sample" in the interface. Payments are in test mode.
import { txn, ACC } from '../core/ledger.js';
import { makeCode } from './rules.js';
import { cnyToMyr } from '../core/money.js';

const H = 3600e3, D = 24 * H;
export const DEMO_PIN = '246810';
const DEMO_SALT = 'ezc-demo-7f3a';
const DEMO_HASH = 'df2de182937d2ef46e79c72c3c00a1d2f514dba2ef0f06fc615545a2fc3fc5e8';

export function seed(now = Date.now()) {
  let n = 0;
  const id = () => 'T-' + String(++n).padStart(6, '0');
  const goods = cnyToMyr(3300 * 300), insp = Math.round(goods * 0.015), ship = 128400;
  const ledger = [
    txn({ id: id(), at: now - 40 * D, memo: 'Top-up · FPX Maybank2u', kind: 'topup', lines: [{ a: ACC.WALLET, v: 1500000 }, { a: ACC.CLEARING, v: -1500000 }] }),
    txn({ id: id(), at: now - 40 * D + 60e3, memo: 'Membership · lifetime', kind: 'fee', lines: [{ a: ACC.WALLET, v: -15000 }, { a: ACC.MEMBERSHIP, v: 15000 }] }),
    txn({ id: id(), at: now - 12 * D, memo: 'Supplier payment · Alipay · 义乌丝路纺织', kind: 'supplier', ref: 'PAY-0912-4471', lines: [{ a: ACC.WALLET, v: -502520 }, { a: ACC.SUPPLIER, v: 500000 }, { a: ACC.FEES, v: 2520 }] }),
    txn({ id: id(), at: now - 9 * D, memo: 'Shipping · EZ-S-7715 · sea to Port Klang', kind: 'fee', ref: 'EZ-S-7715', lines: [{ a: ACC.WALLET, v: -124060 }, { a: ACC.SHIPPING, v: 124060 }] }),
    txn({ id: id(), at: now - 6 * D, memo: 'Top-up · DuitNow QR', kind: 'topup', lines: [{ a: ACC.WALLET, v: 1000000 }, { a: ACC.CLEARING, v: -1000000 }] }),
    txn({ id: id(), at: now - 2 * D, memo: 'Order EZO-3021 · into escrow', kind: 'hold', ref: 'EZO-3021', lines: [{ a: ACC.WALLET, v: -(goods + insp + ship) }, { a: ACC.ESCROW, v: goods + insp }, { a: ACC.SHIPPING, v: ship }] }),
  ];
  const code = makeCode('MY', 10482);
  return {
    v: 2,
    seq: { txn: n, order: 3021, parcel: 20910, shipment: 7715, pay: 4471, ticket: 5120, group: 5, addr: 2, notice: 3 },
    profile: { name: 'Aisyah Rahman', shop: 'Aisyah Trading', phone: '+60 12-345 6789', email: 'aisyah@example.com', code, country: 'MY', member: true, kyc: true, ssm: false, joined: now - 40 * D },
    prefs: { lang: 'en', theme: 'light', cur: 'MYR', calm: false, showBal: true,
      notify: { orders: true, parcels: true, payments: true, promos: false },
      defaults: { dest: 'MY', mode: 'sea', insp: 'std', pay: 'wallet' },
      naming: { cargo: '{contents} · {source}', shipment: '{dest} · {date}' } },
    addresses: [
      { id: 'a1', label: 'Shop', name: 'Aisyah Rahman', phone: '+60 12-345 6789', line: 'No. 12, Jalan Kenari 3, Seksyen 7', city: 'Shah Alam', postcode: '40000', state: 'Selangor', country: 'MY', isDefault: true },
      { id: 'a2', label: 'Home', name: 'Aisyah Rahman', phone: '+60 12-345 6789', line: 'B-8-3, Residensi Harmoni', city: 'Petaling Jaya', postcode: '47301', state: 'Selangor', country: 'MY', isDefault: false },
    ],
    sec: { salt: DEMO_SALT, pinHash: DEMO_HASH, fails: 0, lockUntil: 0, twoStep: 'sms', loginAlerts: true, askOver: 100000,
      devices: [{ id: 'd1', name: 'This browser', where: 'Kuala Lumpur, MY', now: true }, { id: 'd2', name: 'EZICARGO app · Android', where: 'Shah Alam, MY', now: false, last: now - 2 * D }] },
    ledger,
    cart: [{ pid: 'p4', qty: 600, col: 1 }, { pid: 'p16', qty: 1000, col: 0 }],
    orders: [{ id: 'EZO-3021', name: 'Desk lamps for Raya', pid: 'p5', qty: 300, col: 0, fen: 3300, goods, insp, ship, fee: 0, pay: 'wallet', dest: 'MY', mode: 'sea', inspKind: 'std',
      state: 'production', createdAt: now - 2 * D, addrId: 'a1',
      history: [{ state: 'paid', at: now - 2 * D, by: 'customer' }, { state: 'confirmed', at: now - 2 * D + 5 * H, by: 'factory' }, { state: 'production', at: now - 1 * D, by: 'factory' }] }],
    parcels: [
      { id: 'EZ-P-20877', name: 'Tumblers · Taobao', contents: 'Tumblers', source: 'Taobao', cartons: 6, grams: 18400, cm3: 504000, valueSen: 186000, state: 'stored', arrivedAt: now - 3 * D, extraDays: 0, photos: 6, courier: 'ZTO 7731 0042 118', checks: ['photo'] },
      { id: 'EZ-P-20891', name: 'Phone cases · 1688', contents: 'Phone cases', source: '1688', cartons: 2, grams: 4100, cm3: 78750, valueSen: 62000, state: 'stored', arrivedAt: now - 9 * D, extraDays: 0, photos: 4, courier: 'YTO 8812 4410 071', checks: [] },
      { id: 'EZ-P-20902', name: 'Scarves · Yiwu market', contents: 'Scarves', source: 'Yiwu market', cartons: 3, grams: 0, cm3: 0, valueSen: 94000, state: 'coming', arrivedAt: 0, extraDays: 0, photos: 0, courier: 'SF Express SF1402886631', checks: [] },
    ],
    shipments: [{ id: 'EZ-S-7715', name: 'Raya stock · sea', parcelIds: [], cartons: 14, grams: 212000, mode: 'sea', dest: 'MY', sen: 124060, createdAt: now - 9 * D, state: 'at_sea', progress: 0.58, eta: now + 9 * D, tracking: 'EZ7715204418', addrId: 'a1' }],
    groups: [
      { id: 'g1', pid: 'p1', ladder: [[1000, 2200], [3000, 1900]], committed: 2340, goal: 3000, endsAt: now + 5 * H + 12 * 60e3, shops: 41, state: 'open' },
      { id: 'g2', pid: 'p15', ladder: [[5000, 72], [20000, 58]], committed: 16800, goal: 20000, endsAt: now + 9 * H + 40 * 60e3, shops: 63, state: 'open' },
      { id: 'g3', pid: 'p3', ladder: [[500, 4100], [2000, 3600]], committed: 1210, goal: 2000, endsAt: now + 27 * H, shops: 22, state: 'open' },
      { id: 'g4', pid: 'p9', ladder: [[500, 980], [2000, 840]], committed: 780, goal: 2000, endsAt: now + 2 * D + 4 * H, shops: 17, state: 'open' },
      { id: 'g5', pid: 'p16', ladder: [[1000, 260], [5000, 210]], committed: 3900, goal: 5000, endsAt: now + 14 * H, shops: 58, state: 'open' },
    ],
    joins: [],
    supplierHolds: [],
    credit: { onTimePayments: 14, latePayments: 0, monthsActive: 11, volumeSen: 18600000 },
    notices: [
      { id: 'n1', at: now - 20 * 60e3, key: 'n.measured', vars: { id: 'EZ-P-20877' }, route: 'ship', read: false },
      { id: 'n2', at: now - 3 * H, key: 'n.groupFull', vars: { pct: 78 }, route: 'group', read: false },
      { id: 'n3', at: now - 6 * D, key: 'n.topup', vars: { amt: 1000000 }, route: 'wallet', read: true },
    ],
    audit: [
      { at: now - 2 * D, who: code, what: 'Paid order into escrow', ref: 'EZO-3021' },
      { at: now - 1 * D, who: 'Yongkang Steelware', what: 'Started production', ref: 'EZO-3021' },
      { at: now - 3 * D, who: 'Warehouse GZ · Li Wei', what: 'Received and measured parcel', ref: 'EZ-P-20877' },
    ],
    tickets: [
      { id: 'EZT-5120', who: code, subject: 'Can I combine two parcels?', state: 'open', at: now - 4 * H, msgs: [{ from: 'customer', text: 'Can I combine two parcels into one shipment?', at: now - 4 * H }] },
      { id: 'EZT-5114', who: 'SA-K20931', subject: 'Invoice for group deal', state: 'open', at: now - 20 * H, msgs: [{ from: 'customer', text: 'Please send the invoice for my group deal deposit.', at: now - 20 * H }] },
    ],
    customers: [
      { code, name: 'Aisyah Trading', country: 'MY', score: 742, orders: 1, state: 'active' },
      { code: makeCode('MY', 10519), name: 'Nur Hijab Store', country: 'MY', score: 701, orders: 6, state: 'active' },
      { code: makeCode('SG', 20277), name: 'SnapCase', country: 'SG', score: 768, orders: 11, state: 'active' },
      { code: makeCode('SA', 20931), name: 'Bayt Home Jeddah', country: 'SA', score: 688, orders: 4, state: 'active' },
      { code: makeCode('MY', 10633), name: 'GadgetHub JB', country: 'MY', score: 612, orders: 2, state: 'review' },
      { code: makeCode('AE', 30112), name: 'Zara Mode Dubai', country: 'AE', score: 731, orders: 9, state: 'active' },
      { code: makeCode('BN', 40018), name: 'Toko Riang', country: 'BN', score: 655, orders: 3, state: 'frozen' },
    ],
    applications: [
      { id: 'FA-118', n: 'Ningbo Fresh Kitchenware', city: 'Ningbo, Zhejiang', type: 'OEM', state: 'pending', at: now - 2 * D },
      { id: 'FA-121', n: 'Quanzhou Sport Textile', city: 'Quanzhou, Fujian', type: 'Own brand', state: 'pending', at: now - 1 * D },
    ],
    rates: { airAdj: 0, seaAdj: 0 },
    recent: [],
    favs: ['orders', 'track', 'inspect', 'newgroup'],
    chats: {},
    suppliers: [{ id: 's1', name: '义乌丝路纺织', via: 'Alipay' }, { id: 's2', name: '深圳壳工坊', via: 'WeChat Pay' }, { id: 's3', name: '永康钢器有限公司', via: 'ICBC bank' }],
  };
}
