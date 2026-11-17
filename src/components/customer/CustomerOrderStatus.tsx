import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Printer,
  ChevronLeft,
  HelpCircle,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { getOrder, subscribeToStore } from '../../lib/store';
import type { Order, OrderStatus } from '../../types';

interface CustomerOrderStatusProps {
  orderId: string;
  onBackToOrder: () => void;
}

export const CustomerOrderStatus: React.FC<CustomerOrderStatusProps> = ({
  orderId,
  onBackToOrder,
}) => {
  const [order, setOrder] = useState<Order | undefined>(() => getOrder(orderId));

  useEffect(() => {
    const unsub = subscribeToStore(() => {
      setOrder(getOrder(orderId));
    });
    return unsub;
  }, [orderId]);

  if (!order) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center">
        <Card className="p-8 space-y-4">
          <AlertTriangle className="w-10 h-10 text-[#dd5b00] mx-auto" />
          <h2 className="text-lg font-bold text-[#1a1a1a]">Order Not Found</h2>
          <p className="text-xs text-[#787671]">
            We could not find an order matching <code className="font-mono">{orderId}</code>.
          </p>
          <Button variant="secondary" onClick={onBackToOrder} className="w-full">
            Back to Print Ordering
          </Button>
        </Card>
      </div>
    );
  }

  const steps: { key: OrderStatus; label: string; desc: string }[] = [
    { key: 'new', label: 'Order Received', desc: 'Job queued at the print counter' },
    { key: 'review', label: 'In Review', desc: 'Shopkeeper checking file formatting' },
    { key: 'approved', label: 'Approved', desc: 'Job queued for printing spool' },
    { key: 'printing', label: 'Printing', desc: 'Sheets actively feeding through printer' },
    { key: 'ready', label: 'Ready for Pickup', desc: 'Document ready at counter tray' },
    { key: 'completed', label: 'Completed', desc: 'Picked up and verified' },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="max-w-xl mx-auto py-6 px-4 space-y-5">
      
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToOrder}
          className="flex items-center gap-1 text-xs font-semibold text-[#5645d4] hover:underline cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>New Print Order</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#787671]">Auto-syncing</span>
          <span className="w-2 h-2 rounded-full bg-[#1aae39] animate-pulse" />
        </div>
      </div>

      {/* Main Status Hero Card */}
      <Card className="bg-white border-[#e5e3df] p-6 text-center space-y-3">
        <div className="inline-block">
          <Badge status={order.status} size="md" />
        </div>

        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-[#787671]">Queue Reference</span>
          <div className="text-4xl font-extrabold text-[#5645d4] tracking-tight font-mono mt-0.5">
            #{order.orderNumber}
          </div>
          <p className="text-xs text-[#5d5b54] font-mono mt-0.5">ID: {order.id}</p>
        </div>

        {/* Dynamic Status Headline */}
        <div className="pt-2">
          {order.status === 'ready' ? (
            <div className="p-3 bg-[#d9f3e1] rounded-[8px] text-[#1aae39] font-bold text-sm">
              🎉 Your print is ready! Please collect it from the counter.
            </div>
          ) : order.status === 'printing' ? (
            <div className="p-3 bg-[#ffe8d4] rounded-[8px] text-[#dd5b00] font-bold text-sm flex items-center justify-center gap-2">
              <Printer className="w-4 h-4 animate-bounce" />
              Your document is currently being printed on the shop machine.
            </div>
          ) : order.status === 'review' ? (
            <div className="p-3 bg-[#ffe8d4] rounded-[8px] text-[#dd5b00] text-xs font-medium">
              ⚠️ The shopkeeper is reviewing your document or requested a clarification.
            </div>
          ) : order.status === 'cancelled' ? (
            <div className="p-3 bg-[#fde0ec] rounded-[8px] text-[#e03131] text-xs font-semibold">
              ❌ Order Cancelled or Rejected: {order.rejectionReason || 'Contact counter for details.'}
            </div>
          ) : (
            <p className="text-xs text-[#787671]">
              Estimated pickup wait: <strong className="text-[#1a1a1a]">~2 to 5 minutes</strong>
            </p>
          )}
        </div>
      </Card>

      {/* Clarification Alert (if any) */}
      {order.clarificationNote && (
        <Card tint="peach" className="space-y-2 border-none">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-[#dd5b00]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#793400]">
              Note from Shopkeeper
            </h4>
          </div>
          <p className="text-xs text-[#37352f] leading-relaxed">
            "{order.clarificationNote}"
          </p>
          {order.config.isRevisedQuote && order.config.revisedAmount && (
            <div className="mt-2 p-2 bg-white/80 rounded-[6px] text-xs flex justify-between items-center">
              <span>Revised Total:</span>
              <span className="font-bold text-sm text-[#0a1530]">₹{order.config.revisedAmount.toFixed(2)}</span>
            </div>
          )}
        </Card>
      )}

      {/* Progress Timeline */}
      {!isCancelled && (
        <Card className="bg-white border-[#e5e3df] p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5d5b54] mb-4">
            Print Pipeline Progress
          </h3>

          <div className="space-y-4">
            {steps.map((s, idx) => {
              const isPast = currentStepIndex >= idx;
              const isCurrent = currentStepIndex === idx;

              return (
                <div key={s.key} className="flex items-start gap-3 relative">
                  {/* Connecting Line */}
                  {idx < steps.length - 1 && (
                    <div
                      className={`absolute left-3 top-6 bottom-0 w-0.5 -mb-4 ${
                        currentStepIndex > idx ? 'bg-[#5645d4]' : 'bg-[#e5e3df]'
                      }`}
                    />
                  )}

                  {/* Dot */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 text-[10px] font-bold ${
                      isCurrent
                        ? 'bg-[#5645d4] text-white ring-4 ring-[#e6e0f5]'
                        : isPast
                        ? 'bg-[#5645d4] text-white'
                        : 'bg-[#f0eeec] text-[#a4a097]'
                    }`}
                  >
                    {isPast && !isCurrent ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      idx + 1
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-semibold ${
                        isCurrent
                          ? 'text-[#5645d4]'
                          : isPast
                          ? 'text-[#1a1a1a]'
                          : 'text-[#a4a097]'
                      }`}
                    >
                      {s.label}
                    </p>
                    <p className="text-[11px] text-[#787671]">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Order Item Details */}
      <Card className="bg-white border-[#e5e3df] space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#5d5b54]">
          Document & Config Summary
        </h3>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-[#e5e3df]">
            <span className="text-[#787671]">File:</span>
            <span className="font-semibold text-[#1a1a1a] truncate max-w-[200px]">{order.fileName}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-[#e5e3df]">
            <span className="text-[#787671]">Pages / Sheets:</span>
            <span className="font-semibold text-[#1a1a1a]">
              {order.config.selectedPageCount} pgs ({order.config.sheetsNeeded} physical sheets)
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-[#e5e3df]">
            <span className="text-[#787671]">Format:</span>
            <span className="font-semibold text-[#1a1a1a]">
              {order.config.colorMode.toUpperCase()} • {order.config.sides === 'duplex' ? 'Duplex' : 'Single-sided'} • {order.config.paperSize}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-[#e5e3df]">
            <span className="text-[#787671]">Copies:</span>
            <span className="font-semibold text-[#1a1a1a]">× {order.config.copies}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-[#e5e3df]">
            <span className="text-[#787671]">Payment:</span>
            <span className="font-semibold text-[#5645d4]">
              {order.paymentStatus === 'paid' ? 'Paid Online [Sandbox]' : 'Pay at Counter'}
            </span>
          </div>
          <div className="flex justify-between items-baseline pt-1">
            <span className="text-xs font-bold text-[#1a1a1a]">Total Amount:</span>
            <span className="text-lg font-bold text-[#0a1530]">
              ₹{(order.config.revisedAmount || order.config.subtotal).toFixed(2)}
            </span>
          </div>

          {order.isPurged && (
            <div className="pt-2 border-t border-[#e5e3df] text-[11px] text-[#1aae39] flex items-center gap-1.5">
              <span>🔒 Document PDF permanently purged from database after 10 minutes to protect your privacy.</span>
            </div>
          )}
        </div>
      </Card>

    </div>
  );
};
