import React, { useState, useEffect } from 'react';
import {
  Search,
  Download,
  Printer,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileText,
  MessageSquare,
  Trash2,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { RejectOrderModal } from './RejectOrderModal';
import { ClarifyOrderModal } from './ClarifyOrderModal';
import { PrintHandoffModal } from './PrintHandoffModal';
import { DigitalCounterBill } from '../customer/DigitalCounterBill';
import {
  getOrders,
  updateOrderStatus,
  rejectOrder,
  requestClarification,
  reviseOrderQuote,
  markOrderDownloaded,
  markOrderPrinted,
  purgeOrderDocument,
  subscribeToStore,
  saveOrderToLocal,
} from '../../lib/store';
import { listenToStoreOrdersFromFirestore } from '../../lib/firebase';
import { listenToCloud } from '../../lib/cloudSync';
import { getOrderAttachments, saveAttachment, type DownloadableAttachment } from '../../lib/orderAttachments';
import type { Order, OrderStatus, Shop } from '../../types';

interface ShopDashboardProps {
  shop: Shop;
}

// Live Countdown Badge Component
const PurgeTimerBadge: React.FC<{ order: Order }> = ({ order }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (order.isPurged) {
      return;
    }
    if (!order.purgeAt) {
      return;
    }

    const updateTimer = () => {
      const diff = new Date(order.purgeAt!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Purging now...');
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}m ${secs < 10 ? '0' : ''}${secs}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [order.isPurged, order.purgeAt]);

  if (order.isPurged) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#b0b0b0] bg-[#303030] px-2 py-0.5 rounded-full border border-[#606060]/40">
        <Trash2 className="w-3 h-3 text-[#969696]" />
        <span>PDF Purged (Cleaned)</span>
      </span>
    );
  }

  if (order.purgeAt) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#f3ba83] bg-[#3c2b22] px-2 py-0.5 rounded-full border border-[#dd5b00]/30 animate-pulse">
        <Clock className="w-3 h-3" />
        <span>Purges in {timeLeft}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-[#b0b0b0] bg-[#1c1c1c] px-2 py-0.5 rounded-full">
      <ShieldCheck className="w-3 h-3 text-[#6ed5a3]" />
      <span>10m purge on download/print</span>
    </span>
  );
};

export const ShopDashboard: React.FC<ShopDashboardProps> = ({ shop }) => {
  const [orders, setOrders] = useState<Order[]>(() => getOrders(shop.id));
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs_action' | 'printing' | 'ready' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [orderToReject, setOrderToReject] = useState<Order | null>(null);
  const [orderToClarify, setOrderToClarify] = useState<Order | null>(null);
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);
  const [orderToViewBill, setOrderToViewBill] = useState<Order | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Real-time synchronization across devices (Firestore + Cloud SSE + local storage)
  useEffect(() => {
    // 1. Cross-tab storage updates
    const unsubStore = subscribeToStore(() => {
      setOrders(getOrders(shop.id));
    });

    // 2. Real-time Firestore orders listener for this bookstore
    const unsubFirestore = listenToStoreOrdersFromFirestore(shop.id, (firestoreOrders) => {
      firestoreOrders.forEach(o => saveOrderToLocal(o));
      setOrders(getOrders(shop.id));
    });

    // 3. Real-time Cloud SSE listener
    const unsubCloud = listenToCloud(shop.id, (payload) => {
      if (payload.action === 'CREATE_ORDER' && payload.order) {
        saveOrderToLocal(payload.order);
        setOrders(getOrders(shop.id));
        showToast(`🔔 New Order #${payload.order.orderNumber} received from ${payload.order.customerName}!`);
      } else if (payload.action === 'UPDATE_STATUS' && payload.orderId) {
        setOrders(getOrders(shop.id));
      }
    });

    return () => {
      unsubStore();
      unsubFirestore();
      unsubCloud();
    };
  }, [shop.id]);

  useEffect(() => {
    if (!selectedOrderId && orders.length > 0) {
      setSelectedOrderId(orders[0].id);
    }
  }, [orders, selectedOrderId]);

  const selectedOrder = orders.find(o => o.id === selectedOrderId) || orders[0];
  const attachments = selectedOrder ? getOrderAttachments(selectedOrder) : [];
  const availableAttachments = attachments.filter(file => file.storagePath || file.legacyUrl);
  const isDownloading = downloadingOrderId === selectedOrder?.id;

  // Filtering
  const filteredOrders = orders.filter(order => {
    if (statusFilter === 'needs_action' && !['new', 'review'].includes(order.status)) return false;
    if (statusFilter === 'printing' && !['approved', 'printing'].includes(order.status)) return false;
    if (statusFilter === 'ready' && order.status !== 'ready') return false;
    if (statusFilter === 'completed' && !['completed', 'cancelled'].includes(order.status)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = order.customerName.toLowerCase().includes(q);
      const matchFile = order.fileName.toLowerCase().includes(q) ||
        getOrderAttachments(order).some(file => file.name.toLowerCase().includes(q));
      const matchNum = order.orderNumber.toString().includes(q);
      const matchPhone = order.customerPhone.includes(q);
      if (!matchName && !matchFile && !matchNum && !matchPhone) return false;
    }

    return true;
  });

  const handleStatusChange = (orderId: string, status: OrderStatus, note?: string) => {
    const updated = updateOrderStatus(orderId, status, note);
    const refreshed = getOrders(shop.id);
    setOrders(refreshed);
    const target = refreshed.find(o => o.id === orderId) || updated;
    const num = target ? `#${target.orderNumber}` : orderId;
    const statusLabels: Record<OrderStatus, string> = {
      new: 'New in Queue',
      review: 'Under Review',
      approved: 'Approved for Printing',
      printing: 'Printing at Counter',
      ready: 'Ready for Pickup',
      completed: 'Completed',
      cancelled: 'Cancelled / Rejected',
    };
    showToast(`Order ${num} updated: ${statusLabels[status] || status}`);
  };

  const handleDownloadFiles = async (order: Order, files: DownloadableAttachment[]) => {
    if (order.isPurged || downloadingOrderId || !files.length) return;
    setDownloadingOrderId(order.id);
    try {
      const results = await Promise.allSettled(files.map(saveAttachment));
      const failures = files.filter((_, index) => results[index].status === 'rejected');
      if (failures.length) {
        showToast(`Could not download ${failures.map(file => file.name).join(', ')}. Retry from the file list.`);
      } else {
        markOrderDownloaded(order.id);
      }
    } finally {
      setDownloadingOrderId(null);
    }
  };

  const handleManualPurge = async (orderId: string) => {
    if (!window.confirm('Delete the order files now? The receipt will remain.')) return;
    try {
      if (!(await purgeOrderDocument(orderId, 'Manual shopkeeper clean'))) {
        showToast('Could not delete the order files. Please try again.');
      }
    } catch {
      showToast('Could not delete the order files. Please try again.');
    }
  };

  const selectOrder = (id: string) => {
    setSelectedOrderId(id);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => document.getElementById('order-inspector')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
    }
  };

  // Summary Metrics
  const countNew = orders.filter(o => o.status === 'new').length;
  const countPrinting = orders.filter(o => o.status === 'printing').length;
  const countReady = orders.filter(o => o.status === 'ready').length;
  const totalRevenue = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (o.config.revisedAmount || o.config.subtotal), 0);

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      
      <section className="workspace-intro"><p className="eyebrow">THE COUNTER</p><h1>Every detail. In order.</h1><p>Manage the queue and download each customer document.</p></section>
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-[#242424] p-4 border-[#3d3d3d]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#b0b0b0]">New & Queued</span>
          <div className="text-2xl font-bold text-[#ff8278] mt-1 flex items-center gap-2">
            <span>{countNew}</span>
            {countNew > 0 && <span className="w-2 h-2 rounded-full bg-[#da291c] animate-ping" />}
          </div>
          <span className="text-[10px] text-[#969696]">Awaiting shop check</span>
        </Card>

        <Card className="bg-[#242424] p-4 border-[#3d3d3d]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#b0b0b0]">Printing Now</span>
          <div className="text-2xl font-bold text-[#f3ba83] mt-1">{countPrinting}</div>
          <span className="text-[10px] text-[#969696]">In hardware spool</span>
        </Card>

        <Card className="bg-[#242424] p-4 border-[#3d3d3d]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#b0b0b0]">Ready at Counter</span>
          <div className="text-2xl font-bold text-[#6ed5a3] mt-1">{countReady}</div>
          <span className="text-[10px] text-[#969696]">Awaiting customer pickup</span>
        </Card>

        <Card className="bg-[#242424] p-4 border-[#3d3d3d]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#b0b0b0]">Queue Value</span>
          <div className="text-2xl font-bold text-[#ffffff] mt-1">₹{totalRevenue.toFixed(0)}</div>
          <span className="text-[10px] text-[#969696]">Excludes cancelled</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#242424] p-3 rounded-none border border-[#3d3d3d]">
        
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all shrink-0 cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#181818] text-white'
                : 'text-[#bcbcbc] hover:bg-[#1c1c1c]'
            }`}
          >
            All ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('needs_action')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all shrink-0 cursor-pointer ${
              statusFilter === 'needs_action'
                ? 'bg-[#181818] text-white'
                : 'text-[#bcbcbc] hover:bg-[#1c1c1c]'
            }`}
          >
            Needs Action ({orders.filter(o => ['new', 'review'].includes(o.status)).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('printing')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all shrink-0 cursor-pointer ${
              statusFilter === 'printing'
                ? 'bg-[#181818] text-white'
                : 'text-[#bcbcbc] hover:bg-[#1c1c1c]'
            }`}
          >
            Printing ({orders.filter(o => ['approved', 'printing'].includes(o.status)).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ready')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all shrink-0 cursor-pointer ${
              statusFilter === 'ready'
                ? 'bg-[#181818] text-white'
                : 'text-[#bcbcbc] hover:bg-[#1c1c1c]'
            }`}
          >
            Ready ({orders.filter(o => o.status === 'ready').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all shrink-0 cursor-pointer ${
              statusFilter === 'completed'
                ? 'bg-[#181818] text-white'
                : 'text-[#bcbcbc] hover:bg-[#1c1c1c]'
            }`}
          >
            Archive ({orders.filter(o => ['completed', 'cancelled'].includes(o.status)).length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#b0b0b0] absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, order #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-3 text-xs bg-[#1c1c1c] rounded-none border border-[#3d3d3d] focus:border-[#da291c] focus:bg-[#242424] outline-none"
          />
        </div>

      </div>

      {/* Main Split Layout: Orders Queue (Left) & Inspector Drawer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Orders Queue (7 Cols on desktop) */}
        <div id="order-queue" className="lg:col-span-7 space-y-2.5 scroll-mt-44">
          {filteredOrders.length === 0 ? (
            <Card className="p-8 text-center bg-[#242424] border-[#3d3d3d]">
              <p className="text-sm font-semibold text-[#ffffff]">No orders found</p>
              <p className="text-xs text-[#b0b0b0] mt-1">Try selecting a different filter or clearing search.</p>
            </Card>
          ) : (
            filteredOrders.map(order => {
              const isSelected = selectedOrder?.id === order.id;

              return (
                <div
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`Open order ${order.orderNumber} for ${order.customerName}`}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectOrder(order.id); } }}
                  onClick={() => selectOrder(order.id)}
                  className={`p-4 rounded-none border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#242424] border-[#da291c] ring-2 ring-[#da291c]/20 shadow-none'
                      : 'bg-[#242424] border-[#3d3d3d] hover:border-[#606060] hover:bg-[#303030]'
                  }`}
                >
                  <div className="flex flex-wrap sm:flex-nowrap items-start justify-between gap-3">
                    
                    {/* Order Reference & Customer */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-none bg-[#1c1c1c] border border-[#3d3d3d] flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] uppercase font-mono font-bold text-[#b0b0b0]">Queue</span>
                        <span className="text-xs font-mono font-bold text-[#ffffff]">#{order.orderNumber}</span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h4 className="text-sm font-bold text-[#ffffff] truncate">
                            {order.customerName}
                          </h4>
                          <span className="text-[11px] text-[#b0b0b0] shrink-0">
                            {order.customerPhone}
                          </span>
                        </div>

                        <p className="text-xs text-[#bcbcbc] truncate mt-0.5 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-[#ff8278] shrink-0" />
                          <span className="truncate">{order.fileName}</span>
                        </p>

                        <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px]">
                          <span className="font-semibold text-[#ffffff]">
                            {order.config.selectedPageCount} pgs ({order.config.sheetsNeeded} sheets)
                          </span>
                          <span>•</span>
                          <span className={order.config.colorMode === 'color' ? 'text-[#ff8278] font-semibold' : 'text-[#bcbcbc]'}>
                            {order.config.colorMode.toUpperCase()}
                          </span>
                          <span>•</span>
                          <span className="text-[#bcbcbc]">
                            {order.config.sides === 'duplex' ? 'Duplex' : 'Single'}
                          </span>
                          <span>•</span>
                          <PurgeTimerBadge order={order} />
                        </div>
                      </div>
                    </div>

                    {/* Status & Price */}
                    <div className="text-right shrink-0 space-y-1">
                      <Badge status={order.status} size="sm" />
                      <div className="text-base font-bold text-[#ffffff]">
                        ₹{(order.config.revisedAmount || order.config.subtotal).toFixed(2)}
                      </div>
                      <span className={`text-[10px] font-medium block ${
                        order.paymentStatus === 'paid' ? 'text-[#6ed5a3]' : 'text-[#f3ba83]'
                      }`}>
                        {order.paymentStatus === 'paid' ? 'Paid Online' : 'Pay at Counter'}
                      </span>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Inspector Drawer (5 Cols on desktop) */}
        <div id="order-inspector" className="lg:col-span-5 lg:sticky lg:top-24 scroll-mt-44 lg:scroll-mt-24">
          <button type="button" className="mb-3 text-xs text-[#bcbcbc] underline underline-offset-4 lg:hidden" onClick={() => document.getElementById('order-queue')?.scrollIntoView({block: 'start'})}>Back to order queue</button>
          {selectedOrder ? (
            <Card className="bg-[#242424] border-[#3d3d3d] p-5 space-y-5 shadow-none">
              
              {/* Header */}
              <div className="flex items-start justify-between border-b border-[#3d3d3d] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#ff8278] bg-[#303030] px-2 py-0.5 rounded">
                      #{selectedOrder.orderNumber}
                    </span>
                    <Badge status={selectedOrder.status} size="sm" />
                  </div>
                  <h3 className="text-lg font-bold text-[#ffffff] mt-1.5">
                    {selectedOrder.customerName}
                  </h3>
                  <p className="text-xs text-[#b0b0b0]">{selectedOrder.customerPhone}</p>
                </div>

                {/* WhatsApp Quick Message Link */}
                <a
                  href={`https://wa.me/${selectedOrder.customerPhone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(selectedOrder.customerName)},%20your%20print%20order%20%23${selectedOrder.orderNumber}%20at%20${encodeURIComponent(shop.name)}%20is%20being%20processed.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[#6ed5a3] hover:bg-[#163529] p-2 rounded-none border border-[#1aae39]/30 transition-colors"
                  title="Message customer via WhatsApp"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="font-semibold">WhatsApp</span>
                </a>
              </div>

              {/* 10-Minute Auto-Purge Alert Banner */}
              <div className={`p-3 rounded-none border text-xs flex items-center justify-between ${
                selectedOrder.isPurged
                  ? 'bg-[#303030] border-[#606060] text-[#bcbcbc]'
                  : selectedOrder.purgeAt
                  ? 'bg-[#3c2b22] border-[#dd5b00]/40 text-[#bcbcbc]'
                  : 'bg-[#163529] border-[#1aae39]/30 text-[#6ed5a3]'
              }`}>
                <div className="flex items-center gap-2">
                  {selectedOrder.isPurged ? (
                    <Trash2 className="w-4 h-4 text-[#b0b0b0] shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 shrink-0" />
                  )}
                  <div>
                    <strong className="block">
                      {selectedOrder.isPurged
                        ? 'PDF Cleared from Database'
                        : selectedOrder.purgeAt
                        ? '10-Minute Auto-Purge Armed'
                        : '10-Minute Auto-Purge Ready'}
                    </strong>
                    <span className="text-[11px]">
                      {selectedOrder.isPurged
                        ? 'Document binary safely deleted to clear storage.'
                        : selectedOrder.purgeAt
                        ? 'The signed-in counter removes files after the 10-minute countdown.'
                        : 'Triggered automatically when downloaded or printed.'}
                    </span>
                  </div>
                </div>

                {!selectedOrder.isPurged && (
                  <button
                    type="button"
                    onClick={() => handleManualPurge(selectedOrder.id)}
                    className="p-1.5 hover:bg-black/10 rounded text-xs font-semibold cursor-pointer shrink-0"
                    title="Purge PDF right now to immediately clear space"
                  >
                    Purge Now
                  </button>
                )}
              </div>

              {/* Special Customer Notes (if provided) */}
              {selectedOrder.customerNotes && (
                <div className="p-3 bg-[#303030] rounded-none border border-[#f5d75e]/60 text-xs text-[#f3ba83]">
                  <strong className="block font-semibold mb-0.5">Customer Instructions:</strong>
                  "{selectedOrder.customerNotes}"
                </div>
              )}

              {/* Clarification Notice (if active) */}
              {selectedOrder.clarificationNote && (
                <div className="p-3 bg-[#3c2b22] rounded-none border border-[#dd5b00]/30 text-xs text-[#bcbcbc]">
                  <strong className="block font-semibold mb-0.5">Active Shop Note:</strong>
                  "{selectedOrder.clarificationNote}"
                </div>
              )}

              <section aria-label="Uploaded files" className="rounded-none border border-[#3d3d3d] bg-[#242424]">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <h4 className="text-xs font-semibold text-[#dedede]">
                    Uploaded files ({attachments.length})
                  </h4>
                  {!selectedOrder.isPurged && availableAttachments.length > 1 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleDownloadFiles(selectedOrder, availableAttachments)}
                      icon={<Download className="w-3.5 h-3.5" />}
                      disabled={Boolean(downloadingOrderId)}
                    >
                      {isDownloading ? 'Downloading…' : 'Download All'}
                    </Button>
                  )}
                </div>
                <ul aria-label="Order files" className="divide-y divide-[#3d3d3d] border-t border-[#3d3d3d]">
                  {attachments.map((file, index) => (
                    <li key={file.storagePath ?? index} className="flex min-h-11 items-center justify-between gap-3 px-3 py-1.5">
                      <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-[#ffffff]">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-[#b0b0b0]" aria-hidden="true" />
                        <span className="min-w-0 break-all">{file.name}</span>
                      </span>
                      {!selectedOrder.isPurged && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="shrink-0"
                          disabled={Boolean(downloadingOrderId) || (!file.storagePath && !file.legacyUrl)}
                          onClick={() => void handleDownloadFiles(selectedOrder, [file])}
                          aria-label={`Download ${file.name}`}
                          icon={<Download className="w-3.5 h-3.5" />}
                        >
                          Download
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                {!selectedOrder.attachments && / \(\+\d+ more docs\)$/.test(selectedOrder.fileName) && (
                  <p className="px-3 pb-2 text-xs text-[#b0b0b0]">This older order is missing files. Ask the customer to resend the full set.</p>
                )}
              </section>

              {/* Document Specs Matrix */}
              <div className="space-y-2 text-xs">
                <span className="font-bold uppercase tracking-wider text-[#b0b0b0] text-[10px] block">
                  Print Specifications
                </span>

                <div className="p-3 bg-[#1c1c1c] rounded-none border border-[#3d3d3d] space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[#b0b0b0]">Selected Range:</span>
                    <span className="font-bold text-[#ffffff]">{selectedOrder.config.customPageRange} ({selectedOrder.config.selectedPageCount} pgs)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#b0b0b0]">Paper & Sides:</span>
                    <span className="font-bold text-[#ff8278]">
                      {selectedOrder.config.paperSize} • {selectedOrder.config.sides === 'duplex' ? 'Double-Sided (Duplex)' : 'Single-Sided'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#b0b0b0]">Color Mode:</span>
                    <span className="font-bold text-[#ffffff]">{selectedOrder.config.colorMode.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#b0b0b0]">Physical Sheets:</span>
                    <span className="font-bold text-[#ffffff]">{selectedOrder.config.sheetsNeeded} sheets</span>
                  </div>
                </div>
              </div>

              {/* Price & Payment Breakdown */}
              <div className="p-3 bg-[#1c1c1c] rounded-none border border-[#3d3d3d] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#b0b0b0]">Total Amount</span>
                  <div className="text-xl font-extrabold text-[#ffffff]">
                    ₹{(selectedOrder.config.revisedAmount || selectedOrder.config.subtotal).toFixed(2)}
                  </div>
                  {selectedOrder.config.isRevisedQuote && (
                    <span className="text-[10px] text-[#f3ba83] font-semibold">(Revised quote)</span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-[#b0b0b0]">Payment Mode</span>
                  <div className={`text-xs font-bold ${selectedOrder.paymentStatus === 'paid' ? 'text-[#6ed5a3]' : 'text-[#f3ba83]'}`}>
                    {selectedOrder.paymentStatus === 'paid' ? 'PAID ONLINE [SANDBOX]' : 'PAY AT COUNTER'}
                  </div>
                </div>
              </div>

              {/* Core Workflow Actions */}
              <div className="space-y-2 pt-2 border-t border-[#3d3d3d]">
                
                <div className="flex">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setOrderToPrint(selectedOrder)}
                    icon={<Printer className="w-4 h-4" />}
                    disabled={selectedOrder.status === 'cancelled' || selectedOrder.isPurged || !availableAttachments.length}
                  >
                    {selectedOrder.isPurged ? 'PDF Purged' : 'Print via Browser'}
                  </Button>

                </div>

                {selectedOrder.isPurged && (
                  <p className="text-[11px] text-[#b0b0b0] text-center pt-1">
                    The order files are unavailable. The receipt is still available.
                  </p>
                )}

                {/* Status progression triggers */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {['new', 'review'].includes(selectedOrder.status) && (
                    <Button
                      variant="dark"
                      size="sm"
                      onClick={() => handleStatusChange(selectedOrder.id, 'approved', 'Shop verified document')}
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    >
                      Approve Job
                    </Button>
                  )}

                  {selectedOrder.status === 'approved' && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6ed5a3] bg-[#163529] px-3 py-1.5 rounded-none">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>✓ Job Approved</span>
                    </div>
                  )}

                  {['new', 'review', 'approved'].includes(selectedOrder.status) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleStatusChange(selectedOrder.id, 'printing', 'Hardware spool started')}
                    >
                      Mark Printing
                    </Button>
                  )}

                  {selectedOrder.status === 'printing' && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="bg-[#1aae39] hover:bg-[#169431]"
                      onClick={() => handleStatusChange(selectedOrder.id, 'ready', 'Print finished, in counter tray')}
                    >
                      Mark Ready for Pickup
                    </Button>
                  )}

                  {selectedOrder.status === 'ready' && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="bg-[#1aae39] hover:bg-[#169431]"
                      onClick={() => handleStatusChange(selectedOrder.id, 'completed', 'Picked up by customer')}
                    >
                      Mark Completed
                    </Button>
                  )}

                  {/* View Customer Bill */}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-xs text-[#ff8278]"
                    onClick={() => setOrderToViewBill(selectedOrder)}
                    icon={<FileText className="w-3.5 h-3.5 text-[#ff8278]" />}
                  >
                    View Bill (#INV-{selectedOrder.orderNumber})
                  </Button>

                  {/* Clarify button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-[#f3ba83]"
                    onClick={() => setOrderToClarify(selectedOrder)}
                    icon={<HelpCircle className="w-3.5 h-3.5" />}
                  >
                    Clarify / Revise Quote
                  </Button>

                  {/* Reject button */}
                  {selectedOrder.status !== 'cancelled' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-[#ff8278]"
                      onClick={() => setOrderToReject(selectedOrder)}
                      icon={<XCircle className="w-3.5 h-3.5" />}
                    >
                      Reject Order
                    </Button>
                  )}
                </div>

              </div>

              {/* Status History Timeline */}
              <div className="border-t border-[#3d3d3d] pt-3">
                <span className="text-[10px] uppercase font-bold text-[#b0b0b0] block mb-2">Activity Audit Log</span>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {selectedOrder.statusHistory.map((h, i) => (
                    <div key={i} className="text-[11px] text-[#bcbcbc] flex justify-between">
                      <span className="font-semibold capitalize text-[#ffffff]">{h.status}:</span>
                      <span className="text-[#969696]">{new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
              </div>

            </Card>
          ) : (
            <Card className="p-8 text-center text-[#b0b0b0] bg-[#242424] border-[#3d3d3d]">
              Select an order from the queue to review details.
            </Card>
          )}
        </div>

      </div>

      {/* Reject Modal */}
      {orderToReject && (
        <RejectOrderModal
          orderNumber={orderToReject.orderNumber}
          onClose={() => setOrderToReject(null)}
          onConfirm={async (reason) => {
            try {
              if (await rejectOrder(orderToReject.id, reason)) {
                setOrderToReject(null);
                return;
              }
            } catch (error) {
              console.warn('Could not reject order:', error);
            }
            showToast('Could not reject the order. Please try again.');
          }}
        />
      )}

      {/* Clarify / Revise Modal */}
      {orderToClarify && (
        <ClarifyOrderModal
          orderNumber={orderToClarify.orderNumber}
          currentAmount={orderToClarify.config.revisedAmount || orderToClarify.config.subtotal}
          onClose={() => setOrderToClarify(null)}
          onConfirm={(note, revisedAmount) => {
            if (revisedAmount !== undefined) {
              reviseOrderQuote(orderToClarify.id, revisedAmount, note);
            }
            requestClarification(orderToClarify.id, note);
            setOrderToClarify(null);
          }}
        />
      )}

      {/* Print Handoff Modal */}
      {orderToPrint && (
        <PrintHandoffModal
          order={orderToPrint}
          onClose={() => setOrderToPrint(null)}
          onConfirmPrint={() => {
            markOrderPrinted(orderToPrint.id);
            const refreshed = getOrders(shop.id);
            setOrders(refreshed);
            setOrderToPrint(null);
            showToast(`🖨️ Order #${orderToPrint.orderNumber} sent to printer! 10m auto-purge active.`);
          }}
        />
      )}

      {/* Official Counter Bill Modal for Shopkeeper */}
      {orderToViewBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#242424] rounded-none max-w-xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[#3d3d3d]">
              <h3 className="font-bold text-sm text-[#ffffff]">Official Digital Counter Receipt</h3>
              <button
                type="button"
                onClick={() => setOrderToViewBill(null)}
                className="text-[#b0b0b0] hover:text-[#ffffff] text-xs font-semibold p-1.5 cursor-pointer hover:bg-[#303030] rounded"
              >
                ✕ Close
              </button>
            </div>
            <DigitalCounterBill
              order={orderToViewBill}
              shop={shop}
            />
          </div>
        </div>
      )}

      {/* Floating Status Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-5 z-50 bg-[#181818] text-white px-4 py-2.5 rounded-none shadow-none border border-white/20 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#6ed5a3]" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
};
