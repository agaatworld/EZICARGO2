// Factory order life cycle. Money moves only on the transitions that allow it.
// paid → confirmed → production → arrived → inspected → released → shipped → delivered
// Before release an order can be refunded (for example when inspection fails).

export const STEPS = Object.freeze(['paid', 'confirmed', 'production', 'arrived', 'inspected', 'released', 'shipped', 'delivered']);
export const END = Object.freeze(['delivered', 'refunded']);

const NEXT = Object.freeze({
  paid: ['confirmed', 'refunded'],
  confirmed: ['production', 'refunded'],
  production: ['arrived', 'refunded'],
  arrived: ['inspected', 'refunded'],
  inspected: ['released', 'refunded'],
  released: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  refunded: [],
});

export class TransitionError extends Error {}

export function canMove(from, to) { return (NEXT[from] || []).includes(to); }
export function nextStep(state) { return (NEXT[state] || []).find((s) => s !== 'refunded') || null; }
export function stepIndex(state) { return STEPS.indexOf(state); }
export function isOpen(order) { return !END.includes(order.state); }
export function canRefund(order) { return canMove(order.state, 'refunded'); }

/** Returns a new order in the next state plus the money effect the caller must post to the ledger. */
export function move(order, to, { at = Date.now(), by = 'system', note = '' } = {}) {
  if (!canMove(order.state, to)) throw new TransitionError(`Order ${order.id} cannot go from ${order.state} to ${to}`);
  const money = to === 'released' ? 'release' : to === 'refunded' ? 'refund' : null;
  return {
    order: { ...order, state: to, history: [...(order.history || []), { state: to, at, by, note }] },
    money,
  };
}
