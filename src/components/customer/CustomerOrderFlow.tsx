import React, { useState, useId, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  HelpCircle,
  Info,
  ChevronRight,
  Layers,
  Zap,
  Search,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  FilePdfIcon,
  ImageSquareIcon,
  XIcon,
} from '@phosphor-icons/react';
import confetti from 'canvas-confetti';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { PaymentModal } from './PaymentModal';
import { MagneticDropZone } from './MagneticDropZone';
import { parsePageRange } from '../../lib/pageRangeParser';
import { createOrder } from '../../lib/store';
import { generateMinimalPdf } from '../../lib/samplePdf';
import { maxOrderFileSize, removeOrderAttachmentPaths, supportsPrivateUploads } from '../../lib/supabase';
import { uploadLegacyFile } from '../../lib/cloudSync';
import { uploadOrderAttachments } from '../../lib/orderAttachments';
import type { Shop, PrintJobConfig, ColorMode, PrintSides, PaperSize, PageRangeType, PaymentChoice, Order } from '../../types';

interface CustomerOrderFlowProps {
  shop: Shop;
  onOrderSubmitted: (order: Order) => void;
  onViewStatus: (orderId: string) => void;
  isMobileFree?: boolean; // Desktop widescreen layout
}

export interface UploadedDocItem {
  id: string;
  name: string;
  size: number;
  detectedPages: number;
  dataUrl?: string;
  isImage: boolean;
  rawFile?: File;
}

export const CustomerOrderFlow: React.FC<CustomerOrderFlowProps> = ({
  shop,
  onOrderSubmitted,
  onViewStatus,
  isMobileFree = true,
}) => {
  const addMoreInputId = useId();
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  // Multi-File Upload State
  const [docList, setDocList] = useState<UploadedDocItem[]>([]);
  const [isPreparingFiles, setIsPreparingFiles] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Configuration State
  const [copies, setCopies] = useState<number>(1);
  const [colorMode, setColorMode] = useState<ColorMode>('bw');
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [sides, setSides] = useState<PrintSides>('duplex');
  const [pageRangeType, setPageRangeType] = useState<PageRangeType>('all');
  const [customRange, setCustomRange] = useState<string>('');

  // Contact & Submission State
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerNotes, setCustomerNotes] = useState<string>('');
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>('counter');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Payment Modal & Confirmation
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Quick Order Tracking by Number (#1046)
  const [quickTrackInput, setQuickTrackInput] = useState<string>('');
  const recentOrderId = typeof window !== 'undefined' ? localStorage.getItem('recent_order_id') : null;
  const recentOrderNum = typeof window !== 'undefined' ? localStorage.getItem('recent_order_num') : null;

  const handleQuickTrack = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = quickTrackInput.trim();
    if (q) {
      onViewStatus(q);
    }
  };

  // Calculation Logic across all documents
  const totalPagesInDoc = docList.reduce((sum, d) => sum + (d.detectedPages || 1), 0) || 1;
  const totalSize = docList.reduce((sum, d) => sum + d.size, 0);
  const primaryFileName = docList.length === 1
    ? docList[0].name
    : docList.length > 1
    ? `${docList.length} files`
    : '';

  const parsedRange = pageRangeType === 'all'
    ? { valid: true, count: totalPagesInDoc }
    : parsePageRange(customRange, totalPagesInDoc);

  const selectedPageCount = parsedRange.valid ? parsedRange.count : 0;
  
  // Duplex sheets calculation: ceil(pages / 2)
  const sheetsNeeded = sides === 'duplex'
    ? Math.ceil(selectedPageCount / 2)
    : selectedPageCount;

  // Rate calculation
  const baseRate = colorMode === 'color' ? shop.pricing.colorPerPage : shop.pricing.bwPerPage;
  const sizeOption = shop.pricing.paperSizes.find(p => p.id === paperSize);
  const sizeMultiplier = sizeOption ? sizeOption.multiplier : 1.0;
  
  const effectivePerPageRate = sides === 'duplex'
    ? (baseRate * shop.pricing.duplexRateRatio)
    : baseRate;

  const unitPrice = effectivePerPageRate * sizeMultiplier;
  const estimatedSubtotal = Math.max(0, unitPrice * selectedPageCount * copies);

  // Quick Preset Document Loader
  const loadPresetFile = (name: string, pages: number, sizeKB: number) => {
    setUploadError(null);
    const presetItem: UploadedDocItem = {
      id: `preset_${Date.now()}`,
      name,
      size: sizeKB * 1024,
      detectedPages: pages,
      dataUrl: generateMinimalPdf(name, pages),
      isImage: false,
    };
    setDocList([presetItem]);
    setCustomRange(`1-${pages}`);
  };

  // Process incoming files from Magnetic DropZone or file input
  const processFiles = async (incomingFiles: File[]): Promise<UploadedDocItem[]> => {
    const oversized = incomingFiles.find(file => file.size > maxOrderFileSize);
    if (oversized) {
      setUploadError(`${oversized.name} exceeds the 50 MB limit.`);
      return [];
    }
    setUploadError(null);
    const items: UploadedDocItem[] = [];

    for (const f of incomingFiles) {
      const isPdf = f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf';
      const isImage = f.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(f.name);

      if (!isPdf && !isImage) continue;

      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(f);
      });

      let detectedPages = 1;
      if (isPdf && dataUrl) {
        try {
          const matches = dataUrl.match(/\/Type\s*\/Page\b/g);
          if (matches && matches.length > 0) {
            detectedPages = matches.length;
          } else {
            detectedPages = Math.max(1, Math.min(60, Math.round(f.size / 65000)));
          }
        } catch {
          detectedPages = 1;
        }
      }

      items.push({
        id: crypto.randomUUID(),
        name: f.name,
        size: f.size,
        detectedPages,
        dataUrl,
        isImage,
        rawFile: f,
      });
    }

    return items;
  };

  const handleDropZoneFilesChange = async (filesFromZone: File[]) => {
    if (filesFromZone.length === 0) {
      setDocList([]);
      return;
    }
    setIsPreparingFiles(true);
    try {
      const processed = await processFiles(filesFromZone);
      setDocList(processed);
      const sumPgs = processed.reduce((sum, d) => sum + d.detectedPages, 0);
      setCustomRange(`1-${sumPgs || 1}`);
    } finally {
      setIsPreparingFiles(false);
    }
  };

  const handleAddMoreFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const moreFiles = Array.from(e.target.files || []);
    if (moreFiles.length === 0) return;
    e.target.value = '';
    setIsPreparingFiles(true);
    try {
      const processed = await processFiles(moreFiles);
      setDocList(prev => {
        const next = [...prev, ...processed];
        const sumPgs = next.reduce((sum, d) => sum + d.detectedPages, 0);
        setCustomRange(`1-${sumPgs || 1}`);
        return next;
      });
    } finally {
      setIsPreparingFiles(false);
    }
  };

  const handleRemoveDoc = (id: string) => {
    setDocList(prev => {
      const next = prev.filter(d => d.id !== id);
      const sumPgs = next.reduce((sum, d) => sum + d.detectedPages, 0);
      setCustomRange(`1-${sumPgs || 1}`);
      return next;
    });
  };

  const handleClearAllDocs = () => {
    setDocList([]);
    setCustomRange('');
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (docList.length === 0) {
      errors.file = 'Please upload at least one PDF or photo, or choose a sample file.';
    }

    if (pageRangeType === 'custom' && (!parsedRange.valid || parsedRange.count <= 0)) {
      errors.range = parsedRange.error || 'Please specify a valid page range.';
    }

    if (!customerName.trim()) {
      errors.name = 'Please enter your name for counter identification.';
    }

    if (!customerPhone.trim() || customerPhone.trim().length < 8) {
      errors.phone = 'Please provide a valid mobile or WhatsApp number for order status updates.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitOrder = async (isOnlinePaid = false) => {
    if (isSubmitting || isPreparingFiles || !validateForm()) return;

    const config: PrintJobConfig = {
      copies,
      colorMode,
      paperSize,
      sides,
      pageRangeType,
      customPageRange: pageRangeType === 'custom' ? customRange : `1-${totalPagesInDoc}`,
      selectedPageCount,
      sheetsNeeded: sheetsNeeded * copies,
      unitPricePerPage: unitPrice,
      subtotal: estimatedSubtotal,
    };

    setIsSubmitting(true);
    setSubmissionError(null);
    let uploaded: Awaited<ReturnType<typeof uploadOrderAttachments>> = [];
    let newOrder: Order;
    try {
      const privateUploads = await supportsPrivateUploads(shop.id);
      if (!privateUploads && docList.length > 1) {
        throw new Error('This counter currently accepts one file per order. Submit each file separately.');
      }
      const files = await Promise.all(docList.map(async (doc) => {
        if (!doc.rawFile && !doc.dataUrl) throw new Error('File content is unavailable.');
        const blob = doc.rawFile ?? await (await fetch(doc.dataUrl ?? '')).blob();
        return { name: doc.name, blob };
      }));
      if (privateUploads) uploaded = await uploadOrderAttachments(shop.id, files);
      const fileDownloadUrl = privateUploads || !docList[0].rawFile
        ? undefined
        : await uploadLegacyFile(shop.id, files[0].name, files[0].blob);
      newOrder = await createOrder({
        shopId: shop.id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerNotes: customerNotes.trim() || undefined,
        fileName: primaryFileName,
        fileSize: totalSize,
        attachments: privateUploads ? uploaded : undefined,
        fileDownloadUrl,
        fileDataUrl: !privateUploads && !fileDownloadUrl ? docList[0].dataUrl : undefined,
        detectedPageCount: totalPagesInDoc,
        config,
        paymentMode: isOnlinePaid ? 'online' : 'counter',
        paymentStatus: isOnlinePaid ? 'paid' : 'pay_at_counter',
      });
    } catch (error) {
      void removeOrderAttachmentPaths(uploaded.map(file => file.storagePath)).catch(console.warn);
      setSubmissionError(error instanceof Error ? error.message : 'Could not submit the order. Please try again.');
      return;
    } finally {
      setIsSubmitting(false);
    }

    try {
      localStorage.setItem('recent_order_id', newOrder.id);
      localStorage.setItem('recent_order_num', String(newOrder.orderNumber));
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.7 },
      });
    } catch {
      // fallback
    }

    setSubmittedOrder(newOrder);
    onOrderSubmitted(newOrder);
    onViewStatus(newOrder.id);

  };

  // If order was just submitted, display confirmation screen
  if (submittedOrder) {
    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <Card className="text-center p-8 bg-white shadow-sm border border-[#e5e3df]">
          <div className="w-14 h-14 bg-[#d9f3e1] text-[#1aae39] rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <Badge status={submittedOrder.status} size="md" />

          <h2 className="text-2xl font-bold text-[#1a1a1a] mt-3">
            Order Submitted to Counter!
          </h2>
          <p className="text-sm text-[#787671] mt-1">
            Show this order reference at the {shop.name} counter.
          </p>

          <div className="my-6 p-4 rounded-[8px] bg-[#f6f5f4] border border-[#e5e3df] text-center">
            <span className="text-xs uppercase tracking-wider text-[#787671] font-semibold">Queue Reference Number</span>
            <div className="text-4xl font-extrabold text-[#5645d4] tracking-tight mt-1 font-mono">
              #{submittedOrder.orderNumber}
            </div>
            <p className="text-xs text-[#5d5b54] mt-1 font-mono">ID: {submittedOrder.id}</p>
          </div>

          <div className="text-left space-y-2.5 text-xs border-t border-b border-[#e5e3df] py-4 my-4">
            <div className="flex justify-between">
              <span className="text-[#787671]">Document:</span>
              <span className="font-medium text-[#1a1a1a] truncate max-w-[200px]">{submittedOrder.fileName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#787671]">Print Settings:</span>
              <span className="font-medium text-[#1a1a1a]">
                {submittedOrder.config.selectedPageCount} pgs × {submittedOrder.config.copies} copies • {submittedOrder.config.colorMode.toUpperCase()} • {submittedOrder.config.sides === 'duplex' ? 'Double-sided' : 'Single-sided'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#787671]">Estimated Total:</span>
              <span className="font-bold text-sm text-[#1a1a1a]">₹{submittedOrder.config.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#787671]">Payment:</span>
              <span className="font-semibold text-[#5645d4]">
                {submittedOrder.paymentStatus === 'paid' ? 'Paid Online [Sandbox]' : 'Pay at Counter'}
              </span>
            </div>
          </div>

          {/* Retention notice */}
          <div className="p-3 bg-[#f8f5e8] border border-[#e5e3df] rounded-[8px] text-[11px] text-[#523410] flex items-center gap-2 mb-6 text-left">
            <Shield className="w-4 h-4 shrink-0 text-[#dd5b00]" />
            <span>The counter removes files after the 10-minute retention period.</span>
          </div>

          <div className="space-y-2.5">
            <Button
              variant="primary"
              className="w-full"
              onClick={() => onViewStatus(submittedOrder.id)}
              icon={<Clock className="w-4 h-4" />}
            >
              Track Live Order Status
            </Button>
            <Button
              variant="secondary"
              className="w-full text-xs"
              onClick={() => {
                setSubmittedOrder(null);
                setDocList([]);
              }}
            >
              Print Another Document
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Widescreen (Mobile-Free) & Adaptive Layout:
  const containerClass = isMobileFree
    ? "max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8"
    : "max-w-xl mx-auto py-6 px-4";

  return (
    <div className={containerClass}>
      
      {/* Free Platform Surcharge Banner */}
      <div className="mb-6 p-3 bg-[#d9f3e1] border border-[#1aae39]/30 rounded-[12px] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#1aae39]">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 shrink-0" />
          <span>
            <strong>100% Free Self-Service:</strong> Zero app fees, zero student surcharges. Direct shop counter pricing only!
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider bg-white/80 px-2 py-0.5 rounded-full text-[#1aae39]">
          Free Student Pilot
        </span>
      </div>

      {/* Quick Order Tracking Banner (Find Order by #1046) */}
      <div className="bg-[#f0edfa] border border-[#5645d4]/20 rounded-[12px] p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5 text-xs text-[#0a1530]">
          <div className="w-8 h-8 rounded-full bg-[#5645d4] text-white flex items-center justify-center shrink-0">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold block text-sm">Already Placed a Print Order?</span>
            <span className="text-[#5d5b54] text-[11px]">Enter your order number to check live queue status & view your official bill.</span>
          </div>
        </div>

        <form onSubmit={handleQuickTrack} className="flex items-center gap-1.5 w-full sm:w-auto">
          <input
            type="text"
            placeholder="e.g. 1046"
            value={quickTrackInput}
            onChange={(e) => setQuickTrackInput(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-[#c8c4be] rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#5645d4] font-mono w-full sm:w-28 text-center font-bold"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!quickTrackInput.trim()}
            className="text-xs shrink-0 bg-[#5645d4] whitespace-nowrap"
          >
            Track & Bill
          </Button>
        </form>
      </div>

      {/* Resume Previous Order if placed recently in this browser */}
      {recentOrderId && (
        <div className="bg-[#d9f3e1]/70 border border-[#1aae39]/30 rounded-[10px] p-2.5 flex items-center justify-between text-xs text-[#1aae39]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Active print order in progress: <strong className="font-mono font-bold">#{recentOrderNum || recentOrderId}</strong></span>
          </div>
          <button
            type="button"
            onClick={() => onViewStatus(recentOrderId)}
            className="font-bold underline text-xs cursor-pointer hover:opacity-80 shrink-0 text-[#169431]"
          >
            View Bill & Status →
          </button>
        </div>
      )}

      {/* Main Grid: Responsive 2-Columns on Desktop (Mobile-Free), 1-Column on Mobile */}
      <div className={isMobileFree ? "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" : "space-y-6"}>
        
        {/* Left Column (7 cols): Document Upload & Configuration */}
        <div className={isMobileFree ? "lg:col-span-7 space-y-6" : "space-y-6"}>
          
          {/* Shop Header (Visible on Mobile or Mobile-Free) */}
          <Card className="bg-white border-[#e5e3df]">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-[#1a1a1a]">{shop.name}</h1>
                  <Badge variant={shop.isOpen ? 'mint' : 'rose'} size="sm">
                    {shop.isOpen ? 'Open' : 'Paused'}
                  </Badge>
                </div>
                <p className="text-xs text-[#787671] mt-0.5">{shop.location}</p>
                <p className="text-[11px] text-[#a4a097] mt-1">{shop.openingHours}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-[#787671] tracking-wider block">Base Rates</span>
                <div className="text-xs font-semibold text-[#1a1a1a] mt-0.5">
                  B&W: ₹{shop.pricing.bwPerPage.toFixed(1)}/pg
                </div>
                <div className="text-xs font-semibold text-[#5645d4]">
                  Color: ₹{shop.pricing.colorPerPage.toFixed(1)}/pg
                </div>
              </div>
            </div>

            {!shop.isOpen && (
              <div className="mt-3 p-3 bg-[#fde0ec] border border-[#e03131]/30 rounded-[8px] text-xs text-[#e03131] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>The shop is currently pausing new online print jobs. Please visit the counter directly.</span>
              </div>
            )}
          </Card>

          {/* 1. Document Upload Section */}
          <Card className="bg-white border-[#e5e3df] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#1a1a1a] flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#0a1530] text-white text-[11px] flex items-center justify-center font-bold">1</span>
                Upload Document or Image
              </h2>
              <span className="text-[11px] text-[#787671]">PDF, JPG, PNG (Max 50 MB)</span>
            </div>

            {docList.length === 0 ? (
              <div className="space-y-4">
                <MagneticDropZone
                  accept="image/*,.pdf"
                  maxSize={maxOrderFileSize}
                  multiple={true}
                  onFilesChange={handleDropZoneFilesChange}
                />

                {/* Quick Demo Preloaded Files */}
                <div className="pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#787671] mb-2 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-[#5645d4]" />
                    Or test with one-click sample files:
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => loadPresetFile('OS_Lecture_Notes_Unit_1.pdf', 14, 210)}
                      className="p-2 border border-[#e5e3df] rounded-[8px] bg-white hover:bg-[#f6f5f4] text-left transition-colors cursor-pointer"
                    >
                      <p className="text-[11px] font-medium text-[#1a1a1a] truncate">Lecture Notes</p>
                      <p className="text-[10px] text-[#787671]">14 pages • B&W</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => loadPresetFile('Design_Project_Report.pdf', 6, 95)}
                      className="p-2 border border-[#e5e3df] rounded-[8px] bg-white hover:bg-[#f6f5f4] text-left transition-colors cursor-pointer"
                    >
                      <p className="text-[11px] font-medium text-[#1a1a1a] truncate">Project Report</p>
                      <p className="text-[10px] text-[#787671]">6 pages • Color</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => loadPresetFile('Resume_2026_Standard.pdf', 2, 45)}
                      className="p-2 border border-[#e5e3df] rounded-[8px] bg-white hover:bg-[#f6f5f4] text-left transition-colors cursor-pointer"
                    >
                      <p className="text-[11px] font-medium text-[#1a1a1a] truncate">Resume</p>
                      <p className="text-[10px] text-[#787671]">2 pages • Quick</p>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#1a1a1a] pb-2 border-b border-[#e5e3df]">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#1aae39]" />
                    <span>Uploaded Documents ({docList.length})</span>
                  </span>
                  <span className="text-[#5645d4] font-mono text-[11px]">
                    {totalPagesInDoc} total pages • {(totalSize / 1024).toFixed(0)} KB
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {docList.map((docItem) => (
                    <div
                      key={docItem.id}
                      className="p-2.5 rounded-[10px] bg-[#f6f5f4] border border-[#e5e3df] flex items-center justify-between gap-3 hover:bg-[#fafaf9] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {docItem.isImage && docItem.dataUrl ? (
                          <img
                            src={docItem.dataUrl}
                            alt={docItem.name}
                            className="w-9 h-9 object-cover rounded-[6px] border border-[#e5e3df] shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-[8px] bg-[#e6e0f5] text-[#5645d4] flex items-center justify-center shrink-0">
                            {docItem.isImage ? (
                              <ImageSquareIcon size={20} weight="fill" />
                            ) : (
                              <FilePdfIcon size={20} weight="fill" />
                            )}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#1a1a1a] truncate max-w-[220px] sm:max-w-[280px]">
                            {docItem.name}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-[#787671] mt-0.5">
                            <span>{(docItem.size / 1024).toFixed(0)} KB</span>
                            <span>•</span>
                            <span className="font-semibold text-[#5645d4]">
                              {docItem.isImage ? '1 page image' : `${docItem.detectedPages} pages`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveDoc(docItem.id)}
                        className="p-1.5 text-[#787671] hover:text-[#e03131] hover:bg-[#fde0ec] rounded-[6px] transition-colors cursor-pointer shrink-0"
                        title="Remove this document"
                      >
                        <XIcon size={16} weight="bold" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#e5e3df]">
                  <button
                    type="button"
                    onClick={() => addMoreInputRef.current?.click()}
                    disabled={isPreparingFiles || isSubmitting}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5645d4] bg-[#f0edfa] hover:bg-[#e6e0f5] px-3 py-1.5 rounded-[8px] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add More Documents / Photos</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearAllDocs}
                    className="text-xs text-[#787671] hover:text-[#e03131] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All</span>
                  </button>

                  <input
                    ref={addMoreInputRef}
                    id={addMoreInputId}
                    type="file"
                    multiple
                    accept="application/pdf,.pdf,image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={handleAddMoreFiles}
                  />
                </div>
              </div>
            )}

            {uploadError && (
              <p className="text-xs text-[#e03131] flex items-center gap-1.5 mt-2">
                <AlertCircle className="w-3.5 h-3.5" />
                {uploadError}
              </p>
            )}
            {formErrors.file && docList.length === 0 && (
              <p className="text-xs text-[#e03131]">{formErrors.file}</p>
            )}
          </Card>

          {/* 2. Configure Print Options */}
          <Card className="bg-white border-[#e5e3df] space-y-5">
            <h2 className="text-sm font-bold text-[#1a1a1a] flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0a1530] text-white text-[11px] flex items-center justify-center font-bold">2</span>
              Print Configuration
            </h2>

            {/* Color Mode */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5d5b54] mb-1.5">
                Color Option
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setColorMode('bw')}
                  className={`p-3 border rounded-[8px] text-left transition-all cursor-pointer ${
                    colorMode === 'bw'
                      ? 'border-[#5645d4] bg-[#e6e0f5]/30 ring-1 ring-[#5645d4]'
                      : 'border-[#e5e3df] hover:bg-[#fafaf9]'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-[#1a1a1a]">Black & White</span>
                    <span className="text-xs font-bold text-[#1a1a1a]">₹{shop.pricing.bwPerPage.toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-[#787671] mt-0.5">High-speed laser, lecture notes & text</p>
                </button>

                <button
                  type="button"
                  onClick={() => setColorMode('color')}
                  className={`p-3 border rounded-[8px] text-left transition-all cursor-pointer ${
                    colorMode === 'color'
                      ? 'border-[#5645d4] bg-[#e6e0f5]/30 ring-1 ring-[#5645d4]'
                      : 'border-[#e5e3df] hover:bg-[#fafaf9]'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-[#1a1a1a]">Full Color</span>
                    <span className="text-xs font-bold text-[#5645d4]">₹{shop.pricing.colorPerPage.toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-[#787671] mt-0.5">Crisp diagrams, presentations, reports</p>
                </button>
              </div>
            </div>

            {/* Print Sides (Duplex / Simplex) */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5d5b54] mb-1.5">
                Print Sides
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSides('duplex')}
                  className={`p-3 border rounded-[8px] text-left transition-all cursor-pointer ${
                    sides === 'duplex'
                      ? 'border-[#5645d4] bg-[#e6e0f5]/30 ring-1 ring-[#5645d4]'
                      : 'border-[#e5e3df] hover:bg-[#fafaf9]'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-[#1a1a1a]">Double-Sided</span>
                    <span className="text-[10px] font-semibold text-[#1aae39] bg-[#d9f3e1] px-1.5 py-0.2 rounded">Save Paper</span>
                  </div>
                  <p className="text-[11px] text-[#787671] mt-0.5">Standard notebook & thesis layout</p>
                </button>

                <button
                  type="button"
                  onClick={() => setSides('single')}
                  className={`p-3 border rounded-[8px] text-left transition-all cursor-pointer ${
                    sides === 'single'
                      ? 'border-[#5645d4] bg-[#e6e0f5]/30 ring-1 ring-[#5645d4]'
                      : 'border-[#e5e3df] hover:bg-[#fafaf9]'
                  }`}
                >
                  <span className="text-xs font-semibold text-[#1a1a1a]">Single-Sided</span>
                  <p className="text-[11px] text-[#787671] mt-0.5">1 page per physical sheet</p>
                </button>
              </div>
            </div>

            {/* Paper Size & Copies */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5d5b54] mb-1.5">
                  Paper Size
                </label>
                <select
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                  className="w-full h-11 px-3 bg-white text-[#1a1a1a] text-xs font-medium rounded-[8px] border border-[#c8c4be] focus:border-[#5645d4] outline-none"
                >
                  {shop.pricing.paperSizes.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.multiplier > 1 ? `(+${((p.multiplier - 1) * 100).toFixed(0)}%)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5d5b54] mb-1.5">
                  Copies
                </label>
                <div className="flex items-center h-11 border border-[#c8c4be] rounded-[8px] bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCopies(Math.max(1, copies - 1))}
                    className="w-10 h-full text-base font-semibold text-[#5d5b54] hover:bg-[#f6f5f4] cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="flex-1 text-center font-bold text-sm text-[#1a1a1a] border-none outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setCopies(copies + 1)}
                    className="w-10 h-full text-base font-semibold text-[#5d5b54] hover:bg-[#f6f5f4] cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Page Range Selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5d5b54] mb-1.5">
                Page Range
              </label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setPageRangeType('all')}
                  className={`p-2.5 border rounded-[8px] text-xs font-medium transition-all cursor-pointer ${
                    pageRangeType === 'all'
                      ? 'border-[#5645d4] bg-[#e6e0f5]/30 text-[#5645d4] font-semibold'
                      : 'border-[#e5e3df] text-[#5d5b54] hover:bg-[#fafaf9]'
                  }`}
                >
                  All Pages ({totalPagesInDoc})
                </button>
                <button
                  type="button"
                  onClick={() => setPageRangeType('custom')}
                  className={`p-2.5 border rounded-[8px] text-xs font-medium transition-all cursor-pointer ${
                    pageRangeType === 'custom'
                      ? 'border-[#5645d4] bg-[#e6e0f5]/30 text-[#5645d4] font-semibold'
                      : 'border-[#e5e3df] text-[#5d5b54] hover:bg-[#fafaf9]'
                  }`}
                >
                  Custom Selection
                </button>
              </div>

              {pageRangeType === 'custom' && (
                <div>
                  <Input
                    placeholder="e.g. 1-4, 7, 9-11"
                    value={customRange}
                    onChange={(e) => setCustomRange(e.target.value)}
                    error={formErrors.range || (!parsedRange.valid ? parsedRange.error : undefined)}
                    helperText={`Detected document length: ${totalPagesInDoc} pages`}
                  />
                </div>
              )}
            </div>

          </Card>

          {/* 3. Customer Details Form */}
          <Card className="bg-white border-[#e5e3df] space-y-4">
            <h2 className="text-sm font-bold text-[#1a1a1a] flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0a1530] text-white text-[11px] flex items-center justify-center font-bold">3</span>
              Pickup Contact
            </h2>

            <div className="space-y-3">
              <Input
                label="Your Full Name"
                placeholder="e.g. Aarav Sharma"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                error={formErrors.name}
              />

              <Input
                label="Mobile / WhatsApp Number"
                placeholder="e.g. +91 98112 34567"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                error={formErrors.phone}
                helperText="Used to ping you when your print is ready at the counter"
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5d5b54] mb-1.5">
                  Special Instructions (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Staple top-left, spiral binding if available"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  className="w-full h-11 px-3.5 bg-white text-[#1a1a1a] text-xs rounded-[8px] border border-[#c8c4be] focus:border-[#5645d4] outline-none"
                />
              </div>
            </div>
          </Card>

        </div>

        {/* Right Column (5 cols on Desktop / Sticky Sidebar): Live Order Summary & Checkout */}
        <div className={isMobileFree ? "lg:col-span-5 space-y-4 sticky top-20" : "space-y-4"}>
          
          {/* Live Document Preview & Sheets Visualization */}
          <Card className="bg-white border-[#e5e3df] p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e5e3df]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5d5b54] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#5645d4]" />
                Job Specifications
              </span>
              <span className="text-[11px] font-semibold text-[#1aae39] bg-[#d9f3e1] px-2 py-0.5 rounded-full">
                Zero Surcharge
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#e5e3df]">
                <span className="text-[#787671]">Selected Document:</span>
                <span className="font-semibold text-[#1a1a1a] truncate max-w-[190px]">
                  {docList.length > 0 ? primaryFileName : 'No file selected yet'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#e5e3df]">
                <span className="text-[#787671]">Pages to Print:</span>
                <span className="font-bold text-[#1a1a1a]">{selectedPageCount} page{selectedPageCount > 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#e5e3df]">
                <span className="text-[#787671]">Physical Sheets Needed:</span>
                <span className="font-bold text-[#5645d4]">
                  {sheetsNeeded * copies} sheet{sheetsNeeded * copies > 1 ? 's' : ''} ({sides === 'duplex' ? 'Double-sided' : 'Single-sided'})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#e5e3df]">
                <span className="text-[#787671]">Paper Size & Copies:</span>
                <span className="font-semibold text-[#1a1a1a]">{paperSize} • {copies} cop{copies > 1 ? 'ies' : 'y'}</span>
              </div>
            </div>
          </Card>

          {/* Transparent Itemized Price Estimate */}
          <Card tint="yellow-bold" className="border-none space-y-3 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[#793400]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#793400]">
                  Itemized Pricing
                </span>
              </div>
              <span className="text-[11px] font-semibold text-[#793400] bg-white/70 px-2 py-0.5 rounded-full">
                Transparent Formula
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-[#37352f]">
              <div className="flex justify-between">
                <span>Print cost ({selectedPageCount} pgs × ₹{unitPrice.toFixed(2)}):</span>
                <span className="font-semibold">₹{(unitPrice * selectedPageCount * copies).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#1aae39]">
                <span>Online platform fee:</span>
                <span className="font-bold">₹0.00 (FREE)</span>
              </div>
              <div className="border-t border-[#793400]/20 pt-2 flex justify-between items-baseline font-bold text-base text-[#1a1a1a]">
                <span>Payable Amount:</span>
                <span className="text-3xl text-[#0a1530]">₹{estimatedSubtotal.toFixed(2)}</span>
              </div>
            </div>

            <p className="text-[11px] text-[#793400] leading-tight pt-1">
              * Shopkeeper verifies page density and paper stock before starting the physical print.
            </p>
          </Card>

          {/* Payment Method Selector */}
          <Card className="bg-white border-[#e5e3df] p-5 space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5d5b54]">
              Payment Preference
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentChoice('counter')}
                className={`p-3 border rounded-[8px] text-left transition-all cursor-pointer ${
                  paymentChoice === 'counter'
                    ? 'border-[#5645d4] bg-[#e6e0f5]/30 ring-1 ring-[#5645d4]'
                    : 'border-[#e5e3df] hover:bg-[#fafaf9]'
                }`}
              >
                <p className="text-xs font-semibold text-[#1a1a1a]">Pay at Counter</p>
                <p className="text-[11px] text-[#787671] mt-0.5">Cash / UPI when picking up</p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentChoice('online')}
                className={`p-3 border rounded-[8px] text-left transition-all cursor-pointer ${
                  paymentChoice === 'online'
                    ? 'border-[#5645d4] bg-[#e6e0f5]/30 ring-1 ring-[#5645d4]'
                    : 'border-[#e5e3df] hover:bg-[#fafaf9]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1a1a1a]">Pay Online</span>
                  <span className="text-[9px] font-mono text-[#5645d4] bg-[#e6e0f5] px-1 rounded">PROTOTYPE</span>
                </div>
                <p className="text-[11px] text-[#787671] mt-0.5">Instant sandbox UPI/Card</p>
              </button>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                variant="primary"
                className="w-full text-base font-semibold py-3 shadow-md"
                disabled={!shop.isOpen || isSubmitting || isPreparingFiles}
                onClick={() => {
                  if (validateForm()) {
                    if (paymentChoice === 'online') {
                      setShowPaymentModal(true);
                    } else {
                      handleSubmitOrder(false);
                    }
                  }
                }}
                icon={<ChevronRight className="w-5 h-5" />}
              >
                {isSubmitting ? 'Uploading files…' : isPreparingFiles ? 'Preparing files…' : paymentChoice === 'online'
                  ? `Proceed to Payment (₹${estimatedSubtotal.toFixed(2)})`
                  : `Submit Print Order (₹${estimatedSubtotal.toFixed(2)})`}
              </Button>
              {submissionError && <p role="alert" className="mt-2 text-xs text-red-700">{submissionError}</p>}
            </div>
          </Card>

          {/* Privacy & 10-Minute Auto-Purge Notice */}
          <div className="p-3 bg-white border border-[#e5e3df] rounded-[10px] text-[11px] text-[#5d5b54] flex items-center gap-2">
            <Shield className="w-4 h-4 shrink-0 text-[#1aae39]" />
            <span>
              Ask the counter about document retention before uploading sensitive files.
            </span>
          </div>

        </div>

      </div>

      {/* Online Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          amount={estimatedSubtotal}
          customerName={customerName}
          onSuccess={() => {
            setShowPaymentModal(false);
            handleSubmitOrder(true);
          }}
          onCancel={() => setShowPaymentModal(false)}
          onSwitchToCounter={() => {
            setShowPaymentModal(false);
            setPaymentChoice('counter');
            handleSubmitOrder(false);
          }}
        />
      )}

    </div>
  );
};
