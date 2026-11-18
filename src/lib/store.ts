import type { Shop, Order, OrderStatus } from '../types';
import { getUpiPaymentIssue, isValidUpiId } from './upi';
import { validateShop } from './shopValidation';
import {
  createOrderInFirestore,
  updateOrderPaymentInFirestore,
  updateOrderInFirestore,
} from './firebase';
import { archivePublishedShop, canAccessCounter, hasVerifiedCounter, publishNewShop, removeOrderAttachmentPaths, updatePublishedShop, type PublishedShop } from './supabase';

const SHOPS_KEY = 'qr_print_shops_v1';
const ORDERS_KEY = 'qr_print_orders_v2';
const SYNC_CHANNEL = 'qr_print_sync_channel';

export const INITIAL_SHOPS: Record<string, Shop> = {
  'campus-prints': {
    id: 'campus-prints',
    slug: 'campus-prints',
    name: 'Campus QuickPrint & Stationers',
    tagline: 'Fast, crisp thesis, notes & document printing in 2 minutes',
    location: 'Shop 4, Ground Floor, Academic Complex, North Gate',
    phone: '+91 98765 43210',
    ownerName: 'Ramesh Verma',
    ownerPhone: '+91 98765 43210',
    monthlySubscriptionFee: 499,
    subscriptionStatus: 'active',
    subscriptionRenewDate: new Date(Date.now() + 25 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    isOpen: true,
    openingHours: 'Mon - Sat: 8:30 AM – 9:00 PM',
    pricing: {
      bwPerPage: 2.0,
      colorPerPage: 10.0,
      duplexRateRatio: 0.9,
      paperSizes: [
        { id: 'A4', name: 'A4 (Standard 75 GSM)', multiplier: 1.0 },
        { id: 'Letter', name: 'Letter (8.5" x 11")', multiplier: 1.0 },
        { id: 'Legal', name: 'Legal (Long)', multiplier: 1.25 },
        { id: 'A3', name: 'A3 (Large Ledger)', multiplier: 2.0 },
      ],
    },
    acceptedPaymentModes: ['counter', 'online'],
    retentionMinutes: 10,
    qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=',
  },
  'sri-krishna-xerox': {
    id: 'sri-krishna-xerox',
    slug: 'sri-krishna-xerox',
    name: 'Sri Krishna Xerox & Book Depot',
    tagline: 'High-speed xerox, engineering drawing prints & project binding',
    location: 'Opp. University Main Gate, Gandhi Chowk',
    phone: '+91 98480 12345',
    ownerName: 'K. Srinivas Rao',
    ownerPhone: '+91 98480 12345',
    monthlySubscriptionFee: 499,
    subscriptionStatus: 'active',
    subscriptionRenewDate: new Date(Date.now() + 18 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
    isOpen: true,
    openingHours: 'Mon - Sun: 8:00 AM – 9:30 PM',
    pricing: {
      bwPerPage: 2.0,
      colorPerPage: 8.0,
      duplexRateRatio: 0.9,
      paperSizes: [
        { id: 'A4', name: 'A4 (Standard 75 GSM)', multiplier: 1.0 },
        { id: 'Legal', name: 'Legal (Long)', multiplier: 1.25 },
        { id: 'A3', name: 'A3 (Large Ledger)', multiplier: 2.0 },
      ],
    },
    acceptedPaymentModes: ['counter', 'online'],
    retentionMinutes: 10,
    qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=',
  },
  'balaji-xerox': {
    id: 'balaji-xerox',
    slug: 'balaji-xerox',
    name: 'Balaji Educational Xerox & Spiral Binding',
    tagline: 'Fast colour Xerox, lab manuals & instant assignment printouts',
    location: 'Near Govt Polytechnic College, Line 3',
    phone: '+91 99123 45678',
    ownerName: 'Venkat Raman',
    ownerPhone: '+91 99123 45678',
    monthlySubscriptionFee: 499,
    subscriptionStatus: 'active',
    subscriptionRenewDate: new Date(Date.now() + 22 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    isOpen: true,
    openingHours: 'Mon - Sat: 8:30 AM – 8:30 PM',
    pricing: {
      bwPerPage: 2.0,
      colorPerPage: 10.0,
      duplexRateRatio: 0.85,
      paperSizes: [
        { id: 'A4', name: 'A4 (Standard 75 GSM)', multiplier: 1.0 },
        { id: 'Letter', name: 'Letter (8.5" x 11")', multiplier: 1.0 },
      ],
    },
    acceptedPaymentModes: ['counter', 'online'],
    retentionMinutes: 10,
    qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=',
  },
  'vidyarthi-books': {
    id: 'vidyarthi-books',
    slug: 'vidyarthi-books',
    name: 'Vidyarthi Book Centre & Fast Xerox',
    tagline: 'All university text books, guides & high-volume print counter',
    location: 'Shop 12, Municipal Complex, College Road',
    phone: '+91 97000 88990',
    ownerName: 'P. Suresh Reddy',
    ownerPhone: '+91 97000 88990',
    monthlySubscriptionFee: 599,
    subscriptionStatus: 'trial',
    subscriptionRenewDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    isOpen: true,
    openingHours: 'Mon - Sat: 9:00 AM – 9:00 PM',
    pricing: {
      bwPerPage: 1.5,
      colorPerPage: 8.0,
      duplexRateRatio: 0.9,
      paperSizes: [
        { id: 'A4', name: 'A4 (Standard 75 GSM)', multiplier: 1.0 },
        { id: 'Legal', name: 'Legal (Long)', multiplier: 1.25 },
      ],
    },
    acceptedPaymentModes: ['counter', 'online'],
    retentionMinutes: 10,
    qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=',
  },
};

export const DEFAULT_SHOP: Shop = INITIAL_SHOPS['campus-prints'];


// Audio chime for new incoming orders from phone
// Local device broadcast channel
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(SYNC_CHANNEL);
  }
} catch {}

const listeners = new Set<() => void>();

function notifyLocalUpdate() {
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'STORE_UPDATED', timestamp: Date.now() });
  }
  listeners.forEach(fn => fn());
}

export function getAllShops(): Shop[] {
  try {
    const raw = localStorage.getItem(SHOPS_KEY);
    if (!raw) {
      localStorage.setItem(SHOPS_KEY, JSON.stringify(INITIAL_SHOPS));
      return Object.values(INITIAL_SHOPS);
    }
    const shops: Record<string, Shop> = JSON.parse(raw);
    const list = Object.values(shops);
    if (list.length === 0) {
      localStorage.setItem(SHOPS_KEY, JSON.stringify(INITIAL_SHOPS));
      return Object.values(INITIAL_SHOPS);
    }
    return list;
  } catch (err) {
    console.error('Failed reading all shops from localStorage', err);
    return Object.values(INITIAL_SHOPS);
  }
}

export function getShop(shopIdOrSlug: string = 'campus-prints'): Shop {
  try {
    const shops = getAllShops();
    const found = shops.find(s => s.id === shopIdOrSlug || s.slug === shopIdOrSlug);
    if (found) return found;
  } catch (err) {
    console.error('Failed reading shop from localStorage', err);
  }
  return DEFAULT_SHOP;
}

export function cacheShop(shop: Shop): void {
  try {
    const raw = localStorage.getItem(SHOPS_KEY);
    const shops: Record<string, Shop> = raw ? JSON.parse(raw) : { ...INITIAL_SHOPS };
    shops[shop.id] = shop;
    localStorage.setItem(SHOPS_KEY, JSON.stringify(shops));
    notifyLocalUpdate();
  } catch (err) {
    console.error('Failed saving shop to localStorage', err);
  }
}

export function hydratePublishedShop(row: PublishedShop): Shop {
  const fallback = getAllShops().find(shop => shop.id === row.shop_id) ?? DEFAULT_SHOP;
  const cached = { ...fallback };
  delete cached.loginId;
  delete cached.passwordHash;
  return {
    ...cached,
    ...row.profile,
    ...row.management,
    counterEmail: row.counter_email ?? undefined,
    id: row.shop_id,
    slug: row.shop_id,
  };
}

export async function saveShop(shop: Shop): Promise<void> {
  validateShop(shop);
  if (shop.upiId && !isValidUpiId(shop.upiId)) throw new Error('Enter a valid shop UPI ID.');
  await updatePublishedShop(shop);
  cacheShop(shop);
}

export async function addNewStore(newShopData: Partial<Shop> & { name: string }, counterEmail: string): Promise<Shop> {
  const slug = (newShopData.slug || newShopData.id || newShopData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) || `shop-${Date.now()}`;
  const id = slug;
  
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://print.vercel.app';
  const customerUrl = `${origin}/s/${slug}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(customerUrl)}`;

  const createdShop: Shop = {
    id,
    slug,
    name: newShopData.name,
    tagline: newShopData.tagline || 'High-speed document printing, xerox & binding',
    location: newShopData.location || 'Local Bookstore & Xerox Center',
    phone: newShopData.phone || newShopData.ownerPhone || '',
    ownerName: newShopData.ownerName || 'Store Manager',
    ownerPhone: newShopData.ownerPhone || newShopData.phone || '',
    monthlySubscriptionFee: newShopData.monthlySubscriptionFee ?? 0,
    subscriptionStatus: newShopData.subscriptionStatus || 'active',
    subscriptionRenewDate: newShopData.subscriptionRenewDate || new Date(Date.now() + 30 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    isOpen: true,
    openingHours: newShopData.openingHours || 'Mon - Sat: 8:30 AM – 9:00 PM',
    pricing: newShopData.pricing || {
      bwPerPage: 2.0,
      colorPerPage: 10.0,
      duplexRateRatio: 0.9,
      paperSizes: [
        { id: 'A4', name: 'A4 (Standard 75 GSM)', multiplier: 1.0 },
        { id: 'Letter', name: 'Letter (8.5" x 11")', multiplier: 1.0 },
        { id: 'Legal', name: 'Legal (Long)', multiplier: 1.25 },
        { id: 'A3', name: 'A3 (Large Ledger)', multiplier: 2.0 },
      ],
    },
    acceptedPaymentModes: ['counter', 'online'],
    retentionMinutes: 10,
    qrCodeUrl,
  };

  validateShop(createdShop);
  await publishNewShop(createdShop, counterEmail);
  cacheShop(createdShop);
  return createdShop;
}

export async function deleteStore(shopId: string): Promise<void> {
  await archivePublishedShop(shopId);
  try {
    const raw = localStorage.getItem(SHOPS_KEY);
    const shops: Record<string, Shop> = raw ? JSON.parse(raw) : { ...INITIAL_SHOPS };
    delete shops[shopId];
    localStorage.setItem(SHOPS_KEY, JSON.stringify(shops));
    notifyLocalUpdate();
  } catch (err) {
    console.error('Failed deleting store', err);
  }
}

export function getCityPlatformMetrics(shops = getAllShops()): {
  totalShops: number;
  activeSubscriptions: number;
  monthlyRecurringRevenue: number;
  totalCityOrders: number;
  totalCityGrossSales: number;
  totalCityPagesPrinted: number;
} {
  const orders = getAllOrders();

  const activeSubs = shops.filter(s => s.subscriptionStatus === 'active' || s.subscriptionStatus === 'trial').length;
  const monthlyRecurringRevenue = shops.reduce((sum, s) => {
    return sum + (s.subscriptionStatus === 'active' ? (s.monthlySubscriptionFee ?? 0) : 0);
  }, 0);

  const totalCityGrossSales = orders.filter(o => o.paymentStatus === 'paid' && o.status !== 'cancelled').reduce((sum, o) => sum + (o.config.revisedAmount ?? o.config.subtotal), 0);
  const totalCityPagesPrinted = orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + (o.config?.selectedPageCount || 0) * (o.config?.copies || 1), 0);

  return {
    totalShops: shops.length,
    activeSubscriptions: activeSubs,
    monthlyRecurringRevenue,
    totalCityOrders: orders.length,
    totalCityGrossSales,
    totalCityPagesPrinted,
  };
}

export function clearOrderCache(): void { localStorage.removeItem(ORDERS_KEY); notifyLocalUpdate(); }

export function getAllOrders(): Order[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed reading orders from localStorage', err);
    return [];
  }
}

export function getOrders(shopId?: string): Order[] {
  const all = getAllOrders();
  if (!shopId) return all;
  return all.filter(o => o.shopId === shopId);
}

export function getOrder(orderIdOrNumber: string | number): Order | undefined {
  const all = getAllOrders();
  const raw = String(orderIdOrNumber).trim();
  const cleanId = raw.replace(/^#/, '').toUpperCase();
  const numericOnly = Number(cleanId.replace(/^ORD-/, ''));
  return all.find(o => 
    (o.id && o.id.toUpperCase() === cleanId) || 
    (o.orderNumber && `ORD-${o.orderNumber}`.toUpperCase() === cleanId) ||
    String(o.orderNumber) === cleanId ||
    (!isNaN(numericOnly) && o.orderNumber === numericOnly) ||
    (o.id && o.id.toLowerCase() === raw.toLowerCase())
  );
}

export function saveOrderToLocal(order: Order): void {
  const orders = getAllOrders();
  const index = findOrderIndex(orders, order.id);
  if (index >= 0) {
    orders[index] = { ...orders[index], ...order };
  } else {
    orders.unshift(order);
  }
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  notifyLocalUpdate();
}

function findOrderIndex(orders: Order[], orderIdOrNumber: string | number): number {
  const raw = String(orderIdOrNumber).trim();
  const cleanId = raw.replace(/^#/, '').toUpperCase();
  const numericOnly = Number(cleanId.replace(/^ORD-/, ''));
  return orders.findIndex(o => 
    (o.id && o.id.toUpperCase() === cleanId) || 
    (o.orderNumber && `ORD-${o.orderNumber}`.toUpperCase() === cleanId) ||
    String(o.orderNumber) === cleanId ||
    (!isNaN(numericOnly) && o.orderNumber === numericOnly) ||
    (o.id && o.id.toLowerCase() === raw.toLowerCase())
  );
}

export async function createOrder(orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt' | 'status' | 'statusHistory'>): Promise<Order> {
  const now = new Date().toISOString();

  const newOrder: Order = {
    ...orderData,
    id: crypto.randomUUID(),
    orderNumber: 0,
    status: 'new',
    statusHistory: [{ status: 'new', timestamp: now }],
    createdAt: now,
    updatedAt: now,
  };

  const saved = await createOrderInFirestore(newOrder);
  try { saveOrderToLocal(saved); } catch (error) { console.warn('Order saved online; local cache unavailable:', error); }
  return saved;
}

/** Customer reports a transfer; this never marks a payment as received. */
export async function submitUpiReference(orderId: string, utr: string): Promise<Order> {
  if (!/^\d{12}$/.test(utr.trim())) throw new Error('Enter the 12-digit UPI transaction reference from your payment app.');
  const updated = await updateOrderPaymentInFirestore(orderId, order => {
    const issue = getUpiPaymentIssue(order);
    if (issue) throw new Error(issue);
    if (order.upiPayment!.utr) throw new Error('A reference has already been submitted. Contact the shop to check it.');
    return { paymentStatus: 'pending', upiPayment: { ...order.upiPayment!, utr: utr.trim(), submittedAt: new Date().toISOString() } };
  });
  try { saveOrderToLocal(updated); } catch (error) { console.warn('Payment saved online; local cache unavailable:', error); }
  return updated;
}

/** Manual receipt confirmation by the signed-in shop counter. */
export async function confirmUpiPayment(orderId: string): Promise<Order> {
  const order = getOrder(orderId);
  if (!order) throw new Error('Order not found.');
  if (!(await canAccessCounter(order.shopId))) throw new Error('Sign in to this shop counter to confirm receipt.');
  const updated = await updateOrderPaymentInFirestore(orderId, current => {
    if (current.shopId !== order.shopId) throw new Error('Order shop does not match this counter.');
    const issue = getUpiPaymentIssue(current);
    if (issue) throw new Error(issue);
    if (!current.upiPayment?.utr) throw new Error('Ask the customer for their payment reference first.');
    return { paymentStatus: 'paid', upiPayment: { ...current.upiPayment, confirmedAt: new Date().toISOString() } };
  });
  try { saveOrderToLocal(updated); } catch (error) { console.warn('Payment saved online; local cache unavailable:', error); }
  return updated;
}

function cacheServerOrder(order: Order): Order {
  try { saveOrderToLocal(order); } catch (error) { console.warn('Order saved online; local cache unavailable:', error); }
  return order;
}

async function counterMutation(orderId: string, change: (order: Order) => Partial<Order>): Promise<Order> {
  const cached = getOrder(orderId);
  if (!cached || !(await canAccessCounter(cached.shopId))) throw new Error('Sign in to the shop counter to update this order.');
  return cacheServerOrder(await updateOrderInFirestore(orderId, current => {
    if (current.shopId !== cached.shopId) throw new Error('The order belongs to a different shop.');
    return change(current);
  }));
}

export async function confirmCounterPayment(orderId: string): Promise<Order> {
  return counterMutation(orderId, order => {
    if (order.paymentMode !== 'counter') throw new Error('Verify the UPI reference before confirming this payment.');
    if (order.status === 'cancelled') throw new Error('This order is cancelled.');
    if (order.paymentStatus === 'paid') throw new Error('This payment is already recorded.');
    const now = new Date().toISOString();
    return { paymentStatus: 'paid', paymentReceivedAt: now, statusHistory: [...order.statusHistory, { status: order.status, timestamp: now, note: 'Shop confirmed receipt of payment at the counter.' }] };
  });
}

export async function updateOrderStatus(orderId: string, status: OrderStatus, note?: string): Promise<Order> {
  return counterMutation(orderId, order => {
    if (order.status === 'cancelled') throw new Error('Cancelled orders cannot be restarted.');
    const now = new Date().toISOString();
    return { status, statusHistory: [...order.statusHistory, { status, timestamp: now, ...(note ? { note } : {}) }] };
  });
}

function clearOrderFiles(order: Order) {
  return { fileDataUrl: undefined, fileDownloadUrl: undefined, attachments: order.attachments?.map(({ name, size }) => ({ name, size })) };
}

async function deleteOrderFiles(order: Order): Promise<boolean> {
  if (!(await canAccessCounter(order.shopId))) throw new Error('Counter access is required to remove files.');
  if (!order.attachments && order.fileDownloadUrl) throw new Error('This legacy file needs removal from its original storage provider.');
  return removeOrderAttachmentPaths(order.attachments?.flatMap(file => file.storagePath ? [file.storagePath] : []) ?? []);
}

export async function markOrderDownloaded(orderId: string): Promise<Order> {
  return counterMutation(orderId, order => {
    const now = new Date().toISOString();
    const purgeAt = order.purgeAt || new Date(Date.now() + (getShop(order.shopId).retentionMinutes || 10) * 60000).toISOString();
    return { downloadedAt: now, purgeAt, statusHistory: [...order.statusHistory, { status: order.status, timestamp: now, note: 'Download requested; cleanup timer started.' }] };
  });
}

export async function markOrderPrinted(orderId: string): Promise<Order> {
  return counterMutation(orderId, order => {
    if (order.status === 'cancelled' || order.isPurged) throw new Error('This order can no longer be printed.');
    const now = new Date().toISOString();
    return { status: 'printing', printedAt: now, purgeAt: order.purgeAt || new Date(Date.now() + (getShop(order.shopId).retentionMinutes || 10) * 60000).toISOString(), statusHistory: [...order.statusHistory, { status: 'printing', timestamp: now, note: 'Shop confirmed printing has started.' }] };
  });
}

export async function purgeOrderDocument(orderId: string, reason = 'retention policy'): Promise<Order | undefined> {
  const order = getOrder(orderId);
  if (!order || order.isPurged || !(await deleteOrderFiles(order))) return undefined;
  return counterMutation(orderId, current => ({ ...clearOrderFiles(current), isPurged: true, purgedAt: new Date().toISOString(), statusHistory: [...current.statusHistory, { status: current.status, timestamp: new Date().toISOString(), note: `Original files removed (${reason}).` }] }));
}

const ongoingPurges = new Set<string>();
export function checkAndPurgeExpiredDocuments(): number {
  let scheduled = 0;
  for (const order of getAllOrders()) {
    if (!order.isPurged && order.purgeAt && Date.now() >= Date.parse(order.purgeAt) && hasVerifiedCounter(order.shopId) && !ongoingPurges.has(order.id)) {
      ongoingPurges.add(order.id); scheduled++;
      void purgeOrderDocument(order.id).catch(console.warn).finally(() => ongoingPurges.delete(order.id));
    }
  }
  return scheduled;
}
if (typeof window !== 'undefined') setInterval(checkAndPurgeExpiredDocuments, 10000);

export async function rejectOrder(orderId: string, reason: string): Promise<Order | undefined> {
  const order = getOrder(orderId);
  if (!order || !(await deleteOrderFiles(order))) return undefined;
  return counterMutation(orderId, current => ({ ...clearOrderFiles(current), status: 'cancelled', rejectionReason: reason, isPurged: true, purgedAt: new Date().toISOString(), statusHistory: [...current.statusHistory, { status: 'cancelled', timestamp: new Date().toISOString(), note: `Rejected: ${reason}. Originals removed.` }] }));
}

export async function requestClarification(orderId: string, note: string, newTotal?: number): Promise<Order> {
  if (newTotal !== undefined && (!Number.isFinite(newTotal) || newTotal < 0)) throw new Error('Enter a valid quote amount.');
  return counterMutation(orderId, order => {
    if (order.status === 'cancelled') throw new Error('This order is cancelled.');
    if (newTotal !== undefined && order.paymentStatus === 'paid') throw new Error('This order is paid. Reconcile the payment before changing its quote.');
    return { status: 'review', clarificationNote: note, ...(newTotal === undefined ? {} : { config: { ...order.config, isRevisedQuote: true, revisedAmount: newTotal } }), statusHistory: [...order.statusHistory, { status: 'review', timestamp: new Date().toISOString(), note: newTotal === undefined ? note : `Quote revised to ₹${newTotal.toFixed(2)}: ${note}` }] };
  });
}

export function subscribeToStore(onUpdate: () => void): () => void {
  listeners.add(onUpdate);

  const handleStorage = (e: StorageEvent) => {
    if (e.key === ORDERS_KEY || e.key === SHOPS_KEY) {
      onUpdate();
    }
  };

  const handleBroadcast = (e: MessageEvent) => {
    if (e.data?.type === 'STORE_UPDATED') {
      onUpdate();
    }
  };

  window.addEventListener('storage', handleStorage);
  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcast);
  }

  return () => {
    listeners.delete(onUpdate);
    window.removeEventListener('storage', handleStorage);
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcast);
    }
  };
}
