export type ColorMode = 'bw' | 'color';
export type PrintSides = 'single' | 'duplex';
export type PaperSize = 'A4' | 'A3' | 'Letter' | 'Legal';
export type PageRangeType = 'all' | 'custom';
export type PaymentChoice = 'counter' | 'online';
export type PaymentStatus = 'pending' | 'paid' | 'pay_at_counter';

export type OrderStatus =
  | 'new'
  | 'review'
  | 'approved'
  | 'printing'
  | 'ready'
  | 'completed'
  | 'cancelled';

export interface PaperSizeOption {
  id: PaperSize;
  name: string;
  multiplier: number; // e.g. 1.0 for A4, 2.0 for A3
}

export interface ShopPricing {
  bwPerPage: number;          // e.g. ₹2.00 / page
  colorPerPage: number;       // e.g. ₹10.00 / page
  duplexRateRatio: number;    // e.g. 0.9 (slight discount on double sided) or 1.0
  paperSizes: PaperSizeOption[];
}

export interface Shop {
  id: string;
  name: string;
  tagline: string;
  location: string;
  phone: string;
  isOpen: boolean;
  openingHours: string;
  pricing: ShopPricing;
  acceptedPaymentModes: PaymentChoice[];
  retentionMinutes: number;   // e.g. 10 minutes auto-delete post-download/print
  qrCodeUrl: string;
}

export interface PrintJobConfig {
  copies: number;
  colorMode: ColorMode;
  paperSize: PaperSize;
  sides: PrintSides;
  pageRangeType: PageRangeType;
  customPageRange: string;
  selectedPageCount: number;
  sheetsNeeded: number;
  unitPricePerPage: number;
  subtotal: number;
  isRevisedQuote?: boolean;
  revisedAmount?: number;
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  shopId: string;
  customerName: string;
  customerPhone: string;
  customerNotes?: string;
  fileName: string;
  fileSize: number;
  fileDataUrl?: string; // stored for demo downloading / printing, purged after 10m
  detectedPageCount: number;
  config: PrintJobConfig;
  paymentMode: PaymentChoice;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  statusHistory: StatusHistoryEntry[];
  rejectionReason?: string;
  clarificationNote?: string;
  createdAt: string;
  updatedAt: string;
  // 10-Minute Auto-Purge Lifecycle
  downloadedAt?: string;
  printedAt?: string;
  purgeAt?: string;       // ISO timestamp when document binary is purged
  isPurged?: boolean;     // true when binary payload is removed from database
  purgedAt?: string;
}
