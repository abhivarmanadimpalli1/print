import React, { useState, useId, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
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
import { isValidUpiId } from '../../lib/upi';
import { countPdfPages } from '../../lib/pdfPages';
import { MagneticDropZone } from './MagneticDropZone';
import { formatPageRanges, parsePageRange, splitPagesByFile } from '../../lib/pageRangeParser';
import { createOrder } from '../../lib/store';
import { maxOrderFileSize, removeOrderAttachmentPaths } from '../../lib/supabase';
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
  const acceptsUpi = Boolean(shop.upiId && isValidUpiId(shop.upiId) && shop.acceptedPaymentModes.includes('online'));
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Quick Order Tracking by Number (#1046)
  const [quickTrackInput, setQuickTrackInput] = useState<string>('');
  const recentOrderId = typeof window !== 'undefined' ? localStorage.getItem(`recent_order_id:${shop.id}`) : null;
  const recentOrderNum = typeof window !== 'undefined' ? localStorage.getItem(`recent_order_num:${shop.id}`) : null;

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

  const parsedRange = parsePageRange(pageRangeType === 'all' ? '' : customRange, totalPagesInDoc);
  const selectedPageCount = parsedRange.valid ? parsedRange.count : 0;
  const pagesPerFile = splitPagesByFile(docList.map(doc => doc.detectedPages), parsedRange.pages);
  const sheetsNeeded = pagesPerFile.reduce((sum, pages) => sum + (sides === 'duplex' ? Math.ceil(pages.length / 2) : pages.length), 0);

  // Rate calculation
  const baseRate = colorMode === 'color' ? shop.pricing.colorPerPage : shop.pricing.bwPerPage;
  const sizeOption = shop.pricing.paperSizes.find(p => p.id === paperSize);
  const sizeMultiplier = sizeOption ? sizeOption.multiplier : 1.0;
  
  const effectivePerPageRate = sides === 'duplex'
    ? (baseRate * shop.pricing.duplexRateRatio)
    : baseRate;

  const unitPrice = effectivePerPageRate * sizeMultiplier;
  const estimatedSubtotal = Math.max(0, unitPrice * selectedPageCount * copies);

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

      if (!dataUrl) throw new Error(`Could not read ${f.name}. Please select it again.`);
      let detectedPages = 1;
      if (isPdf) {
        try {
          detectedPages = await countPdfPages(await f.arrayBuffer());
        } catch {
          throw new Error(`Could not count pages in ${f.name}. Upload a readable PDF without a password so the print price can be calculated correctly.`);
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
    if (isPreparingFiles) return;
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
    } catch (error) {
      setDocList([]);
      setUploadError(error instanceof Error ? error.message : 'Could not read these documents. Please try again.');
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
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Could not read these documents. Please try again.');
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
      errors.file = 'Please upload at least one PDF or photo, and try again.';
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

  const handleSubmitOrder = async () => {
    if (isSubmitting || isPreparingFiles || !validateForm()) return;
    if (paymentChoice === 'online' && !acceptsUpi) { setSubmissionError('This shop has not enabled UPI. Choose Pay at Counter.'); return; }

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
      const files = await Promise.all(docList.map(async (doc) => {
        if (!doc.rawFile && !doc.dataUrl) throw new Error('File content is unavailable.');
        const blob = doc.rawFile ?? await (await fetch(doc.dataUrl ?? '')).blob();
        return { name: doc.name, blob };
      }));
      uploaded = await uploadOrderAttachments(shop.id, files);
      newOrder = await createOrder({
        shopId: shop.id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerNotes: customerNotes.trim() || undefined,
        fileName: primaryFileName,
        fileSize: totalSize,
        attachments: uploaded.map((file, index) => ({ ...file, pageCount: docList[index].detectedPages,
          printPageRange: formatPageRanges(pagesPerFile[index]), printPageCount: pagesPerFile[index].length })),
        detectedPageCount: totalPagesInDoc,
        config,
        paymentMode: paymentChoice,
        paymentStatus: paymentChoice === 'online' ? 'pending' : 'pay_at_counter',
        ...(paymentChoice === 'online' ? { upiPayment: {
          upiId: shop.upiId!.trim(), payeeName: shop.upiPayeeName?.trim() || shop.name,
          amount: estimatedSubtotal, reference: crypto.randomUUID().replaceAll('-', ''),
        } } : {}),
      });
    } catch (error) {
      void removeOrderAttachmentPaths(uploaded.map(file => file.storagePath)).catch(console.warn);
      setSubmissionError(error instanceof Error ? error.message : 'Could not submit the order. Please try again.');
      return;
    } finally {
      setIsSubmitting(false);
    }

    try {
      localStorage.setItem(`recent_order_id:${shop.id}`, newOrder.id);
      localStorage.setItem(`recent_order_num:${shop.id}`, String(newOrder.orderNumber));
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
        <Card className="text-center p-8 bg-[#242424] shadow-none border border-[#3d3d3d]">
          <div className="w-14 h-14 bg-[#163529] text-[#6ed5a3] rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <Badge status={submittedOrder.status} size="md" />

          <h2 className="text-2xl font-bold text-[#ffffff] mt-3">
            Order Submitted to Counter!
          </h2>
          <p className="text-sm text-[#b0b0b0] mt-1">
            Show this order reference at the {shop.name} counter.
          </p>

          <div className="my-6 p-4 rounded-none bg-[#1c1c1c] border border-[#3d3d3d] text-center">
            <span className="text-xs uppercase tracking-wider text-[#b0b0b0] font-semibold">Queue Reference Number</span>
            <div className="text-4xl font-extrabold text-[#ff8278] tracking-tight mt-1 font-mono">
              #{submittedOrder.orderNumber}
            </div>
            <p className="text-xs text-[#bcbcbc] mt-1 font-mono">ID: {submittedOrder.id}</p>
          </div>

          <div className="text-left space-y-2.5 text-xs border-t border-b border-[#3d3d3d] py-4 my-4">
            <div className="flex justify-between">
              <span className="text-[#b0b0b0]">Document:</span>
              <span className="font-medium text-[#ffffff] truncate max-w-[200px]">{submittedOrder.fileName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#b0b0b0]">Print Settings:</span>
              <span className="font-medium text-[#ffffff]">
                {submittedOrder.config.selectedPageCount} pgs × {submittedOrder.config.copies} copies • {submittedOrder.config.colorMode.toUpperCase()} • {submittedOrder.config.sides === 'duplex' ? 'Double-sided' : 'Single-sided'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#b0b0b0]">Estimated Total:</span>
              <span className="font-bold text-sm text-[#ffffff]">₹{submittedOrder.config.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#b0b0b0]">Payment:</span>
              <span className="font-semibold text-[#ff8278]">
                {submittedOrder.paymentMode === 'online' ? 'UPI payment pending' : 'Pay at Counter'}
              </span>
            </div>
          </div>

          {/* Retention notice */}
          <div className="p-3 bg-[#303030] border border-[#3d3d3d] rounded-none text-[11px] text-[#f3ba83] flex items-center gap-2 mb-6 text-left">
            <Shield className="w-4 h-4 shrink-0 text-[#f3ba83]" />
            <span>The signed-in counter clears files when their retention timer expires.</span>
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
    ? "max-w-7xl mx-auto py-8 sm:py-12 px-4 sm:px-6 lg:px-8"
    : "max-w-xl mx-auto py-6 px-4";

  return (
    <div className={containerClass}>
      
      <section className="order-intro" aria-labelledby="order-heading">
        <p className="eyebrow">YOUR FILES. YOUR WAY.</p>
        <h1 id="order-heading">Ready. Set. Print.</h1>
        <p>Upload your documents, choose your finish, and collect from the counter.</p>
        <div className="intro-meta"><span>01 / UPLOAD</span><span>02 / CUSTOMISE</span><span>03 / COLLECT</span></div>
      </section>
      {/* Free Platform Surcharge Banner */}
      <div className="mb-6 p-3 bg-[#163529] border border-[#1aae39]/30 rounded-none flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#6ed5a3]">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 shrink-0" />
          <span>
            <strong>No app fees.</strong> Pay the shop’s listed print price.
          </span>
        </div>
      </div>

      {/* Quick Order Tracking Banner (Find Order by #1046) */}
      <div className="mb-6 bg-[#303030] border border-[#da291c]/20 rounded-none p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-none">
        <div className="flex items-center gap-2.5 text-xs text-[#ffffff]">
          <div className="w-8 h-8 rounded-full bg-[#da291c] text-white flex items-center justify-center shrink-0">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold block text-sm">Already Placed a Print Order?</span>
            <span className="text-[#bcbcbc] text-[11px]">Enter your order number to check live queue status & view your official bill.</span>
          </div>
        </div>

        <form onSubmit={handleQuickTrack} className="flex items-center gap-1.5 w-full sm:w-auto">
          <input
            type="text"
            placeholder="e.g. 1046"
            value={quickTrackInput}
            onChange={(e) => setQuickTrackInput(e.target.value)}
            className="px-3 py-1.5 text-xs bg-[#242424] border border-[#606060] rounded-none focus:outline-none focus:ring-2 focus:ring-[#da291c] font-mono w-full sm:w-28 text-center font-bold"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!quickTrackInput.trim()}
            className="text-xs shrink-0 bg-[#da291c] whitespace-nowrap"
          >
            Track & Bill
          </Button>
        </form>
      </div>

      {/* Resume Previous Order if placed recently in this browser */}
      {recentOrderId && (
        <div className="bg-[#163529]/70 border border-[#1aae39]/30 rounded-none p-2.5 flex items-center justify-between text-xs text-[#6ed5a3]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Active print order in progress: <strong className="font-mono font-bold">#{recentOrderNum || recentOrderId}</strong></span>
          </div>
          <button
            type="button"
            onClick={() => onViewStatus(recentOrderId)}
            className="font-bold underline text-xs cursor-pointer hover:opacity-80 shrink-0 text-[#6ed5a3]"
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
          <Card className="bg-[#242424] border-[#3d3d3d]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-medium text-[#ffffff]">{shop.name}</h2>
                  <Badge variant={shop.isOpen ? 'mint' : 'rose'} size="sm">
                    {shop.isOpen ? 'Open' : 'Paused'}
                  </Badge>
                </div>
                <p className="text-xs text-[#b0b0b0] mt-0.5">{shop.location}</p>
                <p className="text-[11px] text-[#969696] mt-1">{shop.openingHours}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-[#b0b0b0] tracking-wider block">Base Rates</span>
                <div className="text-xs font-semibold text-[#ffffff] mt-0.5">
                  B&W: ₹{shop.pricing.bwPerPage.toFixed(1)}/pg
                </div>
                <div className="text-xs font-semibold text-[#ff8278]">
                  Color: ₹{shop.pricing.colorPerPage.toFixed(1)}/pg
                </div>
              </div>
            </div>

            {!shop.isOpen && (
              <div className="mt-3 p-3 bg-[#402321] border border-[#e03131]/30 rounded-none text-xs text-[#ff8278] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>The shop is currently pausing new online print jobs. Please visit the counter directly.</span>
              </div>
            )}
          </Card>

          {/* 1. Document Upload Section */}
          <Card className="bg-[#242424] border-[#3d3d3d] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#ffffff] flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#181818] text-white text-[11px] flex items-center justify-center font-bold">1</span>
                Upload Document or Image
              </h2>
              <span className="text-[11px] text-[#b0b0b0]">PDF, JPG, PNG (Max 50 MB)</span>
            </div>

            {docList.length === 0 ? (
              <div className="space-y-4">
                <MagneticDropZone
                  accept="image/*,.pdf"
                  maxSize={maxOrderFileSize}
                  multiple={true}
                  onFilesChange={handleDropZoneFilesChange}
                  files={[]}
                />

              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#ffffff] pb-2 border-b border-[#3d3d3d]">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#6ed5a3]" />
                    <span>Uploaded Documents ({docList.length})</span>
                  </span>
                  <span className="text-[#ff8278] font-mono text-[11px]">
                    {totalPagesInDoc} total pages • {(totalSize / 1024).toFixed(0)} KB
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {docList.map((docItem) => (
                    <div
                      key={docItem.id}
                      className="p-2.5 rounded-none bg-[#1c1c1c] border border-[#3d3d3d] flex items-center justify-between gap-3 hover:bg-[#303030] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {docItem.isImage && docItem.dataUrl ? (
                          <img
                            src={docItem.dataUrl}
                            alt={docItem.name}
                            className="w-9 h-9 object-cover rounded-none border border-[#3d3d3d] shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-none bg-[#303030] text-[#ff8278] flex items-center justify-center shrink-0">
                            {docItem.isImage ? (
                              <ImageSquareIcon size={20} weight="fill" />
                            ) : (
                              <FilePdfIcon size={20} weight="fill" />
                            )}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#ffffff] truncate">
                            {docItem.name}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-[#b0b0b0] mt-0.5">
                            <span>{(docItem.size / 1024).toFixed(0)} KB</span>
                            <span>•</span>
                            <span className="font-semibold text-[#ff8278]">
                              {docItem.isImage ? '1 page image' : `${docItem.detectedPages} pages`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveDoc(docItem.id)}
                        className="p-1.5 text-[#b0b0b0] hover:text-[#ff8278] hover:bg-[#402321] rounded-none transition-colors cursor-pointer shrink-0"
                        title="Remove this document"
                      >
                        <XIcon size={16} weight="bold" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#3d3d3d]">
                  <button
                    type="button"
                    onClick={() => addMoreInputRef.current?.click()}
                    disabled={isPreparingFiles || isSubmitting}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#ff8278] bg-[#303030] hover:bg-[#303030] px-3 py-1.5 rounded-none transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add More Documents / Photos</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearAllDocs}
                    className="text-xs text-[#b0b0b0] hover:text-[#ff8278] hover:underline cursor-pointer flex items-center gap-1"
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
              <p role="alert" className="text-xs text-[#ff8278] flex items-center gap-1.5 mt-2">
                <AlertCircle className="w-3.5 h-3.5" />
                {uploadError}
              </p>
            )}
            {formErrors.file && docList.length === 0 && (
              <p className="text-xs text-[#ff8278]">{formErrors.file}</p>
            )}
          </Card>

          {/* 2. Configure Print Options */}
          <Card className="bg-[#242424] border-[#3d3d3d] space-y-5">
            <h2 className="text-sm font-bold text-[#ffffff] flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#181818] text-white text-[11px] flex items-center justify-center font-bold">2</span>
              Print Configuration
            </h2>

            {/* Color Mode */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#bcbcbc] mb-1.5">
                Color Option
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setColorMode('bw')}
                  className={`p-3 border rounded-none text-left transition-all cursor-pointer ${
                    colorMode === 'bw'
                      ? 'border-[#da291c] bg-[#303030]/30 ring-1 ring-[#da291c]'
                      : 'border-[#3d3d3d] hover:bg-[#303030]'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-[#ffffff]">Black & White</span>
                    <span className="text-xs font-bold text-[#ffffff]">₹{shop.pricing.bwPerPage.toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-[#b0b0b0] mt-0.5">High-speed laser, lecture notes & text</p>
                </button>

                <button
                  type="button"
                  onClick={() => setColorMode('color')}
                  className={`p-3 border rounded-none text-left transition-all cursor-pointer ${
                    colorMode === 'color'
                      ? 'border-[#da291c] bg-[#303030]/30 ring-1 ring-[#da291c]'
                      : 'border-[#3d3d3d] hover:bg-[#303030]'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-[#ffffff]">Full Color</span>
                    <span className="text-xs font-bold text-[#ff8278]">₹{shop.pricing.colorPerPage.toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-[#b0b0b0] mt-0.5">Crisp diagrams, presentations, reports</p>
                </button>
              </div>
            </div>

            {/* Print Sides (Duplex / Simplex) */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#bcbcbc] mb-1.5">
                Print Sides
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSides('duplex')}
                  className={`p-3 border rounded-none text-left transition-all cursor-pointer ${
                    sides === 'duplex'
                      ? 'border-[#da291c] bg-[#303030]/30 ring-1 ring-[#da291c]'
                      : 'border-[#3d3d3d] hover:bg-[#303030]'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-[#ffffff]">Double-Sided</span>
                    <span className="text-[10px] font-semibold text-[#6ed5a3] bg-[#163529] px-1.5 py-0.2 rounded">Save Paper</span>
                  </div>
                  <p className="text-[11px] text-[#b0b0b0] mt-0.5">Standard notebook & thesis layout</p>
                </button>

                <button
                  type="button"
                  onClick={() => setSides('single')}
                  className={`p-3 border rounded-none text-left transition-all cursor-pointer ${
                    sides === 'single'
                      ? 'border-[#da291c] bg-[#303030]/30 ring-1 ring-[#da291c]'
                      : 'border-[#3d3d3d] hover:bg-[#303030]'
                  }`}
                >
                  <span className="text-xs font-semibold text-[#ffffff]">Single-Sided</span>
                  <p className="text-[11px] text-[#b0b0b0] mt-0.5">1 page per physical sheet</p>
                </button>
              </div>
            </div>

            {/* Paper Size & Copies */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#bcbcbc] mb-1.5">
                  Paper Size
                </label>
                <select
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                  className="w-full h-11 px-3 bg-[#242424] text-[#ffffff] text-xs font-medium rounded-none border border-[#606060] focus:border-[#da291c] outline-none"
                >
                  {shop.pricing.paperSizes.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.multiplier > 1 ? `(+${((p.multiplier - 1) * 100).toFixed(0)}%)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#bcbcbc] mb-1.5">
                  Copies
                </label>
                <div className="flex items-center h-11 border border-[#606060] rounded-none bg-[#242424] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCopies(Math.max(1, copies - 1))}
                    className="w-10 h-full text-base font-semibold text-[#bcbcbc] hover:bg-[#1c1c1c] cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="flex-1 text-center font-bold text-sm text-[#ffffff] border-none outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setCopies(copies + 1)}
                    className="w-10 h-full text-base font-semibold text-[#bcbcbc] hover:bg-[#1c1c1c] cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Page Range Selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#bcbcbc] mb-1.5">
                Page Range
              </label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setPageRangeType('all')}
                  className={`p-2.5 border rounded-none text-xs font-medium transition-all cursor-pointer ${
                    pageRangeType === 'all'
                      ? 'border-[#da291c] bg-[#303030]/30 text-[#ff8278] font-semibold'
                      : 'border-[#3d3d3d] text-[#bcbcbc] hover:bg-[#303030]'
                  }`}
                >
                  All Pages ({totalPagesInDoc})
                </button>
                <button
                  type="button"
                  onClick={() => setPageRangeType('custom')}
                  className={`p-2.5 border rounded-none text-xs font-medium transition-all cursor-pointer ${
                    pageRangeType === 'custom'
                      ? 'border-[#da291c] bg-[#303030]/30 text-[#ff8278] font-semibold'
                      : 'border-[#3d3d3d] text-[#bcbcbc] hover:bg-[#303030]'
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
          <Card className="bg-[#242424] border-[#3d3d3d] space-y-4">
            <h2 className="text-sm font-bold text-[#ffffff] flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#181818] text-white text-[11px] flex items-center justify-center font-bold">3</span>
              Pickup Contact
            </h2>

            <div className="space-y-3">
              <Input
                label="Your Full Name"
                autoComplete="name"
                placeholder="e.g. Aarav Sharma"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                error={formErrors.name}
              />

              <Input
                label="Mobile / WhatsApp Number"
                type="tel"
                autoComplete="tel"
                placeholder="e.g. +91 98112 34567"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                error={formErrors.phone}
                helperText="Lets the shop contact you about this order"
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#bcbcbc] mb-1.5">
                  Special Instructions (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Staple top-left, spiral binding if available"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  className="w-full h-11 px-3.5 bg-[#242424] text-[#ffffff] text-xs rounded-none border border-[#606060] focus:border-[#da291c] outline-none"
                />
              </div>
            </div>
          </Card>

        </div>

        {/* Right Column (5 cols on Desktop / Sticky Sidebar): Live Order Summary & Checkout */}
        <div className={isMobileFree ? "lg:col-span-5 space-y-4 lg:sticky lg:top-24 self-start" : "space-y-4"}>
          
          {/* Live Document Preview & Sheets Visualization */}
          <Card className="bg-[#242424] border-[#3d3d3d] p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#3d3d3d]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#bcbcbc] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#ff8278]" />
                Job Specifications
              </span>
              <span className="text-[11px] font-semibold text-[#6ed5a3] bg-[#163529] px-2 py-0.5 rounded-full">
                Zero Surcharge
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#3d3d3d]">
                <span className="text-[#b0b0b0]">Selected Document:</span>
                <span className="font-semibold text-[#ffffff] truncate max-w-[48%]">
                  {docList.length > 0 ? primaryFileName : 'No file selected yet'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#3d3d3d]">
                <span className="text-[#b0b0b0]">Pages to Print:</span>
                <span className="font-bold text-[#ffffff]">{selectedPageCount} page{selectedPageCount > 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#3d3d3d]">
                <span className="text-[#b0b0b0]">Physical Sheets Needed:</span>
                <span className="font-bold text-[#ff8278]">
                  {sheetsNeeded * copies} sheet{sheetsNeeded * copies > 1 ? 's' : ''} ({sides === 'duplex' ? 'Double-sided' : 'Single-sided'})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#3d3d3d]">
                <span className="text-[#b0b0b0]">Paper Size & Copies:</span>
                <span className="font-semibold text-[#ffffff]">{paperSize} • {copies} cop{copies > 1 ? 'ies' : 'y'}</span>
              </div>
            </div>
          </Card>

          {/* Transparent Itemized Price Estimate */}
          <Card tint="yellow-bold" className="pricing-panel border-none space-y-3 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[#bcbcbc]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#bcbcbc]">
                  Itemized Pricing
                </span>
              </div>
              <span className="text-[11px] font-semibold text-[#bcbcbc] bg-white/70 px-2 py-0.5 rounded-full">
                Transparent Formula
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-[#dedede]">
              <div className="flex justify-between">
                <span>Print cost ({selectedPageCount} pgs × ₹{unitPrice.toFixed(2)}):</span>
                <span className="font-semibold">₹{(unitPrice * selectedPageCount * copies).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#6ed5a3]">
                <span>Online platform fee:</span>
                <span className="font-bold">₹0.00 (FREE)</span>
              </div>
              <div className="border-t border-[#bcbcbc]/20 pt-2 flex justify-between items-baseline font-bold text-base text-[#ffffff]">
                <span>Payable Amount:</span>
                <span className="text-3xl text-[#ffffff]">₹{estimatedSubtotal.toFixed(2)}</span>
              </div>
            </div>

            <p className="text-[11px] text-[#bcbcbc] leading-tight pt-1">
              * Shopkeeper verifies page density and paper stock before starting the physical print.
            </p>
          </Card>

          {/* Payment Method Selector */}
          <Card className="bg-[#242424] border-[#3d3d3d] p-5 space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#bcbcbc]">
              Payment Preference
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentChoice('counter')}
                className={`p-3 border rounded-none text-left transition-all cursor-pointer ${
                  paymentChoice === 'counter'
                    ? 'border-[#da291c] bg-[#303030]/30 ring-1 ring-[#da291c]'
                    : 'border-[#3d3d3d] hover:bg-[#303030]'
                }`}
              >
                <p className="text-xs font-semibold text-[#ffffff]">Pay at Counter</p>
                <p className="text-[11px] text-[#b0b0b0] mt-0.5">Cash / UPI when picking up</p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentChoice('online')}
                disabled={!acceptsUpi}
                aria-describedby={!acceptsUpi ? 'upi-unavailable' : undefined}
                className={`p-3 border rounded-none text-left transition-all cursor-pointer ${
                  paymentChoice === 'online'
                    ? 'border-[#da291c] bg-[#303030]/30 ring-1 ring-[#da291c]'
                    : 'border-[#3d3d3d] hover:bg-[#303030]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#ffffff]">Pay Online</span>
                  <span className="text-[9px] font-mono text-[#ff8278] bg-[#303030] px-1 rounded">UPI</span>
                </div>
                <p className="text-[11px] text-[#b0b0b0] mt-0.5">{acceptsUpi ? 'Pay the shop by UPI / QR' : 'Not enabled by this shop'}</p>
              </button>
            </div>

            {!acceptsUpi && <p id="upi-unavailable" className="text-xs text-[#bcbcbc]">This shop currently accepts payment at the counter.</p>}
            {/* Submit Button */}
            <div className="pt-2">
              <Button
                variant="primary"
                className="w-full text-base font-semibold py-3 shadow-none"
                disabled={!shop.isOpen || isSubmitting || isPreparingFiles}
                onClick={() => {
                  if (validateForm()) {
                    void handleSubmitOrder();
                  }
                }}
                icon={<ChevronRight className="w-5 h-5" />}
              >
                {isSubmitting ? 'Uploading files…' : isPreparingFiles ? 'Preparing files…' : paymentChoice === 'online'
                  ? `Proceed to Payment (₹${estimatedSubtotal.toFixed(2)})`
                  : `Submit Print Order (₹${estimatedSubtotal.toFixed(2)})`}
              </Button>
              {submissionError && <p role="alert" className="mt-2 text-xs text-[#ff8278]">{submissionError}</p>}
            </div>
          </Card>

          {/* Privacy & 10-Minute Auto-Purge Notice */}
          <div className="p-3 bg-[#242424] border border-[#3d3d3d] rounded-none text-[11px] text-[#bcbcbc] flex items-center gap-2">
            <Shield className="w-4 h-4 shrink-0 text-[#6ed5a3]" />
            <span>
              Ask the counter about document retention before uploading sensitive files.
            </span>
          </div>

        </div>

      </div>


    </div>
  );
};
