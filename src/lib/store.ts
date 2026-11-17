import type { Shop, Order, OrderStatus } from '../types';
import { generateMinimalPdf } from './samplePdf';
import {
  broadcastToCloud,
  listenToCloud,
  fetchRecentCloudOrders,
  type CloudPayload,
} from './cloudSync';
import {
  syncOrderToFirestore,
  syncShopToFirestore,
  listenToAllCityOrdersFromFirestore,
} from './firebase';

const SHOPS_KEY = 'qr_print_shops_v1';
const ORDERS_KEY = 'qr_print_orders_v1';
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
    loginId: 'campus',
    passwordHash: '1234',
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
    loginId: 'krishna',
    passwordHash: '2345',
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
    loginId: 'balaji',
    passwordHash: '3456',
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
    loginId: 'vidyarthi',
    passwordHash: '4567',
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

const INITIAL_ORDERS: Order[] = [
  {
    id: 'ORD-1040',
    orderNumber: 1040,
    shopId: 'campus-prints',
    customerName: 'Aarav Sharma',
    customerPhone: '+91 98112 34567',
    customerNotes: 'Please staple in top left corner if possible.',
    fileName: 'Operating_Systems_Lecture_Notes_Ch1_4.pdf',
    fileSize: 2450000,
    fileDataUrl: generateMinimalPdf('Operating Systems Lecture Notes', 14),
    detectedPageCount: 14,
    config: {
      copies: 1,
      colorMode: 'bw',
      paperSize: 'A4',
      sides: 'duplex',
      pageRangeType: 'all',
      customPageRange: '1-14',
      selectedPageCount: 14,
      sheetsNeeded: 7,
      unitPricePerPage: 1.8,
      subtotal: 25.2,
    },
    paymentMode: 'counter',
    paymentStatus: 'pay_at_counter',
    status: 'new',
    statusHistory: [
      { status: 'new', timestamp: new Date(Date.now() - 6 * 60000).toISOString() },
    ],
    createdAt: new Date(Date.now() - 6 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 60000).toISOString(),
  },
  {
    id: 'ORD-1039',
    orderNumber: 1039,
    shopId: 'campus-prints',
    customerName: 'Priya Patel',
    customerPhone: '+91 98223 45678',
    customerNotes: 'Color cover only, rest BW if feasible? Submitted as full color for safety.',
    fileName: 'Final_Year_Project_Proposal_Draft.pdf',
    fileSize: 4120000,
    fileDataUrl: generateMinimalPdf('Final Year Project Proposal', 8),
    detectedPageCount: 8,
    config: {
      copies: 2,
      colorMode: 'color',
      paperSize: 'A4',
      sides: 'single',
      pageRangeType: 'all',
      customPageRange: '1-8',
      selectedPageCount: 8,
      sheetsNeeded: 8,
      unitPricePerPage: 10.0,
      subtotal: 160.0,
    },
    paymentMode: 'online',
    paymentStatus: 'paid',
    status: 'review',
    statusHistory: [
      { status: 'new', timestamp: new Date(Date.now() - 15 * 60000).toISOString() },
      { status: 'review', timestamp: new Date(Date.now() - 10 * 60000).toISOString(), note: 'Reviewing color balance request' },
    ],
    clarificationNote: 'Cover page is color (₹10), pages 2-8 can be B&W (₹2). Total would be ₹24 per copy instead of ₹80! Confirm at counter.',
    createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60000).toISOString(),
  },
  {
    id: 'ORD-1045',
    orderNumber: 1045,
    shopId: 'sri-krishna-xerox',
    customerName: 'K. Varun Sharma',
    customerPhone: '+91 79898 69191',
    fileName: 'Operating_System_Complete_Notes.pdf',
    fileSize: 2200000,
    fileDataUrl: generateMinimalPdf('Operating System Complete Notes', 11),
    detectedPageCount: 11,
    config: {
      copies: 1,
      colorMode: 'bw',
      paperSize: 'A4',
      sides: 'single',
      pageRangeType: 'all',
      customPageRange: '1-11',
      selectedPageCount: 11,
      sheetsNeeded: 11,
      unitPricePerPage: 1.80,
      subtotal: 19.80,
    },
    paymentMode: 'counter',
    paymentStatus: 'pay_at_counter',
    status: 'new',
    statusHistory: [
      { status: 'new', timestamp: new Date(Date.now() - 3 * 60000).toISOString() },
    ],
    createdAt: new Date(Date.now() - 3 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 60000).toISOString(),
  },
  {
    id: 'ORD-1044',
    orderNumber: 1044,
    shopId: 'sri-krishna-xerox',
    customerName: 'Sneha Rao',
    customerPhone: '+91 98450 12345',
    fileName: 'Project_Seminar_Slides_Print.pdf',
    fileSize: 3400000,
    fileDataUrl: generateMinimalPdf('Seminar Presentation Slides', 8),
    detectedPageCount: 8,
    config: {
      copies: 2,
      colorMode: 'color',
      paperSize: 'A4',
      sides: 'duplex',
      pageRangeType: 'all',
      customPageRange: '1-8',
      selectedPageCount: 8,
      sheetsNeeded: 8,
      unitPricePerPage: 7.20,
      subtotal: 57.60,
    },
    paymentMode: 'counter',
    paymentStatus: 'pay_at_counter',
    status: 'review',
    clarificationNote: 'Cover slide in Color (₹8), remaining 7 slides B&W (₹1.80). Confirm at counter to save ₹40.',
    statusHistory: [
      { status: 'new', timestamp: new Date(Date.now() - 12 * 60000).toISOString() },
      { status: 'review', timestamp: new Date(Date.now() - 8 * 60000).toISOString() },
    ],
    createdAt: new Date(Date.now() - 12 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 60000).toISOString(),
  },
  {
    id: 'ORD-1043',
    orderNumber: 1043,
    shopId: 'sri-krishna-xerox',
    customerName: 'Rohan Kumar',
    customerPhone: '+91 97012 34567',
    fileName: 'Mathematics_Assignment_Unit_4.pdf',
    fileSize: 1400000,
    fileDataUrl: generateMinimalPdf('Mathematics Unit 4 Assignment', 6),
    detectedPageCount: 6,
    config: {
      copies: 1,
      colorMode: 'bw',
      paperSize: 'A4',
      sides: 'duplex',
      pageRangeType: 'all',
      customPageRange: '1-6',
      selectedPageCount: 6,
      sheetsNeeded: 3,
      unitPricePerPage: 1.62,
      subtotal: 9.72,
    },
    paymentMode: 'counter',
    paymentStatus: 'pay_at_counter',
    status: 'approved',
    statusHistory: [
      { status: 'new', timestamp: new Date(Date.now() - 20 * 60000).toISOString() },
      { status: 'approved', timestamp: new Date(Date.now() - 10 * 60000).toISOString(), note: 'Verified margins by counter' },
    ],
    createdAt: new Date(Date.now() - 20 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60000).toISOString(),
  },
  {
    id: 'ORD-1038',
    orderNumber: 1038,
    shopId: 'sri-krishna-xerox',
    customerName: 'Rahul Verma',
    customerPhone: '+91 98334 56789',
    fileName: 'Lab_Report_Sem6_Digital_Electronics.pdf',
    fileSize: 1180000,
    fileDataUrl: generateMinimalPdf('Digital Electronics Lab Report', 5),
    detectedPageCount: 5,
    config: {
      copies: 1,
      colorMode: 'bw',
      paperSize: 'A4',
      sides: 'single',
      pageRangeType: 'all',
      customPageRange: '1-5',
      selectedPageCount: 5,
      sheetsNeeded: 5,
      unitPricePerPage: 2.0,
      subtotal: 10.0,
    },
    paymentMode: 'counter',
    paymentStatus: 'pay_at_counter',
    status: 'printing',
    statusHistory: [
      { status: 'new', timestamp: new Date(Date.now() - 25 * 60000).toISOString() },
      { status: 'approved', timestamp: new Date(Date.now() - 20 * 60000).toISOString() },
      { status: 'printing', timestamp: new Date(Date.now() - 5 * 60000).toISOString() },
    ],
    printedAt: new Date(Date.now() - 3 * 60000).toISOString(),
    purgeAt: new Date(Date.now() + 7 * 60000).toISOString(),
    createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: 'ORD-1035',
    orderNumber: 1035,
    shopId: 'sri-krishna-xerox',
    customerName: 'Divya Reddy',
    customerPhone: '+91 99887 76655',
    fileName: 'Placement_Resume_Final.pdf',
    fileSize: 850000,
    fileDataUrl: generateMinimalPdf('Placement Resume Final', 2),
    detectedPageCount: 2,
    config: {
      copies: 3,
      colorMode: 'color',
      paperSize: 'A4',
      sides: 'single',
      pageRangeType: 'all',
      customPageRange: '1-2',
      selectedPageCount: 2,
      sheetsNeeded: 2,
      unitPricePerPage: 8.0,
      subtotal: 48.0,
    },
    paymentMode: 'counter',
    paymentStatus: 'pay_at_counter',
    status: 'ready',
    statusHistory: [
      { status: 'new', timestamp: new Date(Date.now() - 40 * 60000).toISOString() },
      { status: 'approved', timestamp: new Date(Date.now() - 30 * 60000).toISOString() },
      { status: 'printing', timestamp: new Date(Date.now() - 20 * 60000).toISOString() },
      { status: 'ready', timestamp: new Date(Date.now() - 8 * 60000).toISOString(), note: 'In tray #2' },
    ],
    printedAt: new Date(Date.now() - 15 * 60000).toISOString(),
    purgeAt: new Date(Date.now() + 2 * 60000).toISOString(),
    createdAt: new Date(Date.now() - 40 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 60000).toISOString(),
  },
  {
    id: 'ORD-1037',
    orderNumber: 1037,
    shopId: 'balaji-xerox',
    customerName: 'Ananya Deshmukh',
    customerPhone: '+91 98445 67890',
    fileName: 'Scholarship_Application_Form_Filled.pdf',
    fileSize: 850000,
    fileDataUrl: generateMinimalPdf('Scholarship Application Form', 2),
    detectedPageCount: 2,
    config: {
      copies: 3,
      colorMode: 'color',
      paperSize: 'A4',
      sides: 'single',
      pageRangeType: 'all',
      customPageRange: '1-2',
      selectedPageCount: 2,
      sheetsNeeded: 2,
      unitPricePerPage: 10.0,
      subtotal: 60.0,
    },
    paymentMode: 'online',
    paymentStatus: 'paid',
    status: 'ready',
    statusHistory: [
      { status: 'new', timestamp: new Date(Date.now() - 40 * 60000).toISOString() },
      { status: 'approved', timestamp: new Date(Date.now() - 35 * 60000).toISOString() },
      { status: 'printing', timestamp: new Date(Date.now() - 30 * 60000).toISOString() },
      { status: 'ready', timestamp: new Date(Date.now() - 10 * 60000).toISOString() },
    ],
    downloadedAt: new Date(Date.now() - 8 * 60000).toISOString(),
    purgeAt: new Date(Date.now() + 2 * 60000).toISOString(),
    createdAt: new Date(Date.now() - 40 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60000).toISOString(),
  },
  {
    id: 'ORD-1036',
    orderNumber: 1036,
    shopId: 'vidyarthi-books',
    customerName: 'Vikram Singh',
    customerPhone: '+91 98556 78901',
    fileName: 'Identity_Card_Scan_Passport_Size.pdf',
    fileSize: 620000,
    fileDataUrl: undefined,
    isPurged: true,
    purgedAt: new Date(Date.now() - 50 * 60000).toISOString(),
    detectedPageCount: 1,
    config: {
      copies: 2,
      colorMode: 'color',
      paperSize: 'A4',
      sides: 'single',
      pageRangeType: 'all',
      customPageRange: '1',
      selectedPageCount: 1,
      sheetsNeeded: 1,
      unitPricePerPage: 10.0,
      subtotal: 20.0,
    },
    paymentMode: 'counter',
    paymentStatus: 'paid',
    status: 'completed',
    statusHistory: [
      { status: 'new', timestamp: new Date(Date.now() - 90 * 60000).toISOString() },
      { status: 'approved', timestamp: new Date(Date.now() - 85 * 60000).toISOString() },
      { status: 'completed', timestamp: new Date(Date.now() - 60 * 60000).toISOString() },
      { status: 'completed', timestamp: new Date(Date.now() - 50 * 60000).toISOString(), note: 'Auto-deleted PDF 10 minutes post-completion' },
    ],
    createdAt: new Date(Date.now() - 90 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 50 * 60000).toISOString(),
  },
];

// Audio chime for new incoming orders from phone
function playChime() {
  try {
    if (typeof window === 'undefined') return;
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // audio context muted or user hasn't interacted
  }
}

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

export function saveShop(shop: Shop): void {
  try {
    const raw = localStorage.getItem(SHOPS_KEY);
    const shops: Record<string, Shop> = raw ? JSON.parse(raw) : { ...INITIAL_SHOPS };
    shops[shop.id] = shop;
    localStorage.setItem(SHOPS_KEY, JSON.stringify(shops));
    notifyLocalUpdate();
    syncShopToFirestore(shop).catch(() => {});
  } catch (err) {
    console.error('Failed saving shop to localStorage', err);
  }
}

export function addNewStore(newShopData: Partial<Shop> & { name: string; ownerName?: string; ownerPhone?: string }): Shop {
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
    phone: newShopData.phone || newShopData.ownerPhone || '+91 98000 00000',
    ownerName: newShopData.ownerName || 'Store Manager',
    ownerPhone: newShopData.ownerPhone || newShopData.phone || '+91 98000 00000',
    loginId: newShopData.loginId || slug.replace(/-/g, '_'),
    passwordHash: newShopData.passwordHash || Math.floor(1000 + Math.random() * 9000).toString(),
    monthlySubscriptionFee: newShopData.monthlySubscriptionFee || 499,
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

  saveShop(createdShop);
  return createdShop;
}

export function deleteStore(shopId: string): void {
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

export function verifyStoreCredentials(shopIdOrSlug: string, loginId: string, secret: string): boolean {
  const shop = getShop(shopIdOrSlug);
  if (!shop) return false;
  const matchId = (shop.loginId || shop.slug || shop.id).trim().toLowerCase() === loginId.trim().toLowerCase();
  const matchSecret = (shop.passwordHash || '1234').trim() === secret.trim();
  return matchId && matchSecret;
}

export function getCityPlatformMetrics(): {
  totalShops: number;
  activeSubscriptions: number;
  monthlyRecurringRevenue: number;
  totalCityOrders: number;
  totalCityGrossSales: number;
  totalCityPagesPrinted: number;
} {
  const shops = getAllShops();
  const orders = getAllOrders();

  const activeSubs = shops.filter(s => s.subscriptionStatus === 'active' || s.subscriptionStatus === 'trial').length;
  const monthlyRecurringRevenue = shops.reduce((sum, s) => {
    return sum + (s.subscriptionStatus === 'active' ? (s.monthlySubscriptionFee || 499) : 0);
  }, 0);

  const totalCityGrossSales = orders.reduce((sum, o) => sum + (o.config?.subtotal || 0), 0);
  const totalCityPagesPrinted = orders.reduce((sum, o) => sum + (o.config?.selectedPageCount || 0) * (o.config?.copies || 1), 0);

  return {
    totalShops: shops.length,
    activeSubscriptions: activeSubs,
    monthlyRecurringRevenue,
    totalCityOrders: orders.length,
    totalCityGrossSales,
    totalCityPagesPrinted,
  };
}

export function getAllOrders(): Order[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) {
      localStorage.setItem(ORDERS_KEY, JSON.stringify(INITIAL_ORDERS));
      return INITIAL_ORDERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_ORDERS;
  } catch (err) {
    console.error('Failed reading orders from localStorage', err);
    return INITIAL_ORDERS;
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

export function createOrder(orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt' | 'status' | 'statusHistory'>): Order {
  const orders = getAllOrders();
  const maxNumber = orders.reduce((max, o) => Math.max(max, o.orderNumber || 1000), 1045);
  const nextNumber = maxNumber + 1;
  const nextId = `ORD-${nextNumber}`;
  const now = new Date().toISOString();

  const newOrder: Order = {
    ...orderData,
    id: nextId,
    orderNumber: nextNumber,
    status: 'new',
    statusHistory: [{ status: 'new', timestamp: now }],
    createdAt: now,
    updatedAt: now,
  };

  const updatedOrders = [newOrder, ...orders];
  localStorage.setItem(ORDERS_KEY, JSON.stringify(updatedOrders));
  notifyLocalUpdate();

  // Sync to Firestore cloud database
  syncOrderToFirestore(newOrder).catch(() => {});

  // Broadcast to all phones and computers across the internet
  broadcastToCloud(newOrder.shopId, {
    action: 'CREATE_ORDER',
    order: newOrder,
  });

  return newOrder;
}

export function updateOrderStatus(orderId: string, status: OrderStatus, note?: string): Order | undefined {
  const orders = getAllOrders();
  const index = findOrderIndex(orders, orderId);
  if (index === -1) return undefined;

  const now = new Date().toISOString();
  const existing = orders[index];
  const shop = getShop(existing.shopId);
  const retentionMs = (shop.retentionMinutes || 10) * 60000;

  let purgeAt = existing.purgeAt;
  if (['printing', 'ready', 'completed'].includes(status) && !purgeAt && !existing.isPurged) {
    purgeAt = new Date(Date.now() + retentionMs).toISOString();
  }

  const updated: Order = {
    ...existing,
    status,
    purgeAt,
    updatedAt: now,
    statusHistory: [
      ...existing.statusHistory,
      { status, timestamp: now, note },
    ],
  };

  orders[index] = updated;
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  notifyLocalUpdate();
  syncOrderToFirestore(updated).catch(() => {});

  // Broadcast status to the customer's phone over the internet
  broadcastToCloud(existing.shopId, {
    action: 'UPDATE_STATUS',
    orderId: existing.id,
    status,
    note,
    purgeAt,
  });

  return updated;
}

export function updateOrderFileUrl(orderId: string, url: string): void {
  const orders = getAllOrders();
  const index = findOrderIndex(orders, orderId);
  if (index !== -1) {
    orders[index].fileDownloadUrl = url;
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    notifyLocalUpdate();
    syncOrderToFirestore(orders[index]).catch(() => {});
  }
}

export function markOrderDownloaded(orderId: string): Order | undefined {
  const orders = getAllOrders();
  const index = findOrderIndex(orders, orderId);
  if (index === -1) return undefined;

  const now = new Date().toISOString();
  const existing = orders[index];
  const shop = getShop(existing.shopId);
  const retentionMs = (shop.retentionMinutes || 10) * 60000;
  const purgeAt = existing.purgeAt || new Date(Date.now() + retentionMs).toISOString();

  const updated: Order = {
    ...existing,
    downloadedAt: now,
    purgeAt,
    updatedAt: now,
    statusHistory: [
      ...existing.statusHistory,
      { status: existing.status, timestamp: now, note: `Document downloaded. Auto-delete scheduled in ${shop.retentionMinutes || 10} minutes.` },
    ],
  };

  orders[index] = updated;
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  notifyLocalUpdate();
  syncOrderToFirestore(updated).catch(() => {});

  broadcastToCloud(existing.shopId, {
    action: 'UPDATE_STATUS',
    orderId: existing.id,
    status: existing.status,
    purgeAt,
  });

  return updated;
}

export function markOrderPrinted(orderId: string): Order | undefined {
  const orders = getAllOrders();
  const index = findOrderIndex(orders, orderId);
  if (index === -1) return undefined;

  const now = new Date().toISOString();
  const existing = orders[index];
  const shop = getShop(existing.shopId);
  const retentionMs = (shop.retentionMinutes || 10) * 60000;
  const purgeAt = existing.purgeAt || new Date(Date.now() + retentionMs).toISOString();

  const updated: Order = {
    ...existing,
    status: 'printing',
    printedAt: now,
    purgeAt,
    updatedAt: now,
    statusHistory: [
      ...existing.statusHistory,
      { status: 'printing', timestamp: now, note: `Sent to printer. Auto-delete scheduled in ${shop.retentionMinutes || 10} minutes.` },
    ],
  };

  orders[index] = updated;
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  notifyLocalUpdate();
  syncOrderToFirestore(updated).catch(() => {});

  broadcastToCloud(existing.shopId, {
    action: 'UPDATE_STATUS',
    orderId: existing.id,
    status: 'printing',
    purgeAt,
  });

  return updated;
}

export function purgeOrderDocument(orderId: string, reason: string = '10-minute retention policy'): Order | undefined {
  const orders = getAllOrders();
  const index = findOrderIndex(orders, orderId);
  if (index === -1) return undefined;

  const now = new Date().toISOString();
  const existing = orders[index];

  const updated: Order = {
    ...existing,
    fileDataUrl: undefined,
    fileDownloadUrl: undefined,
    isPurged: true,
    purgedAt: now,
    updatedAt: now,
    statusHistory: [
      ...existing.statusHistory,
      { status: existing.status, timestamp: now, note: `Document PDF purged from database (${reason})` },
    ],
  };

  orders[index] = updated;
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  notifyLocalUpdate();
  syncOrderToFirestore(updated).catch(() => {});

  broadcastToCloud(existing.shopId, {
    action: 'PURGE_ORDER',
    orderId: existing.id,
  });

  return updated;
}

export function checkAndPurgeExpiredDocuments(): number {
  const orders = getAllOrders();
  const now = Date.now();
  let purgedCount = 0;

  const updated = orders.map(order => {
    if (!order.isPurged && order.purgeAt && now >= new Date(order.purgeAt).getTime()) {
      purgedCount++;
      return {
        ...order,
        fileDataUrl: undefined,
        fileDownloadUrl: undefined,
        isPurged: true,
        purgedAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
        statusHistory: [
          ...order.statusHistory,
          { status: order.status, timestamp: new Date(now).toISOString(), note: '10-minute auto-delete expired: PDF purged from database.' },
        ],
      };
    }
    return order;
  });

  if (purgedCount > 0) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
    notifyLocalUpdate();
  }

  return purgedCount;
}

// Background auto-purge sweep
if (typeof window !== 'undefined') {
  setInterval(() => {
    checkAndPurgeExpiredDocuments();
  }, 3000);
}

export function rejectOrder(orderId: string, reason: string): Order | undefined {
  const orders = getAllOrders();
  const index = findOrderIndex(orders, orderId);
  if (index === -1) return undefined;

  const now = new Date().toISOString();
  const existing = orders[index];
  const updated: Order = {
    ...existing,
    status: 'cancelled',
    rejectionReason: reason,
    fileDataUrl: undefined,
    isPurged: true,
    purgedAt: now,
    updatedAt: now,
    statusHistory: [
      ...existing.statusHistory,
      { status: 'cancelled', timestamp: now, note: `Rejected: ${reason}. PDF purged.` },
    ],
  };

  orders[index] = updated;
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  notifyLocalUpdate();

  broadcastToCloud(existing.shopId, {
    action: 'UPDATE_STATUS',
    orderId,
    status: 'cancelled',
    note: `Rejected: ${reason}`,
  });

  return updated;
}

export function requestClarification(orderId: string, note: string): Order | undefined {
  const orders = getAllOrders();
  const index = findOrderIndex(orders, orderId);
  if (index === -1) return undefined;

  const now = new Date().toISOString();
  const existing = orders[index];
  const updated: Order = {
    ...existing,
    status: 'review',
    clarificationNote: note,
    updatedAt: now,
    statusHistory: [
      ...existing.statusHistory,
      { status: 'review', timestamp: now, note: `Clarification requested: ${note}` },
    ],
  };

  orders[index] = updated;
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  notifyLocalUpdate();

  broadcastToCloud(existing.shopId, {
    action: 'UPDATE_STATUS',
    orderId,
    status: 'review',
    note,
  });

  return updated;
}

export function reviseOrderQuote(orderId: string, newTotal: number, reason: string): Order | undefined {
  const orders = getAllOrders();
  const index = findOrderIndex(orders, orderId);
  if (index === -1) return undefined;

  const now = new Date().toISOString();
  const existing = orders[index];
  const updated: Order = {
    ...existing,
    config: {
      ...existing.config,
      isRevisedQuote: true,
      revisedAmount: newTotal,
    },
    updatedAt: now,
    statusHistory: [
      ...existing.statusHistory,
      { status: existing.status, timestamp: now, note: `Quote revised to ₹${newTotal.toFixed(2)}: ${reason}` },
    ],
  };

  orders[index] = updated;
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  notifyLocalUpdate();

  return updated;
}

export function resetDemoData(): void {
  localStorage.removeItem(ORDERS_KEY);
  localStorage.removeItem(SHOPS_KEY);
  notifyLocalUpdate();
}

/**
 * Merges an order received from a smartphone over the cloud
 */
function handleIncomingCloudMessage(payload: CloudPayload) {
  const orders = getAllOrders();

  if (payload.action === 'CREATE_ORDER' && payload.order) {
    const incoming = payload.order;
    const exists = orders.some(o => o.id === incoming.id || o.orderNumber === incoming.orderNumber);
    if (!exists) {
      // Only fallback to minimal placeholder if neither real cloud file nor local file is present:
      if (!incoming.fileDataUrl && !incoming.fileDownloadUrl && !incoming.isPurged) {
        incoming.fileDataUrl = generateMinimalPdf(incoming.fileName, incoming.detectedPageCount);
      }
      const updated = [incoming, ...orders];
      localStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
      playChime();
      notifyLocalUpdate();
    }
  } else if (payload.action === 'UPDATE_STATUS' && payload.orderId && payload.status) {
    const index = orders.findIndex(o => o.id === payload.orderId || (payload.orderId && o.orderNumber === Number(payload.orderId.replace(/^ORD-/, ''))));
    if (index !== -1) {
      const existing = orders[index];
      const now = new Date().toISOString();
      orders[index] = {
        ...existing,
        status: payload.status,
        purgeAt: payload.purgeAt || existing.purgeAt,
        updatedAt: now,
        statusHistory: [
          ...existing.statusHistory,
          { status: payload.status, timestamp: now, note: payload.note },
        ],
      };
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
      notifyLocalUpdate();
    }
  } else if (payload.action === 'PURGE_ORDER' && payload.orderId) {
    const index = orders.findIndex(o => o.id === payload.orderId);
    if (index !== -1) {
      orders[index] = {
        ...orders[index],
        fileDataUrl: undefined,
        isPurged: true,
        purgedAt: new Date().toISOString(),
      };
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
      notifyLocalUpdate();
    }
  }
}

// Initialize Internet-wide Cloud & Firestore Sync
if (typeof window !== 'undefined') {
  // 1. Real-time Firestore listener across all bookstores in city
  try {
    listenToAllCityOrdersFromFirestore((firestoreOrders) => {
      if (firestoreOrders && firestoreOrders.length > 0) {
        const local = getAllOrders();
        const localMap = new Map(local.map(o => [o.id, o]));
        let hasChange = false;

        firestoreOrders.forEach(fo => {
          const existing = localMap.get(fo.id);
          if (!existing) {
            localMap.set(fo.id, fo);
            hasChange = true;
          } else if (new Date(fo.updatedAt || fo.createdAt).getTime() > new Date(existing.updatedAt || existing.createdAt).getTime()) {
            localMap.set(fo.id, { ...existing, ...fo });
            hasChange = true;
          }
        });

        if (hasChange) {
          const merged = Array.from(localMap.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          localStorage.setItem(ORDERS_KEY, JSON.stringify(merged));
          playChime();
          notifyLocalUpdate();
        }
      }
    });
  } catch (err) {
    console.warn('[Firestore Live Sync] Note:', err);
  }

  // 2. Resolve current store from URL (e.g. /s/sri-krishna-xerox)
  const path = window.location.pathname;
  const match = path.match(/^\/(?:s|shop)\/([a-zA-Z0-9_-]+)/);
  const activeShopId = match ? match[1] : (new URLSearchParams(window.location.search).get('shop') || 'campus-prints');

  // 3. Listen live via Server-Sent Events for this bookstore
  listenToCloud(activeShopId, (payload) => {
    handleIncomingCloudMessage(payload);
  });

  // 4. Poll recent cloud orders for this bookstore
  fetchRecentCloudOrders(activeShopId).then(history => {
    history.forEach(item => {
      handleIncomingCloudMessage(item);
    });
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
