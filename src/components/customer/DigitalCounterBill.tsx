import React, { useState } from 'react';
import {
  Printer,
  Share2,
  Copy,
  Check,
  Sparkles,
  Phone,
  MapPin,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ReceiptPrinter, type ReceiptPrinterStage } from './ReceiptPrinter';
import type { Order, Shop } from '../../types';

interface DigitalCounterBillProps {
  order: Order;
  shop?: Shop;
  onBackToNewOrder?: () => void;
}

export const DigitalCounterBill: React.FC<DigitalCounterBillProps> = ({
  order,
  shop,
  onBackToNewOrder,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const formattedDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = new Date(order.createdAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const totalAmount = (order.config.revisedAmount || order.config.subtotal || 0).toFixed(2);
  const shopName = shop?.name || 'Campus QuickPrint Center';
  const shopAddress = shop?.location || 'Opp. University Main Gate';
  const shopPhone = shop?.ownerPhone || '+91 7989869191';

  // Map order status to tactile printer stage
  const stage: ReceiptPrinterStage =
    ['ready', 'completed'].includes(order.status)
      ? 'complete'
      : ['approved', 'printing'].includes(order.status)
      ? 'printing'
      : 'processing';

  const handlePrint = () => {
    window.print();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(String(order.orderNumber));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const trackingUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/s/${order.shopId}?orderId=${order.id}`
      : `https://print-zeta-one.vercel.app/s/${order.shopId}?orderId=${order.id}`;

    const text = `*OFFICIAL PRINT COUNTER BILL & TOKEN*
🏪 *Bookstore:* ${shopName}
📍 *Location:* ${shopAddress}
🎫 *Order Token:* #${order.orderNumber} (${order.id})
👤 *Customer:* ${order.customerName} (${order.customerPhone})
📄 *File:* ${order.fileName}
📑 *Details:* ${order.config.selectedPageCount} pgs • ${order.config.copies} copy • ${order.config.colorMode.toUpperCase()} • ${order.config.sides === 'duplex' ? 'Duplex' : 'Single'}
💰 *Total Payable:* ₹${totalAmount} (${order.paymentStatus === 'paid' ? 'PAID ONLINE' : 'PAY AT COUNTER'})
⚡ *Live Status:* ${order.status.toUpperCase()}

🔗 *Live Order & Status Link:*
${trackingUrl}

_Powered by Campus QuickPrint SaaS Network • Managed by Abhinav_`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Tactile Hardware Receipt Printer Presentation */}
      <ReceiptPrinter.Root stage={stage} animate={true} feedMotion="stepped">
        {/* Physical Printer Machine Enclosure */}
        <ReceiptPrinter.Machine className="no-print">
          <ReceiptPrinter.Header>
            <div className="flex items-center gap-1.5 text-xs text-[#a4a097] font-mono">
              <Printer className="w-3.5 h-3.5 text-[#f9e79f]" />
              <span>COUNTER POS #01</span>
            </div>
            <ReceiptPrinter.Status />
          </ReceiptPrinter.Header>

          <ReceiptPrinter.Screen>
            <div className="space-y-1.5 font-mono">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#a4a097] uppercase tracking-wider truncate max-w-[200px]">
                  {shopName}
                </span>
                <span className="text-[#f9e79f] font-bold">
                  TOKEN #{order.orderNumber}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#2b3553]">
                <Badge status={order.status} size="sm" />
                <span className="text-[#a4a097]">
                  {stage === 'complete'
                    ? 'READY AT COUNTER'
                    : stage === 'printing'
                    ? 'PRINTING SHEETS...'
                    : 'PROCESSING QUEUE'}
                </span>
              </div>
            </div>
          </ReceiptPrinter.Screen>
        </ReceiptPrinter.Machine>

        {/* Paper Feeding Output Slot */}
        <ReceiptPrinter.Output>
          <ReceiptPrinter.Paper id="printable-receipt" className="space-y-5 text-left">
            {/* Bill Header */}
            <div className="text-center pb-3 border-b border-dashed border-[#c8c4be] space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#f0edfa] text-[#5645d4] text-[10px] font-bold tracking-wider uppercase mb-1">
                <Sparkles className="w-3 h-3" />
                <span>Official Digital Counter Bill</span>
              </div>

              <h2 className="text-lg sm:text-xl font-black text-[#0a1530] tracking-tight">
                {shopName}
              </h2>

              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#787671]">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 shrink-0 text-[#a4a097]" />
                  <span className="truncate">{shopAddress}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3 h-3 text-[#1aae39]" />
                  <span>{shopPhone}</span>
                </span>
              </div>

              <div className="flex items-center justify-center gap-2 text-[10px] text-[#787671] pt-1 font-mono">
                <span>Bill: INV-{order.orderNumber}</span>
                <span>•</span>
                <span>{formattedDate}, {formattedTime}</span>
              </div>
            </div>

            {/* Big Counter Order Token & Barcode */}
            <div className="bg-[#f6f5f4] rounded-[10px] p-3.5 text-center border border-[#e5e3df] space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#787671]">
                Present This Token At Counter
              </span>
              
              <div className="text-4xl sm:text-5xl font-black font-mono text-[#5645d4] tracking-tight">
                #{order.orderNumber}
              </div>

              {/* Clean SVG Barcode Graphic */}
              <div className="pt-0.5 flex flex-col items-center">
                <svg
                  className="h-8 w-44 text-[#1a1a1a]"
                  viewBox="0 0 160 36"
                  fill="currentColor"
                >
                  <rect x="0" y="0" width="3" height="36" />
                  <rect x="5" y="0" width="2" height="36" />
                  <rect x="9" y="0" width="4" height="36" />
                  <rect x="15" y="0" width="2" height="36" />
                  <rect x="19" y="0" width="6" height="36" />
                  <rect x="28" y="0" width="3" height="36" />
                  <rect x="33" y="0" width="2" height="36" />
                  <rect x="38" y="0" width="5" height="36" />
                  <rect x="46" y="0" width="3" height="36" />
                  <rect x="51" y="0" width="2" height="36" />
                  <rect x="56" y="0" width="6" height="36" />
                  <rect x="65" y="0" width="2" height="36" />
                  <rect x="69" y="0" width="4" height="36" />
                  <rect x="76" y="0" width="3" height="36" />
                  <rect x="82" y="0" width="5" height="36" />
                  <rect x="90" y="0" width="2" height="36" />
                  <rect x="94" y="0" width="4" height="36" />
                  <rect x="101" y="0" width="3" height="36" />
                  <rect x="107" y="0" width="6" height="36" />
                  <rect x="116" y="0" width="2" height="36" />
                  <rect x="120" y="0" width="4" height="36" />
                  <rect x="127" y="0" width="3" height="36" />
                  <rect x="133" y="0" width="5" height="36" />
                  <rect x="141" y="0" width="2" height="36" />
                  <rect x="145" y="0" width="4" height="36" />
                  <rect x="152" y="0" width="3" height="36" />
                  <rect x="157" y="0" width="3" height="36" />
                </svg>
                <span className="font-mono text-[10px] text-[#5d5b54] font-semibold tracking-wider mt-0.5">
                  * {order.id} *
                </span>
              </div>

              <div className="pt-1 flex items-center justify-center gap-2">
                <Badge status={order.status} size="sm" />
                <span className="text-xs text-[#787671]">
                  {order.status === 'ready'
                    ? '✅ Ready in counter tray'
                    : order.status === 'printing'
                    ? '🖨️ Actively printing'
                    : order.status === 'approved'
                    ? '✓ Approved by shop'
                    : '⏳ In queue'}
                </span>
              </div>
            </div>

            {/* Customer Information */}
            <div className="grid grid-cols-2 gap-2 text-xs py-2 border-b border-[#e5e3df]">
              <div>
                <span className="text-[#787671] block text-[10px]">Customer Name</span>
                <span className="font-bold text-[#1a1a1a]">{order.customerName}</span>
              </div>
              <div className="text-right">
                <span className="text-[#787671] block text-[10px]">Mobile / WhatsApp</span>
                <span className="font-bold font-mono text-[#1a1a1a]">{order.customerPhone}</span>
              </div>
            </div>

            {/* Itemized Specification Table */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-[#787671] pb-1 border-b border-[#e5e3df]">
                <span>Print Specification</span>
                <span>Details</span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#f0eeec]">
                <span className="text-[#5d5b54] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#5645d4]" />
                  <span className="truncate max-w-[190px]">{order.fileName}</span>
                </span>
                <span className="font-semibold text-[#1a1a1a]">{order.config.selectedPageCount} pgs</span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#f0eeec]">
                <span className="text-[#5d5b54]">Paper & Sides</span>
                <span className="font-semibold text-[#1a1a1a]">
                  {order.config.paperSize} • {order.config.sides === 'duplex' ? 'Duplex (Two-sided)' : 'Single-sided'}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#f0eeec]">
                <span className="text-[#5d5b54]">Color Mode</span>
                <span className="font-semibold uppercase text-[#1a1a1a]">{order.config.colorMode}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#f0eeec]">
                <span className="text-[#5d5b54]">Copies</span>
                <span className="font-semibold text-[#1a1a1a]">× {order.config.copies} ({order.config.sheetsNeeded} sheets)</span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#f0eeec]">
                <span className="text-[#5d5b54]">Rate per Page</span>
                <span className="font-semibold text-[#1a1a1a]">₹{(order.config.unitPricePerPage || 1.8).toFixed(2)}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#f0eeec]">
                <span className="text-[#5d5b54]">Online Platform Surcharge</span>
                <span className="font-semibold text-[#1aae39]">₹0.00 (FREE KIOSK)</span>
              </div>

              {/* Grand Total Row */}
              <div className="flex justify-between items-baseline pt-2">
                <div>
                  <span className="text-sm font-bold text-[#1a1a1a] block">Grand Total:</span>
                  <span className="text-[10px] text-[#787671]">
                    Payment: <strong className="text-[#5645d4]">{order.paymentStatus === 'paid' ? 'Paid Online [Sandbox]' : 'Pay at Counter (Cash/UPI)'}</strong>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-[#0a1530]">
                    ₹{totalAmount}
                  </span>
                </div>
              </div>
            </div>

            {/* Bill Footer & Platform Attribution */}
            <div className="pt-3 border-t border-dashed border-[#c8c4be] text-center space-y-1 text-[10px] text-[#787671]">
              <div className="flex items-center justify-center gap-1.5 font-semibold text-[#1aae39]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Counter Print Token • 10-Min Privacy Guarantee</span>
              </div>
              <p className="text-[9px] text-[#a4a097]">
                Powered by Campus QuickPrint Network • Managed by Abhinav (WhatsApp: 7989869191)
              </p>
            </div>
          </ReceiptPrinter.Paper>
        </ReceiptPrinter.Output>
      </ReceiptPrinter.Root>

      {/* Action Buttons (Hidden when printing via @media print) */}
      <div className="no-print space-y-2.5 max-w-md mx-auto pt-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="primary"
            onClick={handlePrint}
            className="w-full justify-center bg-[#0a1530] hover:bg-[#1a2a52]"
            icon={<Printer className="w-4 h-4" />}
          >
            Print / Save Bill (PDF)
          </Button>

          <Button
            variant="secondary"
            onClick={handleShareWhatsApp}
            className="w-full justify-center text-[#1aae39] border-[#1aae39]/30 hover:bg-[#d9f3e1]/30"
            icon={<Share2 className="w-4 h-4 text-[#1aae39]" />}
          >
            Share on WhatsApp
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-[8px] border border-[#e5e3df] text-[#5d5b54] hover:text-[#1a1a1a] transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#1aae39]" /> : <Copy className="w-3.5 h-3.5 text-[#787671]" />}
            <span>{copied ? 'Copied Token!' : `Copy #${order.orderNumber}`}</span>
          </button>

          {onBackToNewOrder && (
            <button
              type="button"
              onClick={onBackToNewOrder}
              className="text-xs font-semibold text-[#5645d4] hover:underline cursor-pointer"
            >
              + Place Another Print Order
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
