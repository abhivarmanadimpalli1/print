import { useEffect, useRef, useState } from 'react';
import { Copy, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { UpiQrCode } from '../ui/UpiQrCode';
import { buildUpiUri, getUpiPaymentIssue } from '../../lib/upi';
import type { Order } from '../../types';

interface PaymentModalProps {
  order: Order;
  onSubmitReference: (utr: string) => Promise<void>;
  onCancel: () => void;
}

export function PaymentModal({ order, onSubmitReference, onCancel }: PaymentModalProps) {
  const [utr, setUtr] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(onCancel);
  const busyRef = useRef(isSaving);
  useEffect(() => { cancelRef.current = onCancel; busyRef.current = isSaving; }, [onCancel, isSaving]);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) cancelRef.current();
      if (event.key === 'Tab') {
        const elements = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled)');
        if (!elements?.length) return;
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKey); previousFocus?.focus(); };
  }, []);
  const payment = order.upiPayment;
  const issue = getUpiPaymentIssue(order);
  const uri = !issue && payment ? buildUpiUri(payment) : null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs" onClick={e => { if (e.target === e.currentTarget && !isSaving) onCancel(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="upi-payment-title" tabIndex={-1} className="bg-[#242424] border border-[#606060] max-w-md w-full max-h-[90dvh] overflow-y-auto outline-none">
      <div className="sticky top-0 z-10 bg-[#181818] p-4 border-b border-[#3d3d3d] flex items-center justify-between gap-3">
        <div><h2 id="upi-payment-title" className="text-base text-white">Pay the shop with UPI</h2><p className="text-xs text-[#bcbcbc] mt-1">Order #{order.orderNumber} · saved before payment</p></div>
        <button type="button" aria-label="Close payment" className="p-2 text-[#bcbcbc]" disabled={isSaving} onClick={onCancel}><X size={20} /></button>
      </div>
      <div className="p-5 space-y-5">
        {issue ? <p role="alert" className="text-sm text-[#f3ba83]">{issue}</p> : payment && <>
          <div className="text-center"><p className="text-xs text-[#bcbcbc]">Pay directly to {payment.payeeName}</p><p className="text-3xl text-white mt-2">₹{payment.amount.toFixed(2)}</p></div>
          {uri && !payment.utr && <><UpiQrCode uri={uri} downloadable /><a href={uri} className="qp-button flex items-center justify-center min-h-12 px-4 bg-[#da291c] text-white text-center">Open UPI app to pay ₹{payment.amount.toFixed(2)}</a><p className="text-xs text-[#bcbcbc] text-center">Use a UPI app on this phone, or scan the QR from another device. Check the recipient and amount before confirming.</p></>}
          <div className="border border-[#3d3d3d] p-3 flex items-center gap-2"><div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-wider text-[#bcbcbc]">Shop UPI ID</p><p className="text-sm text-white break-all">{payment.upiId}</p></div><Button size="sm" variant="secondary" aria-label="Copy shop UPI ID" icon={<Copy size={14} />} onClick={() => { void navigator.clipboard.writeText(payment.upiId).then(() => setCopied(true)).catch(() => setError('Could not copy. Select the UPI ID above to copy it.')); }}>{copied ? 'Copied' : 'Copy'}</Button></div>
          {payment.utr ? <p role="status" className="text-sm text-[#f3ba83]">Reference {payment.utr} submitted. The shop is checking receipt of your payment. Do not pay again.</p> : <form className="space-y-3 border-t border-[#3d3d3d] pt-4" onSubmit={e => { e.preventDefault(); if (isSaving) return; setError(null); if (!/^\d{12}$/.test(utr.trim())) { setError('Enter the 12-digit UPI reference from your successful transaction.'); return; } setIsSaving(true); void onSubmitReference(utr.trim()).catch(e => setError(e instanceof Error ? e.message : 'Could not save your reference. Try again; do not pay again.')).finally(() => setIsSaving(false)); }}>
            <label htmlFor="upi-utr" className="block text-xs text-white font-medium">Already paid? Enter the UPI transaction reference</label>
            <input id="upi-utr" inputMode="numeric" autoComplete="off" maxLength={12} placeholder="12-digit UPI reference / UTR" value={utr} onChange={e => setUtr(e.target.value)} className="w-full px-3 py-3 bg-[#181818] border border-[#606060] text-white" aria-describedby="upi-reference-help" disabled={isSaving} />
            <p id="upi-reference-help" className="text-xs text-[#bcbcbc]">Find this in your completed payment’s details. The shop checks this reference before marking the order paid.</p>
            <Button type="submit" className="w-full" disabled={isSaving}>{isSaving ? 'Saving reference…' : 'Submit payment reference'}</Button>
          </form>}
        </>}
        {error && <p role="alert" className="text-xs text-[#ff8278]">{error}</p>}
        <Button variant="ghost" className="w-full" disabled={isSaving} onClick={onCancel}>Back to my order</Button>
      </div>
    </div>
  </div>;
}
