import type { Order, UpiPayment } from '../types';

// This checks address syntax, not bank ownership or account availability.
export function isValidUpiId(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/.test(value.trim());
}

export function buildUpiUri(payment: Pick<UpiPayment, 'upiId' | 'payeeName'> & Partial<Pick<UpiPayment, 'amount' | 'reference'>>): string {
  if (!isValidUpiId(payment.upiId)) throw new Error('Enter a valid shop UPI ID, such as shop@bank.');
  if (!payment.payeeName.trim()) throw new Error('Enter the payment recipient name.');
  const params: Record<string, string> = { pa: payment.upiId.trim(), pn: payment.payeeName.trim(), cu: 'INR' };
  if (payment.amount !== undefined) {
    if (!Number.isFinite(payment.amount) || Number(payment.amount.toFixed(2)) <= 0) throw new Error('The payment amount must be greater than zero.');
    params.am = payment.amount.toFixed(2);
  }
  if (payment.reference) {
    if (!/^[a-zA-Z0-9]{1,35}$/.test(payment.reference)) throw new Error('Invalid payment reference.');
    params.tr = payment.reference;
    params.tn = `Print order ${payment.reference.slice(-8)}`;
  }
  return `upi://pay?${Object.entries(params).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')}`;
}

export const getOrderAmount = (order: Order) => order.config.revisedAmount ?? order.config.subtotal;

export function getUpiPaymentIssue(order: Order): string | null {
  if (order.status === 'cancelled') return 'This order is cancelled. Do not make a payment.';
  if (order.paymentStatus === 'paid') return 'The shop has marked this order as paid.';
  if (order.paymentMode !== 'online' || !order.upiPayment || !isValidUpiId(order.upiPayment.upiId)) return 'UPI payment is not configured for this order. Pay at the counter.';
  try { buildUpiUri(order.upiPayment); } catch { return 'This payment request is invalid. Contact the shop before paying.'; }
  if (Math.round(order.upiPayment.amount * 100) !== Math.round(getOrderAmount(order) * 100)) {
    return 'The quote has changed. Contact the shop before making another payment.';
  }
  return null;
}

export function paymentLabel(order: Order): string {
  if (order.paymentStatus === 'paid') return 'Paid';
  if (order.paymentMode === 'online') return order.upiPayment?.utr ? 'UPI — awaiting verification' : 'UPI — payment pending';
  return 'Pay at Counter';
}
