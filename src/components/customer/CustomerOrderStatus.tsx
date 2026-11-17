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
import { getOrder, getShop, saveOrderToLocal, subscribeToStore } from '../../lib/store';
import { getOrderFromFirestore, listenToStoreOrdersFromFirestore } from '../../lib/firebase';
import { listenToCloud } from '../../lib/cloudSync';
import { DigitalCounterBill } from './DigitalCounterBill';
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
  const [activeId, setActiveId] = useState<string>(initialOrderId);
  const [order, setOrder] = useState<Order | undefined>(() => getOrder(initialOrderId));
  const [isSearchingCloud, setIsSearchingCloud] = useState<boolean>(!order);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchError, setSearchError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'tracker' | 'bill'>('bill'); // Default to tactile bill!
  const [isManualSearching, setIsManualSearching] = useState<boolean>(false);

  // Sync state if initialOrderId prop changes
  useEffect(() => {
    setActiveId(initialOrderId);
    const existing = getOrder(initialOrderId);
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

    const currentShopId = order?.shopId || propShop?.id || 'sri-krishna-xerox';

    // Real-time Cloud SSE listener
    const unsubCloud = listenToCloud(currentShopId, (payload) => {
      if (payload.action === 'UPDATE_STATUS' && payload.orderId) {
        const cleanA = String(activeId).replace(/^#/, '').toUpperCase();
        const cleanPayload = String(payload.orderId).replace(/^#/, '').toUpperCase();
        if (cleanA === cleanPayload || cleanPayload.includes(cleanA) || cleanA.includes(cleanPayload)) {
          const refreshed = getOrder(activeId);
          if (refreshed) setOrder(refreshed);
        }
      }
    });

    // Real-time Firestore listener
    const unsubFirestore = listenToStoreOrdersFromFirestore(currentShopId, (remoteOrders) => {
      remoteOrders.forEach(o => saveOrderToLocal(o));
      const match = getOrder(activeId);
      if (match) {
        setOrder(match);
        setIsSearchingCloud(false);
      }
    });

    if (!order) {
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
      unsubCloud();
      unsubFirestore();
    };
  }, [activeId, order, propShop?.id]);

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
        <Card className="p-8 space-y-4 bg-white border border-[#e5e3df] rounded-[12px] shadow-sm">
          <div className="w-9 h-9 border-3 border-[#5645d4] border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-base font-bold text-[#1a1a1a]">Checking City Cloud Database...</h2>
          <p className="text-xs text-[#787671]">
            Retrieving live counter status and generated bill for <code className="font-mono font-bold text-[#5645d4]">{activeId}</code>
          </p>
        </Card>
      </div>
    );
  }

  // Not found recovery state with interactive search bar
  if (!order) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 space-y-4">
        <Card className="p-8 space-y-5 text-center bg-white border border-[#e5e3df] shadow-sm">
          <div className="w-12 h-12 bg-[#ffe8d4] text-[#dd5b00] rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-[#1a1a1a]">Order Not Found</h2>
            <p className="text-xs text-[#787671] mt-1">
              We couldn't automatically locate an order matching <code className="font-mono font-semibold text-[#1a1a1a]">{activeId}</code>.
            </p>
          </div>

          {/* Interactive Search Box */}
          <div className="pt-2 text-left space-y-2">
            <label className="text-xs font-semibold text-[#37352f] block">
              Search by Order Number or Mobile:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. 1046 or ORD-1046"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchOrder(searchQuery)}
                className="flex-1 px-3 py-2 text-xs border border-[#c8c4be] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#5645d4] font-mono"
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
              <p className="text-xs text-[#e03131] pt-1">{searchError}</p>
            )}
          </div>

          <div className="pt-2 border-t border-[#e5e3df]">
            <Button variant="secondary" onClick={onBackToOrder} className="w-full">
              Back to Print Ordering
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const steps: { key: OrderStatus; label: string; desc: string }[] = [
    { key: 'new', label: 'Order Received', desc: 'Job registered in bookstore queue' },
    { key: 'review', label: 'Shopkeeper Review', desc: 'Checking file format and margins' },
    { key: 'approved', label: 'Approved', desc: 'Verified and queued for print spool' },
    { key: 'printing', label: 'Printing at Counter', desc: 'Hardware feeding paper sheets' },
    { key: 'ready', label: 'Ready for Pickup', desc: 'Finished sheets placed in counter tray' },
    { key: 'completed', label: 'Order Completed', desc: 'Collected by student' },
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
          className="flex items-center gap-1 text-xs font-semibold text-[#5645d4] hover:underline cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>New Print Order</span>
        </button>

        {/* Live sync pulse & refresh */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#787671]">Cloud Live</span>
          <span className="w-2 h-2 rounded-full bg-[#1aae39] animate-pulse" />
        </div>
      </div>

      {/* Quick "Track Another Order #" Search Bar */}
      <div className="no-print bg-white p-3 rounded-[10px] border border-[#e5e3df] shadow-xs flex items-center gap-2">
        <Search className="w-4 h-4 text-[#787671] shrink-0" />
        <input
          type="text"
          placeholder="Track another order # (e.g. 1046)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearchOrder(searchQuery)}
          className="flex-1 text-xs bg-transparent border-none focus:outline-none placeholder:text-[#a4a097] font-mono"
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

      {/* View Switcher: Digital Counter Bill vs Pipeline Status */}
      <div className="no-print flex bg-[#f0eeec] p-1 rounded-[10px] border border-[#e5e3df]">
        <button
          type="button"
          onClick={() => setActiveTab('bill')}
          className={`flex-1 py-2 text-xs font-bold rounded-[8px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'bill'
              ? 'bg-white text-[#0a1530] shadow-xs'
              : 'text-[#787671] hover:text-[#1a1a1a]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-[#5645d4]" />
          <span>Official Counter Bill & Token</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tracker')}
          className={`flex-1 py-2 text-xs font-bold rounded-[8px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'tracker'
              ? 'bg-white text-[#0a1530] shadow-xs'
              : 'text-[#787671] hover:text-[#1a1a1a]'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-[#dd5b00]" />
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
          <Card className="bg-white border-[#e5e3df] p-6 text-center space-y-3 shadow-xs">
            <div className="inline-block">
              <Badge status={order.status} size="md" />
            </div>

            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-[#787671]">Queue Token</span>
              <div className="text-4xl sm:text-5xl font-black text-[#5645d4] tracking-tight font-mono mt-0.5">
                #{order.orderNumber}
              </div>
              <p className="text-xs text-[#5d5b54] font-mono mt-0.5">Order ID: {order.id}</p>
            </div>

            <div className="pt-2">
              {order.status === 'ready' ? (
                <div className="p-3 bg-[#d9f3e1] rounded-[8px] text-[#1aae39] font-bold text-sm">
                  🎉 Your print is ready! Please collect it from the bookstore counter tray.
                </div>
              ) : order.status === 'printing' ? (
                <div className="p-3 bg-[#ffe8d4] rounded-[8px] text-[#dd5b00] font-bold text-sm flex items-center justify-center gap-2">
                  <Printer className="w-4 h-4 animate-bounce" />
                  Your document is actively feeding through the shop's printer.
                </div>
              ) : order.status === 'approved' ? (
                <div className="p-3 bg-[#f0edfa] rounded-[8px] text-[#5645d4] font-bold text-sm flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#5645d4]" />
                  Job Approved! Queued to print next at counter.
                </div>
              ) : order.status === 'review' ? (
                <div className="p-3 bg-[#ffe8d4] rounded-[8px] text-[#dd5b00] text-xs font-medium">
                  ⚠️ Shopkeeper is reviewing your document layout.
                </div>
              ) : order.status === 'cancelled' ? (
                <div className="p-3 bg-[#fde0ec] rounded-[8px] text-[#e03131] text-xs font-semibold">
                  ❌ Order Cancelled or Rejected: {order.rejectionReason || 'Contact counter for details.'}
                </div>
              ) : (
                <p className="text-xs text-[#787671]">
                  Estimated counter wait: <strong className="text-[#1a1a1a]">~2 to 5 minutes</strong>
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
                  Note from Bookstore Owner
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
            <Card className="bg-white border-[#e5e3df] p-5 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#5d5b54] mb-4">
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
                            currentStepIndex > idx ? 'bg-[#5645d4]' : 'bg-[#e5e3df]'
                          }`}
                        />
                      )}

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

          {/* Quick link to view counter bill */}
          <Button
            variant="secondary"
            onClick={() => setActiveTab('bill')}
            className="w-full justify-center text-xs"
            icon={<Sparkles className="w-3.5 h-3.5 text-[#5645d4]" />}
          >
            View & Print Official Counter Bill (#INV-{order.orderNumber})
          </Button>
        </div>
      )}

    </div>
  );
};
