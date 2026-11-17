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
  multiplier: number;
}

export interface ShopPricing {
  bwPerPage: number;
  colorPerPage: number;
  duplexRateRatio: number;
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
  retentionMinutes: number;
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
  fileDataUrl?: string;      // local base64 data URL
  fileDownloadUrl?: string;  // cloud URL to the REAL uploaded PDF file
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
  purgeAt?: string;
  isPurged?: boolean;
  purgedAt?: string;
}
