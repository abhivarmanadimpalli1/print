import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Printer,
  ChevronLeft,
  HelpCircle,
  Search,
  Sparkles,
  Clock,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { getOrder, getShop, saveOrderToLocal, submitUpiReference, subscribeToStore } from '../../lib/store';
import { getOrderFromFirestore, listenToOrderFromFirestore } from '../../lib/firebase';
import { DigitalCounterBill } from './DigitalCounterBill';
import { PaymentModal } from './PaymentModal';
import { getUpiPaymentIssue, paymentLabel } from '../../lib/upi';
import type { Order, OrderStatus, Shop } from '../../types';

interface CustomerOrderStatusProps {
  orderId: string;
  onBackToOrder: () => void;
  onSelectOrder?: (orderId: string) => void;
  shop?: Shop;
}

export const CustomerOrderStatus: React.FC<CustomerOrderStatusProps> = ({
  orderId: initialOrderId,
  onBackToOrder,
  onSelectOrder,
  shop: propShop,
}) => {
  const [activeId, setActiveId] = useState<string>(() => getOrder(initialOrderId)?.id || initialOrderId);
  const [order, setOrder] = useState<Order | undefined>(() => getOrder(initialOrderId));
  const [isSearchingCloud, setIsSearchingCloud] = useState<boolean>(!order);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchError, setSearchError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'tracker' | 'bill'>('bill'); // Default to tactile bill!
  const [isManualSearching, setIsManualSearching] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState(() => {
    const saved = getOrder(initialOrderId);
    return Boolean(saved?.paymentMode === 'online' && saved.paymentStatus === 'pending' && !saved.upiPayment?.utr && !getUpiPaymentIssue(saved));
  });

  // Sync state if initialOrderId prop changes
  useEffect(() => {
    const existing = getOrder(initialOrderId);
    setActiveId(existing?.id || initialOrderId);
    setOrder(existing);
    if (!existing) {
      setIsSearchingCloud(true);
    }
  }, [initialOrderId]);

  // Subscribe to real-time store updates and query Firestore if missing
  useEffect(() => {
    const unsubStore = subscribeToStore(() => {
      const local = getOrder(activeId);
      if (local) {
        setOrder(local);
        setIsSearchingCloud(false);
      }
    });

    const unsubFirestore = listenToOrderFromFirestore(activeId, remote => {
      if (remote) {
        try { saveOrderToLocal(remote); } catch { /* Keep the live order usable without local storage. */ }
        setOrder(remote);
        setIsSearchingCloud(false);
      }
    });

    if (!getOrder(activeId)) {
      setIsSearchingCloud(true);
      const timeoutId = setTimeout(() => {
        setIsSearchingCloud(false);
      }, 2500);

      (async () => {
        try {
          const fromFirestore = await getOrderFromFirestore(activeId);
          if (fromFirestore) {
            saveOrderToLocal(fromFirestore);
            setOrder(fromFirestore);
            setActiveId(fromFirestore.id);
          }
        } catch (err) {
          console.warn('[Firestore lookup]', err);
        } finally {
          clearTimeout(timeoutId);
          setIsSearchingCloud(false);
        }
      })();
    }

    return () => {
      unsubStore();
      unsubFirestore();
    };
  }, [activeId]);

  // Handle user searching for another order number (e.g. "1046" or "ORD-1046")
  const handleSearchOrder = async (queryToSearch: string) => {
    const q = queryToSearch.trim();
    if (!q) return;

    setSearchError('');
    setIsManualSearching(true);

    // 1. Try local cache
    const local = getOrder(q);
    if (local) {
      setActiveId(local.id);
      setOrder(local);
      setIsManualSearching(false);
      if (onSelectOrder) onSelectOrder(local.id);
      return;
    }

    // 2. Try Firestore live query
    try {
      const remote = await getOrderFromFirestore(q);
      if (remote) {
        saveOrderToLocal(remote);
        setActiveId(remote.id);
        setOrder(remote);
        if (onSelectOrder) onSelectOrder(remote.id);
      } else {
        setSearchError(`No order found matching "${q}". Please check the number given on your counter slip.`);
      }
    } catch {
      setSearchError('Error contacting database. Please try again.');
    } finally {
      setIsManualSearching(false);
    }
  };

  const currentShop = order ? getShop(order.shopId) : propShop;

  // Loading state while searching Firestore
  if (isSearchingCloud) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <Card className="p-8 space-y-4 bg-[#242424] border border-[#3d3d3d] rounded-none shadow-none">
          <div className="w-9 h-9 border-3 border-[#da291c] border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-base font-bold text-[#ffffff]">Checking City Cloud Database...</h2>
          <p className="text-xs text-[#b0b0b0]">
            Retrieving live counter status and generated bill for <code className="font-mono font-bold text-[#ff8278]">{activeId}</code>
          </p>
        </Card>
      </div>
    );
  }

  // Not found recovery state with interactive search bar
  if (!order) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 space-y-4">
        <Card className="p-8 space-y-5 text-center bg-[#242424] border border-[#3d3d3d] shadow-none">
          <div className="w-12 h-12 bg-[#3c2b22] text-[#f3ba83] rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-[#ffffff]">Order Not Found</h2>
            <p className="text-xs text-[#b0b0b0] mt-1">
              We couldn't automatically locate an order matching <code className="font-mono font-semibold text-[#ffffff]">{activeId}</code>.
            </p>
          </div>

          {/* Interactive Search Box */}
          <div className="pt-2 text-left space-y-2">
            <label className="text-xs font-semibold text-[#dedede] block">
              Search by Order Number or Mobile:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. 1046 or ORD-1046"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchOrder(searchQuery)}
                className="flex-1 px-3 py-2 text-xs border border-[#606060] rounded-none focus:outline-none focus:ring-2 focus:ring-[#da291c] font-mono"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSearchOrder(searchQuery)}
                disabled={isManualSearching || !searchQuery.trim()}
              >
                {isManualSearching ? 'Searching...' : 'Find Order'}
              </Button>
            </div>
            {searchError && (
              <p className="text-xs text-[#ff8278] pt-1">{searchError}</p>
            )}
          </div>

          <div className="pt-2 border-t border-[#3d3d3d]">
            <Button variant="secondary" onClick={onBackToOrder} className="w-full">
              Back to Print Ordering
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (propShop && order.shopId !== propShop.id) return <div className="max-w-xl mx-auto p-6 space-y-4"><p role="alert">This order belongs to a different shop. Open its original tracking link.</p><Button onClick={onBackToOrder}>Back to this shop</Button></div>;

  const steps: { key: OrderStatus; label: string; desc: string }[] = [
    { key: 'new', label: 'Order Received', desc: 'Job registered in bookstore queue' },
    { key: 'review', label: 'Shopkeeper Review', desc: 'Checking file format and margins' },
    { key: 'approved', label: 'Approved', desc: 'Verified and queued for print spool' },
    { key: 'printing', label: 'Printing at Counter', desc: 'The shop marked this order as printing' },
    { key: 'ready', label: 'Ready for Pickup', desc: 'Finished sheets placed in counter tray' },
    { key: 'completed', label: 'Order Completed', desc: 'Collected by the customer' },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="max-w-xl mx-auto py-6 px-4 space-y-5">
      
      {/* Top Header Bar */}
      <div className="no-print flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBackToOrder}
          className="flex items-center gap-1 text-xs font-semibold text-[#ff8278] hover:underline cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>New Print Order</span>
        </button>

        {/* Live sync pulse & refresh */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#b0b0b0]">Cloud Live</span>
          <span className="w-2 h-2 rounded-full bg-[#1aae39] animate-pulse" />
        </div>
      </div>

      {/* Quick "Track Another Order #" Search Bar */}
      <div className="no-print bg-[#242424] p-3 rounded-none border border-[#3d3d3d] shadow-none flex items-center gap-2">
        <Search className="w-4 h-4 text-[#b0b0b0] shrink-0" />
        <input
          type="text"
          placeholder="Track another order # (e.g. 1046)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearchOrder(searchQuery)}
          className="flex-1 text-xs bg-transparent border-none focus:outline-none placeholder:text-[#969696] font-mono"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleSearchOrder(searchQuery)}
          disabled={isManualSearching || !searchQuery.trim()}
          className="text-xs shrink-0"
        >
          {isManualSearching ? 'Searching...' : 'Track'}
        </Button>
      </div>

      {order.paymentMode === 'online' && <Card className="no-print space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg text-white">{paymentLabel(order)}</h2><p className="text-xs text-[#bcbcbc] mt-1">{order.upiPayment?.payeeName || currentShop?.name || 'Shop'}</p></div><span className="text-xl text-white">₹{(order.config.revisedAmount ?? order.config.subtotal).toFixed(2)}</span></div>
        {order.upiPayment?.utr && <p className="text-sm text-[#bcbcbc] break-all">UPI reference: <strong className="text-white">{order.upiPayment.utr}</strong></p>}
        {order.paymentStatus === 'pending' && (getUpiPaymentIssue(order) ? <p className="text-xs text-[#f3ba83]">{getUpiPaymentIssue(order)}</p> : order.upiPayment?.utr ? <p className="text-xs text-[#f3ba83]">Your reference has been submitted. The shop will check receipt of the money. Do not pay again.</p> : <><Button onClick={() => setShowPaymentModal(true)} className="w-full">Pay with UPI / submit reference</Button><p className="text-xs text-[#bcbcbc]">If you already paid, submit that transaction’s reference. Do not make another payment.</p></>)}
      </Card>}
      {showPaymentModal && order.paymentMode === 'online' && <PaymentModal key={order.id} order={order}
        onCancel={() => setShowPaymentModal(false)}
        onSubmitReference={async utr => { const updated = await submitUpiReference(order.id, utr); setOrder(updated); setShowPaymentModal(false); }} />}

      {/* View Switcher: Digital Counter Bill vs Pipeline Status */}
      <div className="no-print flex bg-[#303030] p-1 rounded-none border border-[#3d3d3d]">
        <button
          type="button"
          onClick={() => setActiveTab('bill')}
          className={`flex-1 py-2 text-xs font-bold rounded-none transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'bill'
              ? 'bg-[#242424] text-[#ffffff] shadow-none'
              : 'text-[#b0b0b0] hover:text-[#ffffff]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-[#ff8278]" />
          <span>Official Counter Bill & Token</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tracker')}
          className={`flex-1 py-2 text-xs font-bold rounded-none transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'tracker'
              ? 'bg-[#242424] text-[#ffffff] shadow-none'
              : 'text-[#b0b0b0] hover:text-[#ffffff]'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-[#f3ba83]" />
          <span>Live Queue Progress</span>
        </button>
      </div>

      {/* Tab 1: Official Digital Counter Bill */}
      {activeTab === 'bill' && (
        <DigitalCounterBill
          order={order}
          shop={currentShop}
          onBackToNewOrder={onBackToOrder}
        />
      )}

      {/* Tab 2: Live Queue Progress Pipeline */}
      {activeTab === 'tracker' && (
        <div className="space-y-4">
          
          {/* Hero Status Card */}
          <Card className="bg-[#242424] border-[#3d3d3d] p-6 text-center space-y-3 shadow-none">
            <div className="inline-block">
              <Badge status={order.status} size="md" />
            </div>

            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-[#b0b0b0]">Queue Token</span>
              <div className="text-4xl sm:text-5xl font-black text-[#ff8278] tracking-tight font-mono mt-0.5">
                #{order.orderNumber}
              </div>
              <p className="text-xs text-[#bcbcbc] font-mono mt-0.5">Order ID: {order.id}</p>
            </div>

            <div className="pt-2">
              {order.status === 'ready' ? (
                <div className="p-3 bg-[#163529] rounded-none text-[#6ed5a3] font-bold text-sm">
                  🎉 Your print is ready! Please collect it from the bookstore counter tray.
                </div>
              ) : order.status === 'printing' ? (
                <div className="p-3 bg-[#3c2b22] rounded-none text-[#f3ba83] font-bold text-sm flex items-center justify-center gap-2">
                  <Printer className="w-4 h-4 animate-bounce" />
                  Your document is actively feeding through the shop's printer.
                </div>
              ) : order.status === 'approved' ? (
                <div className="p-3 bg-[#303030] rounded-none text-[#ff8278] font-bold text-sm flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#ff8278]" />
                  Job Approved! Queued to print next at counter.
                </div>
              ) : order.status === 'review' ? (
                <div className="p-3 bg-[#3c2b22] rounded-none text-[#f3ba83] text-xs font-medium">
                  ⚠️ Shopkeeper is reviewing your document layout.
                </div>
              ) : order.status === 'cancelled' ? (
                <div className="p-3 bg-[#402321] rounded-none text-[#ff8278] text-xs font-semibold">
                  ❌ Order Cancelled or Rejected: {order.rejectionReason || 'Contact counter for details.'}
                </div>
              ) : (
                <p className="text-xs text-[#b0b0b0]">
                  Estimated counter wait: <strong className="text-[#ffffff]">~2 to 5 minutes</strong>
                </p>
              )}
            </div>
          </Card>

          {/* Clarification Alert (if any) */}
          {order.clarificationNote && (
            <Card tint="peach" className="space-y-2 border-none">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#f3ba83]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#bcbcbc]">
                  Note from Bookstore Owner
                </h4>
              </div>
              <p className="text-xs text-[#dedede] leading-relaxed">
                "{order.clarificationNote}"
              </p>
              {order.config.isRevisedQuote && order.config.revisedAmount && (
                <div className="mt-2 p-2 bg-[#303030] rounded-none text-xs flex justify-between items-center">
                  <span>Revised Total:</span>
                  <span className="font-bold text-sm text-[#ffffff]">₹{order.config.revisedAmount.toFixed(2)}</span>
                </div>
              )}
            </Card>
          )}

          {/* Progress Timeline */}
          {!isCancelled && (
            <Card className="bg-[#242424] border-[#3d3d3d] p-5 shadow-none">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#bcbcbc] mb-4">
                Counter Print Pipeline
              </h3>

              <div className="space-y-4">
                {steps.map((s, idx) => {
                  const isPast = currentStepIndex >= idx;
                  const isCurrent = currentStepIndex === idx;

                  return (
                    <div key={s.key} className="flex items-start gap-3 relative">
                      {idx < steps.length - 1 && (
                        <div
                          className={`absolute left-3 top-6 bottom-0 w-0.5 -mb-4 ${
                            currentStepIndex > idx ? 'bg-[#da291c]' : 'bg-[#3d3d3d]'
                          }`}
                        />
                      )}

                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 text-[10px] font-bold ${
                          isCurrent
                            ? 'bg-[#da291c] text-white ring-4 ring-[#303030]'
                            : isPast
                            ? 'bg-[#da291c] text-white'
                            : 'bg-[#303030] text-[#969696]'
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
                              ? 'text-[#ff8278]'
                              : isPast
                              ? 'text-[#ffffff]'
                              : 'text-[#969696]'
                          }`}
                        >
                          {s.label}
                        </p>
                        <p className="text-[11px] text-[#b0b0b0]">{s.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Quick link to view counter bill */}
          <Button
            variant="secondary"
            onClick={() => setActiveTab('bill')}
            className="w-full justify-center text-xs"
            icon={<Sparkles className="w-3.5 h-3.5 text-[#ff8278]" />}
          >
            View & Print Official Counter Bill (#INV-{order.orderNumber})
          </Button>
        </div>
      )}

    </div>
  );
};
